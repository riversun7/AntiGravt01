/**
 * @file debug_db.js
 * @description 특정 테이블의 컬럼 정보를 출력하는 간단한 디버깅 스크립트
 * @role 스키마 확인, 개발 편의 도구
 * @dependencies database.js
 * @status Maintenance
 */

const db = require('./database');

try {
    const info = db.pragma('table_info(user_buildings)');
    console.log('Columns in user_buildings:');
    info.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (e) {
    console.error('Error:', e);
}
