// ── Socket.io ──────────────────────────────────────────────────────────────
const socket = io();

let myName = '';
let isHost = false;
let currentServerId = null;
let dotTimer = null;

// Panels
const panels = {
  main:   document.getElementById('mainMenu'),
  bot:    document.getElementById('botMenu'),
  online: document.getElementById('onlineMenu'),
};

function showPanel(name) {
  Object.values(panels).forEach(p => p.classList.add('hidden'));
  panels[name].classList.remove('hidden');
}

window.showMain      = () => { stopWaiting(); showPanel('main'); };
window.showBotMenu   = () => showPanel('bot');
window.showOnlineMenu = () => {
  showPanel('online');
  document.getElementById('waitingMsg').style.display = 'none';
  document.getElementById('btnJoinGlobal').disabled = false;
  document.getElementById('btnJoinGlobal').textContent = '▶ ENTRAR AL CAMPO';
  setTimeout(() => document.getElementById('onlinePlayerName').focus(), 100);
};

// ── Blood Drips ────────────────────────────────────────────────────────────
(function initDrips() {
  const container = document.getElementById('bloodDrips');
  for (let i = 0; i < 18; i++) {
    const d = document.createElement('div');
    d.className = 'drip';
    d.style.left = (Math.random() * 100) + 'vw';
    const len = 30 + Math.random() * 90;
    d.style.setProperty('--len', len + 'px');
    d.style.width = (2 + Math.random() * 4) + 'px';
    d.style.animationDuration = (1.5 + Math.random() * 3) + 's';
    d.style.animationDelay = (Math.random() * 4) + 's';
    container.appendChild(d);
  }
})();

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ── Bot Game ───────────────────────────────────────────────────────────────
window.startBotGame = function() {
  const name = document.getElementById('botPlayerName').value.trim() || 'Sobreviviente';
  sessionStorage.setItem('playerName', name);
  sessionStorage.setItem('gameMode', 'bots');
  window.location.href = '/game.html';
};

// ── Online: join global room ───────────────────────────────────────────────
window.joinGlobal = function() {
  const name = document.getElementById('onlinePlayerName').value.trim() || 'Sobreviviente';
  myName = name;

  document.getElementById('btnJoinGlobal').disabled = true;
  document.getElementById('btnJoinGlobal').textContent = '⏳ Entrando...';
  document.getElementById('waitingMsg').style.display = 'block';

  // Animate dots
  let dots = 0;
  dotTimer = setInterval(() => {
    dots = (dots + 1) % 4;
    document.getElementById('waitingDots').textContent = '⏳ Conectando' + '.'.repeat(dots);
  }, 400);

  socket.emit('joinGlobalRoom', { playerName: name });
};

function stopWaiting() {
  clearInterval(dotTimer);
}

// ── Socket Events ──────────────────────────────────────────────────────────
socket.on('globalRoomJoined', ({ serverId, isHost: host, players, spawnMap }) => {
  stopWaiting();
  isHost = host;
  currentServerId = serverId;

  sessionStorage.setItem('playerName', myName);
  sessionStorage.setItem('gameMode', 'online');
  sessionStorage.setItem('serverId', serverId);
  sessionStorage.setItem('isHost', host ? '1' : '0');
  sessionStorage.setItem('socketId', socket.id);
  sessionStorage.setItem('spawnMap', JSON.stringify(spawnMap || {}));

  window.location.href = '/game.html';
});

socket.on('waitingForPlayers', ({ count }) => {
  const el = document.getElementById('playersOnline');
  if (el) el.textContent = count + ' jugador' + (count !== 1 ? 'es' : '') + ' en el campo';
});

socket.on('joinError', (msg) => {
  stopWaiting();
  document.getElementById('btnJoinGlobal').disabled = false;
  document.getElementById('btnJoinGlobal').textContent = '▶ ENTRAR AL CAMPO';
  showToast(msg, true);
});
