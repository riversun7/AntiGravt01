const db = require('./database');

console.log("--- Schema Info for users ---");
const schema = db.prepare("PRAGMA table_info(users)").all();
console.table(schema);

console.log("\n--- Last 5 Users ---");
const users = db.prepare("SELECT * FROM users ORDER BY id DESC LIMIT 5").all();
console.table(users);

console.log("\n--- Checking 'admin' user ---");
const admin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
console.log(admin);
