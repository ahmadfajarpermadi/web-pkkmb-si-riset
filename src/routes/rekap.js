const express = require('express');

function createRekapRouter(database) {
  const router = express.Router();

  const presensiByEvent = database.prepare(`
    SELECT m.npm, m.nama, datetime(p.waktu_scan, '+7 hours') AS waktu_scan
    FROM presensi p
    JOIN mahasiswa m ON m.npm = p.npm
    WHERE p.event_id = ? AND p.status = 'berhasil'
    ORDER BY p.waktu_scan ASC
  `);
  const belumHadirByEvent = database.prepare(`
    SELECT m.npm, m.nama
    FROM mahasiswa m
    WHERE m.status_verifikasi = 'verified'
      AND NOT EXISTS (
        SELECT 1 FROM presensi p
        WHERE p.npm = m.npm AND p.event_id = ? AND p.status = 'berhasil'
      )
    ORDER BY m.nama ASC
  `);

  router.get('/', (_request, response) => {
    const events = database.prepare(`
      SELECT e.id, e.nama_event, e.status_aktif, e.waktu_mulai, e.waktu_selesai,
             COUNT(p.id) AS total_hadir,
             (SELECT COUNT(*) FROM mahasiswa WHERE status_verifikasi = 'verified') AS total_peserta
      FROM event e
      LEFT JOIN presensi p ON p.event_id = e.id AND p.status = 'berhasil'
      GROUP BY e.id
      ORDER BY e.waktu_mulai DESC
    `).all();

    const eventsWithDetails = events.map((event) => ({
      ...event,
      presensi: presensiByEvent.all(event.id),
      belumHadir: belumHadirByEvent.all(event.id),
    }));

    const totalHadirKeseluruhan = database.prepare(
      "SELECT COUNT(*) AS total FROM presensi WHERE status = 'berhasil'",
    ).get().total;

    return response.render('rekap-presensi', {
      events: eventsWithDetails,
      totalHadirKeseluruhan,
    });
  });

  return router;
}

module.exports = { createRekapRouter };
