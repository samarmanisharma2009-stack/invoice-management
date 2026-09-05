// ==========================================================================
// register.js — Handles registration and creation of the user's Firestore
// profile. New users always receive status: "pending" and role: "user".
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("register-form");
const alertBox = document.getElementById("register-alert");
const submitBtn = document.getElementById("register-submit");
const registerCard = document.getElementById("register-card");
const successCard = document.getElementById("success-card");

function showAlert(message, type = "error") {
  alertBox.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function clearAlert() {
  alertBox.innerHTML = "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const phone = document.getElementById("phone").value.trim();
  const organizationName = document.getElementById("organizationName").value.trim();
  const accessReason = document.getElementById("accessReason").value.trim();
  const verificationNote = document.getElementById("verificationNote").value.trim();

  if (password !== confirmPassword) {
    showAlert("Passwords do not match.");
    return;
  }

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    // 1. Create the Firebase Authentication account.
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // 2. Create the corresponding Firestore profile document.
    //    New accounts always start as role "user" and status "pending".
    //    (A client could try to set role: "admin" here, but Firestore
    //    Security Rules must reject any write that sets a non-default
    //    role or status — the client-side value is never trusted.)
    await setDoc(doc(db, "users", uid), {
      fullName,
      email,
      phone: phone || null,
      organizationName: organizationName || null,
      accessReason,
      verificationNote,
      role: "user",
      status: "pending",
      createdAt: serverTimestamp(),
    });

    // 3. Show the success screen instead of redirecting straight to login,
    //    since a pending account cannot access the system yet.
    form.reset();
    registerCard.classList.add("hidden");
    successCard.classList.remove("hidden");
  } catch (err) {
    console.error("Registration error:", err);
    showAlert(friendlyAuthError(err));
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit registration request";
  }
});

function friendlyAuthError(err) {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    default:
      return "Unable to complete registration. Please try again.";
  }
}
