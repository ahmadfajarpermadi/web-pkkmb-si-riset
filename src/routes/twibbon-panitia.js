const express = require('express');

const STATUS_FILTERS = ['pending', 'verified', 'rejected', 'all'];

function createTwibbonPanitiaRouter(database) {
  const router = express.Router();

  router.get('/antrian', (request, response) => {
    const status = String(request.query.status || 'pending');
    if (!STATUS_FILTERS.includes(status)) {
      return response.status(400).render('error', { message: 'Filter status tidak valid.' });
    }

    const counts = {};
    database.prepare(`
      SELECT status_verifikasi, COUNT(*) AS total
      FROM mahasiswa
      WHERE status_verifikasi IN ('pending', 'verified', 'rejected')
      GROUP BY status_verifikasi
    `).all().forEach((row) => { counts[row.status_verifikasi] = row.total; });

    const whereClause = status === 'all'
      ? "WHERE m.status_verifikasi IN ('pending', 'verified', 'rejected')"
      : 'WHERE m.status_verifikasi = ?';
    const params = status === 'all' ? [] : [status];

    const submissions = database.prepare(`
      SELECT m.npm, m.nama, m.link_twibbon, m.status_verifikasi, m.dibuat_pada,
             datetime(m.diverifikasi_pada, '+7 hours') AS diverifikasi_pada,
             p.username AS diverifikasi_oleh
      FROM mahasiswa m
      LEFT JOIN panitia p ON p.id = m.diverifikasi_oleh
      ${whereClause}
      ORDER BY m.dibuat_pada ${status === 'pending' ? 'ASC' : 'DESC'}
    `).all(...params);

    return response.render('twibbon-queue', { submissions, status, counts });
  });

  router.post('/:npm/status', (request, response, next) => {
    const status = String(request.body.status || '');
    if (!['verified', 'rejected'].includes(status)) {
      return response.status(400).render('error', { message: 'Status verifikasi tidak valid.' });
    }

    try {
      const update = database.prepare(`
        UPDATE mahasiswa
        SET status_verifikasi = ?, diverifikasi_oleh = ?, diverifikasi_pada = CURRENT_TIMESTAMP
        WHERE npm = ? AND status_verifikasi = 'pending'
      `).run(status, request.session.panitiaId, request.params.npm);
      if (update.changes !== 1) {
        return response.status(409).render('error', { message: 'Data ini sudah diproses atau tidak ditemukan.' });
      }
      return response.redirect('/panitia/twibbon/antrian');
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createTwibbonPanitiaRouter };
