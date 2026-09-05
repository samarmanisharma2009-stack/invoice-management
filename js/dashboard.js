// ==========================================================================
// dashboard.js — Handles dashboard data and statistics.
//
// Loads the current user's own invoices (Firestore Security Rules ensure
// the query can only return documents where userId == current uid) and
// computes summary statistics: total, pending, paid, and total billed.
// Also displays the 5 most recently created invoices.
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  requireApprovedUser,
  bindLogoutButtons,
  populateNavUser,
} from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const welcomeText = document.getElementById("welcome-text");
const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statPaid = document.getElementById("stat-paid");
const statTotalBilled = document.getElementById("stat-total-billed");
const recentBody = document.getElementById("recent-invoices-body");

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString();
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

async function loadDashboard(user, profile) {
  populateNavUser(profile, user);
  welcomeText.textContent = `Welcome back, ${profile.fullName || user.email}.`;

  try {
    const invoicesQuery = query(
      collection(db, "invoices"),
      where("userId", "==", user.uid)
    );
    const snap = await getDocs(invoicesQuery);

    const invoices = [];
    snap.forEach((docSnap) => {
      invoices.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderStats(invoices);
    renderRecentInvoices(invoices);
  } catch (err) {
    console.error("Failed to load invoices for dashboard:", err);
    recentBody.innerHTML =
      '<tr><td colspan="6" class="table-empty">Unable to load invoices.</td></tr>';
  }
}

function renderStats(invoices) {
  const total = invoices.length;
  const pending = invoices.filter((inv) => inv.status === "Pending").length;
  const paid = invoices.filter((inv) => inv.status === "Paid").length;
  const totalBilled = invoices
    .filter((inv) => inv.status !== "Cancelled")
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  statTotal.textContent = total;
  statPending.textContent = pending;
  statPaid.textContent = paid;
  statTotalBilled.textContent = formatCurrency(totalBilled);
}

function renderRecentInvoices(invoices) {
  if (invoices.length === 0) {
    recentBody.innerHTML =
      '<tr><td colspan="6" class="table-empty">No invoices yet. <a href="invoice.html">Create your first invoice</a>.</td></tr>';
    return;
  }

  const sorted = [...invoices].sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });

  const recent = sorted.slice(0, 5);

  recentBody.innerHTML = recent
    .map(
      (inv) => `
      <tr>
        <td>${escapeHtml(inv.invoiceNumber || "—")}</td>
        <td>${escapeHtml(inv.customerName || "—")}</td>
        <td>${formatDate(inv.invoiceDate)}</td>
        <td>${formatCurrency(inv.total)}</td>
        <td><span class="badge ${statusBadgeClass(inv.status)}">${escapeHtml(inv.status || "Draft")}</span></td>
        <td><a href="invoice.html?id=${inv.id}" class="btn btn-secondary btn-sm">Open</a></td>
      </tr>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

(async function init() {
  const result = await requireApprovedUser();
  if (!result) return;
  bindLogoutButtons();
  await loadDashboard(result.user, result.profile);
})();
