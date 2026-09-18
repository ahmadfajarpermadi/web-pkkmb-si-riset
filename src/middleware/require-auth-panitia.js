function requireAuthPanitia(request, response, next) {
  if (!request.session.panitiaId) {
    return response.redirect('/panitia/login');
  }

  return next();
}

module.exports = { requireAuthPanitia };
