import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

// Shared MySQL connection pool. Existing endpoints use the callback-style
// pool (`db`); newer routes can use `dbPromise` for async/await.
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the MySQL database:', err.message);
    } else {
        console.log('Successfully connected to the MySQL database.');
        connection.release();
    }
});

const dbPromise = db.promise();

export default db;
export { db, dbPromise };
