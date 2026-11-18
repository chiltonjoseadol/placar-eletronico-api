const $ = (id) => document.getElementById(id);

const EVENT_BUTTONS = {
  futebol: [
    { type: 'gol', label: '⚽ Gol', cls: 'primary' },
    { type: 'falta', label: 'Falta' },
    { type: 'cartao_amarelo', label: '🟨 Amarelo', cls: 'warn' },
    { type: 'cartao_vermelho', label: '🟥 Vermelho', cls: 'danger' },
  ],
  basquete: [
    { type: 'ponto', points: 1, label: '+1', cls: 'primary' },
    { type: 'ponto', points: 2, label: '+2', cls: 'primary' },
    { type: 'ponto', points: 3, label: '+3', cls: 'primary' },
    { type: 'falta', label: 'Falta' },
    { type: 'tempo_tecnico', label: 'Tempo técnico', cls: 'info' },
  ],
  volei: [
    { type: 'ponto', label: '🏐 Ponto', cls: 'primary' },
    { type: 'tempo_tecnico', label: 'Tempo técnico', cls: 'info' },
    { type: 'cartao_amarelo', label: '🟨 Amarelo', cls: 'warn' },
    { type: 'cartao_vermelho', label: '🟥 Vermelho', cls: 'danger' },
  ],
};
const EVENT_LABEL = { gol: 'Gol', ponto: 'Ponto', falta: 'Falta', cartao_amarelo: 'Cartão amarelo', cartao_vermelho: 'Cartão vermelho', tempo_tecnico: 'Tempo técnico' };

let me = null;
let mode = 'login';
let current = null; // { match, board, fetchedAt }
let pollHandle = null;
let tickHandle = null;

/* ---------- Utilidades de UI ---------- */
function toast(msg, ok = false) {
  const t = el('div', { class: `toast${ok ? ' ok' : ''}` }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e.status === 401 && me) { logout(); toast('Sessão expirada. Entre novamente.'); return; }
    toast(e.message);
  }
}

function show(view) {
  for (const id of ['authView', 'listView', 'controlView']) $(id).classList.toggle('hidden', id !== view);
  $('userbox').classList.toggle('hidden', view === 'authView');
}

/* ---------- Autenticação ---------- */
function setMode(m) {
  mode = m;
  $('tabLogin').classList.toggle('active', m === 'login');
  $('tabRegister').classList.toggle('active', m === 'register');
  $('nameField').classList.toggle('hidden', m === 'login');
  $('authSubmit').textContent = m === 'login' ? 'Entrar' : 'Cadastrar';
}
$('tabLogin').onclick = () => setMode('login');
$('tabRegister').onclick = () => setMode('register');

$('authForm').onsubmit = (ev) => {
  ev.preventDefault();
  guard(async () => {
    const body = { email: $('authEmail').value, password: $('authPass').value };
    if (mode === 'register') body.name = $('authName').value;
    const res = await api('POST', `/auth/${mode}`, body);
    session.token = res.token;
    me = res.user;
    await enterApp();
  });
};

function logout() {
  session.token = null;
  me = null;
  stopControl();
  show('authView');
}
$('logout').onclick = logout;

async function enterApp() {
  $('username').textContent = me.name;
  const params = new URLSearchParams(location.search);
  if (params.get('match')) await openControl(Number(params.get('match')));
  else await showList();
}

/* ---------- Lista e criação ---------- */
async function showList() {
  stopControl();
  history.replaceState(null, '', '/');
  show('listView');
  const { data } = await api('GET', '/matches?limit=50');
  const body = $('matchRows');
  body.replaceChildren();
  $('emptyMsg').classList.toggle('hidden', data.length > 0);
  for (const m of data) {
    const mine = m.userId === me.id;
    body.append(
      el('tr', {},
        el('td', {}, m.id),
        el('td', {}, SPORT_LABEL[m.sport]),
        el('td', {},
          el('span', { class: 'dot', style: { background: m.teamAColor } }), m.teamAName, ' x ',
          el('span', { class: 'dot', style: { background: m.teamBColor } }), m.teamBName),
        el('td', {}, m.sport.startsWith('volei') ? `${m.scoreA} x ${m.scoreB} (sets ${m.setsA} x ${m.setsB})` : `${m.scoreA} x ${m.scoreB}`),
        el('td', {}, el('span', { class: `badge ${m.status}` }, STATUS_LABEL[m.status])),
        el('td', { class: 'row' },
          el('button', { class: 'info small', onclick: () => guard(() => openControl(m.id)) }, mine ? 'Controlar' : 'Ver'),
          el('a', { href: `/placar.html?id=${m.id}`, target: '_blank' }, 'Telão'),
          mine ? el('button', { class: 'danger small', onclick: () => deleteMatch(m) }, 'Excluir') : null)
      )
    );
  }
}

function deleteMatch(m) {
  if (!confirm(`Excluir a partida #${m.id} (${m.teamAName} x ${m.teamBName})?`)) return;
  guard(async () => { await api('DELETE', `/matches/${m.id}`); toast('Partida excluída.', true); await showList(); });
}

$('createForm').onsubmit = (ev) => {
  ev.preventDefault();
  guard(async () => {
    const body = {
      sport: $('cSport').value,
      teamAName: $('cNameA').value,
      teamBName: $('cNameB').value,
      teamAColor: $('cColorA').value,
      teamBColor: $('cColorB').value,
    };
    if ($('cShortA').value) body.teamAShortName = $('cShortA').value;
    if ($('cShortB').value) body.teamBShortName = $('cShortB').value;
    if ($('cTimer').value) body.timerType = $('cTimer').value;
    if ($('cDuration').value) body.periodDurationSeconds = Number($('cDuration').value) * 60;
    const match = await api('POST', '/matches', body);
    toast('Partida criada!', true);
    ev.target.reset();
    await openControl(match.id);
  });
};

/* ---------- Controle da partida ---------- */
function stopControl() {
  clearInterval(pollHandle);
  clearInterval(tickHandle);
  pollHandle = tickHandle = null;
  current = null;
}

async function openControl(id) {
  stopControl();
  const match = await api('GET', `/matches/${id}`);
  current = { match, board: null, fetchedAt: 0, built: false };
  history.replaceState(null, '', `/?match=${id}`);
  show('controlView');
  $('tvLink').href = `/placar.html?id=${id}`;
  const mine = match.userId === me.id;
  $('ownerMsg').classList.toggle('hidden', mine);
  $('matchControls').classList.toggle('hidden', !mine);
  $('eventPanel').classList.toggle('hidden', !mine);
  $('undoBtn').classList.toggle('hidden', !mine);
  await refresh();
  pollHandle = setInterval(() => refresh().catch(() => {}), 1500);
  tickHandle = setInterval(tick, 250);
}
$('backBtn').onclick = () => guard(showList);

async function refresh() {
  if (!current) return;
  const id = current.match.id;
  const [board, events] = await Promise.all([api('GET', `/matches/${id}/scoreboard`), api('GET', `/matches/${id}/events`)]);
  if (!current || current.match.id !== id) return;
  current.board = board;
  current.fetchedAt = Date.now();
  current.events = events;
  renderControl();
}

function renderControl() {
  const b = current.board;
  const isVolei = b.sport.startsWith('volei');

  $('ctlStatus').textContent = STATUS_LABEL[b.status];
  $('ctlStatus').className = `badge ${b.status}`;

  for (const k of ['A', 'B']) {
    const t = b.teams[k];
    const box = $(`pv${k}`);
    box.style.background = t.color;
    box.style.color = textOn(t.color);
    box.querySelector('.pshort').textContent = t.shortName;
    box.querySelector('.pscore').textContent = t.score;
    box.querySelector('.psets').textContent = t.sets !== undefined ? `Sets: ${t.sets}` : t.name;
  }
  $('pvPeriod').textContent = `${b.period.current}º ${b.period.label} de ${b.period.total}`;
  $('pvTimer').classList.toggle('hidden', b.timer.type === 'nenhum');
  tick();

  if (current.match.userId !== me.id) { renderLog(); return; }

  renderFlow(b, isVolei);
  const active = b.status === 'em_andamento';
  const sig = `${b.sport}|${b.teams.A.shortName}|${b.teams.B.shortName}`;
  if (current.built !== sig) { buildEventButtons(b); current.built = sig; }
  document.querySelectorAll('#eventPanel .teamctl button').forEach((btn) => (btn.disabled = !active));
  $('undoBtn').disabled = !current.events.length;
  renderLog();
}

function tick() {
  if (!current || !current.board || current.board.timer.type === 'nenhum') return;
  $('pvTimer').textContent = fmtTime(timerSeconds(current.board.timer, current.fetchedAt));
}

function renderFlow(b, isVolei) {
  // Só redesenha quando algo mudou, para não trocar o botão debaixo do clique.
  const sig = `${b.status}|${b.timer.running}|${b.period.current}`;
  if (current.flowSig === sig) return;
  current.flowSig = sig;
  const box = $('flowBtns');
  const id = current.match.id;
  const act = (fn, msg) => () => guard(async () => { await fn(); if (msg) toast(msg, true); await refresh(); });
  const btn = (label, cls, fn, disabled = false) => el('button', { class: cls, onclick: fn, ...(disabled ? { disabled: '' } : {}) }, label);

  const items = [];
  if (b.status === 'agendado') {
    items.push(btn('▶ Iniciar partida', 'primary', act(() => api('PATCH', `/matches/${id}/status`, { status: 'em_andamento' }), 'Partida iniciada.')));
  }
  if (b.status === 'em_andamento') {
    if (b.timer.type !== 'nenhum') {
      items.push(
        b.timer.running
          ? btn('⏸ Pausar cronômetro', 'warn', act(() => api('PATCH', `/matches/${id}/timer`, { action: 'pause' })))
          : btn('⏱ Iniciar cronômetro', 'info', act(() => api('PATCH', `/matches/${id}/timer`, { action: 'start' }))),
        btn('↺ Zerar cronômetro', '', act(() => api('PATCH', `/matches/${id}/timer`, { action: 'reset' })))
      );
    }
    if (!isVolei) {
      items.push(btn(`Próximo ${b.period.label} →`, 'info', act(() => api('PATCH', `/matches/${id}/period/next`), 'Período avançado.'), b.period.current >= b.period.total));
    }
    items.push(btn('■ Finalizar partida', 'danger', () => {
      if (confirm('Finalizar a partida? Não será possível reabri-la.')) act(() => api('PATCH', `/matches/${id}/status`, { status: 'finalizado' }), 'Partida finalizada.')();
    }));
  }
  if (b.status === 'finalizado') items.push(el('span', { class: 'muted' }, 'Partida finalizada.'));
  box.replaceChildren(...items);
}

function buildEventButtons(b) {
  const defs = EVENT_BUTTONS[b.sport.startsWith('volei') ? 'volei' : b.sport];
  for (const k of ['A', 'B']) {
    const t = b.teams[k];
    const box = $(`ctl${k}`);
    box.replaceChildren(
      el('h3', {}, el('span', { class: 'dot', style: { background: t.color } }), `${t.name} (${t.shortName})`),
      el('div', { class: 'btns' },
        defs.map((d) =>
          el('button', { class: d.cls || '', onclick: () => sendEvent(k, d) }, d.label)))
    );
  }
}

function sendEvent(team, def) {
  guard(async () => {
    const b = current.board;
    const body = { team, type: def.type };
    if (def.points) body.points = def.points;
    const player = $('playerName').value.trim();
    if (player) body.playerName = player;
    if (b.timer.type !== 'nenhum') body.clock = fmtTime(b.timer.type === 'regressivo'
      ? (b.timer.periodDurationSeconds || 0) - timerSeconds(b.timer, current.fetchedAt)
      : timerSeconds(b.timer, current.fetchedAt));
    await api('POST', `/matches/${current.match.id}/events`, body);
    await refresh();
  });
}

$('undoBtn').onclick = () => guard(async () => {
  const last = current.events[current.events.length - 1];
  if (!last) return;
  await api('DELETE', `/matches/${current.match.id}/events/${last.id}`);
  toast('Último evento desfeito.', true);
  await refresh();
});

function renderLog() {
  const b = current.board;
  const rows = [...current.events].reverse().slice(0, 30).map((e) => {
    const team = b.teams[e.team];
    return el('div', {},
      el('span', { class: 'dot', style: { background: team.color } }),
      `${team.shortName} • ${EVENT_LABEL[e.type] || e.type}`,
      e.points ? ` (+${e.points})` : '',
      e.playerName ? ` • ${e.playerName}` : '',
      el('span', { class: 'muted' }, `  ${b.period.label} ${e.period}${e.clock ? ' • ' + e.clock : ''}`));
  });
  $('eventLog').replaceChildren(...(rows.length ? rows : [el('span', { class: 'muted' }, 'Nenhum evento registrado.')]));
}

/* ---------- Início ---------- */
(async function init() {
  if (!session.token) return show('authView');
  try {
    me = await api('GET', '/auth/me');
    await enterApp();
  } catch (e) {
    session.token = null;
    show('authView');
  }
})();
