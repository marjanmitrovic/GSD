import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in .env or Render environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const DEMO_EMAIL = 'demo@pragueai.cz';
const DEMO_PASSWORD = 'Demo2026!';
const DEMO_COMPANY = 'Prague AI Demo Company';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('begin');

    const oldUser = await client.query('select company_id from users_app where email=$1', [DEMO_EMAIL]);
    if (oldUser.rows[0]?.company_id) {
      await client.query('delete from companies where id=$1', [oldUser.rows[0].company_id]);
    }

    const companyRes = await client.query(
      `insert into companies
        (name, currency, default_region, report_note, company_address, company_tax_id, company_registration_id, company_bank_account)
       values
        ($1, 'CZK', 'Europe', 'Demo account for client presentations', 'Praha, Czech Republic', 'CZ12345678', '12345678', 'CZ00 0000 0000 0000 0000 0000')
       returning id`,
      [DEMO_COMPANY]
    );
    const companyId = companyRes.rows[0].id;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userRes = await client.query(
      `insert into users_app (company_id, email, password_hash, full_name, role)
       values ($1,$2,$3,'Demo Admin','admin')
       returning id`,
      [companyId, DEMO_EMAIL, passwordHash]
    );
    const userId = userRes.rows[0].id;

    const customers = [
      ['Astra Retail s.r.o.', 'finance@astra.example', '+420 777 111 222', 'Prague, Czech Republic', 'CZ10101010', 'Europe'],
      ['Northstar Consulting', 'hello@northstar.example', '+420 777 222 333', 'Brno, Czech Republic', 'CZ20202020', 'Europe'],
      ['Casa Living GmbH', 'office@casaliving.example', '+49 30 000000', 'Berlin, Germany', 'DE30303030', 'Europe'],
      ['Tokyo Studio Ltd.', 'admin@tokyostudio.example', '+81 3 0000 0000', 'Tokyo, Japan', 'JP40404040', 'Asia']
    ];

    for (const c of customers) {
      await client.query(
        `insert into customers (company_id, name, email, phone, address, tax_id, region)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [companyId, ...c]
      );
    }

    const products = [
      ['Analytics Setup', 'Software', 12000, 29000, 'czechia', 'standard', 21, 21],
      ['Dashboard License', 'Software', 1800, 5400, 'czechia', 'standard', 21, 21],
      ['AI Sales Audit', 'Services', 6500, 17900, 'czechia', 'standard', 21, 21],
      ['Monthly Support', 'Services', 2200, 6900, 'czechia', 'standard', 21, 21]
    ];

    for (const p of products) {
      await client.query(
        `insert into products (company_id, name, category, default_cost, default_price, tax_country, tax_category, cost_vat_rate, sale_vat_rate)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [companyId, ...p]
      );
    }

    const sales = [
      ['2026-01-08', 'Astra Retail s.r.o.', 'Europe', 'Marjan', 'Analytics Setup', 'Software', 1, 12000, 29000, 21, 21, 'czechia', 'standard'],
      ['2026-01-19', 'Northstar Consulting', 'Europe', 'Marjan', 'Dashboard License', 'Software', 5, 1800, 5400, 21, 21, 'czechia', 'standard'],
      ['2026-02-05', 'Casa Living GmbH', 'Europe', 'Demo Sales', 'AI Sales Audit', 'Services', 1, 6500, 17900, 21, 21, 'czechia', 'standard'],
      ['2026-02-21', 'Tokyo Studio Ltd.', 'Asia', 'Demo Sales', 'Monthly Support', 'Services', 3, 2200, 6900, 21, 21, 'czechia', 'standard'],
      ['2026-03-09', 'Astra Retail s.r.o.', 'Europe', 'Marjan', 'Dashboard License', 'Software', 8, 1800, 5400, 21, 21, 'czechia', 'standard'],
      ['2026-03-26', 'Northstar Consulting', 'Europe', 'Marjan', 'Monthly Support', 'Services', 2, 2200, 6900, 21, 21, 'czechia', 'standard']
    ];

    const saleIds = [];
    for (const s of sales) {
      const res = await client.query(
        `insert into sales_records
          (company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price, cost_vat_rate, sale_vat_rate, tax_country, tax_category)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         returning id`,
        [companyId, userId, ...s]
      );
      saleIds.push(res.rows[0].id);
    }

    const invoiceIds = [];
    for (let i = 0; i < saleIds.length; i++) {
      const issueDate = sales[i][0];
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);
      const invoiceNo = `DEMO-2026-${String(i + 1).padStart(3, '0')}`;
      const status = i < 4 ? 'paid' : i === 4 ? 'partial' : 'issued';
      const paidAt = i < 4 ? issueDate : null;
      const inv = await client.query(
        `insert into invoices (company_id, sale_record_id, invoice_number, issue_date, due_date, status, paid_at, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [companyId, saleIds[i], invoiceNo, issueDate, dueDate.toISOString().slice(0,10), status, paidAt, 'Demo invoice']
      );
      invoiceIds.push(inv.rows[0].id);
    }

    const paymentRows = [
      [0, 35090, '2026-01-10', 'bank', 'Paid in full'],
      [1, 32670, '2026-01-24', 'bank', 'Paid in full'],
      [2, 21659, '2026-02-11', 'bank', 'Paid in full'],
      [3, 25047, '2026-02-28', 'bank', 'Paid in full'],
      [4, 25000, '2026-03-15', 'bank', 'Partial payment']
    ];

    for (const p of paymentRows) {
      await client.query(
        `insert into invoice_payments (company_id, invoice_id, amount, payment_date, method, note)
         values ($1,$2,$3,$4,$5,$6)`,
        [companyId, invoiceIds[p[0]], p[1], p[2], p[3], p[4]]
      );
    }

    const expenses = [
      ['2026-01-05', 'Render', 'Hosting', 'Application hosting', 450, 21],
      ['2026-01-06', 'Neon', 'Database', 'PostgreSQL database', 390, 21],
      ['2026-02-01', 'Freelancer', 'Design', 'Landing page design support', 3500, 21],
      ['2026-02-14', 'Marketing', 'Sales', 'Client outreach campaign', 2200, 21],
      ['2026-03-01', 'Software tools', 'Operations', 'Monthly tools', 1750, 21]
    ];

    for (const e of expenses) {
      await client.query(
        `insert into expenses (company_id, expense_date, supplier, category, description, net_amount, vat_rate)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [companyId, ...e]
      );
    }

    await client.query('commit');
    console.log('Demo account created successfully.');
    console.log(`Email: ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
  } catch (err) {
    await client.query('rollback');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
