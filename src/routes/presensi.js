const express = require('express');
const { verifyQrToken } = require('../services/hmac-token');
const { distanceInMeters, isValidLocation } = require('../services/geolocation');
const { logPresensiAttempt } = require('../middleware/rate-limit-log');

function getTokenTolerance() {
  const tolerance = Number.parseInt(process.env.QR_TOKEN_TOLERANCE_SECONDS || '35', 10);
  if (!Number.isInteger(tolerance) || tolerance < 25 || tolerance > 120) {
    throw new Error('QR_TOKEN_TOLERANCE_SECONDS harus berupa angka antara 25 dan 120.');
  }
  return tolerance;
}

function createPresensiRouter(database) {
  const router = express.Router();
  const recordAttendance = database.transaction(({ npm, eventId, latitude, longitude }) => {
    const existing = database.prepare('SELECT 1 FROM presensi WHERE npm = ? AND event_id = ?').get(npm, eventId);
    if (existing) return false;
    database.prepare(`
      INSERT INTO presensi (npm, event_id, latitude, longitude, status)
      VALUES (?, ?, ?, ?, 'berhasil')
    `).run(npm, eventId, latitude, longitude);
    return true;
  });

  function logAttempt(request, npm, eventId, hasil) {
    logPresensiAttempt(database, request, { npm, eventId, hasil });
  }

  function fail(request, response, { npm, eventId = null, hasil, status, message }) {
    logAttempt(request, npm, eventId, hasil);
    return response.status(status).json({ message });
  }

  router.get('/', (_request, response) => response.render('presensi-scan'));

  router.post('/submit', (request, response, next) => {
    const npm = request.session.mahasiswaNpm;
    const tokenData = verifyQrToken(request.body.token, process.env.QR_HMAC_SECRET);
    if (!tokenData) {
      return fail(request, response, { npm, hasil: 'token_invalid', status: 400, message: 'QR tidak valid. Pindai ulang QR yang tampil di venue.' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - tokenData.timestamp) > getTokenTolerance()) {
      return fail(request, response, { npm, eventId: tokenData.event_id, hasil: 'token_expired', status: 400, message: 'QR sudah kedaluwarsa. Pindai QR terbaru di venue.' });
    }

    const event = database.prepare(`
      SELECT id, latitude_venue, longitude_venue, radius_meter
      FROM event
      WHERE id = ? AND status_aktif = 1
        AND julianday(waktu_mulai) <= julianday('now') AND julianday(waktu_selesai) >= julianday('now')
    `).get(tokenData.event_id);
    if (!event) {
      return fail(request, response, { npm, eventId: tokenData.event_id, hasil: 'lainnya', status: 403, message: 'Event presensi tidak aktif atau belum dalam jadwal.' });
    }

    if (database.prepare('SELECT 1 FROM presensi WHERE npm = ? AND event_id = ?').get(npm, event.id)) {
      return fail(request, response, { npm, eventId: event.id, hasil: 'sudah_presensi', status: 409, message: 'Presensi untuk event ini sudah tercatat.' });
    }

    const mahasiswa = database.prepare('SELECT status_verifikasi FROM mahasiswa WHERE npm = ?').get(npm);
    if (!mahasiswa || mahasiswa.status_verifikasi !== 'verified') {
      return fail(request, response, { npm, eventId: event.id, hasil: 'lainnya', status: 403, message: 'Twibbon Anda harus terverifikasi sebelum melakukan presensi.' });
    }

    const location = {
      latitude: Number(request.body.latitude),
      longitude: Number(request.body.longitude),
      accuracy: Number(request.body.accuracy),
    };
    if (!isValidLocation(location)) {
      return fail(request, response, { npm, eventId: event.id, hasil: 'lainnya', status: 400, message: 'Data lokasi tidak valid. Aktifkan lokasi akurat lalu coba lagi.' });
    }

    const distance = distanceInMeters(location.latitude, location.longitude, event.latitude_venue, event.longitude_venue);
    if (distance > event.radius_meter + location.accuracy) {
      return fail(request, response, { npm, eventId: event.id, hasil: 'di_luar_radius', status: 403, message: `Anda berada di luar radius venue (${Math.round(distance)} m dari titik venue).` });
    }

    try {
      if (!recordAttendance({ npm, eventId: event.id, latitude: location.latitude, longitude: location.longitude })) {
        return fail(request, response, { npm, eventId: event.id, hasil: 'sudah_presensi', status: 409, message: 'Presensi untuk event ini sudah tercatat.' });
      }
      logAttempt(request, npm, event.id, 'berhasil');
      return response.status(201).json({ message: 'Presensi berhasil dicatat. Selamat mengikuti kegiatan!' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createPresensiRouter };
