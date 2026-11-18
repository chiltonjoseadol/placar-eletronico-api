const { Op } = require('sequelize');
const matchRepository = require('../repositories/matchRepository');
const eventRepository = require('../repositories/eventRepository');
const AppError = require('../utils/AppError');
const { SPORTS, STATUSES, TIMER_TYPES } = require('../utils/sportRules');
const { computeState } = require('../utils/scoreCalculator');
const {
  parseId,
  requireString,
  optionalHexColor,
  optionalShortName,
} = require('../utils/validators');

const STATUS_TRANSITIONS = {
  agendado: ['em_andamento'],
  em_andamento: ['finalizado'],
  finalizado: [],
};

function defaultShortName(name) {
  return name.replace(/\s+/g, '').slice(0, 3).toUpperCase();
}

function optionalTimerType(value) {
  if (value === undefined || value === null) return undefined;
  if (!TIMER_TYPES.includes(value)) {
    throw new AppError(`Campo 'timerType' deve ser um de: ${TIMER_TYPES.join(', ')}.`, 400);
  }
  return value;
}

function optionalDuration(value) {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError("Campo 'periodDurationSeconds' deve ser um inteiro positivo.", 400);
  }
  return value;
}

function requireSport(value) {
  if (!SPORTS[value]) {
    throw new AppError(`Campo 'sport' deve ser um de: ${Object.keys(SPORTS).join(', ')}.`, 400);
  }
  return value;
}

/** Busca a partida (404) e valida que pertence ao usuário (403). */
async function getOwned(matchId, userId) {
  const match = await matchRepository.findById(parseId(matchId, 'matchId'));
  if (!match) throw new AppError('Partida não encontrada.', 404);
  if (match.userId !== userId) {
    throw new AppError('Você não tem permissão para alterar esta partida.', 403);
  }
  return match;
}

async function getById(id) {
  const match = await matchRepository.findById(parseId(id));
  if (!match) throw new AppError('Partida não encontrada.', 404);
  return match;
}

async function create(userId, body = {}) {
  const sport = requireSport(body.sport);
  const rules = SPORTS[sport];

  const teamAName = requireString(body.teamAName, 'teamAName');
  const teamBName = requireString(body.teamBName, 'teamBName');

  return matchRepository.create({
    userId,
    sport,
    status: 'agendado',
    teamAName,
    teamBName,
    teamAShortName: optionalShortName(body.teamAShortName, 'teamAShortName') || defaultShortName(teamAName),
    teamBShortName: optionalShortName(body.teamBShortName, 'teamBShortName') || defaultShortName(teamBName),
    teamAColor: optionalHexColor(body.teamAColor, 'teamAColor') || '#FF0000',
    teamBColor: optionalHexColor(body.teamBColor, 'teamBColor') || '#0000FF',
    timerType: optionalTimerType(body.timerType) || rules.timerType,
    periodDurationSeconds: optionalDuration(body.periodDurationSeconds) || rules.periodDurationSeconds,
  });
}

async function list(query = {}) {
  const where = {};
  if (query.status) {
    if (!STATUSES.includes(query.status)) {
      throw new AppError(`Filtro 'status' deve ser um de: ${STATUSES.join(', ')}.`, 400);
    }
    where.status = query.status;
  }
  if (query.sport) where.sport = requireSport(query.sport);
  if (query.team) where[Op.or] = [
    { teamAName: { [Op.like]: `%${query.team}%` } },
    { teamBName: { [Op.like]: `%${query.team}%` } },
  ];

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("Parâmetros 'page' (>=1) e 'limit' (1 a 100) devem ser inteiros válidos.", 400);
  }

  const { rows, count } = await matchRepository.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
  });
  return { data: rows, meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) } };
}

async function update(userId, id, body = {}) {
  const match = await getOwned(id, userId);
  const data = {};

  if (body.sport !== undefined) {
    requireSport(body.sport);
    if (body.sport !== match.sport) {
      if (match.status !== 'agendado') {
        throw new AppError('A modalidade só pode ser alterada em partidas agendadas.', 409);
      }
      data.sport = body.sport;
    }
  }
  if (body.teamAName !== undefined) data.teamAName = requireString(body.teamAName, 'teamAName');
  if (body.teamBName !== undefined) data.teamBName = requireString(body.teamBName, 'teamBName');
  const shortA = optionalShortName(body.teamAShortName, 'teamAShortName');
  const shortB = optionalShortName(body.teamBShortName, 'teamBShortName');
  if (shortA) data.teamAShortName = shortA;
  if (shortB) data.teamBShortName = shortB;
  const colorA = optionalHexColor(body.teamAColor, 'teamAColor');
  const colorB = optionalHexColor(body.teamBColor, 'teamBColor');
  if (colorA) data.teamAColor = colorA;
  if (colorB) data.teamBColor = colorB;
  const timerType = optionalTimerType(body.timerType);
  if (timerType) data.timerType = timerType;
  const duration = optionalDuration(body.periodDurationSeconds);
  if (duration) data.periodDurationSeconds = duration;

  return matchRepository.update(match, data);
}

async function changeStatus(userId, id, status) {
  const match = await getOwned(id, userId);
  if (!STATUSES.includes(status)) {
    throw new AppError(`Campo 'status' deve ser um de: ${STATUSES.join(', ')}.`, 400);
  }
  if (!STATUS_TRANSITIONS[match.status].includes(status)) {
    throw new AppError(`Transição inválida: '${match.status}' -> '${status}'.`, 409);
  }
  return matchRepository.update(match, { status });
}

async function nextPeriod(userId, id) {
  const match = await getOwned(id, userId);
  const rules = SPORTS[match.sport];

  if (rules.sets) {
    throw new AppError('No vôlei o set avança automaticamente quando um time vence o set.', 400);
  }
  if (match.status !== 'em_andamento') {
    throw new AppError('A partida precisa estar em andamento para avançar o período.', 409);
  }
  if (match.currentPeriod >= rules.totalPeriods) {
    throw new AppError(`A partida já está no último ${rules.periodLabel}.`, 409);
  }
  return matchRepository.update(match, { currentPeriod: match.currentPeriod + 1 });
}

async function remove(userId, id) {
  const match = await getOwned(id, userId);
  await eventRepository.destroyByMatch(match.id);
  await matchRepository.destroy(match);
}

/** Payload pronto para o telão/front-end consumir. */
async function getScoreboard(id) {
  const match = await getById(id);
  const events = await eventRepository.findByMatch(match.id);
  const rules = SPORTS[match.sport];
  const state = computeState(match.sport, events);

  const currentPeriod = rules.sets
    ? Math.min(state.setHistory.length + (state.finished ? 0 : 1), rules.totalPeriods)
    : match.currentPeriod;

  const team = (key) => ({
    name: match[`team${key}Name`],
    shortName: match[`team${key}ShortName`],
    color: match[`team${key}Color`],
    score: state[`score${key}`],
    ...(rules.sets ? { sets: state[`sets${key}`] } : {}),
  });

  return {
    id: match.id,
    sport: match.sport,
    sportLabel: rules.label,
    status: match.status,
    period: { label: rules.periodLabel, current: currentPeriod, total: rules.totalPeriods },
    timer: { type: match.timerType, periodDurationSeconds: match.periodDurationSeconds },
    teams: { A: team('A'), B: team('B') },
    ...(rules.sets ? { setHistory: state.setHistory, winner: state.winner } : {}),
    updatedAt: match.updatedAt,
  };
}

module.exports = {
  create,
  list,
  getById,
  getOwned,
  update,
  changeStatus,
  nextPeriod,
  remove,
  getScoreboard,
};
