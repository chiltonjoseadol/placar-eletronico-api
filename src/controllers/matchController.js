const matchService = require('../services/matchService');

module.exports = {
  create: async (req, res) => res.status(201).json(await matchService.create(req.userId, req.body)),
  list: async (req, res) => res.status(200).json(await matchService.list(req.query)),
  getById: async (req, res) => res.status(200).json(await matchService.getById(req.params.id)),
  scoreboard: async (req, res) => res.status(200).json(await matchService.getScoreboard(req.params.id)),
  update: async (req, res) =>
    res.status(200).json(await matchService.update(req.userId, req.params.id, req.body)),
  changeStatus: async (req, res) =>
    res.status(200).json(await matchService.changeStatus(req.userId, req.params.id, (req.body || {}).status)),
  nextPeriod: async (req, res) =>
    res.status(200).json(await matchService.nextPeriod(req.userId, req.params.id)),
  remove: async (req, res) => {
    await matchService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
