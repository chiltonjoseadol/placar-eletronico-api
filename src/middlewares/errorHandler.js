const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(`Rota ${req.method} ${req.originalUrl} não encontrada.`, 404));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors.map((e) => e.message).join('; ') });
  }

  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = { notFound, errorHandler };
