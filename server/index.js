import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { parse } from "csv-parse/sync";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ override: true });

const { Pool } = pg;
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DATABASE_URL = process.env.DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
    })
  : null;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 240);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function validateSale(row) {
  const required = ["sale_date", "client", "region", "salesperson", "product", "category"];
  for (const key of required) {
    if (!String(row[key] || "").trim()) return `${key} is required`;
  }
  if (toNumber(row.quantity, 0) <= 0) return "quantity must be greater than 0";
  if (toNumber(row.cost, 0) < 0) return "cost cannot be negative";
  if (toNumber(row.price, 0) < 0) return "price cannot be negative";
  if (toNumber(row.cost_vat_rate, 0) < 0 || toNumber(row.cost_vat_rate, 0) > 100) return "cost_vat_rate must be between 0 and 100";
  if (toNumber(row.sale_vat_rate, 0) < 0 || toNumber(row.sale_vat_rate, 0) > 100) return "sale_vat_rate must be between 0 and 100";
  return null;
}

function requireDb(_req, res, next) {
  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL is not configured. Neon database is required for API mode." });
  }
  next();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, company_id: user.company_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function managerOnly(req, res, next) {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Manager or admin role required" });
  }
  next();
}

app.get("/api/health", async (_req, res) => {
  if (!pool) return res.json({ ok: false, database: "not_configured" });
  try {
    await pool.query("select 1");
    res.json({ ok: true, database: "neon-postgresql" });
  } catch (error) {
    res.status(503).json({ ok: false, database: "unavailable", error: error.message });
  }
});

app.post("/api/setup", requireDb, async (req, res) => {
  const { company_name, full_name, email, password } = req.body;
  if (!company_name || !email || !password) {
    return res.status(400).json({ error: "company_name, email and password are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const existing = await client.query("select id from users_app where email = $1", [email.toLowerCase()]);
    if (existing.rowCount) {
      await client.query("rollback");
      return res.status(409).json({ error: "User already exists" });
    }

    const company = await client.query(
      "insert into companies (name) values ($1) returning id, name",
      [company_name]
    );

    const hash = await bcrypt.hash(password, 12);
    const user = await client.query(
      `insert into users_app (company_id, email, password_hash, full_name, role)
       values ($1, $2, $3, $4, 'admin')
       returning id, company_id, email, full_name, role`,
      [company.rows[0].id, email.toLowerCase(), hash, full_name || null]
    );

    await client.query("commit");
    const token = signToken(user.rows[0]);
    res.json({ token, user: user.rows[0], company: company.rows[0] });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", requireDb, async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    "select id, company_id, email, password_hash, full_name, role from users_app where email = $1",
    [String(email || "").toLowerCase()]
  );

  if (!result.rowCount) return res.status(401).json({ error: "Invalid login" });

  const user = result.rows[0];
  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid login" });

  delete user.password_hash;
  res.json({ token: signToken(user), user });
});

app.get("/api/me", requireDb, auth, async (req, res) => {
  const user = await pool.query(
    `select u.id, u.company_id, u.email, u.full_name, u.role,
            c.name as company_name, c.currency, c.default_region, c.report_note,
            c.company_address, c.company_tax_id, c.company_registration_id, c.company_bank_account
     from users_app u
     left join companies c on c.id = u.company_id
     where u.id = $1`,
    [req.user.id]
  );
  res.json({ user: user.rows[0] });
});


app.get("/api/stats", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    `select
      coalesce(sum(quantity * price), 0)::float as revenue,
      coalesce(sum(quantity * price * (1 + sale_vat_rate / 100)), 0)::float as revenue_gross,
      coalesce(sum(quantity * (price - cost)), 0)::float as profit,
      coalesce(sum((quantity * price * sale_vat_rate / 100) - (quantity * cost * cost_vat_rate / 100)), 0)::float as tax_payable,
      coalesce(sum(quantity), 0)::float as units,
      count(*)::int as transactions,
      count(distinct client)::int as clients,
      count(distinct region)::int as regions,
      count(distinct salesperson)::int as salespeople
     from sales_records
     where company_id=$1`,
    [req.user.company_id]
  );
  res.json({ stats: result.rows[0] });
});


// v13 customers
app.get("/api/customers", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "select * from customers where company_id=$1 order by name",
    [req.user.company_id]
  );
  res.json({ customers: result.rows });
});

app.post("/api/customers", requireDb, auth, managerOnly, async (req, res) => {
  const c = req.body;
  if (!cleanText(c.name)) return res.status(400).json({ error: "Customer name is required" });
  const result = await pool.query(
    `insert into customers (company_id, name, email, phone, address, tax_id, region)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [req.user.company_id, cleanText(c.name), cleanText(c.email, null), cleanText(c.phone, null), cleanText(c.address, null), cleanText(c.tax_id, null), cleanText(c.region, null)]
  );
  res.status(201).json({ customer: result.rows[0] });
});

app.put("/api/customers/:id", requireDb, auth, managerOnly, async (req, res) => {
  const c = req.body;
  if (!cleanText(c.name)) return res.status(400).json({ error: "Customer name is required" });
  const result = await pool.query(
    `update customers set name=$1, email=$2, phone=$3, address=$4, tax_id=$5, region=$6
     where id=$7 and company_id=$8 returning *`,
    [cleanText(c.name), cleanText(c.email, null), cleanText(c.phone, null), cleanText(c.address, null), cleanText(c.tax_id, null), cleanText(c.region, null), req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Customer not found" });
  res.json({ customer: result.rows[0] });
});

app.delete("/api/customers/:id", requireDb, auth, managerOnly, async (req, res) => {
  const result = await pool.query(
    "delete from customers where id=$1 and company_id=$2 returning id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Customer not found" });
  res.json({ ok: true });
});

// v13 products
app.get("/api/products", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "select * from products where company_id=$1 order by name",
    [req.user.company_id]
  );
  res.json({ products: result.rows });
});

app.post("/api/products", requireDb, auth, managerOnly, async (req, res) => {
  const p = req.body;
  if (!cleanText(p.name)) return res.status(400).json({ error: "Product name is required" });
  const result = await pool.query(
    `insert into products (company_id, name, category, default_cost, default_price, tax_country, tax_category, cost_vat_rate, sale_vat_rate)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [req.user.company_id, cleanText(p.name), cleanText(p.category, null), toNumber(p.default_cost, 0), toNumber(p.default_price, 0), cleanText(p.tax_country || "custom"), cleanText(p.tax_category || "standard"), toNumber(p.cost_vat_rate, 0), toNumber(p.sale_vat_rate, 0)]
  );
  res.status(201).json({ product: result.rows[0] });
});

app.put("/api/products/:id", requireDb, auth, managerOnly, async (req, res) => {
  const p = req.body;
  if (!cleanText(p.name)) return res.status(400).json({ error: "Product name is required" });
  const result = await pool.query(
    `update products set name=$1, category=$2, default_cost=$3, default_price=$4, tax_country=$5, tax_category=$6, cost_vat_rate=$7, sale_vat_rate=$8
     where id=$9 and company_id=$10 returning *`,
    [cleanText(p.name), cleanText(p.category, null), toNumber(p.default_cost, 0), toNumber(p.default_price, 0), cleanText(p.tax_country || "custom"), cleanText(p.tax_category || "standard"), toNumber(p.cost_vat_rate, 0), toNumber(p.sale_vat_rate, 0), req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Product not found" });
  res.json({ product: result.rows[0] });
});

app.delete("/api/products/:id", requireDb, auth, managerOnly, async (req, res) => {
  const result = await pool.query(
    "delete from products where id=$1 and company_id=$2 returning id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Product not found" });
  res.json({ ok: true });
});



// v14 invoices

// v17 expenses
app.get("/api/expenses", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "select * from expenses where company_id=$1 order by expense_date desc, created_at desc",
    [req.user.company_id]
  );
  res.json({ expenses: result.rows });
});

app.post("/api/expenses", requireDb, auth, async (req, res) => {
  const e = req.body;
  const net = toNumber(e.net_amount, 0);
  const vat = toNumber(e.vat_rate, 0);
  if (net < 0) return res.status(400).json({ error: "net_amount cannot be negative" });
  if (vat < 0 || vat > 100) return res.status(400).json({ error: "vat_rate must be between 0 and 100" });

  const result = await pool.query(
    `insert into expenses (company_id, expense_date, supplier, category, description, net_amount, vat_rate)
     values ($1,coalesce($2::date,current_date),$3,$4,$5,$6,$7)
     returning *`,
    [
      req.user.company_id,
      e.expense_date || null,
      cleanText(e.supplier, null),
      cleanText(e.category, null),
      cleanText(e.description, null),
      net,
      vat
    ]
  );
  res.status(201).json({ expense: result.rows[0] });
});

app.put("/api/expenses/:id", requireDb, auth, async (req, res) => {
  const e = req.body;
  const net = toNumber(e.net_amount, 0);
  const vat = toNumber(e.vat_rate, 0);
  if (net < 0) return res.status(400).json({ error: "net_amount cannot be negative" });
  if (vat < 0 || vat > 100) return res.status(400).json({ error: "vat_rate must be between 0 and 100" });

  const result = await pool.query(
    `update expenses
     set expense_date=coalesce($1::date,current_date), supplier=$2, category=$3, description=$4, net_amount=$5, vat_rate=$6
     where id=$7 and company_id=$8
     returning *`,
    [
      e.expense_date || null,
      cleanText(e.supplier, null),
      cleanText(e.category, null),
      cleanText(e.description, null),
      net,
      vat,
      req.params.id,
      req.user.company_id
    ]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Expense not found" });
  res.json({ expense: result.rows[0] });
});

app.delete("/api/expenses/:id", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "delete from expenses where id=$1 and company_id=$2 returning id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Expense not found" });
  res.json({ ok: true });
});

app.get("/api/cashflow", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    `select
      coalesce((select sum(s.quantity * s.price * (1 + s.sale_vat_rate / 100)) from sales_records s where s.company_id=$1),0)::float as invoiced_total,
      coalesce((select sum(amount) from invoice_payments p where p.company_id=$1),0)::float as paid_total,
      coalesce((select sum(gross_amount) from expenses e where e.company_id=$1),0)::float as expenses_total,
      coalesce((select sum(net_amount * vat_rate / 100) from expenses e where e.company_id=$1),0)::float as expense_vat,
      (
        coalesce((select sum(amount) from invoice_payments p where p.company_id=$1),0)
        - coalesce((select sum(gross_amount) from expenses e where e.company_id=$1),0)
      )::float as cash_balance
    `,
    [req.user.company_id]
  );
  res.json({ cashflow: result.rows[0] });
});


app.get("/api/invoices", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    `select i.*, s.client, s.product, s.sale_date,
       case
         when i.status = 'paid' then 'paid'
         when i.due_date is not null and i.due_date < current_date then 'overdue'
         else i.status
       end as display_status
     from invoices i
     left join sales_records s on s.id = i.sale_record_id
     where i.company_id=$1
     order by i.created_at desc`,
    [req.user.company_id]
  );
  res.json({ invoices: result.rows });
});



app.get("/api/invoices/:id/payments", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    `select * from invoice_payments
     where invoice_id=$1 and company_id=$2
     order by payment_date desc, created_at desc`,
    [req.params.id, req.user.company_id]
  );
  res.json({ payments: result.rows });
});

app.post("/api/invoices/:id/payments", requireDb, auth, async (req, res) => {
  const amount = toNumber(req.body.amount, 0);
  if (amount <= 0) return res.status(400).json({ error: "Payment amount must be greater than 0" });

  const inv = await pool.query(
    "select id from invoices where id=$1 and company_id=$2",
    [req.params.id, req.user.company_id]
  );
  if (!inv.rowCount) return res.status(404).json({ error: "Invoice not found" });

  const result = await pool.query(
    `insert into invoice_payments (company_id, invoice_id, amount, payment_date, method, note)
     values ($1,$2,$3,coalesce($4::date,current_date),$5,$6)
     returning *`,
    [
      req.user.company_id,
      req.params.id,
      amount,
      req.body.payment_date || null,
      cleanText(req.body.method, null),
      cleanText(req.body.note, null)
    ]
  );

  await pool.query(
    `update invoices
     set status = 'paid',
         paid_at = case when paid_at is null then current_date else paid_at end
     where id=$1 and company_id=$2
       and (
         select coalesce(sum(amount),0)
         from invoice_payments
         where invoice_id=$1 and company_id=$2
       ) >= (
         select coalesce(s.quantity * s.price * (1 + s.sale_vat_rate / 100),0)
         from invoices i
         join sales_records s on s.id=i.sale_record_id
         where i.id=$1 and i.company_id=$2
       )`,
    [req.params.id, req.user.company_id]
  );

  res.status(201).json({ payment: result.rows[0] });
});

app.delete("/api/invoice-payments/:id", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "delete from invoice_payments where id=$1 and company_id=$2 returning invoice_id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Payment not found" });
  res.json({ ok: true, invoice_id: result.rows[0].invoice_id });
});


app.put("/api/invoices/:id/status", requireDb, auth, async (req, res) => {
  const status = cleanText(req.body.status || "issued").toLowerCase();
  const allowed = ["issued", "sent", "paid", "cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid invoice status" });

  const paidAt = status === "paid" ? "current_date" : "null";
  const result = await pool.query(
    `update invoices
     set status=$1, paid_at=${paidAt}
     where id=$2 and company_id=$3
     returning *`,
    [status, req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Invoice not found" });
  res.json({ invoice: result.rows[0] });
});


app.post("/api/invoices", requireDb, auth, async (req, res) => {
  const { sale_record_id, due_days } = req.body;
  if (!sale_record_id) return res.status(400).json({ error: "sale_record_id is required" });

  const sale = await pool.query(
    "select id from sales_records where id=$1 and company_id=$2",
    [sale_record_id, req.user.company_id]
  );
  if (!sale.rowCount) return res.status(404).json({ error: "Sale record not found" });

  const existing = await pool.query(
    "select * from invoices where company_id=$1 and sale_record_id=$2",
    [req.user.company_id, sale_record_id]
  );
  if (existing.rowCount) return res.json({ invoice: existing.rows[0] });

  const year = new Date().getFullYear();
  const countResult = await pool.query(
    "select count(*)::int as count from invoices where company_id=$1 and invoice_number like $2",
    [req.user.company_id, `INV-${year}-%`]
  );
  const seq = String(Number(countResult.rows[0].count || 0) + 1).padStart(4, "0");
  const invoiceNumber = `INV-${year}-${seq}`;
  const days = Number.isFinite(Number(due_days)) ? Number(due_days) : 14;

  const result = await pool.query(
    `insert into invoices (company_id, sale_record_id, invoice_number, issue_date, due_date, status)
     values ($1,$2,$3,current_date,current_date + ($4 || ' days')::interval,'issued')
     returning *`,
    [req.user.company_id, sale_record_id, invoiceNumber, days]
  );
  res.status(201).json({ invoice: result.rows[0] });
});


app.get("/api/sales", requireDb, auth, async (req, res) => {
  const { region, category, salesperson, from, to } = req.query;
  const params = [req.user.company_id];
  const where = ["company_id = $1"];

  if (region) {
    params.push(region);
    where.push(`region = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (salesperson) {
    params.push(salesperson);
    where.push(`salesperson = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`sale_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`sale_date <= $${params.length}`);
  }

  const result = await pool.query(
    `select *,
      (quantity * price) as revenue_net,
      (quantity * price * sale_vat_rate / 100) as sale_tax,
      (quantity * price * (1 + sale_vat_rate / 100)) as revenue_gross,
      (quantity * cost) as cost_net,
      (quantity * cost * cost_vat_rate / 100) as cost_tax,
      (quantity * cost * (1 + cost_vat_rate / 100)) as cost_gross,
      (quantity * (price - cost)) as profit_net,
      ((quantity * price * sale_vat_rate / 100) - (quantity * cost * cost_vat_rate / 100)) as tax_payable,
      (quantity * price) as revenue,
      (quantity * (price - cost)) as profit
     from sales_records
     where ${where.join(" and ")}
     order by sale_date desc, created_at desc`,
    params
  );

  res.json({ rows: result.rows });
});

app.post("/api/sales", requireDb, auth, async (req, res) => {
  const row = req.body;
  const validationError = validateSale(row);
  if (validationError) return res.status(400).json({ error: validationError });

  const result = await pool.query(
    `insert into sales_records
     (company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price, cost_vat_rate, sale_vat_rate, tax_country, tax_category)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning *`,
    [
      req.user.company_id,
      req.user.id,
      row.sale_date,
      row.client,
      row.region,
      row.salesperson,
      row.product,
      row.category,
      Number(row.quantity || 1),
      Number(row.cost || 0),
      Number(row.price || 0),
      Number(row.cost_vat_rate || 0),
      Number(row.sale_vat_rate || 0),
      row.tax_country || "custom",
      row.tax_category || "standard"
    ]
  );

  res.status(201).json({ row: result.rows[0] });
});

app.put("/api/sales/:id", requireDb, auth, managerOnly, async (req, res) => {
  const row = req.body;
  const validationError = validateSale(row);
  if (validationError) return res.status(400).json({ error: validationError });

  const result = await pool.query(
    `update sales_records set
      sale_date=$1, client=$2, region=$3, salesperson=$4, product=$5, category=$6,
      quantity=$7, cost=$8, price=$9, cost_vat_rate=$10, sale_vat_rate=$11, tax_country=$12, tax_category=$13
     where id=$14 and company_id=$15
     returning *`,
    [
      row.sale_date, row.client, row.region, row.salesperson, row.product, row.category,
      Number(row.quantity || 1), Number(row.cost || 0), Number(row.price || 0),
      req.params.id, req.user.company_id
    ]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Record not found" });
  res.json({ row: result.rows[0] });
});

app.delete("/api/sales/:id", requireDb, auth, managerOnly, async (req, res) => {
  const result = await pool.query(
    "delete from sales_records where id=$1 and company_id=$2 returning id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Record not found" });
  res.json({ ok: true });
});

app.post("/api/sales/import", requireDb, auth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });

  const text = req.file.buffer.toString("utf8");
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });

  const client = await pool.connect();
  try {
    await client.query("begin");
    let count = 0;

    for (const r of records) {
      const saleDate = r.sale_date || r.date;
      if (!saleDate || !r.client) continue;

      await client.query(
        `insert into sales_records
         (company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price, cost_vat_rate, sale_vat_rate, tax_country, tax_category)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          req.user.company_id,
          req.user.id,
          saleDate,
          r.client,
          r.region || "Unknown",
          r.salesperson || "Unknown",
          r.product || "Unknown",
          r.category || "Unknown",
          Number(r.quantity || 1),
          Number(r.cost || 0),
          Number(r.price || 0),
          Number(r.cost_vat_rate || 0),
          Number(r.sale_vat_rate || 0),
          cleanText(r.tax_country || 'custom'),
          cleanText(r.tax_category || 'standard')
        ]
      );
      count++;
    }

    await client.query("commit");
    res.json({ imported: count });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post("/api/users/invite", requireDb, auth, managerOnly, async (req, res) => {
  const { email, full_name, role, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const safeRole = ["admin", "manager", "user"].includes(role) ? role : "user";
  const hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `insert into users_app (company_id, email, password_hash, full_name, role)
     values ($1,$2,$3,$4,$5)
     returning id, company_id, email, full_name, role`,
    [req.user.company_id, email.toLowerCase(), hash, full_name || null, safeRole]
  );

  res.status(201).json({ user: result.rows[0] });
});


app.get("/api/company", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "select id, name, currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account from companies where id=$1",
    [req.user.company_id]
  );
  res.json({ company: result.rows[0] });
});

app.put("/api/company", requireDb, auth, managerOnly, async (req, res) => {
  const { name, currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account } = req.body;
  const result = await pool.query(
    `update companies set name=$1, currency=$2, default_region=$3, report_note=$4,
       company_address=$5, company_tax_id=$6, company_registration_id=$7, company_bank_account=$8
     where id=$9 returning id, name, currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account`,
    [name, currency || "USD", default_region || null, report_note || null,
     company_address || null, company_tax_id || null, company_registration_id || null, company_bank_account || null,
     req.user.company_id]
  );
  res.json({ company: result.rows[0] });
});

app.put("/api/users/:id", requireDb, auth, managerOnly, async (req, res) => {
  const { full_name, role, password } = req.body;
  const safeRole = ["admin", "manager", "user"].includes(role) ? role : "user";

  if (password) {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `update users_app set full_name=$1, role=$2, password_hash=$3
       where id=$4 and company_id=$5
       returning id, email, full_name, role, created_at`,
      [full_name || null, safeRole, hash, req.params.id, req.user.company_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "User not found" });
    return res.json({ user: result.rows[0] });
  }

  const result = await pool.query(
    `update users_app set full_name=$1, role=$2
     where id=$3 and company_id=$4
     returning id, email, full_name, role, created_at`,
    [full_name || null, safeRole, req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
});

app.delete("/api/users/:id", requireDb, auth, managerOnly, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const result = await pool.query(
    "delete from users_app where id=$1 and company_id=$2 returning id",
    [req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

app.get("/api/users", requireDb, auth, managerOnly, async (req, res) => {
  const result = await pool.query(
    "select id, email, full_name, role, created_at from users_app where company_id=$1 order by created_at desc",
    [req.user.company_id]
  );
  res.json({ users: result.rows });
});


app.get("/api/backup", requireDb, auth, managerOnly, async (req, res) => {
  const company = await pool.query(
    "select id, name, currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account, created_at from companies where id=$1",
    [req.user.company_id]
  );
  const users = await pool.query(
    "select id, email, full_name, role, created_at from users_app where company_id=$1 order by created_at",
    [req.user.company_id]
  );
  const sales = await pool.query(
    "select * from sales_records where company_id=$1 order by sale_date, created_at",
    [req.user.company_id]
  );
  res.json({
    exported_at: new Date().toISOString(),
    company: company.rows[0],
    users: users.rows,
    sales_records: sales.rows
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "dist");

app.use(express.static(distPath));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

// Express 5 / path-to-regexp no longer accepts app.get("*").
// Use a middleware fallback for the React SPA instead.
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Global Sales Dashboard API running on port ${PORT}`);
});
