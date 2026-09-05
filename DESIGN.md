# Design Document

This document explains the design and technical decisions behind the
Invoice Management System. It focuses on *how* the system was designed
and *why*, rather than repeating the feature list in [README.md](README.md).

---

## 1. Overall architecture

The application is a **static, client-rendered, multi-page site**. There
is no backend server of any kind — every page is a plain HTML file that
loads a dedicated CSS file and a dedicated JavaScript module, and that
JavaScript talks directly to Firebase from the browser.

```
Browser (HTML/CSS/JS)
        │
        ├──► Firebase Authentication  (who is this user?)
        │
        └──► Cloud Firestore          (what data can they read/write?)
```

Each page is self-contained: `dashboard.html` loads `js/dashboard.js`,
`admin.html` loads `js/admin.js`, and so on. Shared logic (Firebase
initialization, auth-state checks, page guards, logout, toast
notifications) lives in `js/firebase-config.js` and `js/auth.js`, and is
imported wherever it's needed via native ES module `import` statements.
There is no bundler or build step — the browser loads exactly the files
that are on disk.

This is a deliberately simple architecture for a CS50-scale educational
project: it's easy to trace a bug to a single file, easy to explain in a
walkthrough video, and doesn't require the student (or grader) to run a
build pipeline to see the code that actually executes.

---

## 2. Why HTML, CSS, and Vanilla JavaScript

- **No framework overhead.** React, Vue, or similar tools solve problems
  (complex state synchronization, component reuse across a large app)
  that this project doesn't really have. Nine pages with mostly
  page-local state is comfortably within what plain DOM APIs can handle
  clearly.
- **No build step.** Anyone can clone the repository, add their Firebase
  config, and open the app in a browser (via a simple static server) —
  no `npm install`, no bundler, no transpilation.
- **Transparency for grading/learning.** Every line of JavaScript that
  runs in the browser is visible in the `js/` folder exactly as written.
  There's no compiled output to reconcile with source.
- **Native ES modules are enough.** Modern browsers support `import`/
  `export` natively, which gives just enough modularity (shared
  `auth.js`/`firebase-config.js` across nine pages) without needing a
  module bundler.

The tradeoff is more manual DOM manipulation (`querySelector`,
`innerHTML` templating) than a framework would require. For an app this
size, that tradeoff is worth the reduced complexity.

---

## 3. Why Firebase Authentication

- Handles password hashing, session/token management, and auth-state
  persistence without the project needing to write or store any of that
  itself.
- Provides `onAuthStateChanged()`, a single reliable hook for "is someone
  signed in right now" that every protected page can use.
- Integrates natively with Firestore Security Rules via
  `request.auth.uid`, which is what makes user-level data isolation
  possible without a custom backend.
- Email/Password is the only sign-in method enabled, since the project
  intentionally avoids collecting more identity information than
  necessary (see Privacy section in the README) and doesn't need social
  login for a small internal tool.

## 4. Why Cloud Firestore

- A document database maps naturally onto the app's data shapes: a user
  profile, a customer, an invoice, and an invoice line item are all
  independent, loosely related documents rather than requiring complex
  joins.
- Firestore Security Rules let access control live at the **data layer**,
  which is the actual security boundary for this app (see Section 8).
  A SQL database reached through a REST API would need a custom backend
  to enforce the same rules — exactly what this project intentionally
  avoids.
- Real-time listeners (`onSnapshot`) were considered but not used; the
  app instead uses one-time reads (`getDocs`/`getDoc`) triggered on page
  load or after a mutation, which is simpler to reason about for a
  single-user-editing-their-own-data use case and keeps the code easier
  to follow for a CS50 project.
- Firebase Storage was deliberately **not** enabled — the app has no file
  upload feature (no logos, no attachments), so there was no reason to
  add another service and another set of security rules to think about.

---

## 5. Firestore database structure

```
users/{uid}
  fullName, email, phone, organizationName,
  accessReason, verificationNote,
  role: "user" | "admin"
  status: "pending" | "approved" | "rejected" | "revoked"
  createdAt

customers/{customerId}
  userId          ← owner's UID
  name, email, phone, address
  createdAt

invoices/{invoiceId}
  userId          ← owner's UID
  customerId, customerName
  invoiceNumber   ← e.g. INV-2026-000001
  invoiceDate, dueDate
  subtotal, tax, discount, total
  status: "Draft" | "Pending" | "Paid" | "Cancelled"
  notes
  createdAt

invoiceItems/{itemId}
  invoiceId       ← parent invoice
  description, quantity, unitPrice, taxRate, lineTotal
```

**Why four flat top-level collections instead of nested subcollections
(e.g. `invoices/{id}/items`)?** Firestore queries cannot easily span
subcollections across different parent documents, and flat collections
with a foreign-key-style field (`userId`, `invoiceId`) keep every query
in this app to a single, simple `where()` clause. It also keeps the
Security Rules simpler: one rule per top-level collection, rather than
rules that need to reason about rule inheritance through nested paths.

`customerName` is intentionally **denormalized** onto the invoice
document at save time (copied from the customer record rather than
looked up every time). This means an invoice retains the customer's name
as it was when the invoice was created/last saved, and invoice listing
pages don't need a second read per invoice just to show who it's for.

---

## 6. How authentication works

1. `firebase-config.js` initializes one shared `Auth` and `Firestore`
   instance, exported for every other module to import.
2. `auth.js` centralizes:
   - `getCurrentAuthState()` — resolves the current Firebase user plus
     their Firestore profile in one call.
   - `requireApprovedUser()` / `requireAdmin()` — page guards that
     redirect away if the visitor doesn't meet the bar, and otherwise
     return `{ user, profile }` for the page's own script to use.
   - `logout()`, `bindLogoutButtons()`, `showToast()`,
     `populateNavUser()` — small shared UI conveniences used on every
     protected page.
3. Each protected page's script (`dashboard.js`, `invoices.js`, etc.)
   calls the relevant guard as the very first thing it does, and only
   proceeds to load page data if the guard returns a result.

This keeps the "am I allowed to be here" logic in one place instead of
duplicated nine times, while still letting each page own its own data
loading.

---

## 7. How account approval works

Every new account is created with `status: "pending"` by `register.js` —
this is a hardcoded default in the client, not something the registering
user can influence via the form. A pending account can authenticate
successfully (Firebase Authentication has no concept of "pending"), but
`login.js` reads the user's Firestore profile immediately after sign-in
and, if `status !== "approved"`, shows a status screen instead of
redirecting to the dashboard.

The status field only moves through the transitions the UI exposes:

```
pending ──(admin approves)──► approved ──(admin revokes)──► revoked
   │                              ▲                             │
   └──────(admin rejects)──► rejected ─(admin approves)─────────┘
```

Admins can move a `rejected` or `revoked` account back to `approved`
directly from `admin.html`, which covers "I made a mistake" or "this
person should get access back" without needing a separate re-registration
flow.

**Why gate on both Authentication success and a separate Firestore
status field, instead of just deleting the account until approved?**
Because the registration form's verification note and reason for access
need to be reviewable by an admin, and that information is far easier
to store and query in Firestore than to attach to a Firebase Auth user
record. It also means a rejected applicant's information is preserved
for the admin's records rather than being deleted outright.

---

## 8. How Admin permissions work

Admin status is a `role` field (`"user"` or `"admin"`) on the user's own
`users/{uid}` document. There is no separate admin collection or admin
account type — an admin is simply a user document with `role: "admin"`
and `status: "approved"`.

Two layers enforce this, and they are **not equivalent**:

1. **Client-side (`requireAdmin()` in `auth.js`)** — redirects a non-admin
   away from `admin.html` before it renders. This exists purely for
   usability: a non-admin never sees a page full of controls they can't
   use.
2. **Firestore Security Rules (server-side, not included as code in this
   repository but required for deployment)** — must independently check
   `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"`
   before allowing a read of the full `users` collection or a write to
   another user's `role`/`status` field.

The client-side guard can be bypassed trivially by anyone who edits
JavaScript in their browser's dev tools — setting a local variable to
`role = "admin"` proves nothing to Firestore. The only thing that
actually stops a non-admin from, say, approving their own account is the
security rule rejecting the write server-side. This project's README and
in-code comments repeatedly flag this distinction because it's the single
most important security concept in the whole system.

There is intentionally **no page that lets a user grant themselves
admin**. The very first admin account must be created by manually editing
the Firestore document in the Firebase Console after registering
normally — see the README's Firebase Setup section.

---

## 9. How Firestore Security Rules protect user data

Rules (to be written and published in the Firebase Console, not part of
this repository's static files) should enforce, at minimum:

- **Unauthenticated requests** are denied entirely for all collections.
- **`users/{uid}`**
  - A signed-in user may read and update their *own* document, but the
    update must not change `role` or `status` (only an admin's write
    should be able to touch those fields).
  - An admin (per the check described in Section 8) may read any user
    document and update `role`/`status` on any user document.
- **`customers/{id}`, `invoices/{id}`, `invoiceItems/{id}`**
  - A signed-in, *approved* user may create documents where
    `userId == request.auth.uid` (or, for `invoiceItems`, where the
    parent invoice's `userId` matches).
  - A signed-in user may read/update/delete only documents where
    `userId == request.auth.uid`.
  - Pending, rejected, or revoked users are denied entirely, even though
    they are "signed in" from Authentication's point of view — the rule
    must check the requester's own `users/{uid}.status`, not just that
    `request.auth` exists.

This is what makes the "User A can never read User B's invoices" and
"pending users can't reach invoices" guarantees actually hold, regardless
of what the browser's JavaScript does or doesn't check first.

---

## 10. How invoices and customers are related

A `customer` is created independently of any invoice. An `invoice`
references a customer by `customerId`, and separately stores a
denormalized `customerName` snapshot (see Section 5). An `invoice` has
zero or more `invoiceItems`, each referencing it by `invoiceId`.

Deleting an invoice (`invoices.js`) also deletes its associated
`invoiceItems` — the app queries `invoiceItems` where `invoiceId` matches
before deleting, since Firestore doesn't cascade deletes automatically.
Deleting a *customer*, by contrast, does **not** touch any invoices that
reference it — past invoices keep their stored `customerName` snapshot,
so a business's invoice history remains intact even if a customer record
is later removed.

---

## 11. How the files work together

- **`firebase-config.js`** is the only file that calls `initializeApp()`.
  Every other file imports `auth`/`db` from here rather than
  re-initializing Firebase.
- **`auth.js`** is imported by every page except `index.html`,
  `login.html`, and `register.html` (which instead use
  `redirectIfAuthenticated()` for the opposite check — keeping already
  logged-in, approved users away from the login/registration forms).
- **Page-specific scripts** (`dashboard.js`, `invoices.js`, `invoice.js`,
  `customers.js`, `admin.js`, `profile.js`) each:
  1. Call the appropriate guard from `auth.js` as their first action.
  2. Wire up their own page's DOM elements and event listeners.
  3. Read/write only the Firestore collections relevant to that page.
- **CSS** is split by concern rather than by page, so pages that share a
  visual language (dashboard, invoices, invoice, customers, profile) all
  load the same `dashboard.css` instead of duplicating those rules four
  times. `style.css` holds everything genuinely shared (buttons, forms,
  tables, nav, cards) so it's the single place to change, say, the
  primary button color.

---

## 12. Notable design decisions

- **Invoice numbers are generated client-side** by counting the user's
  existing invoices for the current year (`INV-2026-000001`, etc.) rather
  than using a server-side counter, since there's no server. This is
  simple and adequate for a single-admin, low-volume educational project,
  but see Limitations below for its weakness.
- **Totals are recalculated immediately before saving**, not just
  displayed reactively in the UI, so that a manipulated DOM value can't
  end up persisted to Firestore as-is.
- **Toasts over `alert()`** — a small custom toast system
  (`showToast()` in `auth.js`) is used everywhere instead of the
  browser's blocking `alert()`/`confirm()`, and destructive actions
  (delete customer, delete invoice, reject user, revoke access) use a
  custom confirmation modal instead of `confirm()`, for a more consistent
  and less jarring experience.
- **Print support** uses the browser's native `window.print()` combined
  with a `@media print` stylesheet that hides navigation and action
  buttons, rather than generating a PDF — keeping the "no backend, no
  extra libraries" constraint intact.

---

## 13. Limitations and possible future improvements

- **Invoice number generation is not race-safe.** Two invoices created in
  rapid succession (e.g. from two open tabs) could theoretically compute
  the same "next number" before either write completes, since the count
  is read and then written without a transaction. A production version
  should use a Firestore transaction or a server-side counter (e.g. a
  Cloud Function) to guarantee uniqueness.
- **No Cloud Functions.** All validation (e.g. "does this status
  transition make sense", "is this total actually correct") happens in
  client JavaScript and, ideally, Firestore Security Rules. There's no
  trusted server-side code that could, for example, send an email
  notification when an account is approved. Adding Cloud Functions would
  be a natural next step for a more complete product.
- **No pagination.** Invoice and user lists are fetched in a single
  `getDocs()` call. This is fine at small scale (a CS50 project's likely
  usage) but would need cursor-based pagination for a business with
  thousands of invoices.
- **No email notifications.** Users aren't notified when their account is
  approved/rejected — they have to check by trying to log in again.
- **Single currency.** Currency formatting is hardcoded to the browser's
  locale with USD; multi-currency support would require storing a
  currency code per invoice.
- **No audit log.** Admin actions (approve/reject/revoke, role changes)
  aren't recorded anywhere other than the current state. A production
  system might add an `auditLog` collection for accountability.
