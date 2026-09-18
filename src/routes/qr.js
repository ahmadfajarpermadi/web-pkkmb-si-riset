const express = require('express');
const QRCode = require('qrcode');
const { generateQrToken } = require('../services/hmac-token');

function getRotationInterval() {
  const interval = Number.parseInt(process.env.QR_ROTATION_INTERVAL_SECONDS || '25', 10);
  if (!Number.isInteger(interval) || interval < 20 || interval > 60) {
    throw new Error('QR_ROTATION_INTERVAL_SECONDS harus berupa angka antara 20 dan 60.');
  }
  return interval;
}

function getActiveEvent(database) {
  return database.prepare(`
    SELECT id, nama_event FROM event
    WHERE status_aktif = 1
    ORDER BY waktu_mulai ASC
    LIMIT 1
  `).get();
}

function createQrRouter(database) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    const event = getActiveEvent(database);
    return response.render('qr-venue', {
      event,
      rotationInterval: getRotationInterval(),
    });
  });

  router.get('/token', async (_request, response, next) => {
    const event = getActiveEvent(database);
    if (!event) {
      return response.status(404).json({ message: 'Belum ada event aktif untuk ditampilkan sebagai QR.' });
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const token = generateQrToken(event.id, process.env.QR_HMAC_SECRET, timestamp);
      const qrDataUrl = await QRCode.toDataURL(token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 720,
        color: { dark: '#231A16', light: '#F3E9D8' },
      });
      response.set('Cache-Control', 'no-store');
      return response.json({
        qrDataUrl,
        generatedAt: timestamp,
        expiresAt: timestamp + getRotationInterval(),
        eventName: event.nama_event,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createQrRouter };
