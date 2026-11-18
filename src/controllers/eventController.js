const eventService = require('../services/eventService');

module.exports = {
  create: async (req, res) =>
    res.status(201).json(await eventService.create(req.userId, req.params.matchId, req.body)),
  list: async (req, res) => res.status(200).json(await eventService.list(req.params.matchId)),
  remove: async (req, res) =>
    res.status(200).json(await eventService.remove(req.userId, req.params.matchId, req.params.eventId)),
};
