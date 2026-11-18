const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Token não informado. Use o header Authorization: Bearer <token>.', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (err) {
    return next(new AppError('Token inválido ou expirado.', 401));
  }
};
