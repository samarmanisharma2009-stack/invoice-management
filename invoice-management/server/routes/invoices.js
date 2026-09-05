const express = require('express');
const db = require('../database');
const { requireAuth, requireApprovedUser } = require('../middleware');

const router = express.Router();

const VALID_STATUSES = ['Draft', 'Pending', 'Paid', 'Cancelled'];

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isPositiveNumber(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Generates a unique, server-assigned invoice number of the form
 * INV-<year>-<sequence>, e.g. INV-2026-000001.
 * Uses a dedicated sequence table + row lock so numbers are never reused,
 * even under concurrent requests.
 */
async function generateInvoiceNumber(connection) {
    const year = new Date().getFullYear();
    await connection.execute(
        `INSERT INTO invoice_number_seq (year_key, last_value)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE last_value = last_value + 1`,
        [year]
    );
    const [rows] = await connection.execute(
        'SELECT last_value FROM invoice_number_seq WHERE year_key = ?',
        [year]
    );
    const seq = String(rows[0].last_value).padStart(6, '0');
    return `INV-${year}-${seq}`;
}

/**
 * Recomputes subtotal/tax/total from line items on the server so a client
 * can never submit a manipulated total.
 */
function computeTotals(items, discount) {
    let subtotal = 0;
    let tax = 0;
    const computedItems = items.map((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const taxRate = Number(item.tax_rate) || 0;
        const lineBase = round2(quantity * unitPrice);
        const lineTax = round2(lineBase * (taxRate / 100));
        subtotal = round2(subtotal + lineBase);
        tax = round2(tax + lineTax);
        return {
            description: String(item.description).slice(0, 255),
            quantity,
            unit_price: unitPrice,
            tax_rate: taxRate,
            line_total: round2(lineBase + lineTax)
        };
    });
    const safeDiscount = round2(Number(discount) || 0);
    const total = round2(subtotal + tax - safeDiscount);
    return { subtotal, tax, discount: safeDiscount, total, computedItems };
}

function validateItemsPayload(items) {
    if (!Array.isArray(items) || items.length === 0) return 'At least one invoice item is required.';
    for (const item of items) {
        if (!item || typeof item.description !== 'string' || item.description.trim().length === 0) {
            return 'Each item requires a description.';
        }
        if (!isPositiveNumber(Number(item.quantity)) || Number(item.quantity) <= 0) {
            return 'Each item requires a positive quantity.';
        }
        if (!isPositiveNumber(Number(item.unit_price))) {
            return 'Each item requires a valid unit price.';
        }
        if (item.tax_rate !== undefined && !isPositiveNumber(Number(item.tax_rate))) {
            return 'Tax rate must be a non-negative number.';
        }
    }
    return null;
}

// ---------- Customers ----------

// GET /api/customers
router.get('/customers', requireAuth, requireApprovedUser, async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, name, email, phone, address, created_at FROM customers WHERE user_id = ? ORDER BY name ASC',
            [req.currentUser.id]
        );
        res.json({ customers: rows });
    } catch (err) {
        next(err);
    }
});

// POST /api/customers
router.post('/customers', requireAuth, requireApprovedUser, async (req, res, next) => {
    try {
        const { name, email, phone, address } = req.body || {};
        if (typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Customer name is required.' });
        }
        const [result] = await db.execute(
            'INSERT INTO customers (user_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
            [
                req.currentUser.id,
                name.trim().slice(0, 190),
                typeof email === 'string' ? email.trim().slice(0, 190) : null,
                typeof phone === 'string' ? phone.trim().slice(0, 30) : null,
                typeof address === 'string' ? address.trim() : null
            ]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        next(err);
    }
});

// ---------- Invoices ----------

// GET /api/invoices
router.get('/invoices', requireAuth, requireApprovedUser, async (req, res, next) => {
    try {
        const [rows] = await db.execute(
            `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.subtotal, i.tax,
                    i.discount, i.total, i.status, c.name AS customer_name
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.user_id = ?
             ORDER BY i.created_at DESC`,
            [req.currentUser.id]
        );
        res.json({ invoices: rows });
    } catch (err) {
        next(err);
    }
});

// GET /api/invoices/:id  (ownership enforced)
router.get('/invoices/:id', requireAuth, requireApprovedUser, async (req, res, next) => {
    try {
        const invoiceId = Number(req.params.id);
        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({ error: 'Invalid invoice id.' });
        }

        const [invoiceRows] = await db.execute(
            `SELECT i.*, c.name AS customer_name, c.email AS customer_email
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.id = ? AND i.user_id = ?`,
            [invoiceId, req.currentUser.id]
        );
        const invoice = invoiceRows[0];
        if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

        const [items] = await db.execute(
            'SELECT id, description, quantity, unit_price, tax_rate, line_total FROM invoice_items WHERE invoice_id = ?',
            [invoiceId]
        );

        res.json({ invoice: { ...invoice, items } });
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices
router.post('/invoices', requireAuth, requireApprovedUser, async (req, res, next) => {
    const { customer_id, invoice_date, due_date, discount, notes, items, status } = req.body || {};

    const customerId = Number(customer_id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
        return res.status(400).json({ error: 'A valid customer_id is required.' });
    }
    if (typeof invoice_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(invoice_date)) {
        return res.status(400).json({ error: 'invoice_date must be in YYYY-MM-DD format.' });
    }
    const itemsError = validateItemsPayload(items);
    if (itemsError) return res.status(400).json({ error: itemsError });
    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Ownership check: the customer must belong to this user.
        const [custRows] = await connection.execute(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [customerId, req.currentUser.id]
        );
        if (custRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Customer not found.' });
        }

        const { subtotal, tax, discount: safeDiscount, total, computedItems } = computeTotals(items, discount);
        const invoiceNumber = await generateInvoiceNumber(connection);

        const [result] = await connection.execute(
            `INSERT INTO invoices
                (user_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax, discount, total, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.currentUser.id,
                customerId,
                invoiceNumber,
                invoice_date,
                due_date || null,
                subtotal,
                tax,
                safeDiscount,
                total,
                status && VALID_STATUSES.includes(status) ? status : 'Draft',
                typeof notes === 'string' ? notes.slice(0, 2000) : null
            ]
        );
        const invoiceId = result.insertId;

        for (const item of computedItems) {
            await connection.execute(
                `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_rate, line_total)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [invoiceId, item.description, item.quantity, item.unit_price, item.tax_rate, item.line_total]
            );
        }

        await connection.commit();
        res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, subtotal, tax, discount: safeDiscount, total });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

// PUT /api/invoices/:id  (ownership enforced, totals recalculated server-side)
router.put('/invoices/:id', requireAuth, requireApprovedUser, async (req, res, next) => {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({ error: 'Invalid invoice id.' });
    }

    const { customer_id, invoice_date, due_date, discount, notes, items, status } = req.body || {};
    const itemsError = items !== undefined ? validateItemsPayload(items) : null;
    if (itemsError) return res.status(400).json({ error: itemsError });
    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            'SELECT id, customer_id FROM invoices WHERE id = ? AND user_id = ? FOR UPDATE',
            [invoiceId, req.currentUser.id]
        );
        const existing = existingRows[0];
        if (!existing) {
            await connection.rollback();
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        let customerId = existing.customer_id;
        if (customer_id !== undefined) {
            customerId = Number(customer_id);
            const [custRows] = await connection.execute(
                'SELECT id FROM customers WHERE id = ? AND user_id = ?',
                [customerId, req.currentUser.id]
            );
            if (custRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Customer not found.' });
            }
        }

        let subtotal, tax, safeDiscount, total, computedItems;
        if (items !== undefined) {
            const totals = computeTotals(items, discount);
            ({ subtotal, tax, discount: safeDiscount, total, computedItems } = totals);

            await connection.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
            for (const item of computedItems) {
                await connection.execute(
                    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_rate, line_total)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [invoiceId, item.description, item.quantity, item.unit_price, item.tax_rate, item.line_total]
                );
            }
        }

        await connection.execute(
            `UPDATE invoices SET
                customer_id = ?,
                invoice_date = COALESCE(?, invoice_date),
                due_date = ?,
                subtotal = COALESCE(?, subtotal),
                tax = COALESCE(?, tax),
                discount = COALESCE(?, discount),
                total = COALESCE(?, total),
                status = COALESCE(?, status),
                notes = ?
             WHERE id = ?`,
            [
                customerId,
                invoice_date || null,
                due_date !== undefined ? due_date : null,
                subtotal !== undefined ? subtotal : null,
                tax !== undefined ? tax : null,
                safeDiscount !== undefined ? safeDiscount : null,
                total !== undefined ? total : null,
                status || null,
                notes !== undefined ? String(notes).slice(0, 2000) : null,
                invoiceId
            ]
        );

        await connection.commit();
        res.json({ message: 'Invoice updated.' });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
});

// DELETE /api/invoices/:id  (ownership enforced)
router.delete('/invoices/:id', requireAuth, requireApprovedUser, async (req, res, next) => {
    try {
        const invoiceId = Number(req.params.id);
        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({ error: 'Invalid invoice id.' });
        }
        const [result] = await db.execute(
            'DELETE FROM invoices WHERE id = ? AND user_id = ?',
            [invoiceId, req.currentUser.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        res.json({ message: 'Invoice deleted.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
