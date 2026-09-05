const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const { hashPassword, verifyPassword, establishSession, destroySession } = require('../auth');
const { requireAuth } = require('../middleware');

const router = express.Router();

// Reduce automated password-guessing attempts.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Please try again later.' }
});

function isNonEmptyString(v, maxLen = 255) {
    return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}

function isValidEmail(v) {
    return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 190;
}

// POST /api/register
router.post('/register', registerLimiter, async (req, res, next) => {
    try {
        const {
            fullName,
            email,
            phone,
            organizationName,
            reason,
            verificationNote,
            password
        } = req.body || {};

        if (!isNonEmptyString(fullName, 150)) {
            return res.status(400).json({ error: 'Full name is required.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }
        if (typeof password !== 'string' || password.length < 10) {
            return res.status(400).json({ error: 'Password must be at least 10 characters.' });
        }
        if (!isNonEmptyString(reason, 2000) && !isNonEmptyString(verificationNote, 2000)) {
            return res.status(400).json({ error: 'Please explain why you need access.' });
        }

        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        const passwordHash = await hashPassword(password);
        const combinedNote = [reason, verificationNote].filter(isNonEmptyString).join('\n\n');

        await db.execute(
            `INSERT INTO users
                (full_name, email, phone, organization_name, verification_note, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, ?, 'user', 'pending')`,
            [
                fullName.trim(),
                email.trim().toLowerCase(),
                isNonEmptyString(phone, 30) ? phone.trim() : null,
                isNonEmptyString(organizationName, 190) ? organizationName.trim() : null,
                combinedNote || null,
                passwordHash
            ]
        );

        res.status(201).json({
            message: 'Registration submitted. An administrator will review your request.'
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/login
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const [rows] = await db.execute(
            'SELECT id, password_hash, role, status FROM users WHERE email = ?',
            [email.trim().toLowerCase()]
        );
        const user = rows[0];

        // Always run a bcrypt compare, even on unknown emails, to avoid
        // leaking account existence via response timing.
        const dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOsvHchQjR8oMuqi1uzQtu4v0J6MKLYYy';
        const passwordOk = await verifyPassword(password, user ? user.password_hash : dummyHash);

        if (!user || !passwordOk) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (user.status !== 'approved') {
            return res.status(403).json({
                error: `Your account is ${user.status}. Please contact the administrator.`
            });
        }

        await establishSession(req, user);
        res.json({ message: 'Logged in.', role: user.role });
    } catch (err) {
        next(err);
    }
});

// POST /api/logout
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        await destroySession(req);
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out.' });
    } catch (err) {
        next(err);
    }
});

// GET /api/me
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, role, status FROM users WHERE id = ?',
            [req.session.userId]
        );
        const user = rows[0];
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
