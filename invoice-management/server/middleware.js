const db = require('./database');

/**
 * Requires an active, valid session. Does NOT by itself guarantee the
 * underlying account is still approved -- see requireApprovedUser.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    next();
}

/**
 * Re-checks the account status against the database on every protected
 * request, so a revoked/rejected account loses access immediately even
 * if their session cookie is still technically valid.
 */
async function requireApprovedUser(req, res, next) {
    try {
        const [rows] = await db.execute(
            'SELECT id, role, status FROM users WHERE id = ?',
            [req.session.userId]
        );
        const user = rows[0];
        if (!user || user.status !== 'approved') {
            await new Promise((resolve) => req.session.destroy(resolve));
            return res.status(403).json({ error: 'Account is not active.' });
        }
        req.currentUser = user;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Server-side role check. Never rely on hiding buttons in the frontend.
 */
function requireAdmin(req, res, next) {
    if (!req.currentUser || req.currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Administrator access required.' });
    }
    next();
}

module.exports = {
    requireAuth,
    requireApprovedUser,
    requireAdmin
};
