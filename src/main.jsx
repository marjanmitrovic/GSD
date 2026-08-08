import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { BarChart3, Download, FileUp, LogOut, Plus, Trash2, Users, Shield, Save, FileText, Settings, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const demoRows = [
  { id: "d1", sale_date: "2026-01-05", client: "Astra Retail", region: "Europe", salesperson: "Emma", product: "Analytics Setup", category: "Software", quantity: 3, cost: 700, price: 1700, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 },
  { id: "d2", sale_date: "2026-01-19", client: "Northstar", region: "North America", salesperson: "John", product: "Dashboard License", category: "Software", quantity: 8, cost: 180, price: 540, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 },
  { id: "d3", sale_date: "2026-02-07", client: "Casa Living", region: "Europe", salesperson: "David", product: "Office Pack", category: "Office Supplies", quantity: 34, cost: 18, price: 42, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 },
  { id: "d4", sale_date: "2026-02-21", client: "Tokyo Studio", region: "Asia", salesperson: "Sophia", product: "Furniture Set", category: "Furniture", quantity: 7, cost: 520, price: 950, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 },
  { id: "d5", sale_date: "2026-03-12", client: "Desert Cloud", region: "Middle East", salesperson: "Michael", product: "Consulting", category: "Services", quantity: 5, cost: 300, price: 1150, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 },
  { id: "d6", sale_date: "2026-03-29", client: "Beta Market", region: "Europe", salesperson: "Emma", product: "Electronics Bundle", category: "Electronics", quantity: 12, cost: 260, price: 620, tax_country:'czechia', tax_category:'standard', cost_vat_rate: 21, sale_vat_rate: 21 }
];

const tr = {
  en: { title:"Global Sales Dashboard", subtitle:"Smart insights. Better decisions. Powerful performance.", setup:"First setup", company:"Company", email:"Email", password:"Password", create:"Create company", login:"Login", demo:"Demo mode", logout:"Logout", import:"Import CSV", export:"Export CSV", excel:"Excel", pdf:"PDF Report", print:"Print / PDF", add:"Add sale", save:"Save", clear:"Clear filters", revenue:"Total Revenue", profit:"Total Profit", margin:"Profit Margin", units:"Units Sold", transactions:"Transactions", region:"Region", category:"Category", salesperson:"Salesperson", from:"From", to:"To", all:"All", monthly:"Revenue & Profit by Month", regionShare:"Revenue by Region", categoryPerf:"Category Performance", topPeople:"Top Salespeople", records:"Sales Records", client:"Client", product:"Product", qty:"Qty", cost:"Cost", price:"Price", role:"Role", users:"Team users", invite:"Add user", fullName:"Full name", companySettings:"Company settings", currency:"Currency", defaultRegion:"Default region", reportNote:"Report note", saved:"Saved", dashboard:"Dashboard", sales:"Sales", reports:"Reports", team:"Team", settings:"Settings", clients:"Clients", health:"System status", empty:"No records yet.", backup:"Backup JSON", search:"Search", revenueNet:"Revenue net", revenueGross:"Revenue gross", costNet:"Cost net", costGross:"Cost gross", saleVat:"Sales VAT %", costVat:"Input VAT %", saleTax:"Output VAT", costTax:"Input VAT", taxPayable:"VAT payable", profitNet:"Net profit", vatNote:"Prices are entered without VAT. VAT is calculated separately. For EU sales choose the destination country VAT rate or use Custom.", taxCountry:"Tax country", taxCategory:"Tax category", standard:"Standard", reduced:"Reduced", zero:"Zero", exempt:"Exempt", invoice:"Invoice PDF", invoiceNo:"Invoice No.", seller:"Seller", buyer:"Buyer", companyAddress:"Company address", companyTaxId:"Tax ID / VAT ID", companyRegId:"Company reg. ID", bankAccount:"Bank account", issueDate:"Issue date", dueDate:"Due date", total:"Total", expenses:"Expenses", cashflow:"Cashflow", supplier:"Supplier", description:"Description", netAmount:"Net amount", grossAmount:"Gross amount", vatRate:"VAT %", expenseDate:"Expense date", cashBalance:"Cash balance", invoicedTotal:"Invoiced", expensesTotal:"Expenses total", invoices:"Invoices", total:"Total", paidAmount:"Paid", balance:"Balance", addPayment:"Add payment", paymentAmount:"Payment amount", partial:"Partial", customers:"Customers", products:"Products", address:"Address", phone:"Phone", taxId:"Tax ID", defaultCost:"Default cost", defaultPrice:"Default price", edit:"Edit" },
  sr: { title:"Globalni prodajni dashboard", subtitle:"Pametan pregled. Bolje odluke. Jači rezultati.", setup:"Prvo podešavanje", company:"Firma", email:"Email", password:"Lozinka", create:"Napravi firmu", login:"Prijava", demo:"Demo režim", logout:"Odjava", import:"Import CSV", export:"Export CSV", excel:"Excel", pdf:"PDF izveštaj", print:"Print / PDF", add:"Dodaj prodaju", save:"Sačuvaj", clear:"Očisti filtere", revenue:"Ukupan prihod", profit:"Ukupan profit", margin:"Profitna marža", units:"Prodate jedinice", transactions:"Transakcije", region:"Region", category:"Kategorija", salesperson:"Prodavac", from:"Od", to:"Do", all:"Sve", monthly:"Prihod i profit po mesecima", regionShare:"Prihod po regionima", categoryPerf:"Učinak kategorija", topPeople:"Najbolji prodavci", records:"Prodajni zapisi", client:"Klijent", product:"Proizvod", qty:"Kol.", cost:"Trošak", price:"Cena", role:"Uloga", users:"Korisnici tima", invite:"Dodaj korisnika", fullName:"Ime i prezime", companySettings:"Podešavanja firme", currency:"Valuta", defaultRegion:"Podrazumevani region", reportNote:"Napomena za izveštaj", saved:"Sačuvano", dashboard:"Dashboard", sales:"Prodaja", reports:"Izveštaji", team:"Tim", settings:"Podešavanja", clients:"Klijenti", health:"Status sistema", empty:"Još nema zapisa.", backup:"Backup JSON", search:"Pretraga", revenueNet:"Prihod bez PDV", revenueGross:"Prihod sa PDV", costNet:"Trošak bez PDV", costGross:"Trošak sa PDV", saleVat:"Prodajni PDV %", costVat:"Ulazni PDV %", saleTax:"Izlazni PDV", costTax:"Ulazni PDV", taxPayable:"PDV za plaćanje", profitNet:"Neto profit", vatNote:"Cene se unose bez PDV-a. PDV se obračunava posebno. Za EU prodaju koristi stopu zemlje kupca ili Custom.", taxCountry:"Poreska zemlja", taxCategory:"Poreska kategorija", standard:"Opšta stopa", reduced:"Snižena/posebna stopa", zero:"Nulta stopa", exempt:"Oslobođeno", invoice:"Račun PDF", invoiceNo:"Broj računa", seller:"Prodavac", buyer:"Kupac", companyAddress:"Adresa firme", companyTaxId:"PIB / PDV ID", companyRegId:"Matični broj / IČO", bankAccount:"Bankovni račun", issueDate:"Datum izdavanja", dueDate:"Rok plaćanja", total:"Ukupno", expenses:"Troškovi", cashflow:"Novčani tok", supplier:"Dobavljač", description:"Opis", netAmount:"Neto iznos", grossAmount:"Bruto iznos", vatRate:"PDV %", expenseDate:"Datum troška", cashBalance:"Stanje novca", invoicedTotal:"Fakturisano", expensesTotal:"Ukupno troškovi", invoices:"Računi", total:"Ukupno", paidAmount:"Plaćeno", balance:"Ostatak", addPayment:"Dodaj uplatu", paymentAmount:"Iznos uplate", partial:"Delimično", customers:"Kupci", products:"Proizvodi / Usluge", address:"Adresa", phone:"Telefon", taxId:"PIB / Tax ID", defaultCost:"Nabavna cena", defaultPrice:"Prodajna cena", edit:"Izmeni" },
  cz: { title:"Globální prodejní dashboard", subtitle:"Chytré přehledy. Lepší rozhodnutí. Silnější výkon.", setup:"První nastavení", company:"Firma", email:"Email", password:"Heslo", create:"Vytvořit firmu", login:"Přihlášení", demo:"Demo režim", logout:"Odhlásit", import:"Import CSV", export:"Export CSV", excel:"Excel", pdf:"PDF report", print:"Print / PDF", add:"Přidat prodej", save:"Uložit", clear:"Vyčistit filtry", revenue:"Celkové tržby", profit:"Celkový zisk", margin:"Zisková marže", units:"Prodané kusy", transactions:"Transakce", region:"Region", category:"Kategorie", salesperson:"Obchodník", from:"Od", to:"Do", all:"Vše", monthly:"Tržby a zisk podle měsíců", regionShare:"Tržby podle regionů", categoryPerf:"Výkon kategorií", topPeople:"Nejlepší obchodníci", records:"Prodejní záznamy", client:"Klient", product:"Produkt", qty:"Ks", cost:"Náklad", price:"Cena", role:"Role", users:"Uživatelé týmu", invite:"Přidat uživatele", fullName:"Jméno a příjmení", companySettings:"Nastavení firmy", currency:"Měna", defaultRegion:"Výchozí region", reportNote:"Poznámka pro report", saved:"Uloženo", dashboard:"Dashboard", sales:"Prodeje", reports:"Reporty", team:"Tým", settings:"Nastavení", clients:"Klienti", health:"Stav systému", empty:"Zatím žádné záznamy.", backup:"Backup JSON", search:"Vyhledávání", revenueNet:"Tržby bez DPH", revenueGross:"Tržby s DPH", costNet:"Náklad bez DPH", costGross:"Náklad s DPH", saleVat:"Prodejní DPH %", costVat:"Vstupní DPH %", saleTax:"Výstupní DPH", costTax:"Vstupní DPH", taxPayable:"DPH k úhradě", profitNet:"Čistý zisk", vatNote:"Ceny se zadávají bez DPH. DPH se počítá zvlášť. Pro EU prodej použij sazbu země zákazníka nebo Custom.", taxCountry:"Daňová země", taxCategory:"Daňová kategorie", standard:"Základní sazba", reduced:"Snížená sazba", zero:"Nulová sazba", exempt:"Osvobozeno", invoice:"Faktura PDF", invoiceNo:"Číslo faktury", seller:"Dodavatel", buyer:"Odběratel", companyAddress:"Adresa firmy", companyTaxId:"DIČ / VAT ID", companyRegId:"IČO", bankAccount:"Bankovní účet", issueDate:"Datum vystavení", dueDate:"Datum splatnosti", total:"Celkem", expenses:"Výdaje", cashflow:"Cashflow", supplier:"Dodavatel", description:"Popis", netAmount:"Částka bez DPH", grossAmount:"Částka s DPH", vatRate:"DPH %", expenseDate:"Datum výdaje", cashBalance:"Stav peněz", invoicedTotal:"Fakturováno", expensesTotal:"Výdaje celkem", invoices:"Faktury", total:"Celkem", paidAmount:"Zaplaceno", balance:"Zbývá", addPayment:"Přidat platbu", paymentAmount:"Částka platby", partial:"Částečně", customers:"Zákazníci", products:"Produkty / Služby", address:"Adresa", phone:"Telefon", taxId:"DIČ / Tax ID", defaultCost:"Náklad", defaultPrice:"Prodejní cena", edit:"Upravit" }
}

const TAX_PROFILES = {
  serbia: {
    label: "Serbia / Srbija",
    rates: { standard: 20, reduced: 10, zero: 0, exempt: 0 }
  },
  czechia: {
    label: "Czechia / Česko",
    rates: { standard: 21, reduced: 12, zero: 0, exempt: 0 }
  },
  eu_custom: {
    label: "EU / country-specific",
    rates: { standard: 0, reduced: 0, zero: 0, exempt: 0 }
  },
  custom: {
    label: "Custom / ručno",
    rates: { standard: 0, reduced: 0, zero: 0, exempt: 0 }
  }
};

function getProfileRate(country, category) {
  return TAX_PROFILES[country]?.rates?.[category] ?? 0;
}

function money(v, currency = "USD"){
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(v || 0));
}
function num(v){ return new Intl.NumberFormat("en-US").format(Number(v||0)); }
function calc(r){
  const q=Number(r.quantity||0), c=Number(r.cost||0), p=Number(r.price||0);
  const costVat=Number(r.cost_vat_rate||0), saleVat=Number(r.sale_vat_rate||0);
  const revenueNet=q*p;
  const saleTax=revenueNet*saleVat/100;
  const revenueGross=revenueNet+saleTax;
  const costNet=q*c;
  const costTax=costNet*costVat/100;
  const costGross=costNet+costTax;
  const profitNet=revenueNet-costNet;
  const taxPayable=saleTax-costTax;
  return {...r, quantity:q, cost:c, price:p, cost_vat_rate:costVat, sale_vat_rate:saleVat, revenue:revenueNet, profit:profitNet, revenue_net:revenueNet, sale_tax:saleTax, revenue_gross:revenueGross, cost_net:costNet, cost_tax:costTax, cost_gross:costGross, profit_net:profitNet, tax_payable:taxPayable};
}
function group(rows,key,val){ return rows.reduce((a,r)=>{ const k=key(r)||"Unknown"; a[k]=(a[k]||0)+val(r); return a; },{}); }
function monthName(key){ return new Date(`${key}-01T00:00:00`).toLocaleString("en-US",{month:"short",year:"2-digit"}); }
function download(filename, content, type="text/plain"){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

async function api(path, options = {}) {
  const token = localStorage.getItem("gsd_token");
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${API_URL}${path}`;
  let res;
  try { res = await fetch(url, { ...options, headers }); }
  catch { throw new Error(`Cannot reach API at ${url}. Check backend on port 4000.`); }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`API returned non-JSON response from ${url}.`); }
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

function AuthPage({ lang, setLang, onLogin, onDemo }) {
  const t = tr[lang];
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ company_name:"", full_name:"", email:"", password:"" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const endpoint = mode === "setup" ? "/api/setup" : "/api/auth/login";
      const data = await api(endpoint, { method:"POST", body: JSON.stringify(form) });
      localStorage.setItem("gsd_token", data.token);
      onLogin(data.user);
    } catch (err) { setError(err.message); }
  }

  return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="brand-row"><div className="brand-icon"><BarChart3 size={28}/></div><div><h1>{t.title}</h1><p>Neon PostgreSQL + Express API</p></div></div>
    <div className="mode-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>setMode("login")}>{t.login}</button><button type="button" className={mode==="setup"?"active":""} onClick={()=>setMode("setup")}>{t.setup}</button></div>
    {mode === "setup" && <input value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} placeholder={t.company} required/>}
    {mode === "setup" && <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder={t.fullName}/>}
    <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder={t.email} required/>
    <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={t.password} required/>
    {error && <div className="error">{error}</div>}
    <div className="login-actions"><button>{mode === "setup" ? t.create : t.login}</button><button type="button" className="ghost" onClick={onDemo}>{t.demo}</button></div>
    <select value={lang} onChange={e=>setLang(e.target.value)}><option value="en">English</option><option value="sr">Srpski</option><option value="cz">Česky</option></select>
  </form></div>;
}

function App() {
  const [lang, setLang] = useState(localStorage.getItem("gsd_lang") || "sr");
  const [user, setUser] = useState(null);
  const [demo, setDemo] = useState(false);
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashflow, setCashflow] = useState(null);
  const [filters, setFilters] = useState({ region:"", category:"", salesperson:"", from:"", to:"", search:"" });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const t = tr[lang];
  const currency = user?.currency || "USD";

  function notify(message, type = "ok") { setToast({ message, type }); setTimeout(() => setToast(null), 2600); }

  useEffect(()=>{ localStorage.setItem("gsd_lang", lang); }, [lang]);
  useEffect(() => { const token = localStorage.getItem("gsd_token"); if (token) api("/api/me").then(data => setUser(data.user)).catch(() => localStorage.removeItem("gsd_token")); }, []);
  useEffect(() => {
    if (demo) { const stored = JSON.parse(localStorage.getItem("gsd_neon_demo") || "null"); setRows(stored || demoRows); return; }
    if (user) { loadSales(); if (["admin", "manager"].includes(user.role)) loadUsers(); }
  }, [demo, user]);

  async function loadSales() { const data = await api("/api/sales"); setRows(data.rows || []); }
  async function loadUsers() { try { const data = await api("/api/users"); setUsers(data.users || []); } catch (e) { notify(e.message, "error"); } }
  async function loadCustomers() { try { const data = await api("/api/customers"); setCustomers(data.customers || []); } catch (e) { notify(e.message, "error"); } }
  async function loadProducts() { try { const data = await api("/api/products"); setProducts(data.products || []); } catch (e) { notify(e.message, "error"); } }
  async function loadInvoices() { try { const data = await api("/api/invoices"); setInvoices(data.invoices || []); } catch (e) { notify(e.message, "error"); } }
  async function loadExpenses() { try { const data = await api("/api/expenses"); setExpenses(data.expenses || []); } catch (e) { notify(e.message, "error"); } }
  async function loadCashflow() { try { const data = await api("/api/cashflow"); setCashflow(data.cashflow || null); } catch (e) { notify(e.message, "error"); } }
  function saveDemo(next) { setRows(next); localStorage.setItem("gsd_neon_demo", JSON.stringify(next)); }

  async function saveSale(row) {
    if (demo) { if (row.id) saveDemo(rows.map(r => r.id === row.id ? row : r)); else saveDemo([{ ...row, id: crypto.randomUUID() }, ...rows]); setEditing(null); notify(t.saved); return; }
    try { if (row.id) await api(`/api/sales/${row.id}`, { method:"PUT", body: JSON.stringify(row) }); else await api("/api/sales", { method:"POST", body: JSON.stringify(row) }); setEditing(null); notify(t.saved); loadSales(); }
    catch (e) { notify(e.message, "error"); }
  }

  async function deleteSale(id) {
    if (demo) { saveDemo(rows.filter(r => r.id !== id)); notify(t.saved); return; }
    try { await api(`/api/sales/${id}`, { method:"DELETE" }); notify(t.saved); loadSales(); } catch (e) { notify(e.message, "error"); }
  }

  async function importCsv(file) {
    if (demo) {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      const headers = lines.shift().split(",").map(h => h.trim());
      const imported = lines.map(line => { const values = line.split(",").map(v => v.trim()); const r = {}; headers.forEach((h,i)=>r[h]=values[i]); return { id: crypto.randomUUID(), sale_date:r.sale_date||r.date, client:r.client, region:r.region, salesperson:r.salesperson, product:r.product, category:r.category, quantity:Number(r.quantity||1), cost:Number(r.cost||0), price:Number(r.price||0), tax_country:r.tax_country||'custom', tax_category:r.tax_category||'standard', cost_vat_rate:Number(r.cost_vat_rate||0), sale_vat_rate:Number(r.sale_vat_rate||0) }; });
      saveDemo([...imported, ...rows]); notify(t.saved); return;
    }
    const fd = new FormData(); fd.append("file", file);
    try { await api("/api/sales/import", { method:"POST", body: fd }); notify(t.saved); loadSales(); } catch(e) { notify(e.message, "error"); }
  }

  const enriched = useMemo(()=>rows.map(calc), [rows]);
  const filtered = useMemo(()=>enriched.filter(r => {
    const haystack = `${r.client} ${r.region} ${r.salesperson} ${r.product} ${r.category}`.toLowerCase();
    return (!filters.region || r.region === filters.region) &&
      (!filters.category || r.category === filters.category) &&
      (!filters.salesperson || r.salesperson === filters.salesperson) &&
      (!filters.from || r.sale_date >= filters.from) &&
      (!filters.to || r.sale_date <= filters.to) &&
      (!filters.search || haystack.includes(filters.search.toLowerCase()));
  }), [enriched, filters]);
  const kpi = useMemo(()=> { const revenue = filtered.reduce((s,r)=>s+r.revenue,0); const profit = filtered.reduce((s,r)=>s+r.profit,0); const units = filtered.reduce((s,r)=>s+r.quantity,0); const taxPayable = filtered.reduce((s,r)=>s+(r.tax_payable||0),0);
    const revenueGross = filtered.reduce((s,r)=>s+(r.revenue_gross||0),0);
    return { revenue, revenueGross, profit, taxPayable, units, transactions:filtered.length, margin: revenue ? profit/revenue*100 : 0 }; }, [filtered]);

  const regions = [...new Set(enriched.map(r=>r.region).filter(Boolean))].sort();
  const categories = [...new Set(enriched.map(r=>r.category).filter(Boolean))].sort();
  const people = [...new Set(enriched.map(r=>r.salesperson).filter(Boolean))].sort();
  const monthly = useMemo(()=> { const rev = group(filtered, r=>r.sale_date?.slice(0,7), r=>r.revenue); const prof = group(filtered, r=>r.sale_date?.slice(0,7), r=>r.profit); return [...new Set([...Object.keys(rev), ...Object.keys(prof)])].sort().map(k=>({ month:monthName(k), revenue:rev[k]||0, profit:prof[k]||0 })); }, [filtered]);
  const regionData = Object.entries(group(filtered, r=>r.region, r=>r.revenue)).map(([name,value])=>({name,value}));
  const categoryData = Object.entries(group(filtered, r=>r.category, r=>r.revenue)).map(([name,revenue])=>({name,revenue}));
  const peopleData = Object.entries(group(filtered, r=>r.salesperson, r=>r.profit)).sort((a,b)=>b[1]-a[1]).slice(0,5);

  function exportCsv() { const headers = ["sale_date","client","region","salesperson","product","category","quantity","tax_country","tax_category","cost","cost_vat_rate","price","sale_vat_rate","revenue_net","sale_tax","revenue_gross","cost_net","cost_tax","cost_gross","profit_net","tax_payable"]; const body = filtered.map(r => headers.map(h => r[h]).join(",")).join("\n"); download("sales-records.csv", `${headers.join(",")}\n${body}`, "text/csv"); }
  function exportExcel() { const data = filtered.map(r => ({ Date:r.sale_date, Client:r.client, Region:r.region, Salesperson:r.salesperson, Product:r.product, Category:r.category, Quantity:r.quantity, Tax_Country:r.tax_country, Tax_Category:r.tax_category, Cost_Net_Unit:r.cost, Cost_VAT_Rate:r.cost_vat_rate, Price_Net_Unit:r.price, Sale_VAT_Rate:r.sale_vat_rate, Revenue_Net:r.revenue_net, Sale_Tax:r.sale_tax, Revenue_Gross:r.revenue_gross, Cost_Net:r.cost_net, Cost_Tax:r.cost_tax, Cost_Gross:r.cost_gross, Profit_Net:r.profit_net, VAT_Payable:r.tax_payable })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sales"); XLSX.writeFile(wb, "sales-records.xlsx"); }
  function exportPdf() { const doc = new jsPDF(); doc.setFontSize(16); doc.text(t.title, 14, 16); doc.setFontSize(10); doc.text(`${t.revenueNet}: ${money(kpi.revenue, currency)}   ${t.profitNet}: ${money(kpi.profit, currency)}   ${t.taxPayable}: ${money(kpi.taxPayable, currency)}`, 14, 25); autoTable(doc, { startY: 34, head: [[t.from,t.client,t.region,t.salesperson,t.product,t.qty,t.revenueNet,t.revenueGross,t.profitNet,t.taxPayable]], body: filtered.map(r => [r.sale_date,r.client,r.region,r.salesperson,r.product,r.quantity,money(r.revenue_net,currency),money(r.revenue_gross,currency),money(r.profit_net,currency),money(r.tax_payable,currency)]), styles:{fontSize:7}, headStyles:{fillColor:[52,224,198],textColor:[6,16,23]} }); doc.save("sales-dashboard-report.pdf"); }
  
  function invoiceNumber(row) {
    const date = (row.sale_date || new Date().toISOString().slice(0,10)).replaceAll("-", "");
    const shortId = String(row.id || "").slice(0, 6).toUpperCase() || Math.floor(Math.random()*999999);
    return `INV-${date}-${shortId}`;
  }

  async function exportInvoice(row) {
    const r = calc(row);
    let officialInvoice = null;
    try {
      const data = await api("/api/invoices", { method:"POST", body:JSON.stringify({ sale_record_id: r.id, due_days: 14 }) });
      officialInvoice = data.invoice;
      loadInvoices();
    } catch (e) {
      notify(e.message, "error");
    }
    const buyer = customers.find(c => c.name === r.client);
    const doc = new jsPDF();
    const issue = officialInvoice?.issue_date || new Date().toISOString().slice(0,10);
    const due = officialInvoice?.due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
    const invNo = officialInvoice?.invoice_number || invoiceNumber(r);
    const sellerName = user?.company_name || "Company";
    const sellerAddress = user?.company_address || "";
    const sellerTaxId = user?.company_tax_id || "";
    const sellerRegId = user?.company_registration_id || "";
    const bank = user?.company_bank_account || "";

    doc.setFontSize(20);
    doc.text("Racun / Faktura", 14, 18);
    doc.setFontSize(10);
    doc.text(`Broj racuna: ${invNo}`, 14, 28);
    doc.text(`Datum izdavanja: ${issue}`, 14, 34);
    doc.text(`Rok placanja: ${due}`, 14, 40);

    doc.setFontSize(12);
    doc.text("Prodavac", 14, 55);
    doc.setFontSize(10);
    doc.text(sellerName, 14, 62);
    if (sellerAddress) doc.text(sellerAddress, 14, 68);
    if (sellerTaxId) doc.text(`${t.companyTaxId}: ${sellerTaxId}`, 14, 74);
    if (sellerRegId) doc.text(`${t.companyRegId}: ${sellerRegId}`, 14, 80);
    if (bank) doc.text(`${t.bankAccount}: ${bank}`, 14, 86);

    doc.setFontSize(12);
    doc.text("Kupac", 112, 55);
    doc.setFontSize(10);
    doc.text(r.client || "-", 112, 62);
    if (buyer?.address) doc.text(String(buyer.address).slice(0, 50), 112, 68);
    if (buyer?.tax_id) doc.text(`PIB / VAT ID: ${buyer.tax_id}`, 112, 74);
    if (!buyer?.address) doc.text(r.region || "-", 112, 68);

    autoTable(doc, {
      startY: 98,
      head: [["Proizvod", "Kategorija", "Kol.", "Cena net", "PDV %", "Prihod bez PDV", "Izlazni PDV", "Prihod sa PDV"]],
      body: [[r.product, r.category, r.quantity, money(r.price, currency), `${r.sale_vat_rate}%`, money(r.revenue_net, currency), money(r.sale_tax, currency), money(r.revenue_gross, currency)]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 224, 198], textColor: [6, 16, 23] }
    });

    const y = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.text(`Prihod bez PDV: ${money(r.revenue_net, currency)}`, 130, y);
    doc.text(`Izlazni PDV: ${money(r.sale_tax, currency)}`, 130, y + 7);
    doc.text(`Ukupno: ${money(r.revenue_gross, currency)}`, 130, y + 14);

    if (user?.report_note) {
      doc.setFontSize(9);
      doc.text(String(user.report_note).slice(0, 150), 14, y + 26);
    }

    doc.save(`${invNo}.pdf`);
  }

async function exportBackup() {
    if (demo) {
      download("sales-dashboard-demo-backup.json", JSON.stringify({ exported_at:new Date().toISOString(), sales_records:rows }, null, 2), "application/json");
      return;
    }
    try {
      const data = await api("/api/backup");
      download("sales-dashboard-backup.json", JSON.stringify(data, null, 2), "application/json");
    } catch (e) {
      notify(e.message, "error");
    }
  }

  function logout() { localStorage.removeItem("gsd_token"); setUser(null); setDemo(false); setRows([]); }

  if (!user && !demo) return <AuthPage lang={lang} setLang={setLang} onLogin={setUser} onDemo={()=>setDemo(true)}/>;

  return <div className="shell">
    <aside className="sidebar"><div className="brand-row"><div className="brand-icon"><BarChart3 size={26}/></div><div><h1>Global Sales</h1><p>Neon Console</p></div></div><nav>
  <button className={activeView==="dashboard"?"active":""} onClick={()=>setActiveView("dashboard")}>{t.dashboard}</button>
  <button className={activeView==="sales"?"active":""} onClick={()=>setActiveView("sales")}>{t.sales}</button>
  <button className={activeView==="reports"?"active":""} onClick={()=>setActiveView("reports")}>{t.reports}</button>
  <button className={activeView==="invoices"?"active":""} onClick={()=>setActiveView("invoices")}>{t.invoices}</button>
  <button className={activeView==="expenses"?"active":""} onClick={()=>setActiveView("expenses")}>{t.expenses}</button>
  <button className={activeView==="cashflow"?"active":""} onClick={()=>setActiveView("cashflow")}>{t.cashflow}</button>
  <button className={activeView==="customers"?"active":""} onClick={()=>setActiveView("customers")}>{t.customers}</button>
  <button className={activeView==="products"?"active":""} onClick={()=>setActiveView("products")}>{t.products}</button>
  <button className={activeView==="team"?"active":""} onClick={()=>setActiveView("team")}>{t.team}</button>
  <button className={activeView==="settings"?"active":""} onClick={()=>setActiveView("settings")}>{t.settings}</button>
</nav><div className="side-card"><Shield size={24}/><h3>{t.role}: {demo ? "demo" : user?.role}</h3><p>{demo ? "Local demo data" : user?.company_name || "Neon PostgreSQL"}</p></div></aside>
    <main className="main">
      <header className="topbar"><div><p>{t.subtitle}</p><h2>{t.title}</h2></div><div className="actions"><label><FileUp size={17}/>{t.import}<input hidden type="file" accept=".csv" onChange={e=>e.target.files[0] && importCsv(e.target.files[0])}/></label><button onClick={exportCsv}><Download size={17}/>{t.export}</button><button onClick={exportExcel}><Download size={17}/>{t.excel}</button><button onClick={exportPdf}><FileText size={17}/>{t.pdf}</button><button onClick={exportBackup}><Download size={17}/>{t.backup}</button><button onClick={()=>window.print()}>{t.print}</button><select value={lang} onChange={e=>setLang(e.target.value)}><option value="sr">SR</option><option value="en">EN</option><option value="cz">CZ</option></select><button onClick={logout}><LogOut size={17}/>{t.logout}</button></div></header>
      {activeView === "dashboard" && <>
      <section className="filters"><Select label={t.region} value={filters.region} options={regions} all={t.all} onChange={v=>setFilters({...filters,region:v})}/><Select label={t.category} value={filters.category} options={categories} all={t.all} onChange={v=>setFilters({...filters,category:v})}/><Select label={t.salesperson} value={filters.salesperson} options={people} all={t.all} onChange={v=>setFilters({...filters,salesperson:v})}/><Field label={t.from} type="date" value={filters.from} onChange={v=>setFilters({...filters,from:v})}/><Field label={t.to} type="date" value={filters.to} onChange={v=>setFilters({...filters,to:v})}/><Field label={t.search} value={filters.search} onChange={v=>setFilters({...filters,search:v})}/><button onClick={()=>setFilters({region:"",category:"",salesperson:"",from:"",to:"",search:""})}>{t.clear}</button></section>
      <section className="kpis"><Kpi label={t.revenueNet} value={money(kpi.revenue,currency)}/><Kpi label={t.profitNet} value={money(kpi.profit,currency)}/><Kpi label={t.margin} value={`${kpi.margin.toFixed(1)}%`}/><Kpi label={t.units} value={num(kpi.units)}/><Kpi label={t.transactions} value={num(kpi.transactions)}/></section>
      <section className="grid">
        <Panel title={t.monthly} wide><ResponsiveContainer width="100%" height={330}><AreaChart data={monthly}><XAxis dataKey="month"/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v,currency)}/><Legend/><Area dataKey="revenue" stroke="#34e0c6" fill="#34e0c6" fillOpacity={0.16}/><Line dataKey="profit" stroke="#ffb454" strokeWidth={3}/></AreaChart></ResponsiveContainer></Panel>
        <Panel title={t.regionShare}><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={regionData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96}>{regionData.map((_,i)=><Cell key={i} fill={["#34e0c6","#ffb454","#7c89ff","#ff647c","#8af0ff"][i%5]}/>)}</Pie><Tooltip formatter={v=>money(v,currency)}/><Legend/></PieChart></ResponsiveContainer></Panel>
        <Panel title={t.categoryPerf}><ResponsiveContainer width="100%" height={280}><BarChart data={categoryData}><XAxis dataKey="name"/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v,currency)}/><Bar dataKey="revenue" fill="#34e0c6"/></BarChart></ResponsiveContainer></Panel>
        <Panel title={t.topPeople}><div className="rank-list">{peopleData.map(([name,profit],i)=><div className="rank" key={name}><span>{i+1}</span><strong>{name}</strong><em>{money(profit,currency)}</em></div>)}</div></Panel>
      </section>
    </>}

    {activeView === "sales" && <>
      <div className="tax-note">{t.vatNote}</div>
      <section className="filters"><Select label={t.region} value={filters.region} options={regions} all={t.all} onChange={v=>setFilters({...filters,region:v})}/><Select label={t.category} value={filters.category} options={categories} all={t.all} onChange={v=>setFilters({...filters,category:v})}/><Select label={t.salesperson} value={filters.salesperson} options={people} all={t.all} onChange={v=>setFilters({...filters,salesperson:v})}/><Field label={t.from} type="date" value={filters.from} onChange={v=>setFilters({...filters,from:v})}/><Field label={t.to} type="date" value={filters.to} onChange={v=>setFilters({...filters,to:v})}/><Field label={t.search} value={filters.search} onChange={v=>setFilters({...filters,search:v})}/><button onClick={()=>setFilters({region:"",category:"",salesperson:"",from:"",to:"",search:""})}>{t.clear}</button></section>
      <section className="grid single-grid">
        <Panel title={editing ? t.save : t.add}><EntryForm t={t} initial={editing} customers={customers} products={products} onSave={saveSale} onCancel={()=>setEditing(null)}/></Panel>
        <Panel title={t.records}><p className="muted-text">Double click / dupli klik na red za editovanje.</p><div className="table-wrap"><table><thead><tr><th>{t.from}</th><th>{t.client}</th><th>{t.region}</th><th>{t.salesperson}</th><th>{t.product}</th><th>{t.category}</th><th>{t.qty}</th><th>{t.revenueNet}</th><th>{t.revenueGross}</th><th>{t.profitNet}</th><th>{t.taxPayable}</th><th></th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} onDoubleClick={()=>setEditing(row)}><td>{row.sale_date}</td><td>{row.client}</td><td>{row.region}</td><td>{row.salesperson}</td><td>{row.product}</td><td>{row.category}</td><td>{row.quantity}</td><td>{money(row.revenue_net,currency)}</td><td>{money(row.revenue_gross,currency)}</td><td>{money(row.profit_net,currency)}</td><td>{money(row.tax_payable,currency)}</td><td className="row-actions"><button title={t.invoice} onClick={()=>exportInvoice(row)}><FileText size={16}/></button><button className="trash" onClick={()=>deleteSale(row.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div></Panel>
      </section>
    </>}

    {activeView === "reports" && <>
      <section className="kpis"><Kpi label={t.revenueNet} value={money(kpi.revenue,currency)}/><Kpi label={t.profitNet} value={money(kpi.profit,currency)}/><Kpi label={t.margin} value={`${kpi.margin.toFixed(1)}%`}/><Kpi label={t.units} value={num(kpi.units)}/><Kpi label={t.transactions} value={num(kpi.transactions)}/></section>
      <section className="grid">
        <Panel title={t.monthly} wide><ResponsiveContainer width="100%" height={330}><AreaChart data={monthly}><XAxis dataKey="month"/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v,currency)}/><Legend/><Area dataKey="revenue" stroke="#34e0c6" fill="#34e0c6" fillOpacity={0.16}/><Line dataKey="profit" stroke="#ffb454" strokeWidth={3}/></AreaChart></ResponsiveContainer></Panel>
        <Panel title={t.regionShare}><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={regionData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96}>{regionData.map((_,i)=><Cell key={i} fill={["#34e0c6","#ffb454","#7c89ff","#ff647c","#8af0ff"][i%5]}/>)}</Pie><Tooltip formatter={v=>money(v,currency)}/><Legend/></PieChart></ResponsiveContainer></Panel>
        <Panel title={t.categoryPerf}><ResponsiveContainer width="100%" height={280}><BarChart data={categoryData}><XAxis dataKey="name"/><YAxis tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={v=>money(v,currency)}/><Bar dataKey="revenue" fill="#34e0c6"/></BarChart></ResponsiveContainer></Panel>
        <Panel title={t.topPeople}><div className="rank-list">{peopleData.map(([name,profit],i)=><div className="rank" key={name}><span>{i+1}</span><strong>{name}</strong><em>{money(profit,currency)}</em></div>)}</div></Panel>
      </section>
    </>}

    
    {activeView === "expenses" && <>
      <Panel title={t.expenses}><ExpensesManager t={t} expenses={expenses} reload={()=>{loadExpenses();loadCashflow();}} notify={notify}/></Panel>
    </>}

    {activeView === "cashflow" && <>
      <Panel title={t.cashflow}><CashflowView t={t} cashflow={cashflow} currency={currency}/></Panel>
    </>}

    {activeView === "invoices" && <>
      <Panel title={t.invoices}><InvoicesList t={t} invoices={invoices} reload={()=>{loadInvoices();loadCashflow();}} notify={notify}/></Panel>
    </>}

    {activeView === "customers" && <>
      {!demo && ["admin","manager"].includes(user?.role) ? <Panel title={t.customers}><CustomersManager t={t} customers={customers} reload={loadCustomers} notify={notify}/></Panel> : <Panel title={t.customers}><p className="muted-text">Manager or admin role required.</p></Panel>}
    </>}

    {activeView === "products" && <>
      {!demo && ["admin","manager"].includes(user?.role) ? <Panel title={t.products}><ProductsManager t={t} products={products} reload={loadProducts} notify={notify}/></Panel> : <Panel title={t.products}><p className="muted-text">Manager or admin role required.</p></Panel>}
    </>}

{activeView === "team" && <>
      {!demo && ["admin","manager"].includes(user?.role) ? <Panel title={t.users}><Team t={t} users={users} reload={loadUsers} notify={notify}/></Panel> : <Panel title={t.users}><p className="muted-text">{demo ? "Team panel is disabled in demo mode." : "Manager or admin role required."}</p></Panel>}
    </>}

    {activeView === "settings" && <>
      {!demo && ["admin","manager"].includes(user?.role) ? <Panel title={t.companySettings}><CompanySettings t={t} user={user} setUser={setUser} notify={notify}/></Panel> : <Panel title={t.companySettings}><p className="muted-text">{demo ? "Settings are disabled in demo mode." : "Manager or admin role required."}</p></Panel>}
    </>}

    {toast && <div className={`toast ${toast.type}`}><AlertCircle size={18}/>{toast.message}</div>}
    </main>
  </div>;
}

function CompanySettings({ t, user, setUser, notify }) {
  const [form, setForm] = useState({
    name:user.company_name || "",
    currency:user.currency || "USD",
    default_region:user.default_region || "",
    report_note:user.report_note || "",
    company_address:user.company_address || "",
    company_tax_id:user.company_tax_id || "",
    company_registration_id:user.company_registration_id || "",
    company_bank_account:user.company_bank_account || ""
  });

  async function submit(e) {
    e.preventDefault();
    try {
      const data = await api("/api/company", { method:"PUT", body:JSON.stringify(form) });
      setUser({
        ...user,
        company_name:data.company.name,
        currency:data.company.currency,
        default_region:data.company.default_region,
        report_note:data.company.report_note,
        company_address:data.company.company_address,
        company_tax_id:data.company.company_tax_id,
        company_registration_id:data.company.company_registration_id,
        company_bank_account:data.company.company_bank_account
      });
      notify(t.saved);
    } catch(e) { notify(e.message, "error"); }
  }

  return <form className="team-form" onSubmit={submit}>
    <input placeholder={t.company} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
    <input placeholder={t.currency} value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}/>
    <input placeholder={t.defaultRegion} value={form.default_region || ""} onChange={e=>setForm({...form,default_region:e.target.value})}/>
    <input placeholder={t.companyAddress} value={form.company_address || ""} onChange={e=>setForm({...form,company_address:e.target.value})}/>
    <input placeholder={t.companyTaxId} value={form.company_tax_id || ""} onChange={e=>setForm({...form,company_tax_id:e.target.value})}/>
    <input placeholder={t.companyRegId} value={form.company_registration_id || ""} onChange={e=>setForm({...form,company_registration_id:e.target.value})}/>
    <input placeholder={t.bankAccount} value={form.company_bank_account || ""} onChange={e=>setForm({...form,company_bank_account:e.target.value})}/>
    <input placeholder={t.reportNote} value={form.report_note || ""} onChange={e=>setForm({...form,report_note:e.target.value})}/>
    <button><Settings size={17}/>{t.save}</button>
  </form>
}

function Team({ t, users, reload, notify }) {
  const [form,setForm]=useState({email:"",full_name:"",password:"",role:"user"});
  const [edit,setEdit]=useState(null);
  async function submit(e) { e.preventDefault(); try { if (edit) await api(`/api/users/${edit.id}`, { method:"PUT", body:JSON.stringify(form) }); else await api("/api/users/invite", { method:"POST", body:JSON.stringify(form) }); setForm({email:"",full_name:"",password:"",role:"user"}); setEdit(null); notify(t.saved); reload(); } catch(e) { notify(e.message, "error"); } }
  function startEdit(u) { setEdit(u); setForm({ email:u.email, full_name:u.full_name || "", password:"", role:u.role }); }
  async function removeUser(id) { try { await api(`/api/users/${id}`, { method:"DELETE" }); notify(t.saved); reload(); } catch(e) { notify(e.message, "error"); } }
  return <div><form className="team-form" onSubmit={submit}><input placeholder={t.email} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required disabled={!!edit}/><input placeholder={t.fullName} value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/><input placeholder={edit ? "New password optional" : t.password} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required={!edit}/><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="user">user</option><option value="manager">manager</option><option value="admin">admin</option></select><button><Users size={17}/>{edit ? t.save : t.invite}</button>{edit && <button type="button" className="ghost" onClick={()=>{setEdit(null);setForm({email:"",full_name:"",password:"",role:"user"});}}>Cancel</button>}</form><div className="user-list">{users.map(u=><div className="user-row" key={u.id}><div><strong>{u.email}</strong><span>{u.full_name || "-"} · {u.role}</span></div><div className="user-actions"><button onClick={()=>startEdit(u)}>{t.edit}</button><button className="trash" onClick={()=>removeUser(u.id)}><Trash2 size={16}/></button></div></div>)}</div></div>;
}




function CashflowView({ t, cashflow, currency }) {
  const c = cashflow || {};
  return <div className="stats">
    <Stat title={t.invoicedTotal} value={money(c.invoiced_total, currency)} />
    <Stat title={t.paidAmount} value={money(c.paid_total, currency)} />
    <Stat title={t.expensesTotal} value={money(c.expenses_total, currency)} />
    <Stat title={t.cashBalance} value={money(c.cash_balance, currency)} />
  </div>
}

function ExpensesManager({ t, expenses, reload, notify }) {
  const empty = { expense_date:new Date().toISOString().slice(0,10), supplier:"", category:"", description:"", net_amount:0, vat_rate:21 };
  const [form, setForm] = useState(empty);
  const [edit, setEdit] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      if (edit) await api(`/api/expenses/${edit.id}`, { method:"PUT", body:JSON.stringify(form) });
      else await api("/api/expenses", { method:"POST", body:JSON.stringify(form) });
      setForm(empty); setEdit(null); notify(t.saved); reload();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  function start(row) {
    setEdit(row);
    setForm({
      expense_date: row.expense_date || new Date().toISOString().slice(0,10),
      supplier: row.supplier || "",
      category: row.category || "",
      description: row.description || "",
      net_amount: Number(row.net_amount || 0),
      vat_rate: Number(row.vat_rate || 0)
    });
  }

  async function remove(id) {
    try {
      await api(`/api/expenses/${id}`, { method:"DELETE" });
      notify(t.saved);
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return <div>
    <form className="entry labeled-entry" onSubmit={submit}>
      <Field label={t.expenseDate} type="date" value={form.expense_date} onChange={v=>setForm({...form,expense_date:v})}/>
      <Field label={t.supplier} value={form.supplier} onChange={v=>setForm({...form,supplier:v})}/>
      <Field label={t.category} value={form.category} onChange={v=>setForm({...form,category:v})}/>
      <Field label={t.description} value={form.description} onChange={v=>setForm({...form,description:v})}/>
      <Field label={t.netAmount} type="number" value={form.net_amount} onChange={v=>setForm({...form,net_amount:Number(v)})}/>
      <Field label={t.vatRate} type="number" value={form.vat_rate} onChange={v=>setForm({...form,vat_rate:Number(v)})}/>
      <button><Save size={17}/>{edit ? t.save : t.add}</button>
      {edit && <button type="button" className="ghost" onClick={()=>{setEdit(null);setForm(empty)}}>Cancel</button>}
    </form>

    <div className="table-wrap"><table>
      <thead><tr><th>{t.expenseDate}</th><th>{t.supplier}</th><th>{t.category}</th><th>{t.description}</th><th>{t.netAmount}</th><th>{t.vatRate}</th><th>{t.grossAmount}</th><th></th></tr></thead>
      <tbody>{expenses.length === 0 && <tr><td colSpan="8">{t.empty}</td></tr>}{expenses.map(e=><tr key={e.id} onDoubleClick={()=>start(e)}>
        <td>{e.expense_date}</td><td>{e.supplier}</td><td>{e.category}</td><td>{e.description}</td>
        <td>{money(e.net_amount)}</td><td>{e.vat_rate}%</td><td>{money(e.gross_amount)}</td>
        <td className="row-actions"><button onClick={()=>start(e)}>{t.edit}</button><button className="trash" onClick={()=>remove(e.id)}><Trash2 size={16}/></button></td>
      </tr>)}</tbody>
    </table></div>
  </div>
}

function InvoicesList({ t, invoices, reload, notify }) {
  const [amounts, setAmounts] = useState({});

  async function setStatus(id, status) {
    try {
      await api(`/api/invoices/${id}/status`, { method:"PUT", body:JSON.stringify({ status }) });
      notify(t.saved);
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function addPayment(inv) {
    const raw = amounts[inv.id] || "";
    const amount = Number(raw);
    if (!amount || amount <= 0) {
      notify(t.paymentAmount, "error");
      return;
    }
    try {
      await api(`/api/invoices/${inv.id}/payments`, {
        method:"POST",
        body:JSON.stringify({ amount, payment_date:new Date().toISOString().slice(0,10), method:"manual" })
      });
      setAmounts({...amounts, [inv.id]:""});
      notify(t.saved);
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  function statusLabel(s) {
    const key = String(s || "issued").toLowerCase();
    return t[key] || key;
  }

  return <div className="table-wrap"><table>
    <thead><tr>
      <th>{t.invoiceNo}</th><th>{t.client}</th><th>{t.product}</th><th>{t.issueDate}</th><th>{t.dueDate}</th>
      <th>{t.total}</th><th>{t.paidAmount}</th><th>{t.balance}</th><th>Status</th><th>{t.addPayment}</th><th></th>
    </tr></thead>
    <tbody>{invoices.length === 0 && <tr><td colSpan="11">{t.empty}</td></tr>}{invoices.map(i=><tr key={i.id}>
      <td>{i.invoice_number}</td>
      <td>{i.client}</td>
      <td>{i.product}</td>
      <td>{i.issue_date}</td>
      <td>{i.due_date}</td>
      <td>{money(i.invoice_total)}</td>
      <td>{money(i.paid_amount)}</td>
      <td>{money(i.balance_due)}</td>
      <td><span className={`status status-${i.display_status || i.status}`}>{statusLabel(i.display_status || i.status)}</span></td>
      <td className="payment-cell">
        <input type="number" placeholder="0.00" value={amounts[i.id] || ""} onChange={e=>setAmounts({...amounts,[i.id]:e.target.value})}/>
        <button onClick={()=>addPayment(i)}>{t.addPayment}</button>
      </td>
      <td className="row-actions">
        <button onClick={()=>setStatus(i.id,"sent")}>{t.markSent || "Sent"}</button>
        <button onClick={()=>setStatus(i.id,"paid")}>{t.markPaid || "Paid"}</button>
        <button className="trash" onClick={()=>setStatus(i.id,"cancelled")}>{t.cancelInvoice || "Cancel"}</button>
      </td>
    </tr>)}</tbody>
  </table></div>
}

function CustomersManager({ t, customers, reload, notify }) {
  const empty = { name:"", email:"", phone:"", address:"", tax_id:"", region:"" };
  const [form,setForm] = useState(empty);
  const [edit,setEdit] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      if (edit) await api(`/api/customers/${edit.id}`, { method:"PUT", body:JSON.stringify(form) });
      else await api("/api/customers", { method:"POST", body:JSON.stringify(form) });
      setForm(empty); setEdit(null); notify(t.saved); reload();
    } catch(e) { notify(e.message, "error"); }
  }
  function start(c){ setEdit(c); setForm({ name:c.name||"", email:c.email||"", phone:c.phone||"", address:c.address||"", tax_id:c.tax_id||"", region:c.region||"" }); }
  async function remove(id){ try { await api(`/api/customers/${id}`, { method:"DELETE" }); notify(t.saved); reload(); } catch(e) { notify(e.message, "error"); } }

  return <div>
    <form className="entry labeled-entry" onSubmit={submit}>
      <Field label={t.client} value={form.name} onChange={v=>setForm({...form,name:v})}/>
      <Field label={t.email} value={form.email} onChange={v=>setForm({...form,email:v})}/>
      <Field label={t.phone} value={form.phone} onChange={v=>setForm({...form,phone:v})}/>
      <Field label={t.address} value={form.address} onChange={v=>setForm({...form,address:v})}/>
      <Field label={t.taxId} value={form.tax_id} onChange={v=>setForm({...form,tax_id:v})}/>
      <Field label={t.region} value={form.region} onChange={v=>setForm({...form,region:v})}/>
      <button><Save size={17}/>{edit ? t.save : t.add}</button>
      {edit && <button type="button" className="ghost" onClick={()=>{setEdit(null);setForm(empty)}}>Cancel</button>}
    </form>
    <div className="table-wrap"><table><thead><tr><th>{t.client}</th><th>{t.email}</th><th>{t.phone}</th><th>{t.region}</th><th>{t.taxId}</th><th></th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td><td>{c.region}</td><td>{c.tax_id}</td><td className="row-actions"><button onClick={()=>start(c)}>{t.edit}</button><button className="trash" onClick={()=>remove(c.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
  </div>
}

function ProductsManager({ t, products, reload, notify }) {
  const empty = { name:"", category:"", default_cost:0, default_price:0, tax_country:"czechia", tax_category:"standard", cost_vat_rate:21, sale_vat_rate:21 };
  const [form,setForm] = useState(empty);
  const [edit,setEdit] = useState(null);
  function applyCountry(country) {
    const rate = getProfileRate(country, form.tax_category || "standard");
    setForm({...form,tax_country:country,cost_vat_rate:rate,sale_vat_rate:rate});
  }
  function applyCategory(cat) {
    const rate = getProfileRate(form.tax_country || "custom", cat);
    setForm({...form,tax_category:cat,cost_vat_rate:rate,sale_vat_rate:rate});
  }
  async function submit(e) {
    e.preventDefault();
    try {
      if (edit) await api(`/api/products/${edit.id}`, { method:"PUT", body:JSON.stringify(form) });
      else await api("/api/products", { method:"POST", body:JSON.stringify(form) });
      setForm(empty); setEdit(null); notify(t.saved); reload();
    } catch(e) { notify(e.message, "error"); }
  }
  function start(p){ setEdit(p); setForm({ name:p.name||"", category:p.category||"", default_cost:Number(p.default_cost||0), default_price:Number(p.default_price||0), tax_country:p.tax_country||"custom", tax_category:p.tax_category||"standard", cost_vat_rate:Number(p.cost_vat_rate||0), sale_vat_rate:Number(p.sale_vat_rate||0) }); }
  async function remove(id){ try { await api(`/api/products/${id}`, { method:"DELETE" }); notify(t.saved); reload(); } catch(e) { notify(e.message, "error"); } }

  return <div>
    <form className="entry labeled-entry" onSubmit={submit}>
      <Field label={t.product} value={form.name} onChange={v=>setForm({...form,name:v})}/>
      <Field label={t.category} value={form.category} onChange={v=>setForm({...form,category:v})}/>
      <Field label={t.defaultCost} type="number" value={form.default_cost} onChange={v=>setForm({...form,default_cost:Number(v)})}/>
      <Field label={t.defaultPrice} type="number" value={form.default_price} onChange={v=>setForm({...form,default_price:Number(v)})}/>
      <div className="field"><label>{t.taxCountry}</label><select value={form.tax_country} onChange={e=>applyCountry(e.target.value)}>{Object.entries(TAX_PROFILES).map(([key,profile])=><option key={key} value={key}>{profile.label}</option>)}</select></div>
      <div className="field"><label>{t.taxCategory}</label><select value={form.tax_category} onChange={e=>applyCategory(e.target.value)}><option value="standard">{t.standard}</option><option value="reduced">{t.reduced}</option><option value="zero">{t.zero}</option><option value="exempt">{t.exempt}</option></select></div>
      <Field label={t.costVat} type="number" value={form.cost_vat_rate} onChange={v=>setForm({...form,cost_vat_rate:Number(v)})}/>
      <Field label={t.saleVat} type="number" value={form.sale_vat_rate} onChange={v=>setForm({...form,sale_vat_rate:Number(v)})}/>
      <button><Save size={17}/>{edit ? t.save : t.add}</button>
      {edit && <button type="button" className="ghost" onClick={()=>{setEdit(null);setForm(empty)}}>Cancel</button>}
    </form>
    <div className="table-wrap"><table><thead><tr><th>{t.product}</th><th>{t.category}</th><th>{t.defaultCost}</th><th>{t.defaultPrice}</th><th>{t.taxCountry}</th><th>{t.saleVat}</th><th></th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{money(p.default_cost)}</td><td>{money(p.default_price)}</td><td>{p.tax_country}</td><td>{p.sale_vat_rate}%</td><td className="row-actions"><button onClick={()=>start(p)}>{t.edit}</button><button className="trash" onClick={()=>remove(p.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
  </div>
}

function EntryForm({ t, onSave, initial, customers = [], products = [], onCancel }) {
  const empty = { sale_date:new Date().toISOString().slice(0,10), client:"", region:"", salesperson:"", product:"", category:"", quantity:1, tax_country:"czechia", tax_category:"standard", cost:0, cost_vat_rate:21, price:0, sale_vat_rate:21 };
  const [form,setForm]=useState(initial || empty);
  useEffect(()=>setForm(initial || empty), [initial]);

  function set(k,v){ setForm({...form,[k]:v}); }

  function applyCustomer(name) {
    const c = customers.find(x => x.name === name);
    if (c) setForm({...form, client:c.name, region:c.region || form.region});
    else set("client", name);
  }

  function applyProduct(name) {
    const p = products.find(x => x.name === name);
    if (p) setForm({...form, product:p.name, category:p.category || "", cost:Number(p.default_cost||0), price:Number(p.default_price||0), tax_country:p.tax_country || "custom", tax_category:p.tax_category || "standard", cost_vat_rate:Number(p.cost_vat_rate||0), sale_vat_rate:Number(p.sale_vat_rate||0)});
    else set("product", name);
  }

  function applyTaxProfile(country, category = form.tax_category || "standard") {
    const rate = getProfileRate(country, category);
    setForm({...form, tax_country: country, tax_category: category, cost_vat_rate: rate, sale_vat_rate: rate});
  }

  function applyTaxCategory(category) {
    const rate = getProfileRate(form.tax_country || "custom", category);
    setForm({...form, tax_category: category, cost_vat_rate: rate, sale_vat_rate: rate});
  }

  function submit(e){
    e.preventDefault();
    onSave({
      ...form,
      quantity:Number(form.quantity),
      cost:Number(form.cost),
      cost_vat_rate:Number(form.cost_vat_rate||0),
      price:Number(form.price),
      sale_vat_rate:Number(form.sale_vat_rate||0),
      tax_country:form.tax_country || "custom",
      tax_category:form.tax_category || "standard"
    });
    if(!initial) setForm(empty);
  }

  return <form className="entry" onSubmit={submit}>
    <input type="date" value={form.sale_date || ""} onChange={e=>set("sale_date",e.target.value)} required/>
    <input placeholder={t.client} value={form.client || ""} onChange={e=>set("client",e.target.value)} required/>
    <input placeholder={t.region} value={form.region || ""} onChange={e=>set("region",e.target.value)} required/>
    <input placeholder={t.salesperson} value={form.salesperson || ""} onChange={e=>set("salesperson",e.target.value)} required/>
    <input placeholder={t.product} value={form.product || ""} onChange={e=>set("product",e.target.value)} required/>
    <input placeholder={t.category} value={form.category || ""} onChange={e=>set("category",e.target.value)} required/>
    <input type="number" min="1" value={form.quantity || 1} onChange={e=>set("quantity",e.target.value)} required/>

    <select value={form.tax_country || "custom"} onChange={e=>applyTaxProfile(e.target.value)}>
      {Object.entries(TAX_PROFILES).map(([key,profile])=><option key={key} value={key}>{profile.label}</option>)}
    </select>

    <select value={form.tax_category || "standard"} onChange={e=>applyTaxCategory(e.target.value)}>
      <option value="standard">{t.standard}</option>
      <option value="reduced">{t.reduced}</option>
      <option value="zero">{t.zero}</option>
      <option value="exempt">{t.exempt}</option>
    </select>

    <input type="number" min="0" step="0.01" placeholder={`${t.costNet} / unit`} value={form.cost || 0} onChange={e=>set("cost",e.target.value)} required/>
    <input type="number" min="0" max="100" step="0.01" placeholder={t.costVat} value={form.cost_vat_rate ?? 0} onChange={e=>set("cost_vat_rate",e.target.value)} required/>
    <input type="number" min="0" step="0.01" placeholder={`${t.price} net / unit`} value={form.price || 0} onChange={e=>set("price",e.target.value)} required/>
    <input type="number" min="0" max="100" step="0.01" placeholder={t.saleVat} value={form.sale_vat_rate ?? 0} onChange={e=>set("sale_vat_rate",e.target.value)} required/>
    <datalist id="customers-list">{customers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
    <datalist id="products-list">{products.map(p=><option key={p.id} value={p.name}/>)}</datalist>
    <button>{initial ? <Save size={17}/> : <Plus size={17}/>} {initial ? t.save : t.add}</button>
    {initial && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
  </form>
}
function Select({label,value,options,all,onChange}){ return <div className="field"><label>{label}</label><select value={value} onChange={e=>onChange(e.target.value)}><option value="">{all}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>; }
function Field({label,value,type="text",list,onChange}){ return <div className="field"><label>{label}</label><input type={type} list={list} value={value} onChange={e=>onChange(e.target.value)}/></div>; }
function Kpi({label,value}){ return <article className="kpi"><p>{label}</p><h3>{value}</h3><span>LIVE</span></article>; }
function Panel({title,children,wide}){ return <article className={`panel ${wide ? "wide" : ""}`}><div className="panel-head"><h3>{title}</h3></div>{children}</article>; }

createRoot(document.getElementById("root")).render(<App />);
