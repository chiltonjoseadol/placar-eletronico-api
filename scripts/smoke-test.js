/**
 * Teste de fumaça: sobe a API em um banco temporário e exercita os fluxos principais.
 * Uso: npm run smoke
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `placar-smoke-${Date.now()}.sqlite`);
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = dbFile;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret';

const app = require('../src/app');
const { sequelize } = require('../src/models');

let failures = 0;
function check(label, cond, extra) {
  if (!cond) failures += 1;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${!cond && extra ? ' -> ' + JSON.stringify(extra) : ''}`);
}

(async () => {
  await sequelize.sync({ force: true });
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/api`;

  async function call(method, url, body, token) {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  try {
    let r = await call('POST', '/auth/register', { name: 'Ana', email: 'ana@x.com', password: '123456' });
    check('registro 201', r.status === 201, r);
    const token = r.body.token;
    r = await call('POST', '/auth/register', { name: 'Ana', email: 'ana@x.com', password: '123456' });
    check('e-mail duplicado 409', r.status === 409, r);
    r = await call('POST', '/auth/login', { email: 'ana@x.com', password: 'errada' });
    check('login inválido 401', r.status === 401, r);
    r = await call('POST', '/auth/login', { email: 'ana@x.com', password: '123456' });
    check('login 200', r.status === 200 && !!r.body.token, r);

    r = await call('POST', '/matches', { sport: 'futebol', teamAName: 'A', teamBName: 'B' });
    check('criar partida sem token 401', r.status === 401, r);
    r = await call('POST', '/matches', { sport: 'tenis', teamAName: 'A', teamBName: 'B' }, token);
    check('modalidade inválida 400', r.status === 400, r);
    r = await call('POST', '/matches', { sport: 'futebol', teamAName: 'A', teamBName: 'B', teamAColor: 'vermelho' }, token);
    check('cor inválida 400', r.status === 400, r);

    // Basquete
    r = await call('POST', '/matches', { sport: 'basquete', teamAName: 'Lakers', teamBName: 'Celtics', teamAColor: '#552583' }, token);
    check('criar basquete 201 (timer regressivo)', r.status === 201 && r.body.timerType === 'regressivo', r);
    const bId = r.body.id;
    r = await call('POST', `/matches/${bId}/events`, { team: 'A', type: 'ponto', points: 2 }, token);
    check('evento com partida agendada 409', r.status === 409, r);
    await call('PATCH', `/matches/${bId}/status`, { status: 'em_andamento' }, token);
    await call('POST', `/matches/${bId}/events`, { team: 'A', type: 'ponto', points: 3 }, token);
    await call('POST', `/matches/${bId}/events`, { team: 'A', type: 'ponto', points: 2 }, token);
    r = await call('POST', `/matches/${bId}/events`, { team: 'B', type: 'ponto', points: 1 }, token);
    check('placar basquete 5x1', r.status === 201 && r.body.match.teams.A.score === 5 && r.body.match.teams.B.score === 1, r.body);
    r = await call('POST', `/matches/${bId}/events`, { team: 'B', type: 'ponto', points: 4 }, token);
    check('ponto de 4 inválido 400', r.status === 400, r);
    r = await call('POST', `/matches/${bId}/events`, { team: 'B', type: 'gol' }, token);
    check('gol no basquete 400', r.status === 400, r);
    r = await call('PATCH', `/matches/${bId}/period/next`, null, token);
    check('avança quarto', r.status === 200 && r.body.currentPeriod === 2, r);
    r = await call('GET', `/matches/${bId}/scoreboard`);
    check('scoreboard público com cor e quarto 2', r.status === 200 && r.body.teams.A.color === '#552583' && r.body.period.current === 2, r);

    // Futebol
    r = await call('POST', '/matches', { sport: 'futebol', teamAName: 'Brasil', teamBName: 'Argentina' }, token);
    check('futebol timer progressivo', r.body.timerType === 'progressivo' && r.body.teamAShortName === 'BRA', r);
    const fId = r.body.id;
    await call('PATCH', `/matches/${fId}/status`, { status: 'em_andamento' }, token);
    await call('POST', `/matches/${fId}/events`, { team: 'A', type: 'gol' }, token);
    r = await call('POST', `/matches/${fId}/events`, { team: 'A', type: 'cartao_amarelo', playerName: 'X' }, token);
    check('cartão não altera placar', r.body.match.teams.A.score === 1, r.body);
    const evId = r.body.event.id;
    r = await call('DELETE', `/matches/${fId}/events/${evId}`, null, token);
    check('desfazer evento 200', r.status === 200, r);
    r = await call('PATCH', `/matches/${fId}/status`, { status: 'agendado' }, token);
    check('transição inválida 409', r.status === 409, r);

    // Vôlei de praia: melhor de 3, set de 21, tie-break de 15
    r = await call('POST', '/matches', { sport: 'volei_praia', teamAName: 'Dupla 1', teamBName: 'Dupla 2' }, token);
    const vId = r.body.id;
    await call('PATCH', `/matches/${vId}/status`, { status: 'em_andamento' }, token);
    const win = async (team, n) => { let last; for (let i = 0; i < n; i++) last = await call('POST', `/matches/${vId}/events`, { team, type: 'ponto' }, token); return last; };
    r = await win('A', 21);
    check('set 1 para A (sets 1x0, placar zerado, set 2)', r.body.match.teams.A.sets === 1 && r.body.match.teams.A.score === 0 && r.body.match.period.current === 2, r.body);
    r = await win('B', 21);
    check('set 2 para B (1x1, set 3)', r.body.match.teams.B.sets === 1 && r.body.match.period.current === 3, r.body);
    r = await win('A', 14);
    check('tie-break 14x0 ainda aberto', r.body.match.status === 'em_andamento', r.body);
    r = await win('A', 1);
    check('tie-break 15 encerra partida (2x1, finalizado)', r.body.match.status === 'finalizado' && r.body.match.teams.A.sets === 2 && r.body.match.winner === 'A', r.body);
    r = await call('POST', `/matches/${vId}/events`, { team: 'A', type: 'ponto' }, token);
    check('evento após fim 409', r.status === 409, r);

    // Autorização por dono
    const other = await call('POST', '/auth/register', { name: 'Beto', email: 'beto@x.com', password: '123456' });
    r = await call('DELETE', `/matches/${bId}`, null, other.body.token);
    check('outro usuário não exclui 403', r.status === 403, r);
    r = await call('DELETE', `/matches/${bId}`, null, token);
    check('dono exclui 204', r.status === 204, r);
    r = await call('GET', `/matches/${bId}`);
    check('partida excluída 404', r.status === 404, r);
    r = await call('GET', '/matches?limit=1&page=2');
    check('paginação', r.status === 200 && r.body.data.length === 1 && r.body.meta.total === 2, r.body.meta);
    r = await call('GET', '/matches/abc');
    check('id inválido 400', r.status === 400, r);

    const docs = await fetch(base.replace('/api', '/apidocs/'));
    check('swagger /apidocs acessível', docs.status === 200);
  } catch (e) {
    failures += 1;
    console.error(e);
  } finally {
    server.close();
    await sequelize.close();
    fs.rmSync(dbFile, { force: true });
    console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes passaram');
    process.exit(failures ? 1 : 0);
  }
})();
