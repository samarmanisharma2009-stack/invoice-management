const express = require('express');
const db = require('../database');
const { requireAuth, requireApprovedUser, requireAdmin } = require('../middleware');

const router = express.Router();

const ALLOWED_STATUS_FILTERS = ['pending', 'approved', 'rejected', 'revoked'];

// GET /api/admin/users?status=pending
router.get('/users', requireAuth, requireApprovedUser, requireAdmin, async (req, res, next) => {
    try {
        const { status } = req.query;
        let sql = `SELECT id, full_name, email, phone, organization_name, verification_note,
                          role, status, created_at, updated_at
                   FROM users`;
        const params = [];

        if (status && ALLOWED_STATUS_FILTERS.includes(status)) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY created_at DESC';

        const [rows] = await db.execute(sql, params);
        res.json({ users: rows });
    } catch (err) {
        next(err);
    }
});

async function setUserStatus(req, res, next, newStatus) {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id.' });
        }

        const [rows] = await db.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
        const target = rows[0];
        if (!target) return res.status(404).json({ error: 'User not found.' });

        // Prevent an admin from locking themselves (or the last admin) out accidentally.
        if (target.role === 'admin' && newStatus !== 'approved' && userId === req.currentUser.id) {
            return res.status(400).json({ error: 'You cannot change your own account status.' });
        }

        await db.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
        res.json({ message: `User ${newStatus}.` });
    } catch (err) {
        next(err);
    }
}

// POST /api/admin/users/:id/approve
router.post('/users/:id/approve', requireAuth, requireApprovedUser, requireAdmin, (req, res, next) =>
    setUserStatus(req, res, next, 'approved')
);

// POST /api/admin/users/:id/reject
router.post('/users/:id/reject', requireAuth, requireApprovedUser, requireAdmin, (req, res, next) =>
    setUserStatus(req, res, next, 'rejected')
);

// POST /api/admin/users/:id/revoke
router.post('/users/:id/revoke', requireAuth, requireApprovedUser, requireAdmin, (req, res, next) =>
    setUserStatus(req, res, next, 'revoked')
);

module.exports = router;
