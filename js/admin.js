// ==========================================================================
// admin.js — Handles admin dashboard functionality: viewing registrations,
// approving, rejecting, and revoking users.
//
// SECURITY NOTE: This page is only reachable in the UI for users whose
// Firestore profile has role == "admin" (enforced client-side by
// requireAdmin() in auth.js for a smooth experience). The actual security
// boundary — preventing a non-admin from writing role/status changes to
// other users' documents, or from reading this data at all — must be
// enforced by Firestore Security Rules on the server side. This file must
// never be treated as the source of truth for who is allowed to act as an
// admin.
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  requireAdmin,
  bindLogoutButtons,
  populateNavUser,
  showToast,
} from "./auth.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tabs = document.querySelectorAll(".admin-tab");
const panels = document.querySelectorAll(".admin-panel");

const pendingBody = document.getElementById("pending-body");
const approvedBody = document.getElementById("approved-body");
const rejectedBody = document.getElementById("rejected-body");
const revokedBody = document.getElementById("revoked-body");
const allBody = document.getElementById("all-body");

const countPending = document.getElementById("count-pending");
const countApproved = document.getElementById("count-approved");
const countRejected = document.getElementById("count-rejected");
const countRevoked = document.getElementById("count-revoked");
const countAll = document.getElementById("count-all");

const rejectModalOverlay = document.getElementById("reject-modal-overlay");
const rejectNotePreview = document.getElementById("reject-note-preview");
const rejectCancelBtn = document.getElementById("reject-cancel-btn");
const rejectConfirmBtn = document.getElementById("reject-confirm-btn");

const revokeModalOverlay = document.getElementById("revoke-modal-overlay");
const revokeCancelBtn = document.getElementById("revoke-cancel-btn");
const revokeConfirmBtn = document.getElementById("revoke-confirm-btn");

let allUsers = [];
let pendingRejectUid = null;
let pendingRevokeUid = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "—";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString();
}

function statusBadgeClass(status) {
  switch (status) {
    case "approved":
      return "badge-approved";
    case "pending":
      return "badge-pending";
    case "rejected":
      return "badge-rejected";
    case "revoked":
      return "badge-revoked";
    default:
      return "badge-pending";
  }
}

// ---- Tabs ----
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ---- Data loading ----
async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers = [];
    snap.forEach((docSnap) => allUsers.push({ uid: docSnap.id, ...docSnap.data() }));
    renderAll();
  } catch (err) {
    console.error("Failed to load users:", err);
    [pendingBody, approvedBody, rejectedBody, revokedBody, allBody].forEach((body) => {
      body.innerHTML =
        '<tr><td colspan="7" class="table-empty">Unable to load users.</td></tr>';
    });
  }
}

function renderAll() {
  const pending = allUsers.filter((u) => u.status === "pending");
  const approved = allUsers.filter((u) => u.status === "approved");
  const rejected = allUsers.filter((u) => u.status === "rejected");
  const revoked = allUsers.filter((u) => u.status === "revoked");

  countPending.textContent = pending.length;
  countApproved.textContent = approved.length;
  countRejected.textContent = rejected.length;
  countRevoked.textContent = revoked.length;
  countAll.textContent = allUsers.length;

  renderPending(pending);
  renderApproved(approved);
  renderRejected(rejected);
  renderRevoked(revoked);
  renderAllUsers(allUsers);
}

function renderPending(users) {
  if (users.length === 0) {
    pendingBody.innerHTML =
      '<tr><td colspan="7" class="table-empty">No pending registration requests.</td></tr>';
    return;
  }

  pendingBody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.organizationName || "—")}</td>
        <td class="text-sm">${escapeHtml(u.accessReason || "—")}</td>
        <td><div class="verification-note-box">${escapeHtml(u.verificationNote || "—")}</div></td>
        <td class="text-sm">${formatDate(u.createdAt)}</td>
        <td>
          <div class="admin-actions-cell">
            <button class="btn btn-success btn-sm" data-approve="${u.uid}">Approve</button>
            <button class="btn btn-danger btn-sm" data-reject="${u.uid}">Reject</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  pendingBody.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => setUserStatus(btn.dataset.approve, "approved"));
  });
  pendingBody.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => openRejectModal(btn.dataset.reject));
  });
}

function renderApproved(users) {
  if (users.length === 0) {
    approvedBody.innerHTML =
      '<tr><td colspan="6" class="table-empty">No approved users yet.</td></tr>';
    return;
  }

  approvedBody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.organizationName || "—")}</td>
        <td>
          <select class="role-select" data-role-select="${u.uid}">
            <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td class="text-sm">${formatDate(u.createdAt)}</td>
        <td>
          <button class="btn btn-danger btn-sm" data-revoke="${u.uid}">Revoke access</button>
        </td>
      </tr>`
    )
    .join("");

  approvedBody.querySelectorAll("[data-role-select]").forEach((select) => {
    select.addEventListener("change", () =>
      updateUserRole(select.dataset.roleSelect, select.value)
    );
  });
  approvedBody.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", () => openRevokeModal(btn.dataset.revoke));
  });
}

function renderRejected(users) {
  if (users.length === 0) {
    rejectedBody.innerHTML =
      '<tr><td colspan="4" class="table-empty">No rejected registrations.</td></tr>';
    return;
  }

  rejectedBody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><div class="verification-note-box">${escapeHtml(u.verificationNote || "—")}</div></td>
        <td>
          <button class="btn btn-success btn-sm" data-approve="${u.uid}">Approve instead</button>
        </td>
      </tr>`
    )
    .join("");

  rejectedBody.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => setUserStatus(btn.dataset.approve, "approved"));
  });
}

function renderRevoked(users) {
  if (users.length === 0) {
    revokedBody.innerHTML =
      '<tr><td colspan="4" class="table-empty">No revoked users.</td></tr>';
    return;
  }

  revokedBody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.organizationName || "—")}</td>
        <td>
          <button class="btn btn-success btn-sm" data-approve="${u.uid}">Restore access</button>
        </td>
      </tr>`
    )
    .join("");

  revokedBody.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => setUserStatus(btn.dataset.approve, "approved"));
  });
}

function renderAllUsers(users) {
  if (users.length === 0) {
    allBody.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>';
    return;
  }

  const sorted = [...users].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));

  allBody.innerHTML = sorted
    .map(
      (u) => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.role || "user")}</td>
        <td><span class="badge ${statusBadgeClass(u.status)}">${escapeHtml(u.status || "pending")}</span></td>
        <td></td>
      </tr>`
    )
    .join("");
}

// ---- Actions ----
async function setUserStatus(uid, status) {
  try {
    await updateDoc(doc(db, "users", uid), { status });
    showToast(`User ${status}.`, "success");
    await loadUsers();
  } catch (err) {
    console.error("Failed to update user status:", err);
    showToast("Unable to update user status.", "error");
  }
}

async function updateUserRole(uid, role) {
  try {
    await updateDoc(doc(db, "users", uid), { role });
    showToast("Role updated.", "success");
    await loadUsers();
  } catch (err) {
    console.error("Failed to update user role:", err);
    showToast("Unable to update role.", "error");
    await loadUsers();
  }
}

function openRejectModal(uid) {
  pendingRejectUid = uid;
  const user = allUsers.find((u) => u.uid === uid);
  rejectNotePreview.textContent = user?.verificationNote || "No verification note provided.";
  rejectModalOverlay.classList.remove("hidden");
}

function closeRejectModal() {
  pendingRejectUid = null;
  rejectModalOverlay.classList.add("hidden");
}

rejectCancelBtn.addEventListener("click", closeRejectModal);

rejectConfirmBtn.addEventListener("click", async () => {
  if (!pendingRejectUid) return;
  rejectConfirmBtn.disabled = true;
  await setUserStatus(pendingRejectUid, "rejected");
  rejectConfirmBtn.disabled = false;
  closeRejectModal();
});

function openRevokeModal(uid) {
  pendingRevokeUid = uid;
  revokeModalOverlay.classList.remove("hidden");
}

function closeRevokeModal() {
  pendingRevokeUid = null;
  revokeModalOverlay.classList.add("hidden");
}

revokeCancelBtn.addEventListener("click", closeRevokeModal);

revokeConfirmBtn.addEventListener("click", async () => {
  if (!pendingRevokeUid) return;
  revokeConfirmBtn.disabled = true;
  await setUserStatus(pendingRevokeUid, "revoked");
  revokeConfirmBtn.disabled = false;
  closeRevokeModal();
});

(async function init() {
  const result = await requireAdmin();
  if (!result) return;
  populateNavUser(result.profile, result.user);
  bindLogoutButtons();
  await loadUsers();
})();
