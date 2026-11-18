const { SPORTS } = require('./sportRules');

/**
 * Calcula o placar a partir da lista de eventos (fonte única da verdade).
 *
 * - Futebol/Basquete: soma dos pontos de cada time.
 * - Vôlei: pontos do set corrente; ao atingir a pontuação do set com
 *   diferença mínima de 2, o set é computado e o placar do set zera.
 *   A partida termina quando um time atinge o número de sets necessários.
 */
function computeState(sportKey, events) {
  const rules = SPORTS[sportKey];
  const scoring = events
    .filter((e) => e.points > 0)
    .sort((x, y) => x.id - y.id);

  if (!rules.sets) {
    let scoreA = 0;
    let scoreB = 0;
    for (const e of scoring) {
      if (e.team === 'A') scoreA += e.points;
      else scoreB += e.points;
    }
    return { scoreA, scoreB, setsA: 0, setsB: 0, setHistory: [], finished: false, winner: null };
  }

  const { maxSets, setsToWin, setPoints, tiebreakPoints } = rules.sets;
  let a = 0;
  let b = 0;
  let setsA = 0;
  let setsB = 0;
  const setHistory = [];
  let finished = false;

  for (const e of scoring) {
    if (e.team === 'A') a += e.points;
    else b += e.points;

    const setNumber = setHistory.length + 1;
    const target = setNumber === maxSets ? tiebreakPoints : setPoints;

    if ((a >= target || b >= target) && Math.abs(a - b) >= 2) {
      setHistory.push({ set: setNumber, A: a, B: b });
      if (a > b) setsA += 1;
      else setsB += 1;

      if (setsA === setsToWin || setsB === setsToWin) {
        finished = true;
        break;
      }
      a = 0;
      b = 0;
    }
  }

  let winner = null;
  if (finished) winner = setsA > setsB ? 'A' : 'B';

  return { scoreA: a, scoreB: b, setsA, setsB, setHistory, finished, winner };
}

module.exports = { computeState };
