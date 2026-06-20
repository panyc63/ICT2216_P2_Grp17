import { dbPromise } from '../config/db.js';

// Statuses that mean an order is finished — a patient with only these has no
// "open" order and a new one would be created.
const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'Refunded'];

// Generates the next sequential order id (MH-O001, MH-O002, ...).
export const nextOrderId = async () => {
    const [rows] = await dbPromise.query(
        "SELECT order_id FROM orders WHERE order_id LIKE 'MH-O%' ORDER BY order_id DESC LIMIT 1"
    );
    if (rows.length === 0) return 'MH-O001';
    const lastNum = parseInt(rows[0].order_id.replace('MH-O', ''), 10);
    return `MH-O${String(lastNum + 1).padStart(3, '0')}`;
};

// Records a status transition: updates the order and appends to the history.
export const setOrderStatus = async (orderId, status, note = null) => {
    await dbPromise.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId]);
    await dbPromise.query(
        'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
        [orderId, status, note]
    );
};

// The patient's current open (non-terminal) order, or null.
export const getActiveOrder = async (patientId) => {
    const [rows] = await dbPromise.query(
        `SELECT * FROM orders
         WHERE patient_id = ? AND status NOT IN (?, ?, ?)
         ORDER BY created_at DESC, order_id DESC
         LIMIT 1`,
        [patientId, ...TERMINAL_STATUSES]
    );
    return rows[0] || null;
};

// Returns the patient's open order, creating a fresh Pending one if none exists.
// Optionally sets needs_medication on it.
export const ensureOpenOrder = async (patientId, { needs_medication } = {}) => {
    let order = await getActiveOrder(patientId);

    if (!order) {
        const orderId = await nextOrderId();
        const nm = typeof needs_medication === 'boolean' ? needs_medication : null;
        await dbPromise.query(
            'INSERT INTO orders (order_id, patient_id, status, needs_medication) VALUES (?, ?, ?, ?)',
            [orderId, patientId, 'Pending', nm]
        );
        await dbPromise.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'Pending', 'Order created']
        );
        const [rows] = await dbPromise.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        return rows[0];
    }

    // Update needs_medication on the existing order if provided.
    if (typeof needs_medication === 'boolean' && order.needs_medication !== (needs_medication ? 1 : 0)) {
        await dbPromise.query('UPDATE orders SET needs_medication = ? WHERE order_id = ?', [needs_medication, order.order_id]);
        order.needs_medication = needs_medication ? 1 : 0;
    }
    return order;
};

// The order linked to a given consultation, or null.
export const findOrderByConsultation = async (consultationId) => {
    const [rows] = await dbPromise.query(
        'SELECT o.* FROM orders o JOIN consultations c ON c.order_id = o.order_id WHERE c.consultation_id = ? LIMIT 1',
        [consultationId]
    );
    return rows[0] || null;
};

// Updates editable order fields (used by the Phase 2 frontend).
export const patchOrderFields = async (orderId, { needs_medication, collection_method }) => {
    const sets = [];
    const params = [];
    if (typeof needs_medication === 'boolean') { sets.push('needs_medication = ?'); params.push(needs_medication); }
    if (typeof collection_method === 'string') { sets.push('collection_method = ?'); params.push(collection_method); }
    if (sets.length === 0) return;
    params.push(orderId);
    await dbPromise.query(`UPDATE orders SET ${sets.join(', ')} WHERE order_id = ?`, params);
};
