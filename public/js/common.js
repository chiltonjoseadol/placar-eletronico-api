const API = '/api';

const session = {
  get token() { return localStorage.getItem('placar_token'); },
  set token(v) { v ? localStorage.setItem('placar_token', v) : localStorage.removeItem('placar_token'); },
};

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Escolhe texto preto ou branco conforme a cor de fundo. */
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#111111' : '#ffffff';
}

/** Segundos a exibir no cronômetro, com base no payload do scoreboard. */
function timerSeconds(timer, fetchedAt) {
  const elapsed = timer.elapsedSeconds + (timer.running ? (Date.now() - fetchedAt) / 1000 : 0);
  if (timer.type === 'regressivo' && timer.periodDurationSeconds) {
    return Math.max(0, timer.periodDurationSeconds - elapsed);
  }
  return elapsed;
}

const STATUS_LABEL = { agendado: 'Agendado', em_andamento: 'Em andamento', finalizado: 'Finalizado' };
const SPORT_LABEL = { futebol: 'Futebol', basquete: 'Basquete', volei_quadra: 'Vôlei de quadra', volei_praia: 'Vôlei de praia' };
