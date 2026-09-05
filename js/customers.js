// ==========================================================================
// customers.js — Handles customer CRUD operations.
//
// Every customer document stores userId (the owner's Firebase Auth UID).
// Firestore Security Rules ensure a user can only read/write customers
// where userId matches their own uid.
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
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const customersBody = document.getElementById("customers-body");
const searchInput = document.getElementById("search-input");

const newCustomerBtn = document.getElementById("new-customer-btn");
const customerModalOverlay = document.getElementById("customer-modal-overlay");
const customerModalTitle = document.getElementById("customer-modal-title");
const customerForm = document.getElementById("customer-form");
const customerIdInput = document.getElementById("customer-id");
const customerNameInput = document.getElementById("customer-name");
const customerEmailInput = document.getElementById("customer-email");
const customerPhoneInput = document.getElementById("customer-phone");
const customerAddressInput = document.getElementById("customer-address");
const customerCancelBtn = document.getElementById("customer-cancel-btn");
const customerSaveBtn = document.getElementById("customer-save-btn");

const deleteModalOverlay = document.getElementById("delete-modal-overlay");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

let currentUser = null;
let allCustomers = [];
let pendingDeleteId = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function openCustomerModal(customer = null) {
  customerForm.reset();
  if (customer) {
    customerModalTitle.textContent = "Edit customer";
    customerIdInput.value = customer.id;
    customerNameInput.value = customer.name || "";
    customerEmailInput.value = customer.email || "";
    customerPhoneInput.value = customer.phone || "";
    customerAddressInput.value = customer.address || "";
  } else {
    customerModalTitle.textContent = "New customer";
    customerIdInput.value = "";
  }
  customerModalOverlay.classList.remove("hidden");
}

function closeCustomerModal() {
  customerModalOverlay.classList.add("hidden");
}

newCustomerBtn.addEventListener("click", () => openCustomerModal());
customerCancelBtn.addEventListener("click", closeCustomerModal);

customerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = customerIdInput.value;
  const data = {
    name: customerNameInput.value.trim(),
    email: customerEmailInput.value.trim() || null,
    phone: customerPhoneInput.value.trim() || null,
    address: customerAddressInput.value.trim() || null,
  };

  if (!data.name) {
    showToast("Customer name is required.", "error");
    return;
  }

  customerSaveBtn.disabled = true;
  customerSaveBtn.textContent = "Saving…";

  try {
    if (id) {
      await updateDoc(doc(db, "customers", id), data);
      showToast("Customer updated.", "success");
    } else {
      await addDoc(collection(db, "customers"), {
        ...data,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      showToast("Customer added.", "success");
    }
    closeCustomerModal();
    await loadCustomers();
  } catch (err) {
    console.error("Failed to save customer:", err);
    showToast("Unable to save customer. Please try again.", "error");
  } finally {
    customerSaveBtn.disabled = false;
    customerSaveBtn.textContent = "Save customer";
  }
});

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
    await deleteDoc(doc(db, "customers", pendingDeleteId));
    showToast("Customer deleted.", "success");
    closeDeleteModal();
    await loadCustomers();
  } catch (err) {
    console.error("Failed to delete customer:", err);
    showToast("Unable to delete customer.", "error");
  } finally {
    deleteConfirmBtn.disabled = false;
  }
});

function renderCustomers(customers) {
  if (customers.length === 0) {
    customersBody.innerHTML =
      '<tr><td colspan="5" class="table-empty">No customers yet. Click "New customer" to add one.</td></tr>';
    return;
  }

  customersBody.innerHTML = customers
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.email || "—")}</td>
        <td>${escapeHtml(c.phone || "—")}</td>
        <td>${escapeHtml(c.address || "—")}</td>
        <td>
          <div class="admin-actions-cell">
            <button class="btn btn-secondary btn-sm" data-edit="${c.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${c.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");

  customersBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const customer = allCustomers.find((c) => c.id === btn.dataset.edit);
      if (customer) openCustomerModal(customer);
    });
  });

  customersBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.delete));
  });
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    renderCustomers(allCustomers);
    return;
  }
  const filtered = allCustomers.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term)
  );
  renderCustomers(filtered);
}

searchInput.addEventListener("input", applyFilter);

async function loadCustomers() {
  try {
    const q = query(collection(db, "customers"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    allCustomers = [];
    snap.forEach((docSnap) => allCustomers.push({ id: docSnap.id, ...docSnap.data() }));
    allCustomers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    applyFilter();
  } catch (err) {
    console.error("Failed to load customers:", err);
    customersBody.innerHTML =
      '<tr><td colspan="5" class="table-empty">Unable to load customers.</td></tr>';
  }
}

(async function init() {
  const result = await requireApprovedUser();
  if (!result) return;
  currentUser = result.user;
  populateNavUser(result.profile, result.user);
  bindLogoutButtons();
  await loadCustomers();
})();
