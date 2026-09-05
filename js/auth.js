// ==========================================================================
// auth.js — Shared authentication state, access guards, and small UI helpers
//
// This module is imported by every protected page (dashboard, invoices,
// invoice, customers, admin, profile) as well as login/register.
//
// Responsibilities:
// - Track Firebase Authentication state
// - Load the current user's Firestore profile (users/{uid})
// - Guard pages so that only users with the correct status/role can view them
// - Provide logout functionality
// - Provide a small toast notification helper used across the app
//
// SECURITY NOTE:
// The checks in this file (e.g. redirecting non-admins away from admin.html)
// are for USER EXPERIENCE only. They stop normal users from *seeing* pages
// they shouldn't use, but they do not by themselves protect any data.
// The actual security boundary is enforced by Firestore Security Rules on
// the server side. Never assume a page-level redirect is sufficient
// protection for the underlying data.
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Resolves with { user, profile } once Firebase has determined whether
 * someone is signed in. `user` is the Firebase Auth user object (or null).
 * `profile` is the corresponding Firestore users/{uid} document data
 * (or null if not signed in, or if the profile doesn't exist yet).
 */
function getCurrentAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) {
        resolve({ user: null, profile: null });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const profile = snap.exists() ? snap.data() : null;
        resolve({ user, profile });
      } catch (err) {
        console.error("Failed to load user profile:", err);
        resolve({ user, profile: null });
      }
    });
  });
}

/**
 * Fetches the current user's profile fresh from Firestore (bypasses any
 * cached copy). Useful after an admin approves/rejects/revokes an account,
 * or after a profile update.
 */
async function fetchProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Guards a page that requires the visitor to be signed OUT (e.g. login,
 * register, index). If already signed in and approved, sends them to the
 * dashboard. If signed in but pending/rejected/revoked, sends them to the
 * appropriate status page.
 */
async function redirectIfAuthenticated() {
  const { user, profile } = await getCurrentAuthState();
  if (!user) return;

  if (!profile) {
    // Signed in but no profile document yet — treat as pending.
    window.location.href = "login.html";
    return;
  }

  if (profile.status === "approved") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "login.html";
  }
}

/**
 * Guards a page that requires an approved, signed-in user. Redirects to
 * login.html if not signed in, or to login.html (which will show the
 * appropriate status message) if the account is pending/rejected/revoked.
 *
 * Returns { user, profile } if access is allowed, so the calling page's
 * script can continue loading its own data.
 */
async function requireApprovedUser() {
  const { user, profile } = await getCurrentAuthState();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  if (!profile || profile.status !== "approved") {
    window.location.href = "login.html";
    return null;
  }

  return { user, profile };
}

/**
 * Guards a page that requires an approved admin. Redirects non-admins back
 * to the dashboard. This is a UX convenience only — the real protection is
 * in Firestore Security Rules.
 */
async function requireAdmin() {
  const result = await requireApprovedUser();
  if (!result) return null;

  if (result.profile.role !== "admin") {
    window.location.href = "dashboard.html";
    return null;
  }

  return result;
}

/**
 * Signs the current user out and redirects to the login page.
 */
async function logout() {
  try {
    await signOut(auth);
  } finally {
    window.location.href = "login.html";
  }
}

/**
 * Wires up any element with [data-logout] to call logout() on click.
 * Call this once a protected page has finished setting up its nav.
 */
function bindLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });
}

/**
 * Displays a small transient toast notification. Creates the toast
 * container on first use.
 * @param {string} message
 * @param {"info"|"success"|"error"} type
 */
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/**
 * Populates any [data-user-name] / [data-user-email] elements in the page
 * nav with the signed-in user's info. Convenience for protected pages.
 */
function populateNavUser(profile, user) {
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = profile?.fullName || user?.email || "Account";
  });
  document.querySelectorAll("[data-user-email]").forEach((el) => {
    el.textContent = user?.email || "";
  });
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = profile?.role === "admin" ? "" : "none";
  });
}

export {
  getCurrentAuthState,
  fetchProfile,
  redirectIfAuthenticated,
  requireApprovedUser,
  requireAdmin,
  logout,
  bindLogoutButtons,
  showToast,
  populateNavUser,
};
