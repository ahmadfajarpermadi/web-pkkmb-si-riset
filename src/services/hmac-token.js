const crypto = require('crypto');

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function generateQrToken(eventId, secret, timestamp = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('QR_HMAC_SECRET belum dikonfigurasi.');

  const payload = base64Url(JSON.stringify({
    event_id: eventId,
    timestamp,
    nonce_random: crypto.randomBytes(16).toString('base64url'),
  }));
  return `${payload}.${sign(payload, secret)}`;
}

function verifyQrToken(token, secret) {
  const [payload, signature, ...extra] = String(token || '').split('.');
  if (!payload || !signature || extra.length !== 0) return null;

  const expectedSignature = sign(payload, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(decoded.event_id) || !Number.isInteger(decoded.timestamp) || typeof decoded.nonce_random !== 'string') return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { generateQrToken, verifyQrToken };
