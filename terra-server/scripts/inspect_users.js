/**
 * @file inspect_users.js
 * @description 사용자 테이블(users)의 스키마와 최신 데이터를 확인하는 디버깅 스크립트
 * @role 데이터 확인, 스키마 검증
 * @dependencies database.js
 * @status Maintenance
 */

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
