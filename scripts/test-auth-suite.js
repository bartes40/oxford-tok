import app from '../server/app.js';
import http from 'node:http';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const server = http.createServer(app).listen(3096, async () => {
  try {
    console.log('🚀 RUNNING DEEP AUTH VALIDATION SUITE...');
    const baseUrl = 'http://localhost:3096/api';

    // 1. Unauthenticated /auth/me
    const r1 = await fetch(baseUrl + '/auth/me');
    const d1 = await r1.json();
    if (d1.isGuest !== true || d1.user !== null) throw new Error('Test 1 Failed');
    console.log('✅ Test 1: Unauthenticated user returns isGuest: true, user: null');

    // 2. Reject short username
    const r2 = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab', password: 'password123' })
    });
    if (r2.status !== 400) throw new Error('Test 2 Failed');
    console.log('✅ Test 2: Short username rejected (400)');

    // 3. Reject reserved username 'guest'
    const r3 = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'guest', password: 'password123' })
    });
    if (r3.status !== 400) throw new Error('Test 3 Failed');
    console.log('✅ Test 3: Reserved username "guest" rejected (400)');

    // 4. Reject short password
    const r4 = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'validuser', password: '12' })
    });
    if (r4.status !== 400) throw new Error('Test 4 Failed');
    console.log('✅ Test 4: Short password (<4 chars) rejected (400)');

    // 5. Successful registration with mixed case username
    const testUser = 'Alex_' + Date.now().toString().slice(-4);
    const r5 = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'StrongPassword!123' })
    });
    const d5 = await r5.json();
    if (r5.status !== 200 || !d5.token || d5.user?.username !== testUser) throw new Error('Test 5 Failed');
    console.log('✅ Test 5: Successful registration with token & user returned');

    // 6. Reject duplicate registration with lowercase variant
    const r6 = await fetch(baseUrl + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser.toLowerCase(), password: 'AnotherPassword' })
    });
    const d6 = await r6.json();
    if (r6.status !== 400 || d6.success !== false) throw new Error('Test 6 Failed');
    console.log('✅ Test 6: Duplicate registration with case-variance strictly blocked (400)');

    // 7. Login with wrong password
    const r7 = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'WrongPassword' })
    });
    if (r7.status !== 401) throw new Error('Test 7 Failed');
    console.log('✅ Test 7: Login with wrong password rejected (401)');

    // 8. Login with correct password and trimmed lowercase username
    const r8 = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '  ' + testUser.toLowerCase() + '  ', password: 'StrongPassword!123' })
    });
    const d8 = await r8.json();
    if (r8.status !== 200 || !d8.token || d8.user.isGuest !== false) throw new Error('Test 8 Failed');
    console.log('✅ Test 8: Login with case-insensitive and trimmed username succeeds');

    // 9. Authenticated /auth/me returns valid user session
    const token = d8.token;
    const r9 = await fetch(baseUrl + '/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const d9 = await r9.json();
    if (d9.isGuest !== false || d9.user.username !== testUser) throw new Error('Test 9 Failed');
    console.log('✅ Test 9: /auth/me verifies session token and returns full profile');

    // 10. Authenticated review updates XP in cloud
    const r10 = await fetch(baseUrl + '/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ word_id: 10, rating: 4 })
    });
    const d10 = await r10.json();
    if (d10.success !== true || d10.userStats.xp <= 50) throw new Error('Test 10 Failed');
    console.log('✅ Test 10: Authenticated card review updates cloud XP (XP now: ' + d10.userStats.xp + ')');

    // 11. Cleanup test account in Turso
    const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    await c.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [testUser] });
    await c.execute({ sql: 'DELETE FROM user_profile WHERE user_id = ?', args: [d5.user.id] });
    await c.execute({ sql: 'DELETE FROM user_progress WHERE user_id = ?', args: [d5.user.id] });
    await c.execute({ sql: 'DELETE FROM review_logs WHERE user_id = ?', args: [d5.user.id] });
    console.log('✅ Test 11: Cloud cleanup completed.');

    console.log('\n🏆 ALL 11 DEEP TESTS PASSED WITH 100% ACCURACY!');
  } catch (err) {
    console.error('❌ VALIDATION ERROR:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
});
