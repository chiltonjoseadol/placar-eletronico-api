const AppError = require('./AppError');

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(`Parâmetro '${label}' inválido.`, 400);
  }
  return n;
}

function requireString(value, field, { min = 1, max = 100 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new AppError(`Campo '${field}' é obrigatório e deve ter entre ${min} e ${max} caracteres.`, 400);
  }
  return value.trim();
}

function optionalHexColor(value, field) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new AppError(`Campo '${field}' deve ser uma cor hexadecimal no formato #RRGGBB.`, 400);
  }
  return value.toUpperCase();
}

function optionalShortName(value, field) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field, { min: 1, max: 5 }).toUpperCase();
}

function requireEmail(value) {
  if (typeof value !== 'string' || !EMAIL.test(value.trim())) {
    throw new AppError("Campo 'email' inválido.", 400);
  }
  return value.trim().toLowerCase();
}

module.exports = { parseId, requireString, optionalHexColor, optionalShortName, requireEmail };
