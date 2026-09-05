// ==========================================================================
// invoice.js — Handles invoice creation, editing, calculations, and saving.
//
// Calculation rules (also re-validated below before saving):
//   Item Total = Quantity × Unit Price × (1 + Tax% / 100)
//   Subtotal   = Sum of Item Totals before tax
//   Tax        = Sum of (Quantity × Unit Price × Tax% / 100)
//   Total      = Subtotal + Tax - Discount
//
// The app computes these values itself rather than trusting any total that
// might be tampered with in the browser; the same calculation is repeated
// right before writing to Firestore so a manipulated DOM can't produce a
// bad total in the saved document.
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  requireApprovedUser,
  bindLogoutButtons,
  populateNavUser,
  showToast,
} from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const itemsBody = document.getElementById("items-body");
const itemRowTemplate = document.getElementById("item-row-template");
const addItemBtn = document.getElementById("add-item-btn");
const customerSelect = document.getElementById("customer-select");
const invoiceDateInput = document.getElementById("invoice-date");
const dueDateInput = document.getElementById("due-date");
const invoiceStatusSelect = document.getElementById("invoice-status");
const discountInput = document.getElementById("discount-input");
const invoiceNotesInput = document.getElementById("invoice-notes");
const subtotalDisplay = document.getElementById("subtotal-display");
const taxDisplay = document.getElementById("tax-display");
const totalDisplay = document.getElementById("total-display");
const invoiceForm = document.getElementById("invoice-form");
const saveBtn = document.getElementById("save-btn");
const pageTitle = document.getElementById("page-title");
const invoiceNumberDisplay = document.getElementById("invoice-number-display");
const printBtn = document.getElementById("print-btn");

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

let currentUser = null;
let editingInvoiceId = null;
let existingInvoiceNumber = null;

printBtn.addEventListener("click", () => window.print());

function addItemRow(item = {}) {
  const fragment = itemRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".item-row");

  row.querySelector(".item-desc").value = item.description || "";
  row.querySelector(".item-qty").value = item.quantity ?? 1;
  row.querySelector(".item-price").value = item.unitPrice ?? 0;
  row.querySelector(".item-tax").value = item.taxRate ?? 0;

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", recalculateTotals);
  });

  row.querySelector(".remove-item-btn").addEventListener("click", () => {
    row.remove();
    recalculateTotals();
  });

  itemsBody.appendChild(row);
  recalculateTotals();
}

addItemBtn.addEventListener("click", () => addItemRow());

function getItemsFromDom() {
  return Array.from(itemsBody.querySelectorAll(".item-row")).map((row) => {
    const description = row.querySelector(".item-desc").value.trim();
    const quantity = Number(row.querySelector(".item-qty").value) || 0;
    const unitPrice = Number(row.querySelector(".item-price").value) || 0;
    const taxRate = Number(row.querySelector(".item-tax").value) || 0;
    const lineBase = quantity * unitPrice;
    const lineTax = lineBase * (taxRate / 100);
    const lineTotal = lineBase + lineTax;
    return { description, quantity, unitPrice, taxRate, lineBase, lineTax, lineTotal, row };
  });
}

function recalculateTotals() {
  const items = getItemsFromDom();

  items.forEach((item) => {
    item.row.querySelector(".line-total-cell").textContent = formatCurrency(item.lineTotal);
  });

  const subtotal = items.reduce((sum, i) => sum + i.lineBase, 0);
  const tax = items.reduce((sum, i) => sum + i.lineTax, 0);
  const discount = Number(discountInput.value) || 0;
  const total = Math.max(0, subtotal + tax - discount);

  subtotalDisplay.textContent = formatCurrency(subtotal);
  taxDisplay.textContent = formatCurrency(tax);
  totalDisplay.textContent = formatCurrency(total);

  return { subtotal, tax, discount, total };
}

discountInput.addEventListener("input", recalculateTotals);

async function loadCustomers(selectedId = "") {
  const q = query(collection(db, "customers"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);

  customerSelect.innerHTML = '<option value="">Select a customer…</option>';
  snap.forEach((docSnap) => {
    const c = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = c.name;
    opt.dataset.name = c.name;
    if (docSnap.id === selectedId) opt.selected = true;
    customerSelect.appendChild(opt);
  });
}

/**
 * Generates a sequential invoice number in the format INV-YYYY-000001,
 * based on how many invoices this user already has for the current year.
 * This is a simple client-side approach appropriate for a small
 * educational project; it counts the user's own invoices (readable under
 * Firestore Security Rules) rather than trusting a client-supplied number.
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const q = query(collection(db, "invoices"), where("userId", "==", currentUser.uid));
  const snap = await getDocs(q);

  let countThisYear = 0;
  snap.forEach((docSnap) => {
    const num = docSnap.data().invoiceNumber || "";
    if (num.startsWith(`INV-${year}-`)) countThisYear += 1;
  });

  const next = String(countThisYear + 1).padStart(6, "0");
  return `INV-${year}-${next}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function loadExistingInvoice(invoiceId) {
  const snap = await getDoc(doc(db, "invoices", invoiceId));
  if (!snap.exists()) {
    showToast("Invoice not found.", "error");
    window.location.href = "invoices.html";
    return;
  }

  const inv = snap.data();

  if (inv.userId !== currentUser.uid) {
    // Extra client-side guard; Firestore Security Rules are the real
    // enforcement point that prevents this read from succeeding at all.
    showToast("You do not have access to this invoice.", "error");
    window.location.href = "invoices.html";
    return;
  }

  editingInvoiceId = invoiceId;
  existingInvoiceNumber = inv.invoiceNumber;
  pageTitle.textContent = "Edit invoice";
  invoiceNumberDisplay.textContent = inv.invoiceNumber;

  await loadCustomers(inv.customerId);
  invoiceDateInput.value = inv.invoiceDate || todayIso();
  dueDateInput.value = inv.dueDate || "";
  invoiceStatusSelect.value = inv.status || "Draft";
  discountInput.value = inv.discount || 0;
  invoiceNotesInput.value = inv.notes || "";

  itemsBody.innerHTML = "";

  // Load line items for this invoice from the invoiceItems collection.
  const itemsQuery = query(
    collection(db, "invoiceItems"),
    where("invoiceId", "==", invoiceId)
  );
  const itemsSnap = await getDocs(itemsQuery);
  const items = [];
  itemsSnap.forEach((d) => items.push(d.data()));

  if (items.length === 0) {
    addItemRow();
  } else {
    items.forEach((item) => addItemRow(item));
  }

  recalculateTotals();
}

async function initNewInvoice() {
  pageTitle.textContent = "New invoice";
  await loadCustomers();
  invoiceDateInput.value = todayIso();
  invoiceNumberDisplay.textContent = "(auto-generated)";
  addItemRow();
}

invoiceForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const customerId = customerSelect.value;
  const customerName = customerSelect.selectedOptions[0]?.dataset.name || "";

  if (!customerId) {
    showToast("Please select a customer.", "error");
    return;
  }

  const items = getItemsFromDom().filter((i) => i.description);
  if (items.length === 0) {
    showToast("Please add at least one invoice item.", "error");
    return;
  }

  // Re-validate/recompute totals server-of-truth style, right before save,
  // rather than trusting whatever is currently rendered on screen.
  const { subtotal, tax, discount, total } = recalculateTotals();

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const invoiceData = {
      userId: currentUser.uid,
      customerId,
      customerName,
      invoiceDate: invoiceDateInput.value,
      dueDate: dueDateInput.value || null,
      subtotal,
      tax,
      discount,
      total,
      status: invoiceStatusSelect.value,
      notes: invoiceNotesInput.value.trim() || null,
    };

    let invoiceId = editingInvoiceId;

    if (invoiceId) {
      await updateDoc(doc(db, "invoices", invoiceId), invoiceData);
    } else {
      const invoiceNumber = await generateInvoiceNumber();
      const docRef = await addDoc(collection(db, "invoices"), {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
      });
      invoiceId = docRef.id;
    }

    // Replace invoice items: delete old ones, write current ones.
    await saveInvoiceItems(invoiceId, items);

    showToast("Invoice saved.", "success");
    window.location.href = "invoices.html";
  } catch (err) {
    console.error("Failed to save invoice:", err);
    showToast("Unable to save invoice. Please try again.", "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save invoice";
  }
});

async function saveInvoiceItems(invoiceId, items) {
  // Remove any existing items for this invoice before writing the current set.
  if (editingInvoiceId) {
    const existingQuery = query(
      collection(db, "invoiceItems"),
      where("invoiceId", "==", invoiceId)
    );
    const existingSnap = await getDocs(existingQuery);
    const { deleteDoc, doc: fsDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );
    const deletions = [];
    existingSnap.forEach((d) => {
      deletions.push(deleteDoc(fsDoc(db, "invoiceItems", d.id)));
    });
    await Promise.all(deletions);
  }

  const writes = items.map((item) =>
    addDoc(collection(db, "invoiceItems"), {
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      lineTotal: item.lineTotal,
    })
  );
  await Promise.all(writes);
}

(async function init() {
  const result = await requireApprovedUser();
  if (!result) return;
  currentUser = result.user;
  populateNavUser(result.profile, result.user);
  bindLogoutButtons();

  const params = new URLSearchParams(window.location.search);
  const invoiceId = params.get("id");

  if (invoiceId) {
    await loadExistingInvoice(invoiceId);
  } else {
    await initNewInvoice();
  }
})();
