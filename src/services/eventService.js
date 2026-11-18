const matchRepository = require('../repositories/matchRepository');
const eventRepository = require('../repositories/eventRepository');
const matchService = require('./matchService');
const AppError = require('../utils/AppError');
const { SPORTS } = require('../utils/sportRules');
const { computeState } = require('../utils/scoreCalculator');
const { parseId } = require('../utils/validators');

function resolvePoints(sport, type, points) {
  const allowed = SPORTS[sport].events[type];
  if (!allowed) {
    throw new AppError(
      `Evento '${type}' não existe para ${SPORTS[sport].label}. Permitidos: ${Object.keys(SPORTS[sport].events).join(', ')}.`,
      400
    );
  }
  if (points === undefined || points === null) {
    if (allowed.length === 1) return allowed[0];
    throw new AppError(`Informe 'points' para o evento '${type}' (valores: ${allowed.join(', ')}).`, 400);
  }
  if (!allowed.includes(points)) {
    throw new AppError(`'points' inválido para '${type}'. Valores permitidos: ${allowed.join(', ')}.`, 400);
  }
  return points;
}

/** Recalcula o placar a partir dos eventos e grava o estado derivado na partida. */
async function syncMatch(match) {
  const events = await eventRepository.findByMatch(match.id);
  const rules = SPORTS[match.sport];
  const state = computeState(match.sport, events);

  const data = {
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    setsA: state.setsA,
    setsB: state.setsB,
  };
  if (rules.sets) {
    data.currentPeriod = Math.min(state.setHistory.length + (state.finished ? 0 : 1), rules.totalPeriods);
  }
  if (state.finished) data.status = 'finalizado';

  await matchRepository.update(match, data);
  return state;
}

async function create(userId, matchId, body = {}) {
  const match = await matchService.getOwned(matchId, userId);

  if (match.status !== 'em_andamento') {
    throw new AppError('Eventos só podem ser registrados em partidas em andamento.', 409);
  }
  if (!['A', 'B'].includes(body.team)) {
    throw new AppError("Campo 'team' deve ser 'A' ou 'B'.", 400);
  }
  if (typeof body.type !== 'string') {
    throw new AppError("Campo 'type' é obrigatório.", 400);
  }
  if (body.playerName !== undefined && (typeof body.playerName !== 'string' || body.playerName.length > 100)) {
    throw new AppError("Campo 'playerName' deve ser texto de até 100 caracteres.", 400);
  }
  if (body.clock !== undefined && (typeof body.clock !== 'string' || !/^\d{1,3}:\d{2}$/.test(body.clock))) {
    throw new AppError("Campo 'clock' deve estar no formato mm:ss.", 400);
  }

  const points = resolvePoints(match.sport, body.type, body.points);

  const event = await eventRepository.create({
    matchId: match.id,
    team: body.team,
    type: body.type,
    points,
    period: match.currentPeriod,
    playerName: body.playerName,
    clock: body.clock,
  });

  await syncMatch(match);
  return { event, match: await matchService.getScoreboard(match.id) };
}

async function list(matchId) {
  const match = await matchService.getById(matchId);
  return eventRepository.findByMatch(match.id);
}

async function remove(userId, matchId, eventId) {
  const match = await matchService.getOwned(matchId, userId);
  const event = await eventRepository.findById(parseId(eventId, 'eventId'), match.id);
  if (!event) throw new AppError('Evento não encontrado.', 404);

  if (SPORTS[match.sport].sets) {
    const last = await eventRepository.findLastByMatch(match.id);
    if (last.id !== event.id) {
      throw new AppError('No vôlei só é possível desfazer o último evento da partida.', 409);
    }
  }

  await eventRepository.destroy(event);

  // No vôlei, desfazer o ponto que encerrou a partida (finalização automática) a reabre.
  if (match.status === 'finalizado' && SPORTS[match.sport].sets) {
    await matchRepository.update(match, { status: 'em_andamento' });
  }
  await syncMatch(match);
  return matchService.getScoreboard(match.id);
}

module.exports = { create, list, remove };
