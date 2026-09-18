function validateInstagramPostUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    return { valid: false, message: 'Masukkan link postingan Instagram yang valid.' };
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(hostname)) {
    return { valid: false, message: 'Link harus menggunakan domain instagram.com dan HTTPS.' };
  }
  if (url.username || url.password || !/^\/(p|reel)\/[^/]+\/?$/.test(url.pathname)) {
    return { valid: false, message: 'Gunakan link postingan Instagram dengan format instagram.com/p/... atau instagram.com/reel/....' };
  }

  url.hash = '';
  return { valid: true, url: url.toString() };
}

module.exports = { validateInstagramPostUrl };
