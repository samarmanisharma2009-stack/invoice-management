# Invoice Management System

A lightweight, security-focused invoice management web application built with **HTML, CSS, JavaScript, Node.js, Express, and MySQL**.

The project is inspired by accounting applications such as TallyPrime and is designed as a **CS50 Final Project**. It demonstrates user authentication, manual account approval, role-based access control, invoice management, database operations, and basic web security.

> **Educational project:** This application is intended for learning and demonstration. It is not a production accounting, taxation, legal, financial, or identity-verification system.

---

# 🚀 Technology Stack

The project intentionally uses simple and beginner-friendly technologies.

### Frontend
- HTML
- CSS
- Vanilla JavaScript

### Backend
- Node.js
- Express.js

### Database
- MySQL / MariaDB

### Security Packages
- `bcrypt` — password hashing
- `express-session` — secure login sessions
- `helmet` — security-related HTTP headers
- `express-rate-limit` — protection against excessive login attempts
- `mysql2` — MySQL connection and parameterized queries
- `dotenv` — private configuration/environment variables


---

# ✨ Features

## 👤 User Registration

A visitor can create an account by providing only the information necessary for access approval:

- Full name
- Email address
- Phone number (optional)
- Business/organization name (optional)
- Reason for requesting access
- Short verification note

The system does **not** require Aadhaar, PAN, bank information, or government identity numbers by default.

---

## 🔐 Manual Account Approval

New accounts are created with:

```text
status = pending
```

A pending user cannot access the invoice system.

The Owner/Admin reviews the registration and can:

```text
Pending
   │
   ├── Approve → Approved
   │
   └── Reject  → Rejected
```

An approved account can later be changed to:

```text
Revoked
```

to immediately remove access.

---

# 👑 Owner/Admin Dashboard

The Owner/Admin can:

- View users
- View pending registration requests
- Review verification information
- Approve users
- Reject users
- Revoke user access
- View invoices
- Manage system records

Regular users cannot access administrative functions.

Admin permissions are checked **on the server**, not merely by hiding buttons in the frontend.

---

# 🧾 Invoice Management

Approved users can:

- Create invoices
- Add customers
- Add multiple invoice items
- Edit invoices
- View invoices
- Delete invoices
- Calculate subtotal
- Calculate tax
- Apply discounts
- Calculate the final total
- Set invoice status
- Print invoices

Example invoice statuses:

```text
Draft
Pending
Paid
Cancelled
```

Invoice calculations are performed and validated by the server so that users cannot simply modify totals through browser developer tools.

---

# 🔒 Security Features

Security is an important part of the project.

## Password Hashing

Passwords are never stored as plain text.

Node.js uses `bcrypt` to create password hashes.

Conceptually:

```text
Password
   ↓
bcrypt
   ↓
Password Hash
   ↓
MySQL
```

During login, the submitted password is compared with the stored hash.

---

## SQL Injection Protection

Database queries use parameterized queries through `mysql2`.

Avoid:

```javascript
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

Use:

```javascript
const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
);
```

This prevents user input from being interpreted as part of the SQL command.

---

## Authentication

Protected pages and API endpoints require a valid authenticated session.

For example:

```text
Not logged in
     │
     ▼
Login page

Logged in
     │
     ▼
Dashboard
```

---

## Authorization

Authentication and authorization are different.

A user being logged in does not automatically make them an administrator.

The server checks:

```text
Is the user logged in?
        │
       YES
        │
        ▼
Is the user an Admin?
     │          │
    YES         NO
     │           │
     ▼           ▼
  Allow        Deny
```

---

## Session Security

The application uses server-side sessions.

Important cookie settings include:

```text
HttpOnly
SameSite=Lax
Secure when HTTPS is enabled
```

The session should also be regenerated after successful login.

---

## Login Rate Limiting

Repeated login attempts are limited using `express-rate-limit`.

This helps reduce automated password-guessing attempts.

---

## CSRF Protection

State-changing requests should use CSRF protection where applicable.

Examples:

```text
Approve user
Reject user
Revoke user
Create invoice
Edit invoice
Delete invoice
Change account settings
```

---

## XSS Protection

User-provided information must be safely escaped before being inserted into HTML.

Never blindly place untrusted content into:

```javascript
element.innerHTML
```

Prefer safe DOM APIs such as:

```javascript
element.textContent = value;
```

Server-side validation is also required.

---

## Security Headers

`helmet` is used to configure commonly recommended HTTP security headers.

---

# 🛡️ Verification & Privacy

This project deliberately uses a **minimal verification system**.

The default application does not collect:

- Aadhaar numbers
- PAN numbers
- Government ID numbers
- Bank account information
- Unnecessary identity documents

Instead, the applicant provides a short explanation that allows the Owner/Admin to decide whether access should be granted.

Example:

```text
Why do you need access?

What organization/business are you associated with?

How can the Owner verify your request?
```

### Optional attachments

File uploads are **not required for the basic version**.

If attachments are added later, they must be stored privately and protected by authorization. Uploaded files must never be allowed to execute as server-side code.

For a CS50 project, a verification note without document uploads is recommended because it keeps the project simpler and reduces privacy/security risks.

---

# 📁 Project Structure

```text
invoice-management/
│
├── public/
│   │
│   ├── index.html
│   ├── register.html
│   ├── dashboard.html
│   ├── invoice.html
│   └── admin.html
│
│   ├── css/
│   │   └── style.css
│   │
│   └── js/
│       ├── login.js
│       ├── register.js
│       ├── dashboard.js
│       ├── invoice.js
│       └── admin.js
│
├── server/
│   ├── server.js
│   ├── database.js
│   ├── auth.js
│   ├── middleware.js
│   │
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       └── invoices.js
│
├── database/
│   └── schema.sql
│
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

# 📦 Installation

## 1. Install Node.js

Install a current **LTS version of Node.js**.

Verify the installation:

```bash
node --version
npm --version
```

---

# 2. Download the Project

Clone the repository:

```bash
git clone <repository-url>
```

Enter the project directory:

```bash
cd invoice-management
```

---

# 3. Install Dependencies

Run:

```bash
npm install
```

The required packages should be listed in `package.json`.

Typical dependencies:

```text
express
mysql2
bcrypt
express-session
helmet
express-rate-limit
dotenv
```

Development dependencies may include:

```text
nodemon
```

---

# 4. Create the MySQL Database

Create a database such as:

```sql
CREATE DATABASE invoice_management;
```

Then import:

```text
database/schema.sql
```

You can use phpMyAdmin, MySQL Workbench, or the MySQL command line.

---

# 5. Configure Environment Variables

Create a `.env` file in the project root.

Example:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=invoice_management
DB_USER=root
DB_PASSWORD=your_database_password

SESSION_SECRET=replace_with_a_long_random_secret
```

Do **not** publish the `.env` file to GitHub.

---

# 6. Start the Server

For normal execution:

```bash
npm start
```

For development, if a development script is configured:

```bash
npm run dev
```

The application should then be available at:

```text
http://localhost:3000
```

---

# 🗄️ Database Structure

The basic database contains four primary tables.

## users

```text
id
full_name
email
phone
organization_name
verification_note
password_hash
role
status
created_at
updated_at
```

Possible roles:

```text
admin
user
```

Possible statuses:

```text
pending
approved
rejected
revoked
```

---

## customers

```text
id
user_id
name
email
phone
address
created_at
updated_at
```

Each customer belongs to a user.

---

## invoices

```text
id
user_id
customer_id
invoice_number
invoice_date
due_date
subtotal
tax
discount
total
status
notes
created_at
updated_at
```

---

## invoice_items

```text
id
invoice_id
description
quantity
unit_price
tax_rate
line_total
```

---

# 🔄 Application Workflow

## Registration

```text
Visitor
   │
   ▼
Registration Form
   │
   ▼
Server Validation
   │
   ▼
Password Hashing
   │
   ▼
MySQL
   │
   ▼
status = pending
```

---

## Approval

```text
Pending User
     │
     ▼
Admin Dashboard
     │
     ▼
Review Request
     │
 ┌───┴────┐
 ▼        ▼
Approve  Reject
 │        │
 ▼        ▼
Access   Blocked
```

---

## Login

```text
Login Form
     │
     ▼
POST /api/login
     │
     ▼
Node.js
     │
     ▼
Find User
     │
     ▼
Check Password
     │
     ▼
Check Account Status
     │
 ┌───┴──────────┐
 ▼              ▼
Approved       Other
 │              │
 ▼              ▼
Create        Deny
Session       Access
```

---

# 🌐 Example API Structure

The frontend communicates with the Node.js server using HTTP requests.

## Authentication

```text
POST /api/register
POST /api/login
POST /api/logout
GET  /api/me
```

## Users

```text
GET  /api/admin/users
POST /api/admin/users/:id/approve
POST /api/admin/users/:id/reject
POST /api/admin/users/:id/revoke
```

## Invoices

```text
GET    /api/invoices
GET    /api/invoices/:id
POST   /api/invoices
PUT    /api/invoices/:id
DELETE /api/invoices/:id
```

The exact routes may change during implementation.

---

# 👤 User Data Isolation

Users must only be able to access their own customers and invoices.

Example:

```text
User A
 ├── Invoice A1
 └── Invoice A2

User B
 ├── Invoice B1
 └── Invoice B2
```

User A must not be able to access:

```text
/api/invoices/B1
```

simply by changing an ID in the browser.

The server must verify ownership for every protected resource.

---

# 🧮 Invoice Calculation

A basic invoice calculation can be represented as:

```text
Item Total = Quantity × Unit Price

Subtotal = Sum of Item Totals

Tax Amount = Applicable Tax

Total = Subtotal + Tax - Discount
```

The server must perform the final calculation instead of trusting a total submitted by the browser.

---

# 🔢 Invoice Numbers

Invoice numbers should be generated by the server.

Example:

```text
INV-2026-000001
INV-2026-000002
INV-2026-000003
```

The database should enforce uniqueness.

---

# 👑 First Admin Account

Do not create a permanently accessible public setup page that can recreate or overwrite the administrator.

For the initial installation, create the first admin using a controlled setup process.

The setup process must:

1. Check whether an administrator already exists.
2. Refuse to create another initial administrator if one already exists.
3. Hash the administrator password with `bcrypt`.
4. Never store the plain-text password.
5. Be disabled or removed after initial setup.

---

# 🔐 Environment & Secrets

Never commit:

```text
.env
Database passwords
Session secrets
API keys
Private verification files
Production credentials
```

Example `.gitignore`:

```gitignore
node_modules/
.env
.env.*
!.env.example

*.log

storage/
uploads/

.DS_Store
Thumbs.db
```

A safe example configuration can be committed as:

```text
.env.example
```

without real passwords or secrets.

---

# 🚀 Deployment

Node.js requires a hosting provider that supports running a Node.js application.

Unlike traditional PHP hosting, the server needs to keep the Node.js application running.

Before deployment, verify that the hosting provider supports:

- Node.js
- Express applications
- MySQL/MariaDB
- Environment variables
- Persistent application processes
- HTTPS

### Important

**InfinityFree is primarily PHP/MySQL hosting and is not the intended deployment platform for this Node.js version.**

If you specifically need InfinityFree, use the PHP version of this project instead.

For the Node.js version, use a hosting provider that explicitly supports Node.js applications.

---

# 🧪 Testing Checklist

Before considering the project complete:

## Authentication

- [ ] User can register.
- [ ] Password is hashed.
- [ ] User starts as `pending`.
- [ ] Pending user cannot log in.
- [ ] Approved user can log in.
- [ ] Rejected user cannot log in.
- [ ] Revoked user cannot access the system.
- [ ] Logout destroys the session.
- [ ] Session ID changes after login.

## Authorization

- [ ] Normal users cannot access Admin APIs.
- [ ] Admin APIs check the user's role on the server.
- [ ] Users cannot access another user's invoices.
- [ ] Users cannot modify another user's customers.

## Security

- [ ] SQL queries use parameters.
- [ ] CSRF protection is implemented where required.
- [ ] Login attempts are rate-limited.
- [ ] Security headers are enabled.
- [ ] User input is validated.
- [ ] HTML output is safely escaped.
- [ ] `.env` is not committed.
- [ ] Errors do not reveal database credentials.
- [ ] Sensitive verification information is protected.

## Invoices

- [ ] Invoice can be created.
- [ ] Invoice can be viewed.
- [ ] Invoice can be edited.
- [ ] Invoice can be deleted.
- [ ] Invoice number is unique.
- [ ] Invoice totals are calculated correctly.
- [ ] Server validates invoice values.
- [ ] User ownership is enforced.

---

# 🎓 CS50 Final Project Goals

This project demonstrates:

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- MySQL
- Database design
- CRUD operations
- Authentication
- Authorization
- Sessions
- Password hashing
- Prepared SQL statements
- Input validation
- CSRF protection
- XSS prevention
- Rate limiting
- Security headers
- Privacy-conscious user verification
- Invoice/business logic
- REST-style API design

---

# 📝 Implementation Note

This generated implementation uses `csurf` for CSRF protection because it is
simple to wire up and matches the checklist in this README. `csurf` is
archived upstream, so before deploying to production consider switching to a
maintained alternative (e.g. a double-submit cookie pattern implemented by
hand, or `csrf-csrf`). Functionally it still works for local/CS50 use.

---

# 📜 License

Choose an open-source license before publishing the repository.

The MIT License is one possible choice for a small open-source educational project.

---

# ⚠️ Disclaimer

This software is an educational project created for learning and demonstration purposes.

It should not be considered a complete production accounting, taxation, financial, legal, identity-verification, or enterprise-security system.

Before using it with real business or customer data, conduct an appropriate security, privacy, backup, authorization, and compliance review.
