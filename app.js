const STORAGE_KEY = "safex_week3_invoices_v1";
const $ = (id) => document.getElementById(id);
let invoices = [];
try {
  invoices = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
} catch (e) {
  invoices = [];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function money(value, symbol = "$") {
  return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function uid() {
  return "inv_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  renderAll();
}
function isOverdue(inv) {
  return (
    inv.status !== "Paid" && new Date(inv.dueDate + "T23:59:59") < new Date()
  );
}
function displayStatus(inv) {
  return isOverdue(inv) ? "Overdue" : inv.status;
}

function addLineItem(
  item = { description: "Website maintenance", quantity: 1, rate: 100 },
) {
  const row = document.createElement("div");
  row.className = "line-item";
  row.innerHTML = `
    <label>Description<input class="item-desc" value="${item.description || ""}" required></label>
    <label>Qty<input class="item-qty" type="number" min="0" step="0.01" value="${item.quantity ?? 1}" required></label>
    <label>Rate<input class="item-rate" type="number" min="0" step="0.01" value="${item.rate ?? 0}" required></label>
    <label>Line Total<div class="line-total">$0.00</div></label>
    <button type="button" class="btn btn-danger remove-item">Remove</button>`;
  row
    .querySelectorAll("input")
    .forEach((el) => el.addEventListener("input", updateFormTotals));
  row.querySelector(".remove-item").addEventListener("click", () => {
    if ($("itemsContainer").children.length > 1) {
      row.remove();
      updateFormTotals();
    }
  });
  $("itemsContainer").appendChild(row);
  updateFormTotals();
}

function getFormItems() {
  return [...document.querySelectorAll(".line-item")].map((row) => ({
    description: row.querySelector(".item-desc").value.trim(),
    quantity: Number(row.querySelector(".item-qty").value || 0),
    rate: Number(row.querySelector(".item-rate").value || 0),
  }));
}
function calcTotals(items, taxRate) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax = subtotal * (Number(taxRate || 0) / 100);
  return { subtotal, tax, total: subtotal + tax };
}
function updateFormTotals() {
  const symbol = $("currency").value;
  const items = getFormItems();
  const t = calcTotals(items, $("taxRate").value);
  [...document.querySelectorAll(".line-item")].forEach(
    (row, i) =>
      (row.querySelector(".line-total").textContent = money(
        items[i].quantity * items[i].rate,
        symbol,
      )),
  );
  $("formSubtotal").textContent = money(t.subtotal, symbol);
  $("formTax").textContent = money(t.tax, symbol);
  $("formTotal").textContent = money(t.total, symbol);
}
function collectInvoice() {
  const items = getFormItems();
  const totals = calcTotals(items, $("taxRate").value);
  return {
    id: uid(),
    number: $("invoiceNumber").value.trim(),
    issueDate: $("issueDate").value,
    dueDate: $("dueDate").value,
    clientName: $("clientName").value.trim(),
    clientEmail: $("clientEmail").value.trim(),
    clientAddress: $("clientAddress").value.trim(),
    currency: $("currency").value,
    items,
    taxRate: Number($("taxRate").value || 0),
    status: $("status").value,
    notes: $("notes").value.trim(),
    ...totals,
  };
}
function resetForm() {
  $("invoiceForm").reset();
  $("itemsContainer").innerHTML = "";
  $("issueDate").value = todayISO();
  $("dueDate").value = plusDays(14);
  $("invoiceNumber").value =
    "INV-" + String(invoices.length + 1).padStart(3, "0");
  $("notes").value = "Thank you for your business.";
  addLineItem();
  updateFormTotals();
}
function validateForm() {
  if (!$("invoiceForm").reportValidity()) return false;
  if (!getFormItems().length) return false;
  return true;
}
function saveCurrentInvoice() {
  if (!validateForm()) return null;
  const inv = collectInvoice();
  invoices.unshift(inv);
  save();
  resetForm();
  return inv;
}

function generatePDF(inv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(18, 56, 93);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("INVOICE", 16, 21);
  doc.setFontSize(10);
  doc.text("SafeX Solutions - Portfolio Demo", pageW - 16, 19, {
    align: "right",
  });
  doc.setTextColor(23, 32, 42);
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text(`Invoice #: ${inv.number}`, 16, 48);
  doc.setFont(undefined, "normal");
  doc.text(`Issue date: ${inv.issueDate}`, 16, 56);
  doc.text(`Due date: ${inv.dueDate}`, 16, 64);
  doc.setFont(undefined, "bold");
  doc.text("Bill To", 120, 48);
  doc.setFont(undefined, "normal");
  doc.text(inv.clientName, 120, 56);
  doc.text(inv.clientEmail, 120, 64);
  const address = (inv.clientAddress || "").split("\n");
  address.forEach((line, i) => doc.text(line, 120, 72 + i * 6));
  let y = 88;
  doc.setFillColor(231, 240, 248);
  doc.rect(16, y - 7, pageW - 32, 10, "F");
  doc.setFont(undefined, "bold");
  doc.text("Description", 19, y);
  doc.text("Qty", 119, y);
  doc.text("Rate", 142, y);
  doc.text("Amount", 176, y, { align: "right" });
  doc.setFont(undefined, "normal");
  y += 10;
  inv.items.forEach((item) => {
    if (y > 245) {
      doc.addPage();
      y = 22;
    }
    doc.text(String(item.description).slice(0, 55), 19, y);
    doc.text(String(item.quantity), 119, y);
    doc.text(money(item.rate, inv.currency), 142, y);
    doc.text(money(item.quantity * item.rate, inv.currency), 194, y, {
      align: "right",
    });
    y += 9;
  });
  y += 8;
  doc.line(110, y - 4, 194, y - 4);
  doc.text("Subtotal", 142, y);
  doc.text(money(inv.subtotal, inv.currency), 194, y, { align: "right" });
  y += 8;
  doc.text(`Tax (${inv.taxRate}%)`, 142, y);
  doc.text(money(inv.tax, inv.currency), 194, y, { align: "right" });
  y += 9;
  doc.setFont(undefined, "bold");
  doc.setFontSize(13);
  doc.text("Total", 142, y);
  doc.text(money(inv.total, inv.currency), 194, y, { align: "right" });
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  y += 18;
  doc.setTextColor(102, 112, 133);
  doc.text(inv.notes || "Thank you for your business.", 16, y);
  doc.text(`Status: ${displayStatus(inv)}`, 16, y + 8);
  doc.text(
    "Generated with the SafeX Client Invoice Generator & Tracker",
    16,
    282,
  );
  doc.save(`${inv.number}-${inv.clientName.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}

function renderDashboard() {
  const filter = $("statusFilter").value;
  const q = $("searchInput").value.toLowerCase().trim();
  const rows = invoices.filter(
    (inv) =>
      (filter === "All" || displayStatus(inv) === filter) &&
      (!q ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.number.toLowerCase().includes(q)),
  );
  $("invoiceTableBody").innerHTML = "";
  $("emptyState").style.display = rows.length ? "none" : "block";
  rows.forEach((inv) => {
    const status = displayStatus(inv);
    const tr = document.createElement("tr");
    if (status === "Overdue") tr.className = "overdue";
    tr.innerHTML = `<td><strong>${inv.number}</strong><br><small>${inv.issueDate}</small></td><td>${inv.clientName}<br><small>${inv.clientEmail}</small></td><td>${inv.dueDate}</td><td><strong>${money(inv.total, inv.currency)}</strong></td><td><span class="status-pill status-${status.toLowerCase()}">${status}</span></td><td><div class="row-actions"><button class="btn btn-secondary pdf">PDF</button><button class="btn btn-ghost toggle">${inv.status === "Paid" ? "Mark Unpaid" : "Mark Paid"}</button><button class="btn btn-danger del">Delete</button></div></td>`;
    tr.querySelector(".pdf").onclick = () => generatePDF(inv);
    tr.querySelector(".toggle").onclick = () => {
      inv.status = inv.status === "Paid" ? "Unpaid" : "Paid";
      save();
    };
    tr.querySelector(".del").onclick = () => {
      if (confirm(`Delete ${inv.number}?`)) {
        invoices = invoices.filter((x) => x.id !== inv.id);
        save();
      }
    };
    $("invoiceTableBody").appendChild(tr);
  });
}
function renderStats() {
  const total = invoices.reduce((s, i) => s + i.total, 0),
    paid = invoices
      .filter((i) => i.status === "Paid")
      .reduce((s, i) => s + i.total, 0),
    unpaid = total - paid,
    overdue = invoices.filter(isOverdue).length;
  const currency = invoices[0]?.currency || "$";
  $("statTotal").textContent = money(total, currency);
  $("statPaid").textContent = money(paid, currency);
  $("statUnpaid").textContent = money(unpaid, currency);
  $("statOverdue").textContent = overdue;
}
function renderClients() {
  const map = new Map();
  invoices.forEach((i) => {
    if (!map.has(i.clientEmail))
      map.set(i.clientEmail, {
        name: i.clientName,
        email: i.clientEmail,
        count: 0,
        total: 0,
        currency: i.currency,
      });
    const c = map.get(i.clientEmail);
    c.count++;
    c.total += i.total;
  });
  $("clientList").innerHTML = "";
  if (!map.size) {
    $("clientList").innerHTML =
      '<div class="empty-state">Clients appear automatically when invoices are saved.</div>';
    return;
  }
  [...map.values()].forEach((c) => {
    const div = document.createElement("div");
    div.className = "client-card";
    div.innerHTML = `<strong>${c.name}</strong><span>${c.email}</span><br><span>${c.count} invoice(s) - ${money(c.total, c.currency)}</span>`;
    $("clientList").appendChild(div);
  });
}
function renderAll() {
  renderStats();
  renderDashboard();
  renderClients();
}
function seedDemo() {
  if (
    invoices.length &&
    !confirm("Demo data will replace your current invoices. Continue?")
  )
    return;
  const d = (n) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const base = [
    [
      "INV-001",
      "Bright Labs",
      "accounts@brightlabs.example",
      d(-24),
      d(-10),
      "Paid",
      [
        ["Landing page design", 1, 650],
        ["SEO setup", 1, 250],
      ],
      5,
      "$",
    ],
    [
      "INV-002",
      "Northstar Studio",
      "hello@northstar.example",
      d(-16),
      d(-2),
      "Unpaid",
      [["Automation workflow", 1, 900]],
      0,
      "$",
    ],
    [
      "INV-003",
      "GreenLeaf Cafe",
      "owner@greenleaf.example",
      d(-8),
      d(6),
      "Unpaid",
      [
        ["Website optimization", 1, 420],
        ["Analytics setup", 1, 180],
      ],
      5,
      "$",
    ],
    [
      "INV-004",
      "Apex Consulting",
      "finance@apex.example",
      d(-4),
      d(10),
      "Paid",
      [["Monthly support", 10, 75]],
      0,
      "$",
    ],
    [
      "INV-005",
      "Nova Retail",
      "ops@novaretail.example",
      d(-2),
      d(12),
      "Unpaid",
      [["Product page updates", 6, 65]],
      7.5,
      "$",
    ],
  ];
  invoices = base.map((r) => {
    const items = r[6].map((x) => ({
      description: x[0],
      quantity: x[1],
      rate: x[2],
    }));
    const t = calcTotals(items, r[7]);
    return {
      id: uid(),
      number: r[0],
      clientName: r[1],
      clientEmail: r[2],
      clientAddress: "Sample City",
      issueDate: r[3],
      dueDate: r[4],
      status: r[5],
      items,
      taxRate: r[7],
      currency: r[8],
      notes: "Thank you for your business.",
      ...t,
    };
  });
  save();
  resetForm();
}

$("addItemBtn").onclick = () =>
  addLineItem({ description: "", quantity: 1, rate: 0 });
$("resetBtn").onclick = resetForm;
$("currency").onchange = updateFormTotals;
$("taxRate").oninput = updateFormTotals;
$("invoiceForm").onsubmit = (e) => {
  e.preventDefault();
  const inv = saveCurrentInvoice();
  if (inv) alert(`${inv.number} saved successfully.`);
};
$("saveAndPdfBtn").onclick = () => {
  if (!validateForm()) return;
  const inv = collectInvoice();
  invoices.unshift(inv);
  save();
  generatePDF(inv);
  resetForm();
};
$("statusFilter").onchange = renderDashboard;
$("searchInput").oninput = renderDashboard;
$("seedDemoBtn").onclick = seedDemo;
resetForm();
renderAll();
