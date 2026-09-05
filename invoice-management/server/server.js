require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const csurf = require('csurf');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const invoiceRoutes = require('./routes/invoices');
const { requireAuth, requireApprovedUser } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

if (!process.env.SESSION_SECRET) {
    console.error('FATAL: SESSION_SECRET is not set. Refusing to start.');
    process.exit(1);
}

app.set('trust proxy', 1);

// Security-related HTTP headers.
app.use(helmet());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// CSRF protection for state-changing requests. The token is exposed via
// GET /api/csrf-token and must be sent back in the X-CSRF-Token header.
const csrfProtection = csurf({ cookie: false });

app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Apply CSRF protection to all mutating API routes, but not to GETs.
app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return csrfProtection(req, res, next);
});

app.use('/api', authRoutes);
app.use('/api/admin', userRoutes);
app.use('/api', invoiceRoutes);

// GET /api/whoami-status - lightweight session/role check for the frontend
app.get('/api/session-status', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        role: req.session.role,
        status: req.session.status
    });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Central error handler. Never leak stack traces, SQL, or credentials.
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    }
    console.error(err);
    res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
    console.log(`Invoice Management System running at http://localhost:${PORT}`);
});
