-- Optional demo seed for Global Sales Dashboard v7
-- Run after creating a company/user through the app.
-- Replace COMPANY_ID and USER_ID before running.

insert into sales_records
(company_id, user_id, sale_date, client, region, salesperson, product, category, quantity, cost, price)
values
('COMPANY_ID', 'USER_ID', '2026-01-05', 'Astra Retail', 'Europe', 'Emma', 'Analytics Setup', 'Software', 3, 700, 1700),
('COMPANY_ID', 'USER_ID', '2026-01-19', 'Northstar', 'North America', 'John', 'Dashboard License', 'Software', 8, 180, 540),
('COMPANY_ID', 'USER_ID', '2026-02-07', 'Casa Living', 'Europe', 'David', 'Office Pack', 'Office Supplies', 34, 18, 42),
('COMPANY_ID', 'USER_ID', '2026-02-21', 'Tokyo Studio', 'Asia', 'Sophia', 'Furniture Set', 'Furniture', 7, 520, 950);
