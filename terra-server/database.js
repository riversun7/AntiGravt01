const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'terra.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize Schema
function initSchema() {
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT DEFAULT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        cyborg_model TEXT DEFAULT NULL
    );`;

    const createResourcesTable = `
    CREATE TABLE IF NOT EXISTS user_resources (
        user_id INTEGER PRIMARY KEY,
        gold INTEGER DEFAULT 0,
        gem INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );`;

    const createUserStatsTable = `
    CREATE TABLE IF NOT EXISTS user_stats (
        user_id INTEGER PRIMARY KEY,
        strength INTEGER DEFAULT 5,
        dexterity INTEGER DEFAULT 5,
        constitution INTEGER DEFAULT 5,
        agility INTEGER DEFAULT 5,
        intelligence INTEGER DEFAULT 5,
        wisdom INTEGER DEFAULT 5,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );`;

    db.exec(createUsersTable);
    db.exec(createResourcesTable);
    db.exec(createUserStatsTable);

    // Seed Admin
    try {
        const adminCheck = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
        if (!adminCheck) {
            db.prepare("INSERT INTO users (username, password, role) VALUES ('admin', '1234', 'admin')").run();
            // Get admin id
            const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
            // Init resources/stats for admin too (optional but prevents errors)
            db.prepare('INSERT INTO user_resources (user_id, gold, gem) VALUES (?, ?, ?)').run(admin.id, 999999, 999999);
            db.prepare('INSERT INTO user_stats (user_id) VALUES (?)').run(admin.id);
            console.log("Admin user seeded: admin / 1234");
        }
    } catch (e) {
        console.log("Admin seed error or already exists", e);
    }

    console.log('Database initialized');
}

initSchema();

module.exports = db;
