import { dbPromise } from '../config/db.js';

// Generic sequential id generator for prefixed string ids
// (e.g. MH-C001, MH-MC001, MH-RX001, MH-PR001). Shared so the various routes
// don't each redefine it.
export const nextSeqId = async (table, idCol, prefix) => {
    const [rows] = await dbPromise.query(
        `SELECT ${idCol} AS id FROM ${table} WHERE ${idCol} LIKE ? ORDER BY ${idCol} DESC LIMIT 1`,
        [`${prefix}%`]
    );
    if (rows.length === 0) return `${prefix}001`;
    const lastNum = parseInt(rows[0].id.replace(prefix, ''), 10);
    return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
};
