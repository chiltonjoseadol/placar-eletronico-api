const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');
const { requireString, requireEmail } = require('../utils/validators');

function sanitize(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

async function register(body = {}) {
  const name = requireString(body.name, 'name', { min: 2, max: 100 });
  const email = requireEmail(body.email);
  const password = requireString(body.password, 'password', { min: 6, max: 100 });

  if (await userRepository.findByEmail(email)) {
    throw new AppError('E-mail já cadastrado.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({ name, email, passwordHash });
  return { user: sanitize(user), token: signToken(user) };
}

async function login(body = {}) {
  const email = requireEmail(body.email);
  const password = requireString(body.password, 'password', { min: 1, max: 100 });

  const user = await userRepository.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Credenciais inválidas.', 401);
  }
  return { user: sanitize(user), token: signToken(user) };
}

async function me(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  return sanitize(user);
}

module.exports = { register, login, me };
