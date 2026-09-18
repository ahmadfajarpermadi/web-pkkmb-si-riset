const fs = require('fs');
const os = require('os');
const path = require('path');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pkkmb-load-test-'));
process.env.DB_PATH = path.join(temporaryDirectory, 'presensi.db');
process.env.QR_HMAC_SECRET = 'load-test-hmac-secret-yang-tidak-dipakai-produksi';
process.env.SESSION_SECRET_MAHASISWA = 'load-test-session-mahasiswa-yang-tidak-dipakai-produksi';
process.env.SESSION_SECRET_PANITIA = 'load-test-session-panitia-yang-tidak-dipakai-produksi';

const autocannon = require('autocannon');
const bcrypt = require('bcrypt');
const { createApp } = require('../app');
const { initializeDatabase } = require('../db/initialize');
const { generateQrToken } = require('../services/hmac-token');

const participantCount = Number.parseInt(process.env.LOAD_TEST_PARTICIPANTS || '30', 10);

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => (error ? reject(error) : resolve(result)));
  });
}

async function login(baseUrl, npm, password) {
  const response = await fetch(`${baseUrl}/mahasiswa/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ npm, password }),
  });
  if (response.status !== 302) throw new Error(`Login peserta load test gagal untuk ${npm}.`);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  if (!Number.isInteger(participantCount) || participantCount < 2 || participantCount > 500) {
    throw new Error('LOAD_TEST_PARTICIPANTS harus berupa angka 2–500.');
  }

  const database = initializeDatabase();
  const password = 'load-test-password-yang-kuat';
  const passwordHash = await bcrypt.hash(password, 12);
  const now = Date.now();
  const eventId = database.prepare(`
    INSERT INTO event (nama_event, latitude_venue, longitude_venue, radius_meter, waktu_mulai, waktu_selesai)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'Load Test Lokal', -7.801, 112.01, 100,
    new Date(now - 60_000).toISOString(), new Date(now + 60 * 60 * 1000).toISOString(),
  ).lastInsertRowid;
  const insertMahasiswa = database.prepare(`
    INSERT INTO mahasiswa (npm, nama, password_hash, prodi, status_verifikasi)
    VALUES (?, ?, ?, ?, 'verified')
  `);
  const participants = Array.from({ length: participantCount }, (_, index) => String(8800000000 + index));
  database.transaction(() => {
    participants.forEach((npm, index) => insertMahasiswa.run(npm, `Peserta Load Test ${index + 1}`, passwordHash, 'Sistem Informasi'));
  })();

  const app = createApp({ database });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const cookies = await Promise.all(participants.map((npm) => login(baseUrl, npm, password)));
    const tokenTimestamp = Math.floor(Date.now() / 1000);
    let requestIndex = 0;
    const result = await runAutocannon({
      url: baseUrl,
      connections: participantCount,
      amount: participantCount,
      pipelining: 1,
      setupClient(client) {
        const index = requestIndex++;
        client.setRequest({
          method: 'POST',
          path: '/mahasiswa/presensi/submit',
          headers: { cookie: cookies[index], 'content-type': 'application/json' },
          body: JSON.stringify({
            token: generateQrToken(Number(eventId), process.env.QR_HMAC_SECRET, tokenTimestamp),
            latitude: -7.801,
            longitude: 112.01,
            accuracy: 3,
          }),
        });
      },
    });
    const successCount = database.prepare("SELECT COUNT(*) AS total FROM presensi WHERE status = 'berhasil'").get().total;
    console.log(autocannon.printResult(result));
    console.log(`Presensi sukses: ${successCount}/${participantCount}`);
    if (successCount !== participantCount || result.errors > 0) {
      throw new Error('Load test tidak menghasilkan seluruh presensi sukses. Periksa hasil di atas.');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    database.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Load test gagal: ${error.message}`);
  process.exitCode = 1;
});
