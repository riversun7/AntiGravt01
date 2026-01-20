/**
 * @file verify_setup.js
 * @description 서버 환경 설정(.env, DB 파일, 테이블 존재 여부)을 검증하는 진단 스크립트
 * @role 배포 전/후 환경 점검 (Health Check)
 * @dependencies fs, path, database.js
 * @status Maintenance
 * 
 * @analysis
 * - .env 로드 확인, DB 파일 권한 및 경로 확인, 필수 테이블(admin_tasks 등) 존재 여부를 체크합니다.
 * - 서버 실행 전 `node verify_setup.js`로 환경 문제를 미리 파악할 수 있습니다.
 */

const fs = require('fs');
const path = require('path');

// Manually load .env
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
        console.log('✅ Loaded .env file manually');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file:', e.message);
}

const db = require('./database');

console.log('=== DB Configuration Verification ===');
console.log('1. Environment Variable Check:');
if (process.env.DB_PATH) {
    console.log(`   ✅ DB_PATH is set to: ${process.env.DB_PATH}`);
} else {
    console.error('   ❌ DB_PATH is NOT set in environment!');
    process.exit(1);
}

console.log('\n2. File System Check:');
const resolvedPath = path.resolve(process.env.DB_PATH);
if (fs.existsSync(resolvedPath)) {
    console.log(`   ✅ DB file exists at: ${resolvedPath}`);
    const stats = fs.statSync(resolvedPath);
    console.log(`   Detailed Size: ${stats.size} bytes`);
} else {
    console.error(`   ❌ DB file NOT found at: ${resolvedPath}`);
    // Check parent dir
    const parentDir = path.dirname(resolvedPath);
    if (fs.existsSync(parentDir)) {
        console.log(`   (Parent directory ${parentDir} exists)`);
    } else {
        console.error(`   (Parent directory ${parentDir} does NOT exist)`);
    }
}

console.log('\n3. Database Module Connectivity Check:');
try {
    const tableCount = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get();
    console.log(`   ✅ Successfully connected via database.js`);
    console.log(`   ✅ Table count: ${tableCount.count}`);

    // Check specific critical table for admin planning
    const tasksTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_tasks'").get();
    if (tasksTable) {
        console.log(`   ✅ 'admin_tasks' table exists.`);
    } else {
        console.error(`   ❌ 'admin_tasks' table missing!`);
    }
} catch (e) {
    console.error('   ❌ Failed to connect to DB:', e.message);
}
console.log('=====================================');
