// ==========================================================================
// login.js — Handles Firebase login and redirects the user according to
// their account status (pending / approved / rejected / revoked).
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const loginAlert = document.getElementById("login-alert");
const loginSubmit = document.getElementById("login-submit");
const loginCard = document.getElementById("login-card");

const statusCard = document.getElementById("status-card");
const statusIcon = document.getElementById("status-icon");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const statusLogoutBtn = document.getElementById("status-logout");

const STATUS_CONTENT = {
  pending: {
    icon: "⏳",
    title: "Your account is pending approval",
    message:
      "An administrator needs to review and approve your account before you can access the invoice system. Please check back later.",
  },
  rejected: {
    icon: "🚫",
    title: "Your registration was not approved",
    message:
      "Your account request was reviewed and was not approved. If you believe this is a mistake, please contact the administrator.",
  },
  revoked: {
    icon: "⚠️",
    title: "Your access has been revoked",
    message:
      "Your account access has been revoked by an administrator. Please contact the administrator for more information.",
  },
  missing: {
    icon: "❓",
    title: "Account profile not found",
    message:
      "We couldn't find a profile for this account. Please contact the administrator, or register again.",
  },
};

function showAlert(message, type = "error") {
  loginAlert.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function clearAlert() {
  loginAlert.innerHTML = "";
}

function showStatusScreen(statusKey) {
  loginCard.classList.add("hidden");
  statusCard.classList.remove("hidden");
  const content = STATUS_CONTENT[statusKey] || STATUS_CONTENT.missing;
  statusIcon.textContent = content.icon;
  statusTitle.textContent = content.title;
  statusMessage.textContent = content.message;
}

statusLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  statusCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
});

async function routeSignedInUser(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      showStatusScreen("missing");
      return;
    }
    const profile = snap.data();
    if (profile.status === "approved") {
      window.location.href = "dashboard.html";
      return;
    }
    showStatusScreen(profile.status || "pending");
  } catch (err) {
    console.error("Failed to load profile after login:", err);
    showAlert("Something went wrong loading your account. Please try again.");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginSubmit.disabled = true;
  loginSubmit.textContent = "Logging in…";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await routeSignedInUser(cred.user);
  } catch (err) {
    console.error("Login error:", err);
    showAlert(friendlyAuthError(err));
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Log in";
  }
});

function friendlyAuthError(err) {
  switch (err.code) {
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Unable to log in. Please try again.";
  }
}

// If a user is already signed in when this page loads (e.g. they refreshed
// while pending), route them straight away instead of showing the form.
onAuthStateChanged(auth, (user) => {
  if (user) {
    routeSignedInUser(user);
  }
});
