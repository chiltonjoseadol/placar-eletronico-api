const { MatchEvent } = require('../models');

module.exports = {
  create: (data) => MatchEvent.create(data),
  findByMatch: (matchId) => MatchEvent.findAll({ where: { matchId }, order: [['id', 'ASC']] }),
  findById: (id, matchId) => MatchEvent.findOne({ where: { id, matchId } }),
  findLastByMatch: (matchId) => MatchEvent.findOne({ where: { matchId }, order: [['id', 'DESC']] }),
  destroy: (event) => event.destroy(),
  destroyByMatch: (matchId) => MatchEvent.destroy({ where: { matchId } }),
};
