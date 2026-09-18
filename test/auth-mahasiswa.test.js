const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcrypt');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pkkmb-auth-'));
process.env.DB_PATH = path.join(testDirectory, 'presensi.db');
process.env.SESSION_SECRET_MAHASISWA = 'test-session-secret-yang-panjang';
process.env.SESSION_SECRET_PANITIA = 'test-session-panitia-yang-panjang';
process.env.QR_HMAC_SECRET = 'test-qr-hmac-secret-yang-panjang';

const { initializeDatabase } = require('../src/db/initialize');
const { createApp } = require('../src/app');
const { generateQrToken, verifyQrToken } = require('../src/services/hmac-token');

function form(values) {
  return new URLSearchParams(values).toString();
}

test('registrasi dan login mahasiswa tervalidasi', async (context) => {
  const database = initializeDatabase();
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, {
    redirect: 'manual',
    ...options,
  });

  context.after(() => {
    server.close();
    database.close();
    fs.rmSync(testDirectory, { recursive: true, force: true });
  });

  let response = await request('/mahasiswa/dashboard');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/mahasiswa/login');

  response = await request('/mahasiswa/daftar', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ npm: '9999999999', password: 'sandi-kuat-2026', konfirmasi_sandi: 'sandi-kuat-2026' }),
  });
  assert.equal(response.status, 400);

  response = await request('/mahasiswa/daftar', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ npm: '2613020001', password: 'sandi-kuat-2026', konfirmasi_sandi: 'sandi-kuat-2026' }),
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/mahasiswa/login?terdaftar=1');
  assert.match(database.prepare('SELECT password_hash FROM mahasiswa WHERE npm = ?').get('2613020001').password_hash, /^\$2/);

  response = await request('/mahasiswa/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ npm: '2613020001', password: 'sandi-salah' }),
  });
  assert.equal(response.status, 401);

  response = await request('/mahasiswa/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ npm: '2613020001', password: 'sandi-kuat-2026' }),
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/mahasiswa/dashboard');
  const cookie = response.headers.get('set-cookie').split(';')[0];

  response = await request('/mahasiswa/dashboard', { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Putri Ayu Junita/);
});

test('login panitia memakai sesi yang terpisah dari mahasiswa', async (context) => {
  const database = initializeDatabase();
  const passwordHash = await bcrypt.hash('sandi-panitia-kuat', 12);
  database.prepare(`
    INSERT INTO panitia (username, password_hash, nama, role) VALUES (?, ?, ?, ?)
  `).run('verifikator-1', passwordHash, 'Panitia Verifikator', 'verifikator');
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, {
    redirect: 'manual',
    ...options,
  });

  context.after(() => {
    server.close();
    database.close();
  });

  let response = await request('/panitia/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'verifikator-1', password: 'sandi-panitia-kuat' }),
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/panitia/dashboard');
  const panitiaCookie = response.headers.get('set-cookie').split(';')[0];

  response = await request('/panitia/dashboard', { headers: { cookie: panitiaCookie } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Panitia Verifikator/);

  response = await request('/mahasiswa/dashboard', { headers: { cookie: panitiaCookie } });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/mahasiswa/login');
});

test('twibbon divalidasi dan dapat diverifikasi atau dikirim ulang setelah ditolak', async (context) => {
  const database = initializeDatabase();
  const passwordHash = await bcrypt.hash('sandi-panitia-twibbon', 12);
  database.prepare(`
    INSERT INTO panitia (username, password_hash, nama, role) VALUES (?, ?, ?, ?)
  `).run('verifikator-twibbon', passwordHash, 'Panitia Twibbon', 'verifikator');
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual', ...options });
  const loginMahasiswa = async (npm) => {
    await request('/mahasiswa/daftar', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ npm, password: 'sandi-mahasiswa-kuat', konfirmasi_sandi: 'sandi-mahasiswa-kuat' }) });
    const login = await request('/mahasiswa/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ npm, password: 'sandi-mahasiswa-kuat' }) });
    return login.headers.get('set-cookie').split(';')[0];
  };

  context.after(() => { server.close(); database.close(); fs.rmSync(testDirectory, { recursive: true, force: true }); });

  const cookieOne = await loginMahasiswa('2613020002');
  let response = await request('/mahasiswa/twibbon/submit', { method: 'POST', headers: { cookie: cookieOne, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ link_twibbon: 'https://example.com/p/tidak-valid' }) });
  assert.equal(response.status, 302);
  assert.equal(database.prepare('SELECT status_verifikasi FROM mahasiswa WHERE npm = ?').get('2613020002').status_verifikasi, 'belum_submit');

  response = await request('/mahasiswa/twibbon/submit', { method: 'POST', headers: { cookie: cookieOne, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ link_twibbon: 'https://www.instagram.com/p/postingan-valid/' }) });
  assert.equal(response.status, 302);
  assert.equal(database.prepare('SELECT status_verifikasi FROM mahasiswa WHERE npm = ?').get('2613020002').status_verifikasi, 'pending');

  let panitiaLogin = await request('/panitia/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ username: 'verifikator-twibbon', password: 'sandi-panitia-twibbon' }) });
  const panitiaCookie = panitiaLogin.headers.get('set-cookie').split(';')[0];
  response = await request('/panitia/twibbon/2613020002/status', { method: 'POST', headers: { cookie: panitiaCookie, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ status: 'verified' }) });
  assert.equal(response.status, 302);
  assert.equal(database.prepare('SELECT status_verifikasi FROM mahasiswa WHERE npm = ?').get('2613020002').status_verifikasi, 'verified');

  const cookieTwo = await loginMahasiswa('2613020003');
  await request('/mahasiswa/twibbon/submit', { method: 'POST', headers: { cookie: cookieTwo, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ link_twibbon: 'https://www.instagram.com/reel/pertama/' }) });
  response = await request('/panitia/twibbon/2613020003/status', { method: 'POST', headers: { cookie: panitiaCookie, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ status: 'rejected' }) });
  assert.equal(response.status, 302);
  response = await request('/mahasiswa/twibbon/submit', { method: 'POST', headers: { cookie: cookieTwo, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ link_twibbon: 'https://www.instagram.com/p/kirim-ulang/' }) });
  assert.equal(response.status, 302);
  assert.equal(database.prepare('SELECT status_verifikasi FROM mahasiswa WHERE npm = ?').get('2613020003').status_verifikasi, 'pending');
});

test('token QR bertanda tangan HMAC dan endpoint QR khusus panitia', async (context) => {
  const database = initializeDatabase();
  const passwordHash = await bcrypt.hash('sandi-panitia-qr-kuat', 12);
  database.prepare(`
    INSERT INTO panitia (username, password_hash, nama, role) VALUES (?, ?, ?, ?)
  `).run('panitia-qr', passwordHash, 'Panitia QR', 'superadmin');
  database.prepare(`
    INSERT INTO event (nama_event, latitude_venue, longitude_venue, radius_meter, waktu_mulai, waktu_selesai)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('PKKMB Hari 1', -7.801, 112.01, 100, '2026-09-01T07:00:00+07:00', '2026-09-01T16:00:00+07:00');
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual', ...options });
  context.after(() => { server.close(); database.close(); fs.rmSync(testDirectory, { recursive: true, force: true }); });

  const token = generateQrToken(1, process.env.QR_HMAC_SECRET, 12345);
  const tokenPayload = verifyQrToken(token, process.env.QR_HMAC_SECRET);
  assert.equal(tokenPayload.event_id, 1);
  assert.equal(tokenPayload.timestamp, 12345);
  assert.ok(tokenPayload.nonce_random);
  assert.equal(verifyQrToken(`${token}x`, process.env.QR_HMAC_SECRET), null);

  let response = await request('/panitia/qr/token');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/panitia/login');
  response = await request('/panitia/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ username: 'panitia-qr', password: 'sandi-panitia-qr-kuat' }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  response = await request('/panitia/qr/token', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.qrDataUrl, /^data:image\/png;base64,/);
  assert.equal(body.eventName, 'PKKMB Hari 1');
});

test('presensi memvalidasi token dan lokasi lalu mengunci satu presensi per event', async (context) => {
  const database = initializeDatabase();
  const passwordHash = await bcrypt.hash('sandi-presensi-kuat', 12);
  database.prepare(`
    INSERT INTO mahasiswa (npm, nama, password_hash, prodi, status_verifikasi)
    VALUES (?, ?, ?, ?, 'verified')
  `).run('2613020004', 'Naila Ghina Az-zain', passwordHash, 'Sistem Informasi');
  const now = new Date();
  const started = new Date(now.getTime() - 60_000).toISOString();
  const finished = new Date(now.getTime() + 60_000).toISOString();
  const eventId = database.prepare(`
    INSERT INTO event (nama_event, latitude_venue, longitude_venue, radius_meter, waktu_mulai, waktu_selesai)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('PKKMB Presensi', -7.801, 112.01, 100, started, finished).lastInsertRowid;
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual', ...options });
  context.after(() => { server.close(); database.close(); fs.rmSync(testDirectory, { recursive: true, force: true }); });

  let response = await request('/mahasiswa/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ npm: '2613020004', password: 'sandi-presensi-kuat' }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const token = generateQrToken(Number(eventId), process.env.QR_HMAC_SECRET);
  const payload = JSON.stringify({ token, latitude: -7.801, longitude: 112.01, accuracy: 5 });

  response = await request('/mahasiswa/presensi/submit', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: payload });
  assert.equal(response.status, 201);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM presensi WHERE npm = ?').get('2613020004').total, 1);

  response = await request('/mahasiswa/presensi/submit', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: payload });
  assert.equal(response.status, 409);

  const expiredToken = generateQrToken(Number(eventId), process.env.QR_HMAC_SECRET, Math.floor(Date.now() / 1000) - 60);
  response = await request('/mahasiswa/presensi/submit', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ token: expiredToken, latitude: -7.801, longitude: 112.01, accuracy: 5 }) });
  assert.equal(response.status, 400);
  const secondPasswordHash = await bcrypt.hash('sandi-lokasi-kuat', 12);
  database.prepare(`
    INSERT INTO mahasiswa (npm, nama, password_hash, prodi, status_verifikasi)
    VALUES (?, ?, ?, ?, 'verified')
  `).run('2613020005', 'Muhammad Faiz Nashrullah', secondPasswordHash, 'Sistem Informasi');
  response = await request('/mahasiswa/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ npm: '2613020005', password: 'sandi-lokasi-kuat' }) });
  const outsideCookie = response.headers.get('set-cookie').split(';')[0];
  response = await request('/mahasiswa/presensi/submit', { method: 'POST', headers: { cookie: outsideCookie, 'content-type': 'application/json' }, body: JSON.stringify({ token: generateQrToken(Number(eventId), process.env.QR_HMAC_SECRET), latitude: -7.9, longitude: 112.01, accuracy: 5 }) });
  assert.equal(response.status, 403);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM log_percobaan WHERE hasil = 'berhasil'").get().total, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM log_percobaan WHERE hasil = 'sudah_presensi'").get().total, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM log_percobaan WHERE hasil = 'token_expired'").get().total, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM log_percobaan WHERE hasil = 'di_luar_radius'").get().total, 1);
});

test('dashboard panitia menandai lebih dari tiga NPM dari satu IP tanpa memblokir', async (context) => {
  const database = initializeDatabase();
  const passwordHash = await bcrypt.hash('sandi-anomali-kuat', 12);
  database.prepare(`
    INSERT INTO panitia (username, password_hash, nama, role) VALUES (?, ?, ?, ?)
  `).run('panitia-anomali', passwordHash, 'Panitia Anomali', 'verifikator');
  const insertLog = database.prepare(`
    INSERT INTO log_percobaan (npm, ip_address, user_agent, hasil) VALUES (?, ?, ?, ?)
  `);
  ['2613020001', '2613020002', '2613020003', '2613020004'].forEach((npm) => {
    insertLog.run(npm, '198.51.100.7', 'test-agent', 'token_invalid');
  });
  const app = createApp({ database });
  const server = app.listen(0);
  const port = server.address().port;
  const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual', ...options });
  context.after(() => { server.close(); database.close(); fs.rmSync(testDirectory, { recursive: true, force: true }); });

  let response = await request('/panitia/anomali');
  assert.equal(response.status, 302);
  response = await request('/panitia/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ username: 'panitia-anomali', password: 'sandi-anomali-kuat' }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  response = await request('/panitia/anomali', { headers: { cookie } });
  assert.equal(response.status, 200);
  const page = await response.text();
  assert.match(page, /198\.51\.100\.7/);
  assert.match(page, /4 NPM/);
});
