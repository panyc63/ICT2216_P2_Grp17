import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, 'firebase-adminsdk.json'), 'utf8')
);

// This project's Realtime Database lives in the asia-southeast1 region, so the
// URL must use the regional host. Override with FIREBASE_DB_URL if it changes.
const databaseURL =
    process.env.FIREBASE_DB_URL ||
    `https://${serviceAccount.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`;

const app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL
});

console.log('Successfully connected to the Firebase Realtime Database.');

const db = getDatabase(app);

export default app;
export { db };
