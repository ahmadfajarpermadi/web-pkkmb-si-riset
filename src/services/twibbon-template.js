function getTwibbonTemplateUrl() {
  const value = process.env.TWIBBON_TEMPLATE_URL;
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

module.exports = { getTwibbonTemplateUrl };
