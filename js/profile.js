// ==========================================================================
// profile.js — Handle user profile information.
//
// Users may update their own fullName, phone, and organizationName.
// They cannot change their own role or status from this page — those
// fields are intentionally excluded from the update payload, and
// Firestore Security Rules must independently reject any client attempt
// to modify role or status on their own user document.
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  requireApprovedUser,
  bindLogoutButtons,
  populateNavUser,
  showToast,
} from "./auth.js";
import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const profileEmail = document.getElementById("profile-email");
const profileFullName = document.getElementById("profile-fullName");
const profilePhone = document.getElementById("profile-phone");
const profileOrganizationName = document.getElementById("profile-organizationName");
const profileRole = document.getElementById("profile-role");
const profileStatus = document.getElementById("profile-status");
const profileForm = document.getElementById("profile-form");
const profileSaveBtn = document.getElementById("profile-save-btn");
const profileAlert = document.getElementById("profile-alert");

let currentUser = null;

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

function fillForm(user, profile) {
  profileEmail.value = user.email || "";
  profileFullName.value = profile.fullName || "";
  profilePhone.value = profile.phone || "";
  profileOrganizationName.value = profile.organizationName || "";

  profileRole.textContent = profile.role || "user";
  profileStatus.textContent = profile.status || "pending";
  profileStatus.className = `badge ${statusBadgeClass(profile.status)}`;
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileAlert.innerHTML = "";

  const fullName = profileFullName.value.trim();
  if (!fullName) {
    showToast("Full name is required.", "error");
    return;
  }

  profileSaveBtn.disabled = true;
  profileSaveBtn.textContent = "Saving…";

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      fullName,
      phone: profilePhone.value.trim() || null,
      organizationName: profileOrganizationName.value.trim() || null,
    });
    showToast("Profile updated.", "success");
  } catch (err) {
    console.error("Failed to update profile:", err);
    showToast("Unable to update profile. Please try again.", "error");
  } finally {
    profileSaveBtn.disabled = false;
    profileSaveBtn.textContent = "Save changes";
  }
});

(async function init() {
  const result = await requireApprovedUser();
  if (!result) return;
  currentUser = result.user;
  populateNavUser(result.profile, result.user);
  bindLogoutButtons();
  fillForm(result.user, result.profile);
})();
