/**
 * One-time controlled setup script for creating the first administrator.
 * Run with: npm run setup-admin
 *
 * This is a CLI script, not a public HTTP endpoint, so it cannot be
 * abused to recreate or overwrite the admin account remotely. It refuses
 * to run if an administrator already exists.
 */
require('dotenv').config();
const readline = require('readline');
const db = require('./database');
const { hashPassword } = require('./auth');

function ask(question, { hidden = false } = {}) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        if (!hidden) {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
            return;
        }
        // Minimal hidden input for password entry.
        const stdin = process.stdin;
        process.stdout.write(question);
        let value = '';
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.on('data', function handler(char) {
            char = char.toString();
            if (char === '\n' || char === '\r' || char === '\u0004') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeListener('data', handler);
                process.stdout.write('\n');
                rl.close();
                resolve(value);
            } else if (char === '\u0003') {
                process.exit(1);
            } else if (char === '\u007f') {
                value = value.slice(0, -1);
            } else {
                value += char;
            }
        });
    });
}

async function main() {
    const [existing] = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.length > 0) {
        console.error('An administrator already exists. Refusing to create another initial administrator.');
        process.exit(1);
    }

    const fullName = await ask('Admin full name: ');
    const email = await ask('Admin email: ');
    const password = await ask('Admin password (min 12 chars): ', { hidden: true });

    if (!fullName.trim() || !email.trim() || password.length < 12) {
        console.error('Invalid input. Full name, email, and a 12+ character password are required.');
        process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    await db.execute(
        `INSERT INTO users (full_name, email, password_hash, role, status)
         VALUES (?, ?, ?, 'admin', 'approved')`,
        [fullName.trim(), email.trim().toLowerCase(), passwordHash]
    );

    console.log('Administrator account created successfully.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Setup failed.');
    console.error('  message:', err && err.message);
    console.error('  code:   ', err && err.code);
    console.error('  errno:  ', err && err.errno);
    if (err && err.code === 'ECONNREFUSED') {
        console.error('  -> MySQL/MariaDB does not appear to be running, or DB_HOST/DB_PORT in .env are wrong.');
    }
    if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('  -> DB_USER/DB_PASSWORD in .env are incorrect.');
    }
    if (err && err.code === 'ER_BAD_DB_ERROR') {
        console.error('  -> The database in DB_NAME does not exist yet. Create it and import database/schema.sql.');
    }
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
        console.error('  -> The "users" table does not exist. Import database/schema.sql into your database.');
    }
    process.exit(1);
});
