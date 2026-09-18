const express = require('express');
const bcrypt = require('bcrypt');
const { getMahasiswaTerdaftar } = require('../services/mahasiswa-roster');

const NPM_PATTERN = /^\d{10}$/;
const PASSWORD_MIN_LENGTH = 8;

function renderRegister(response, { error, npm = '' } = {}) {
  return response.status(error ? 400 : 200).render('mahasiswa-register', { error, npm });
}

function createAuthMahasiswaRouter(database) {
  const router = express.Router();

  router.get('/daftar', (_request, response) => renderRegister(response));

  router.post('/daftar', async (request, response, next) => {
    const npm = String(request.body.npm || '').trim();
    const password = String(request.body.password || '');
    const passwordConfirmation = String(request.body.konfirmasi_sandi || '');

    if (!NPM_PATTERN.test(npm)) {
      return renderRegister(response, { error: 'NPM harus terdiri dari tepat 10 angka.', npm });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return renderRegister(response, { error: 'Sandi minimal harus terdiri dari 8 karakter.', npm });
    }
    if (password !== passwordConfirmation) {
      return renderRegister(response, { error: 'Konfirmasi sandi tidak sama.', npm });
    }

    const mahasiswaRoster = getMahasiswaTerdaftar(npm);
    if (!mahasiswaRoster) {
      return renderRegister(response, { error: 'NPM tidak ditemukan pada daftar peserta PKKMB.', npm });
    }
    if (database.prepare('SELECT 1 FROM mahasiswa WHERE npm = ?').get(npm)) {
      return renderRegister(response, { error: 'NPM ini sudah terdaftar. Silakan masuk.', npm });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      database.prepare(`
        INSERT INTO mahasiswa (npm, nama, password_hash, prodi)
        VALUES (?, ?, ?, ?)
      `).run(npm, mahasiswaRoster.nama, passwordHash, 'Sistem Informasi');
      return response.redirect('/mahasiswa/login?terdaftar=1');
    } catch (error) {
      return next(error);
    }
  });

  router.get('/login', (request, response) => {
    if (request.session.mahasiswaNpm) return response.redirect('/mahasiswa/dashboard');
    return response.render('mahasiswa-login', {
      error: null,
      registered: request.query.terdaftar === '1',
      npm: '',
    });
  });

  router.post('/login', async (request, response, next) => {
    const npm = String(request.body.npm || '').trim();
    const password = String(request.body.password || '');
    const invalidCredentials = () => response.status(401).render('mahasiswa-login', {
      error: 'NPM atau sandi tidak sesuai.', registered: false, npm,
    });

    if (!NPM_PATTERN.test(npm) || !password) return invalidCredentials();

    try {
      const mahasiswa = database.prepare('SELECT npm, password_hash FROM mahasiswa WHERE npm = ?').get(npm);
      if (!mahasiswa || !(await bcrypt.compare(password, mahasiswa.password_hash))) {
        return invalidCredentials();
      }
      return request.session.regenerate((error) => {
        if (error) return next(error);
        request.session.mahasiswaNpm = mahasiswa.npm;
        return request.session.save((saveError) => {
          if (saveError) return next(saveError);
          return response.redirect('/mahasiswa/dashboard');
        });
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('pkkmb_mahasiswa_sid');
      return response.redirect('/mahasiswa/login');
    });
  });

  return router;
}

module.exports = { createAuthMahasiswaRouter };
