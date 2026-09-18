require('dotenv').config();

const { createApp } = require('./app');
const { initializeDatabase } = require('./db/initialize');

const port = Number.parseInt(process.env.PORT || '3000', 10);

const requiredSecrets = ['QR_HMAC_SECRET', 'SESSION_SECRET_MAHASISWA', 'SESSION_SECRET_PANITIA'];
for (const secretName of requiredSecrets) {
  if (!process.env[secretName]) {
    throw new Error(`${secretName} wajib diatur di environment variable.`);
  }
}

const database = initializeDatabase();
const app = createApp({ database, isProduction: process.env.NODE_ENV === 'production' });
app.listen(port, () => {
  console.log(`Server berjalan di port ${port}.`);
});
