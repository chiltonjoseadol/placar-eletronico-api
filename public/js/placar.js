const matchId = new URLSearchParams(location.search).get('id');
const root = document.getElementById('root');
let data = null;
let fetchedAt = 0;
let refs = null;

async function showPicker() {
  document.getElementById('sport').textContent = 'Telão - escolha uma partida';
  const { data: matches } = await api('GET', '/matches?limit=50');
  root.append(
    el('div', { class: 'tvpick' },
      el('h2', {}, 'Partidas'),
      matches.length
        ? matches.map((m) =>
            el('a', { href: `/placar.html?id=${m.id}` }, `#${m.id}  ${m.teamAName} x ${m.teamBName}  (${SPORT_LABEL[m.sport]}, ${STATUS_LABEL[m.status]})`))
        : el('p', { class: 'muted' }, 'Nenhuma partida criada ainda. Crie uma no painel de controle.'),
      el('p', {}, el('a', { href: '/' }, '← Painel de controle'))
    )
  );
}

function buildLayout() {
  const team = (key) => {
    const r = {
      box: el('section', { class: 'tvteam' }),
      short: el('div', { class: 'tshort' }),
      name: el('div', { class: 'tname' }),
      score: el('div', { class: 'tscore' }),
      sets: el('div', { class: 'tsets' }),
    };
    r.box.append(r.short, r.name, r.score, r.sets);
    return r;
  };
  refs = {
    A: team('A'),
    B: team('B'),
    center: el('section', { class: 'tvcenter' }),
    period: el('div', { class: 'tperiod' }),
    timer: el('div', { class: 'ttimer' }),
    history: el('div', { class: 'thistory' }),
    winner: el('div', { class: 'twinner' }),
  };
  refs.center.append(refs.period, refs.timer, refs.history, refs.winner);
  root.append(el('main', { class: 'tvmain', style: { flex: '1' } }, refs.A.box, refs.center, refs.B.box));
}

function render() {
  if (!refs) buildLayout();
  document.getElementById('sport').textContent = `${data.sportLabel}  •  Partida #${data.id}`;
  const st = document.getElementById('status');
  st.textContent = STATUS_LABEL[data.status];
  st.className = `badge ${data.status}`;

  for (const key of ['A', 'B']) {
    const t = data.teams[key];
    const r = refs[key];
    r.box.style.background = t.color;
    r.box.style.color = textOn(t.color);
    r.short.textContent = t.shortName;
    r.name.textContent = t.name;
    r.score.textContent = t.score;
    r.sets.textContent = t.sets !== undefined ? `SETS: ${t.sets}` : '';
  }

  refs.period.textContent = `${data.period.current}º ${data.period.label}`;
  refs.timer.classList.toggle('hidden', data.timer.type === 'nenhum');
  refs.history.replaceChildren(
    ...(data.setHistory || []).map((s) => el('div', {}, `Set ${s.set}: ${s.A} x ${s.B}`))
  );
  refs.winner.textContent = data.winner ? `Vencedor: ${data.teams[data.winner].name}` : '';
  tick();
}

function tick() {
  if (!data || !refs || data.timer.type === 'nenhum') return;
  refs.timer.textContent = fmtTime(timerSeconds(data.timer, fetchedAt));
  refs.timer.classList.toggle('paused', !data.timer.running);
}

async function load() {
  try {
    data = await api('GET', `/matches/${matchId}/scoreboard`);
    fetchedAt = Date.now();
    render();
  } catch (e) {
    document.getElementById('sport').textContent = e.message;
  }
}

if (!matchId) {
  showPicker();
} else {
  load();
  setInterval(load, 1000);
  setInterval(tick, 200);
}
