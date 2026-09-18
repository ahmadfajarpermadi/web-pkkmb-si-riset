require('dotenv').config();

const { initializeDatabase } = require('../db/initialize');

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? '' : String(process.argv[index + 1] || '').trim();
}

function numberFor(flag) {
  const value = Number(valueFor(flag));
  return Number.isFinite(value) ? value : null;
}

function validDate(value) {
  return value && !Number.isNaN(Date.parse(value));
}

function main() {
  const nama = valueFor('--nama');
  const latitude = numberFor('--latitude');
  const longitude = numberFor('--longitude');
  const radius = numberFor('--radius');
  const mulai = valueFor('--mulai');
  const selesai = valueFor('--selesai');

  if (!nama || nama.length > 150) throw new Error('Nama event wajib diisi dan maksimal 150 karakter.');
  if (latitude === null || latitude < -90 || latitude > 90) throw new Error('Latitude harus berada di antara -90 dan 90.');
  if (longitude === null || longitude < -180 || longitude > 180) throw new Error('Longitude harus berada di antara -180 dan 180.');
  if (!Number.isInteger(radius) || radius < 1 || radius > 5000) throw new Error('Radius harus berupa bilangan bulat 1–5000 meter.');
  if (!validDate(mulai) || !validDate(selesai) || Date.parse(selesai) <= Date.parse(mulai)) throw new Error('Waktu mulai dan selesai harus valid; selesai harus setelah mulai.');

  const database = initializeDatabase();
  try {
    database.transaction(() => {
      database.prepare('UPDATE event SET status_aktif = 0 WHERE status_aktif = 1').run();
      database.prepare(`
        INSERT INTO event (nama_event, latitude_venue, longitude_venue, radius_meter, waktu_mulai, waktu_selesai, status_aktif)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(nama, latitude, longitude, radius, mulai, selesai);
    })();
    console.log(`Event aktif '${nama}' berhasil dibuat.`);
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`Gagal membuat event: ${error.message}`);
  process.exitCode = 1;
}
