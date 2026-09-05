# Invoice Management System

A simple, lightweight invoice management web application built with plain
HTML, CSS, and JavaScript, backed by **Firebase Authentication** and
**Cloud Firestore**. This project was built as a **CS50 Final Project**,
and the technology stack is intentionally kept small: there is no PHP,
Node.js backend server, Express, MySQL, Firebase Storage, AWS, Azure, or
any other backend service.

## Demo video

_Add the link to your project demo video here before submitting._

`[Project demo video — YOUR LINK HERE]`

---

## What this project does

InvoiceHub lets small businesses and freelancers:

- Register for an account and wait for administrator approval
- Log in once approved
- Add and manage customers
- Create, edit, and delete invoices with line items, tax, and discounts
- Track invoice status (Draft, Pending, Paid, Cancelled)
- Print invoices
- View a dashboard summarizing their invoicing activity

An administrator can:

- Review pending registration requests, including each applicant's stated
  reason for access and verification note
- Approve or reject new accounts
- Revoke access from previously approved accounts
- Change a user's role (`user` or `admin`)
- View all registered users and their status

---

## Technologies used

| Layer | Technology |
|---|---|
| Structure | HTML |
| Styling | CSS |
| Behavior | Vanilla JavaScript (ES modules) |
| Authentication | Firebase Authentication (Email/Password) |
| Database | Cloud Firestore |
| Hosting | Any static file host (e.g. Firebase Hosting, GitHub Pages, Netlify) |

No frameworks (React, Vue, etc.), no build tools, and no server-side code
are used. The browser talks directly to Firebase.

---

## How Firebase Authentication is used

Firebase Authentication handles the account lifecycle:

- **Registration** — `register.js` calls
  `createUserWithEmailAndPassword()` to create the account, then writes a
  matching profile document to Firestore.
- **Login** — `login.js` calls `signInWithEmailAndPassword()`, then reads
  the user's Firestore profile to decide where to send them (dashboard if
  approved, or a status screen if pending/rejected/revoked).
- **Logout** — Available from the navigation bar on every protected page
  via `signOut()`.
- **Session state** — `auth.js` uses `onAuthStateChanged()` to determine
  whether a visitor is signed in before allowing access to any protected
  page.

The application only uses the **Email/Password** sign-in method — no
third-party sign-in providers are required.

---

## How Cloud Firestore is used

Firestore is the application's only data store. It holds:

- **`users`** — one profile document per account (keyed by the Firebase
  Auth UID), including approval status and role
- **`customers`** — each user's customer list
- **`invoices`** — each user's invoices
- **`invoiceItems`** — line items belonging to a specific invoice

All reads and writes happen directly from the browser using the Firestore
Web SDK. See [DESIGN.md](DESIGN.md) for the full schema and relationships.

---

## Features

### Registration & account approval

- Users register with their full name, email, password, and a short
  verification note explaining why they need access. Phone number and
  organization name are optional.
- The registration form does **not** ask for Aadhaar, PAN, government ID
  numbers, bank details, or any other unnecessary sensitive information.
- Every new account starts with `status: "pending"` and cannot access
  invoices until an administrator approves it.
- An administrator can move an account between `pending`, `approved`, and
  `rejected`, and can later `revoke` an approved account's access.

```
pending ──► approved ──► revoked
   │
   └──────► rejected
```

### Invoice management

Approved users can:

- Create, view, edit, and delete invoices
- Add and manage customers
- Add invoice line items with quantity, unit price, and tax rate
- See subtotal, tax, discount, and total calculated automatically
- Set an invoice's status: `Draft`, `Pending`, `Paid`, or `Cancelled`
- Print an invoice using the browser's print dialog

### Admin dashboard

Administrators can review pending requests (including the applicant's
reason for access and verification note), approve or reject them, revoke
previously approved accounts, and change a user's role.

### Data isolation

Every customer, invoice, and invoice item record is tied to the Firebase
Auth UID of the user who created it. Firestore Security Rules ensure one
user can never read or modify another user's records.

---

## Project file structure

```
invoice-management/
│
├── index.html          Landing page
├── login.html           Login page
├── register.html         Registration page
├── dashboard.html         Dashboard (approved users)
├── invoices.html          Invoice listing
├── invoice.html           Invoice create/edit
├── customers.html         Customer management
├── admin.html             Admin dashboard
├── profile.html           User profile
│
├── css/
│   ├── style.css        Shared base styles (reset, buttons, forms, tables, nav)
│   ├── auth.css         Landing/login/register styles
│   ├── dashboard.css     Dashboard/invoices/invoice/customers/profile styles
│   └── admin.css        Admin dashboard styles
│
├── js/
│   ├── firebase-config.js  Firebase initialization
│   ├── auth.js            Shared auth state, page guards, logout, toasts
│   ├── register.js         Registration logic
│   ├── login.js            Login logic
│   ├── dashboard.js         Dashboard stats & recent invoices
│   ├── invoices.js          Invoice listing, search, filter, delete
│   ├── invoice.js           Invoice create/edit, calculations
│   ├── customers.js         Customer CRUD
│   ├── admin.js            Admin approve/reject/revoke logic
│   └── profile.js          Profile view/update
│
├── README.md
└── DESIGN.md
```

---

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Enable Authentication** → Sign-in method → enable **Email/Password**.
3. **Create a Cloud Firestore database** (start in a supported region;
   choose production mode).
4. **Do not enable Firebase Storage** — this project doesn't use it.
5. In Project Settings → General → Your apps, add a **Web app** and copy
   the resulting config object.
6. Paste those values into `js/firebase-config.js`:

   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.firebasestorage.app",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID",
   };
   ```

   These values identify your Firebase project and are safe to include in
   frontend code — they are not secret credentials. **Never** put a
   Firebase service-account private key or any other server-side secret
   into this file or anywhere in frontend JavaScript.

7. **Publish Firestore Security Rules.** This project's security depends
   entirely on properly configured rules — see [DESIGN.md](DESIGN.md) for
   the rules structure and reasoning. At minimum, rules must:
   - Deny all access to unauthenticated requests.
   - Allow a user to read/write only `customers`, `invoices`, and
     `invoiceItems` documents where `userId` matches their own UID.
   - Allow only users whose own `users/{uid}` document has `role == "admin"`
     to read all `users` documents and to change other users' `status`/`role`.
   - Prevent a user from setting their own `role` or `status` on
     registration or profile update.

8. **Create the first admin account manually.** After registering
   normally through `register.html`, open the Firebase Console →
   Firestore → `users/{your-uid}` and manually change `role` to `"admin"`
   and `status` to `"approved"`. There is no public page that lets anyone
   grant themselves admin access — this is intentional.

---

## Running the project locally

This is a frontend-only application, but it must be served over HTTP
(not opened directly as a `file://` URL), because Firebase's ES module
imports require a proper origin.

Any simple static server works, for example:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

---

## Deployment

Because the app is frontend-only, it can be deployed to any static
hosting service — Firebase Hosting, GitHub Pages, Netlify, Vercel, etc.
The host only needs to serve the HTML, CSS, and JS files; Firebase itself
provides Authentication and Firestore. No backend server needs to be
deployed.

Example using Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Security summary

- **Firebase Authentication** verifies who a user is.
- **Firestore Security Rules** — not JavaScript — decide what each signed-in
  user is allowed to read or write. Hiding a page or a button in the UI is
  a usability nicety, not a security boundary.
- Every user-owned document stores the owner's Firebase Auth UID, and
  rules ensure a user can only access records where that UID matches
  their own.
- Admin capability is stored as `role: "admin"` on a user's own Firestore
  document, but a client can never grant this to itself — rules must
  reject any attempt to write a non-default `role` or `status` during
  registration or self-service profile updates.
- Invoice totals are recalculated by the application immediately before
  saving, rather than trusting whatever value happens to be present in
  the browser.

See [DESIGN.md](DESIGN.md) for full details on how these rules should be
structured.

---

## How the user approval system works

1. A visitor registers via `register.html`, providing their name, email,
   password, and a short note explaining why they want access.
2. Their account is created in Firebase Authentication, and a matching
   `users/{uid}` document is written to Firestore with `status: "pending"`.
3. A pending user who tries to log in sees a "waiting for approval"
   screen instead of the dashboard.
4. An administrator opens `admin.html`, reviews the pending request
   (including the applicant's reason for access and verification note),
   and either approves or rejects it.
5. An approved user can now log in and use the full application. An
   admin can later revoke an approved user's access at any time, which
   immediately blocks them from the invoice system on their next login
   or page load.

---

## How invoices and customers are managed

- A user first adds their customers via `customers.html`.
- When creating an invoice (`invoice.html`), the user selects an existing
  customer, adds one or more line items (description, quantity, unit
  price, tax rate), and the app calculates the subtotal, tax, and total
  automatically as they type.
- The user can apply a flat discount, add notes, and set the invoice's
  status.
- Saved invoices appear in `invoices.html`, where they can be searched,
  filtered by status, opened for editing, or deleted.
- Deleting an invoice also deletes its associated line items.

---

## Disclaimer

This project was created for educational purposes, including use as a
CS50 Final Project. It is **not** intended to be a production accounting,
taxation, financial, legal, or enterprise-security system.
