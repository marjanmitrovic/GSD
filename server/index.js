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
  const invoices = await pool.query(
    `select coalesce(sum(sr.quantity * sr.price * (1 + sr.sale_vat_rate/100)),0)::float as invoiced
     from invoices i join sales_records sr on sr.id=i.sale_record_id
     where i.company_id=$1`,
    [req.user.company_id]
  );
  const payments = await pool.query(
    "select coalesce(sum(amount),0)::float as paid from invoice_payments where company_id=$1",
    [req.user.company_id]
  );
  const expenses = await pool.query(
    "select coalesce(sum(gross_amount),0)::float as expenses from expenses where company_id=$1",
    [req.user.company_id]
  );
  res.json({
    invoiced: invoices.rows[0].invoiced || 0,
    paid: payments.rows[0].paid || 0,
    expenses: expenses.rows[0].expenses || 0,
    balance: (payments.rows[0].paid || 0) - (expenses.rows[0].expenses || 0)
  });
});
app.get("/api/invoices", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    `select i.*, sr.client, sr.product, sr.quantity, sr.price, sr.cost, sr.sale_vat_rate,
       (sr.quantity * sr.price * (1 + sr.sale_vat_rate/100))::float as total_gross,
       coalesce((select sum(amount) from invoice_payments p where p.invoice_id=i.id),0)::float as paid_amount
     from invoices i
     join sales_records sr on sr.id=i.sale_record_id
     where i.company_id=$1
     order by i.created_at desc`,
    [req.user.company_id]
  );
  res.json({ invoices: result.rows });
});

app.post("/api/invoices/:saleId", requireDb, auth, managerOnly, async (req, res) => {
  const saleId = req.params.saleId;
  const sale = await pool.query(
    "select * from sales_records where id=$1 and company_id=$2",
    [saleId, req.user.company_id]
  );
  if (!sale.rowCount) return res.status(404).json({ error: "Sale record not found" });

  const existing = await pool.query(
    "select * from invoices where sale_record_id=$1 and company_id=$2",
    [saleId, req.user.company_id]
  );
  if (existing.rowCount) return res.json({ invoice: existing.rows[0] });

  const year = new Date().getFullYear();
  const count = await pool.query("select count(*)::int as c from invoices where company_id=$1", [req.user.company_id]);
  const invoiceNo = `INV-${year}-${String(count.rows[0].c + 1).padStart(4, "0")}`;
  const result = await pool.query(
    `insert into invoices (company_id, sale_record_id, invoice_number, issue_date, due_date, status)
     values ($1,$2,$3,current_date,current_date + interval '14 days','issued') returning *`,
    [req.user.company_id, saleId, invoiceNo]
  );
  res.status(201).json({ invoice: result.rows[0] });
});

app.post("/api/invoices/:invoiceId/payments", requireDb, auth, async (req, res) => {
  const invoiceId = req.params.invoiceId;
  const inv = await pool.query("select * from invoices where id=$1 and company_id=$2", [invoiceId, req.user.company_id]);
  if (!inv.rowCount) return res.status(404).json({ error: "Invoice not found" });
  const amount = toNumber(req.body.amount, 0);
  if (amount <= 0) return res.status(400).json({ error: "Payment amount must be greater than 0" });
  const result = await pool.query(
    `insert into invoice_payments (company_id, invoice_id, amount, payment_date, method, note)
     values ($1,$2,$3,coalesce($4::date,current_date),$5,$6) returning *`,
    [req.user.company_id, invoiceId, amount, req.body.payment_date || null, cleanText(req.body.method, null), cleanText(req.body.note, null)]
  );
  res.status(201).json({ payment: result.rows[0] });
});

app.put("/api/invoices/:id/status", requireDb, auth, async (req, res) => {
  const status = cleanText(req.body.status || "issued");
  const allowed = ["issued", "partial", "paid", "cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const result = await pool.query(
    "update invoices set status=$1, paid_at=case when $1='paid' then current_date else paid_at end where id=$2 and company_id=$3 returning *",
    [status, req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Invoice not found" });
  res.json({ invoice: result.rows[0] });
});
app.get("/api/sales", requireDb, auth, async (req, res) => {
  const result = await pool.query(
    "select * from sales_records where company_id=$1 order by sale_date desc, created_at desc",
    [req.user.company_id]
  );
  res.json({ rows: result.rows });
});

app.post("/api/sales", requireDb, auth, async (req, res) => {
  const row = req.body;
  const error = validateSale(row);
  if (error) return res.status(400).json({ error });

  const result = await pool.query(
    `insert into sales_records
     (company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price, cost_vat_rate, sale_vat_rate, tax_country, tax_category)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning *`,
    [
      req.user.company_id,
      req.user.id,
      row.sale_date,
      cleanText(row.client),
      cleanText(row.region),
      cleanText(row.salesperson),
      cleanText(row.product),
      cleanText(row.category),
      toNumber(row.quantity, 1),
      toNumber(row.cost, 0),
      toNumber(row.price, 0),
      toNumber(row.cost_vat_rate, 0),
      toNumber(row.sale_vat_rate, 0),
      cleanText(row.tax_country || "custom"),
      cleanText(row.tax_category || "standard")
    ]
  );
  res.status(201).json({ row: result.rows[0] });
});

app.put("/api/sales/:id", requireDb, auth, async (req, res) => {
  const row = req.body;
  const error = validateSale(row);
  if (error) return res.status(400).json({ error });

  const result = await pool.query(
    `update sales_records set sale_date=$1, client=$2, region=$3, salesperson=$4, product=$5, category=$6, quantity=$7, cost=$8, price=$9, cost_vat_rate=$10, sale_vat_rate=$11, tax_country=$12, tax_category=$13
     where id=$14 and company_id=$15 returning *`,
    [row.sale_date, cleanText(row.client), cleanText(row.region), cleanText(row.salesperson), cleanText(row.product), cleanText(row.category), toNumber(row.quantity, 1), toNumber(row.cost, 0), toNumber(row.price, 0), toNumber(row.cost_vat_rate, 0), toNumber(row.sale_vat_rate, 0), cleanText(row.tax_country || "custom"), cleanText(row.tax_category || "standard"), req.params.id, req.user.company_id]
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

app.post("/api/import", requireDb, auth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });
  const text = req.file.buffer.toString("utf8");
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  const inserted = [];

  for (const record of records) {
    const row = {
      sale_date: record.sale_date || record.date || record.Date,
      client: record.client || record.Client,
      region: record.region || record.Region,
      salesperson: record.salesperson || record.Salesperson,
      product: record.product || record.Product,
      category: record.category || record.Category,
      quantity: record.quantity || record.Quantity,
      cost: record.cost || record.Cost,
      price: record.price || record.Price,
      cost_vat_rate: record.cost_vat_rate || record.CostVAT || 0,
      sale_vat_rate: record.sale_vat_rate || record.SaleVAT || 0,
      tax_country: record.tax_country || record.TaxCountry || "custom",
      tax_category: record.tax_category || record.TaxCategory || "standard"
    };
    const error = validateSale(row);
    if (error) continue;
    const result = await pool.query(
      `insert into sales_records
       (company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price, cost_vat_rate, sale_vat_rate, tax_country, tax_category)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning *`,
      [req.user.company_id, req.user.id, row.sale_date, cleanText(row.client), cleanText(row.region), cleanText(row.salesperson), cleanText(row.product), cleanText(row.category), toNumber(row.quantity, 1), toNumber(row.cost, 0), toNumber(row.price, 0), toNumber(row.cost_vat_rate, 0), toNumber(row.sale_vat_rate, 0), cleanText(row.tax_country), cleanText(row.tax_category)]
    );
    inserted.push(result.rows[0]);
  }
  res.json({ inserted });
});

app.get("/api/company", requireDb, auth, async (req, res) => {
  const company = await pool.query("select * from companies where id=$1", [req.user.company_id]);
  res.json({ company: company.rows[0] });
});

app.put("/api/company", requireDb, auth, managerOnly, async (req, res) => {
  const { currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account } = req.body;
  const result = await pool.query(
    `update companies
     set currency=$1, default_region=$2, report_note=$3,
         company_address=$4, company_tax_id=$5, company_registration_id=$6, company_bank_account=$7
     where id=$8 returning *`,
    [cleanText(currency || "USD"), cleanText(default_region, null), cleanText(report_note, null), cleanText(company_address, null), cleanText(company_tax_id, null), cleanText(company_registration_id, null), cleanText(company_bank_account, null), req.user.company_id]
  );
  res.json({ company: result.rows[0] });
});

app.get("/api/users", requireDb, auth, managerOnly, async (req, res) => {
  const users = await pool.query("select id, email, full_name, role, created_at from users_app where company_id=$1 order by created_at", [req.user.company_id]);
  res.json({ users: users.rows });
});

app.post("/api/users", requireDb, auth, managerOnly, async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const safeRole = ["admin", "manager", "user"].includes(role) ? role : "user";
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      `insert into users_app (company_id, email, password_hash, full_name, role)
       values ($1,$2,$3,$4,$5) returning id, email, full_name, role, created_at`,
      [req.user.company_id, String(email).toLowerCase(), hash, cleanText(full_name, null), safeRole]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/users/:id", requireDb, auth, managerOnly, async (req, res) => {
  const { full_name, role, password } = req.body;
  const safeRole = ["admin", "manager", "user"].includes(role) ? role : "user";
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query("update users_app set password_hash=$1 where id=$2 and company_id=$3", [hash, req.params.id, req.user.company_id]);
  }
  const result = await pool.query(
    "update users_app set full_name=$1, role=$2 where id=$3 and company_id=$4 returning id, email, full_name, role, created_at",
    [cleanText(full_name, null), safeRole, req.params.id, req.user.company_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
});

app.delete("/api/users/:id", requireDb, auth, managerOnly, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot delete your own account" });
  const result = await pool.query("delete from users_app where id=$1 and company_id=$2 returning id", [req.params.id, req.user.company_id]);
  if (!result.rowCount) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

app.get("/api/backup", requireDb, auth, managerOnly, async (req, res) => {
  const company = await pool.query(
    "select * from companies where id=$1",
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
