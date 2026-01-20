/**
 * @file fix_db_col.js
 * @description DB 테이블에 누락된 컬럼을 수동으로 추가하는 긴급 복구 스크립트
 * @role 핫픽스 (Hotfix), 스키마 패치
 * @dependencies database.js
 * @status Maintenance (특정 이슈 발생 시 사용)
 * 
 * @analysis
 * - 현재는 `user_buildings` 테이블에 `last_maintenance_at` 컬럼을 추가하는 용도로 작성됨.
 * - 필요에 따라 SQL문을 수정하여 다른 마이그레이션 용도로 재사용 가능.
 */

const db = require('./database');

console.log('Adding last_maintenance_at column...');
try {
    // SQLite doesn't support dynamic defaults in ALTER TABLE
    db.prepare('ALTER TABLE user_buildings ADD COLUMN last_maintenance_at DATETIME DEFAULT NULL').run();
    console.log('Success: Added last_maintenance_at column.');
} catch (e) {
    console.error('Error:', e);
}
