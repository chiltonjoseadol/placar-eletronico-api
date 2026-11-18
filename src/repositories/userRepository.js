const { User } = require('../models');

module.exports = {
  create: (data) => User.create(data),
  findByEmail: (email) => User.findOne({ where: { email } }),
  findById: (id) => User.findByPk(id),
};
