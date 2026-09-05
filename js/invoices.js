// ==========================================================================
// invoices.js — Handles invoice listing, searching, filtering, editing,
// and deletion.
//
// Only invoices belonging to the currently authenticated user are shown.
// The Firestore query is scoped with where("userId", "==", uid), and
// Firestore Security Rules independently enforce that this is the only
// data the query is allowed to return.
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
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const invoicesBody = document.getElementById("invoices-body");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

const deleteModalOverlay = document.getElementById("delete-modal-overlay");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

let currentUser = null;
let allInvoices = [];
let pendingDeleteId = null;

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  return value; // stored as YYYY-MM-DD string from the date input
}

function statusBadgeClass(status) {
  switch (status) {
    case "Paid":
      return "badge-paid";
    case "Pending":
      return "badge-invoice-pending";
    case "Cancelled":
      return "badge-cancelled";
    default:
      return "badge-draft";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderInvoices(invoices) {
  if (invoices.length === 0) {
    invoicesBody.innerHTML =
      '<tr><td colspan="7" class="table-empty">No invoices found.</td></tr>';
    return;
  }

  invoicesBody.innerHTML = invoices
    .map(
      (inv) => `
      <tr>
        <td>${escapeHtml(inv.invoiceNumber || "—")}</td>
        <td>${escapeHtml(inv.customerName || "—")}</td>
        <td>${formatDate(inv.invoiceDate)}</td>
        <td>${formatDate(inv.dueDate)}</td>
        <td>${formatCurrency(inv.total)}</td>
        <td><span class="badge ${statusBadgeClass(inv.status)}">${escapeHtml(inv.status || "Draft")}</span></td>
        <td>
          <div class="admin-actions-cell">
            <a href="invoice.html?id=${inv.id}" class="btn btn-secondary btn-sm">Edit</a>
            <button class="btn btn-danger btn-sm" data-delete="${inv.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  invoicesBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
}

function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  const filtered = allInvoices.filter((inv) => {
    const matchesTerm =
      !term ||
      (inv.invoiceNumber || "").toLowerCase().includes(term) ||
      (inv.customerName || "").toLowerCase().includes(term);
    const matchesStatus = !status || inv.status === status;
    return matchesTerm && matchesStatus;
  });

  renderInvoices(filtered);
}

searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);

function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteModalOverlay.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModalOverlay.classList.add("hidden");
}

deleteCancelBtn.addEventListener("click", closeDeleteModal);

deleteConfirmBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  deleteConfirmBtn.disabled = true;

  try {
    // Delete the invoice document.
    await deleteDoc(doc(db, "invoices", pendingDeleteId));

    // Delete its line items too.
    const itemsQuery = query(
      collection(db, "invoiceItems"),
      where("invoiceId", "==", pendingDeleteId)
    );
    const itemsSnap = await getDocs(itemsQuery);
    const deletions = [];
    itemsSnap.forEach((d) => deletions.push(deleteDoc(doc(db, "invoiceItems", d.id))));
    await Promise.all(deletions);

    showToast("Invoice deleted.", "success");
    closeDeleteModal();
    await loadInvoices();
  } catch (err) {
    console.error("Failed to delete invoice:", err);
    showToast("Unable to delete invoice.", "error");
  } finally {
    deleteConfirmBtn.disabled = false;
  }
});

async function loadInvoices() {
  try {
    const q = query(collection(db, "invoices"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    allInvoices = [];
    snap.forEach((docSnap) => allInvoices.push({ id: docSnap.id, ...docSnap.data() }));
    allInvoices.sort((a, b) => (b.invoiceNumber || "").localeCompare(a.invoiceNumber || ""));
    applyFilters();
  } catch (err) {
    console.error("Failed to load invoices:", err);
    invoicesBody.innerHTML =
      '<tr><td colspan="7" class="table-empty">Unable to load invoices.</td></tr>';
  }
}

(async function init() {
  const result = await requireApprovedUser();
  if (!result) return;
  currentUser = result.user;
  populateNavUser(result.profile, result.user);
  bindLogoutButtons();
  await loadInvoices();
})();
