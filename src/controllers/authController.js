const authService = require('../services/authService');

module.exports = {
  register: async (req, res) => res.status(201).json(await authService.register(req.body)),
  login: async (req, res) => res.status(200).json(await authService.login(req.body)),
  me: async (req, res) => res.status(200).json(await authService.me(req.userId)),
};
