const express = require('express');
const bcrypt = require('bcrypt');

function createAuthPanitiaRouter(database) {
  const router = express.Router();

  router.get('/login', (request, response) => {
    if (request.session.panitiaId) return response.redirect('/panitia/dashboard');
    return response.render('panitia-login', { error: null, username: '' });
  });

  router.post('/login', async (request, response, next) => {
    const username = String(request.body.username || '').trim();
    const password = String(request.body.password || '');
    const invalidCredentials = () => response.status(401).render('panitia-login', {
      error: 'Username atau sandi tidak sesuai.', username,
    });

    if (!username || !password) return invalidCredentials();

    try {
      const panitia = database.prepare(
        'SELECT id, password_hash FROM panitia WHERE username = ? COLLATE NOCASE',
      ).get(username);
      if (!panitia || !(await bcrypt.compare(password, panitia.password_hash))) {
        return invalidCredentials();
      }

      return request.session.regenerate((error) => {
        if (error) return next(error);
        request.session.panitiaId = panitia.id;
        return request.session.save((saveError) => {
          if (saveError) return next(saveError);
          return response.redirect('/panitia/dashboard');
        });
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('pkkmb_panitia_sid');
      return response.redirect('/panitia/login');
    });
  });

  return router;
}

module.exports = { createAuthPanitiaRouter };
