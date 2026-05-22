const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// ── Global Room ───────────────────────────────────────────────────────────
// There is ONE global room. Everyone joins it automatically.
// The first player becomes host. If host leaves, next player takes over.

const ROOM_ID = 'global';
const MW = 2600, MH = 2200;
const CENTER = { x: Math.round(MW / 2), y: Math.round(MH / 2) };

const room = {
  id: ROOM_ID,
  hostId: null,
  players: {},   // socketId -> player object
  state: 'playing', // always playing
};

const playerSockets = {}; // socketId -> playerName

function getHostId() {
  return room.hostId;
}

function reassignHost() {
  const ids = Object.keys(room.players);
  if (ids.length === 0) { room.hostId = null; return; }
  room.hostId = ids[0];
  room.players[room.hostId].isHost = true;
  console.log(`🔄 New host: ${room.players[room.hostId].name}`);
}

io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  // ── Join Global Room ─────────────────────────────────────────────────────
  socket.on('joinGlobalRoom', ({ playerName }) => {
    const name = (playerName || 'Sobreviviente').slice(0, 20);

    // Already in room? clean up old entry
    if (room.players[socket.id]) {
      delete room.players[socket.id];
    }

    const isFirstPlayer = Object.keys(room.players).length === 0;
    const isHost = isFirstPlayer;
    if (isHost) room.hostId = socket.id;

    playerSockets[socket.id] = name;
    socket.join(ROOM_ID);

    room.players[socket.id] = {
      id: socket.id,
      name,
      isHost,
      alive: true,
      hp: 120,
      maxHp: 120,
      kills: 0,
      x: CENTER.x,
      y: CENTER.y,
    };

    const spawnMap = {};
    Object.keys(room.players).forEach(id => {
      spawnMap[id] = { x: CENTER.x, y: CENTER.y };
    });

    // Tell the joining player everything they need
    socket.emit('globalRoomJoined', {
      serverId: ROOM_ID,
      isHost,
      players: Object.values(room.players),
      spawnMap,
    });

    // Tell everyone else a new player joined
    socket.to(ROOM_ID).emit('playerJoined', {
      player: room.players[socket.id],
      players: Object.values(room.players),
    });

    // Tell everyone online count
    io.to(ROOM_ID).emit('waitingForPlayers', {
      count: Object.keys(room.players).length,
    });

    console.log(`👤 ${name} joined (${Object.keys(room.players).length} players, host=${isHost})`);
  });

  // ── Player State Sync ────────────────────────────────────────────────────
  socket.on('playerState', (data) => {
    if (!room.players[socket.id]) return;
    Object.assign(room.players[socket.id], {
      x: data.x, y: data.y, angle: data.angle,
      hp: data.hp, maxHp: data.maxHp,
      kills: data.kills || 0,
      alive: data.alive !== false,
      weapon: data.weapon,
      name: data.name || room.players[socket.id].name,
    });
    socket.to(ROOM_ID).emit('remotePlayerState', {
      id: socket.id,
      name: data.name || room.players[socket.id].name,
      ...data,
    });
  });

  // ── Bullet Fired ─────────────────────────────────────────────────────────
  socket.on('bulletFired', (data) => {
    socket.to(ROOM_ID).emit('remoteBullet', { ...data, ownerId: socket.id });
  });

  // ── Zombie Sync (host → clients) ─────────────────────────────────────────
  socket.on('zombieSync', (data) => {
    if (socket.id !== room.hostId) return;
    socket.to(ROOM_ID).emit('zombieSync', data);
  });

  // ── Client zombie hit report ──────────────────────────────────────────────
  socket.on('clientZombieHit', (data) => {
    if (room.hostId && room.hostId !== socket.id) {
      io.to(room.hostId).emit('clientZombieHit', { ...data, fromId: socket.id });
    }
  });

  // ── Damage Player ─────────────────────────────────────────────────────────
  socket.on('damagePlayer', ({ targetId, dmg }) => {
    io.to(targetId).emit('damagePlayer', { targetId, dmg });
  });

  // ── Round Update ──────────────────────────────────────────────────────────
  socket.on('roundUpdate', ({ round }) => {
    if (socket.id !== room.hostId) return;
    socket.to(ROOM_ID).emit('roundSync', { round });
  });

  // ── Player Died ───────────────────────────────────────────────────────────
  socket.on('playerDied', () => {
    if (!room.players[socket.id]) return;
    room.players[socket.id].alive = false;
    io.to(ROOM_ID).emit('remotePlayerDied', { id: socket.id });
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on('chatMessage', ({ message }) => {
    if (!room.players[socket.id]) return;
    const msg = {
      from: room.players[socket.id].name,
      text: message.slice(0, 200),
      time: Date.now(),
    };
    io.to(ROOM_ID).emit('chatMessage', msg);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    const name = playerSockets[socket.id] || '?';
    delete room.players[socket.id];
    delete playerSockets[socket.id];

    const remaining = Object.keys(room.players).length;

    if (remaining === 0) {
      room.hostId = null;
      console.log('🏚 Room empty');
    } else if (room.hostId === socket.id) {
      reassignHost();
      io.to(ROOM_ID).emit('hostTransferred', {
        newHostId: room.hostId,
        players: Object.values(room.players),
      });
    } else {
      io.to(ROOM_ID).emit('playerLeft', {
        id: socket.id,
        players: Object.values(room.players),
      });
    }

    io.to(ROOM_ID).emit('waitingForPlayers', { count: remaining });
    console.log(`🚪 ${name} left (${remaining} remaining)`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🧟 ZOMBIE WAR SERVER running on http://localhost:${PORT}\n`);
});
