const express = require('express');
const { validateInstagramPostUrl } = require('../services/instagram-url');

function createTwibbonMahasiswaRouter(database) {
  const router = express.Router();

  router.post('/submit', (request, response, next) => {
    const result = validateInstagramPostUrl(request.body.link_twibbon);
    if (!result.valid) {
      request.session.twibbonError = result.message;
      return response.redirect('/mahasiswa/dashboard');
    }

    try {
      const outcome = database.prepare(`
        UPDATE mahasiswa
        SET link_twibbon = ?, status_verifikasi = 'pending', diverifikasi_oleh = NULL, diverifikasi_pada = NULL
        WHERE npm = ? AND status_verifikasi IN ('belum_submit', 'rejected')
      `).run(result.url, request.session.mahasiswaNpm);
      if (outcome.changes !== 1) {
        request.session.twibbonError = 'Twibbon sedang dalam proses verifikasi atau sudah terverifikasi, sehingga link tidak dapat diubah.';
      } else {
        request.session.twibbonSuccess = 'Link twibbon berhasil dikirim dan sedang menunggu verifikasi panitia.';
      }
      return response.redirect('/mahasiswa/dashboard');
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createTwibbonMahasiswaRouter };
