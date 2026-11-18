const { Match } = require('../models');

module.exports = {
  create: (data) => Match.create(data),
  findById: (id) => Match.findByPk(id),
  findAndCountAll: ({ where, limit, offset }) =>
    Match.findAndCountAll({ where, limit, offset, order: [['id', 'DESC']] }),
  update: (match, data) => match.update(data),
  destroy: (match) => match.destroy(),
};
