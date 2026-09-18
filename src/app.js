const express = require('express');
const path = require('path');
const session = require('express-session');
const { createMahasiswaSessionStore, createPanitiaSessionStore } = require('./services/mahasiswa-session-store');
const { createAuthMahasiswaRouter } = require('./routes/auth-mahasiswa');
const { createAuthPanitiaRouter } = require('./routes/auth-panitia');
const { createTwibbonMahasiswaRouter } = require('./routes/twibbon-mahasiswa');
const { createTwibbonPanitiaRouter } = require('./routes/twibbon-panitia');
const { createQrRouter } = require('./routes/qr');
const { createPresensiRouter } = require('./routes/presensi');
const { createAnomalyRouter } = require('./routes/anomaly');
const { createRekapRouter } = require('./routes/rekap');
const { getTwibbonTemplateUrl } = require('./services/twibbon-template');
const { requireAuthMahasiswa } = require('./middleware/require-auth-mahasiswa');
const { requireAuthPanitia } = require('./middleware/require-auth-panitia');

function createApp({ database, isProduction = false }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
  app.use('/vendor/html5-qrcode', express.static(path.join(__dirname, '..', 'node_modules', 'html5-qrcode')));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(session({
    name: 'pkkmb_mahasiswa_sid',
    secret: process.env.SESSION_SECRET_MAHASISWA,
    store: createMahasiswaSessionStore(database),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }));

  app.use('/mahasiswa', createAuthMahasiswaRouter(database));
  app.use('/mahasiswa/twibbon', requireAuthMahasiswa, createTwibbonMahasiswaRouter(database));
  app.use('/mahasiswa/presensi', requireAuthMahasiswa, createPresensiRouter(database));
  app.use('/panitia', session({
    name: 'pkkmb_panitia_sid',
    secret: process.env.SESSION_SECRET_PANITIA,
    store: createPanitiaSessionStore(database),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }));
  app.use('/panitia', createAuthPanitiaRouter(database));
  app.use('/panitia/twibbon', requireAuthPanitia, createTwibbonPanitiaRouter(database));
  app.use('/panitia/qr', requireAuthPanitia, createQrRouter(database));
  app.use('/panitia/anomali', requireAuthPanitia, createAnomalyRouter(database));
  app.use('/panitia/rekap', requireAuthPanitia, createRekapRouter(database));

  app.get('/', (request, response) => {
    if (request.session.mahasiswaNpm) {
      return response.redirect('/mahasiswa/dashboard');
    }
    return response.redirect('/mahasiswa/login');
  });

  app.get('/mahasiswa/dashboard', requireAuthMahasiswa, (request, response) => {
    const mahasiswa = database.prepare(`
      SELECT npm, nama, link_twibbon, status_verifikasi FROM mahasiswa WHERE npm = ?
    `).get(request.session.mahasiswaNpm);
    const twibbonError = request.session.twibbonError;
    const twibbonSuccess = request.session.twibbonSuccess;
    delete request.session.twibbonError;
    delete request.session.twibbonSuccess;
    return response.render('mahasiswa-dashboard', {
      mahasiswa, twibbonError, twibbonSuccess, twibbonTemplateUrl: getTwibbonTemplateUrl(),
    });
  });

  app.get('/panitia/dashboard', requireAuthPanitia, (request, response) => {
    const panitia = database.prepare('SELECT id, username, nama, role FROM panitia WHERE id = ?').get(request.session.panitiaId);
    const totalPending = database.prepare(
      "SELECT COUNT(*) AS total FROM mahasiswa WHERE status_verifikasi = 'pending'",
    ).get().total;
    return response.render('panitia-dashboard', { panitia, totalPending });
  });

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use((error, _request, response, _next) => {
    console.error('Unhandled application error:', error.message);
    response.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  });

  return app;
}

module.exports = { createApp };
