require('dotenv').config();

const bcrypt = require('bcrypt');
const { initializeDatabase } = require('../db/initialize');

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? '' : String(process.argv[index + 1] || '').trim();
}

async function main() {
  const username = valueFor('--username');
  const nama = valueFor('--nama');
  const password = valueFor('--password');
  const role = valueFor('--role') || 'verifikator';

  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
    throw new Error('Username harus 3–40 karakter: huruf, angka, titik, garis bawah, atau strip.');
  }
  if (!nama || nama.length > 100) throw new Error('Nama wajib diisi dan maksimal 100 karakter.');
  if (password.length < 12) throw new Error('Password panitia minimal 12 karakter.');
  if (!['verifikator', 'superadmin'].includes(role)) throw new Error('Role harus verifikator atau superadmin.');

  const database = initializeDatabase();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    database.prepare(`
      INSERT INTO panitia (username, password_hash, nama, role) VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, nama, role);
    console.log(`Akun panitia '${username}' berhasil dibuat.`);
  } finally {
    database.close();
  }
}

main().catch((error) => {
  console.error(`Gagal membuat akun panitia: ${error.message}`);
  process.exitCode = 1;
});
