const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SPORTS, STATUSES, TIMER_TYPES } = require('../utils/sportRules');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
});

const Match = sequelize.define('Match', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sport: { type: DataTypes.ENUM(...Object.keys(SPORTS)), allowNull: false },
  status: { type: DataTypes.ENUM(...STATUSES), allowNull: false, defaultValue: 'agendado' },

  teamAName: { type: DataTypes.STRING(100), allowNull: false },
  teamAShortName: { type: DataTypes.STRING(5), allowNull: false },
  teamAColor: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FF0000' },
  teamBName: { type: DataTypes.STRING(100), allowNull: false },
  teamBShortName: { type: DataTypes.STRING(5), allowNull: false },
  teamBColor: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#0000FF' },

  timerType: { type: DataTypes.ENUM(...TIMER_TYPES), allowNull: false },
  periodDurationSeconds: { type: DataTypes.INTEGER, allowNull: true },
  // Estado do cronômetro: tempo acumulado + instante em que foi iniciado (null = pausado)
  timerElapsedMs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  timerStartedAt: { type: DataTypes.DATE, allowNull: true },

  // Estado derivado dos eventos (mantido para listagens rápidas)
  scoreA: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  scoreB: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  setsA: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  setsB: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  currentPeriod: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
});

const MatchEvent = sequelize.define('MatchEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  team: { type: DataTypes.ENUM('A', 'B'), allowNull: false },
  type: { type: DataTypes.STRING(30), allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  period: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  playerName: { type: DataTypes.STRING(100), allowNull: true },
  clock: { type: DataTypes.STRING(10), allowNull: true },
});

User.hasMany(Match, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
Match.belongsTo(User, { foreignKey: 'userId' });

Match.hasMany(MatchEvent, { foreignKey: { name: 'matchId', allowNull: false }, as: 'events', onDelete: 'CASCADE' });
MatchEvent.belongsTo(Match, { foreignKey: 'matchId' });

module.exports = { sequelize, User, Match, MatchEvent };
