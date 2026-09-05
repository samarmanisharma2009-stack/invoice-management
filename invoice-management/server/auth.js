const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password. Passwords are never stored as plain text.
 */
async function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 */
async function verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Regenerate the session (new session ID) and store the minimal
 * user context needed for subsequent authorization checks.
 * Prevents session fixation attacks.
 */
function establishSession(req, user) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) return reject(err);
            req.session.userId = user.id;
            req.session.role = user.role;
            req.session.status = user.status;
            req.session.save((saveErr) => {
                if (saveErr) return reject(saveErr);
                resolve();
            });
        });
    });
}

function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    hashPassword,
    verifyPassword,
    establishSession,
    destroySession
};
