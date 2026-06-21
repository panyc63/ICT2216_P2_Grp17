import { dbPromise } from '../config/db.js';

// Appends a row to security_audit_logs. Used for sensitive actions (e.g.
// standalone MC issuance, payment-request creation). actorId is the user who
// performed the action; resource identifies what was affected.
export const logAudit = async (actorId, action, resource, outcome = 'SUCCESS') => {
    await dbPromise.query(
        `INSERT INTO security_audit_logs (actor_id, action_performed, affected_resource, outcome)
         VALUES (?, ?, ?, ?)`,
        [actorId || 'unknown', action, resource, outcome === 'FAILURE' ? 'FAILURE' : 'SUCCESS']
    );
};
