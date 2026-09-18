function requireAuthMahasiswa(request, response, next) {
  if (!request.session.mahasiswaNpm) {
    return response.redirect('/mahasiswa/login');
  }

  return next();
}

module.exports = { requireAuthMahasiswa };
