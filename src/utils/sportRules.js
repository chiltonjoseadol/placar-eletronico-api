/**
 * Regras de cada modalidade. Centraliza tudo o que muda entre esportes,
 * assim o restante do código não precisa de if/else por modalidade.
 *
 * events: tipo de evento -> pontos permitidos (o primeiro é o padrão quando
 * só existe uma opção; quando há várias, o cliente precisa informar).
 */
const SPORTS = {
  futebol: {
    label: 'Futebol',
    periodLabel: 'tempo',
    totalPeriods: 2,
    timerType: 'progressivo',
    periodDurationSeconds: 2700,
    events: {
      gol: [1],
      falta: [0],
      cartao_amarelo: [0],
      cartao_vermelho: [0],
    },
  },
  basquete: {
    label: 'Basquete',
    periodLabel: 'quarto',
    totalPeriods: 4,
    timerType: 'regressivo',
    periodDurationSeconds: 600,
    events: {
      ponto: [1, 2, 3],
      falta: [0],
      tempo_tecnico: [0],
    },
  },
  volei_quadra: {
    label: 'Vôlei de quadra',
    periodLabel: 'set',
    totalPeriods: 5,
    timerType: 'nenhum',
    periodDurationSeconds: null,
    sets: { maxSets: 5, setsToWin: 3, setPoints: 25, tiebreakPoints: 15 },
    events: {
      ponto: [1],
      tempo_tecnico: [0],
      cartao_amarelo: [0],
      cartao_vermelho: [0],
    },
  },
  volei_praia: {
    label: 'Vôlei de praia',
    periodLabel: 'set',
    totalPeriods: 3,
    timerType: 'nenhum',
    periodDurationSeconds: null,
    sets: { maxSets: 3, setsToWin: 2, setPoints: 21, tiebreakPoints: 15 },
    events: {
      ponto: [1],
      tempo_tecnico: [0],
      cartao_amarelo: [0],
      cartao_vermelho: [0],
    },
  },
};

const STATUSES = ['agendado', 'em_andamento', 'finalizado'];
const TIMER_TYPES = ['progressivo', 'regressivo', 'nenhum'];

module.exports = { SPORTS, STATUSES, TIMER_TYPES };
