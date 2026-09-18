require('dotenv').config();

const bcrypt = require('bcrypt');
const { initializeDatabase } = require('../db/initialize');

const NPM_PATTERN = /^\d{10}$/;
const PASSWORD_MIN_LENGTH = 8;
const STATUS_VALID = ['belum_submit', 'pending', 'verified', 'rejected'];

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? '' : String(process.argv[index + 1] || '').trim();
}

async function main() {
  const npm = valueFor('--npm');
  const nama = valueFor('--nama');
  const password = valueFor('--password');
  const prodi = valueFor('--prodi') || 'Sistem Informasi';
  const status = valueFor('--status') || 'belum_submit';

  if (!NPM_PATTERN.test(npm)) throw new Error('NPM harus terdiri dari tepat 10 angka.');
  if (!nama || nama.length > 100) throw new Error('Nama wajib diisi dan maksimal 100 karakter.');
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password minimal ${PASSWORD_MIN_LENGTH} karakter.`);
  }
  if (!STATUS_VALID.includes(status)) {
    throw new Error(`Status harus salah satu dari: ${STATUS_VALID.join(', ')}.`);
  }

  const database = initializeDatabase();
  try {
    if (database.prepare('SELECT 1 FROM mahasiswa WHERE npm = ?').get(npm)) {
      throw new Error(`NPM ${npm} sudah terdaftar di database.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    database.prepare(`
      INSERT INTO mahasiswa (npm, nama, password_hash, prodi, status_verifikasi)
      VALUES (?, ?, ?, ?, ?)
    `).run(npm, nama, passwordHash, prodi, status);
    console.log(`Akun peserta '${nama}' (${npm}) berhasil dibuat dengan status '${status}'.`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  console.error(`Gagal membuat akun peserta: ${error.message}`);
  process.exitCode = 1;
});
