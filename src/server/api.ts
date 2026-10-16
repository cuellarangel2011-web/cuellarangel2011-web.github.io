import express from 'express';
import { GoogleGenAI } from '@google/genai';
import type { DiceRollResult, PartyMemberLive, PresenceStatus, LiveCombatantMini } from '../types/dnd.ts';
import { dataStore } from './dataStore.ts';

export const apiRouter = express.Router();

// Memory store for multiplayer sessions / rooms
interface RoomState {
  roomCode: string;
  createdAt: number;
  lastUpdated: number;
  party: Record<string, PartyMemberLive>;
  dmConnected?: boolean;
  dmLastPing?: number;
  dmLiveMessage?: string;
  dmPresenceStatus?: PresenceStatus;
  dmIdleSeconds?: number;
  dmLastRoll?: DiceRollResult;
  rollFeed: DiceRollResult[];
  dmAnnouncements: {
    id: string;
    title: string;
    content: string;
    timestamp: number;
  }[];
  currentQuest?: string;
  quickNotification?: string;
  showCombatantsOnTable?: boolean;
  liveCombatants?: LiveCombatantMini[];
}

const rooms: Record<string, RoomState> = {};

function getOrCreateRoom(code: string): RoomState {
  const normCode = code.trim().toUpperCase() || 'MESA-PRINCIPAL';
  if (!rooms[normCode]) {
    rooms[normCode] = {
      roomCode: normCode,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      party: {},
      dmConnected: false,
      dmLastPing: 0,
      dmLiveMessage: '',
      dmPresenceStatus: 'active',
      dmIdleSeconds: 0,
      rollFeed: [],
      dmAnnouncements: [],
      currentQuest: 'Investigar los misterios del reino y proteger a los inocentes.',
      quickNotification: '',
      showCombatantsOnTable: false,
      liveCombatants: [],
    };
  }
  return rooms[normCode];
}

// Clean old sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of Object.entries(rooms)) {
    if (now - room.lastUpdated > 24 * 60 * 60 * 1000) {
      delete rooms[code];
    }
  }
}, 60 * 60 * 1000);

// Initialize Gemini Client (checks host override header or process.env.GEMINI_API_KEY)
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Health endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// ==========================================
// AUTHENTICATION & USER MANAGEMENT
// ==========================================

// Register a new user account (starts as PENDING for DM & Player)
apiRouter.post('/auth/register', (req, res) => {
  const { email, displayName, password, requestedRole } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Faltan campos requeridos: correo, nombre o contraseña.' });
  }

  const existing = dataStore.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
  }

  let role: 'player' | 'dm' | 'both' | 'moderator' = 'player';
  if (requestedRole === 'dm') role = 'dm';
  else if (requestedRole === 'both') role = 'both';
  else if (requestedRole === 'moderator') {
    const host = dataStore.getHostSettings();
    if (req.body.adminSecret && req.body.adminSecret === (host.moderatorPassword || 'admin')) {
      role = 'moderator';
    } else {
      return res.status(401).json({ error: 'Clave de moderador incorrecta.' });
    }
  }

  const isAutoApproved = role === 'moderator' || email.trim().toLowerCase() === 'admin@weroll.app';
  const newUser = dataStore.createUser({
    email: email.trim().toLowerCase(),
    displayName: displayName.trim(),
    password: password.trim(),
    role,
    status: isAutoApproved ? 'approved' : 'pending',
  });

  res.json({
    success: true,
    status: 'pending',
    message: 'Solicitud enviada con éxito. Tu cuenta debe ser aprobada por el Administrador antes de acceder.',
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      status: newUser.status,
    },
  });
});

// Login
apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
  }

  const normEmail = email.trim().toLowerCase();
  const user = dataStore.findUserByEmail(normEmail);

  if (!user || user.password !== password.trim()) {
    return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Tu cuenta está en estado PENDIENTE de aprobación por el Administrador. No puedes ingresar hasta que sea aprobada.',
      status: 'pending',
    });
  }

  if (user.status === 'rejected') {
    const host = dataStore.getHostSettings();
    const customMsg = host.rejectionCustomMessage || 'Lo lamentamos, por el momento no puedes acceder a WeRoll. Manda mensaje a soporte@weroll.app si quieres una revisión manual de tu caso.';
    return res.status(403).json({
      error: 'Tu solicitud de acceso ha sido rechazada por el Administrador.',
      status: 'rejected',
      customMessage: customMsg,
    });
  }

  // Update last active
  user.lastActiveAt = Date.now();
  const allUsers = dataStore.getUsers();
  const idx = allUsers.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    allUsers[idx].lastActiveAt = Date.now();
    dataStore.saveUsers(allUsers);
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
});

// Check current user status / me
apiRouter.get('/auth/me', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email requerido.' });
  }
  const user = dataStore.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  });
});

// ==========================================
// ADMINISTRATOR ENDPOINTS
// ==========================================

// List all registered users
apiRouter.get('/admin/users', (req, res) => {
  const users = dataStore.getUsers().map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    registeredAt: u.registeredAt,
    approvedAt: u.approvedAt,
    approvedBy: u.approvedBy,
    lastActiveAt: u.lastActiveAt,
  }));
  res.json({ users });
});

// Approve user
apiRouter.post('/admin/users/:id/approve', (req, res) => {
  const updated = dataStore.updateUserStatus(req.params.id, 'approved', 'Admin');
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ success: true, user: updated });
});

// Reject user
apiRouter.post('/admin/users/:id/reject', (req, res) => {
  const updated = dataStore.updateUserStatus(req.params.id, 'rejected', 'Admin');
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ success: true, user: updated });
});

// Change user role
apiRouter.post('/admin/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['player', 'dm', 'both', 'moderator'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }
  const updated = dataStore.updateUserRole(req.params.id, role);
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ success: true, user: updated });
});

// ==========================================
// ROOMS & SESSION MANAGEMENT (WITH PASSWORDS)
// ==========================================

// DM Registers or Updates a Room with Password & World Sheet
apiRouter.post('/rooms/create', (req, res) => {
  const { roomCode, name, dmEmail, dmDisplayName, password, worldSheetId } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'Código de sala requerido.' });
  }

  const normCode = roomCode.trim().toUpperCase();
  dataStore.setRoom({
    roomCode: normCode,
    name: name || normCode,
    dmEmail: dmEmail || 'dm@weroll.app',
    dmDisplayName: dmDisplayName || 'Dungeon Master',
    password: password ? password.trim() : undefined,
    worldSheetId,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  });

  const room = getOrCreateRoom(normCode);
  room.lastUpdated = Date.now();

  res.json({ success: true, roomCode: normCode });
});

// Verify Room Code & Password before player joins
apiRouter.post('/rooms/verify', (req, res) => {
  const { roomCode, password } = req.body;
  if (!roomCode) {
    return res.status(400).json({ valid: false, error: 'Código de mesa requerido.' });
  }

  const normCode = roomCode.trim().toUpperCase();
  const roomRecord = dataStore.getRoom(normCode);

  // If room record exists and has a password
  if (roomRecord && roomRecord.password && roomRecord.password.trim() !== '') {
    if (!password || password.trim() !== roomRecord.password.trim()) {
      return res.status(401).json({
        valid: false,
        error: 'Contraseña de la mesa incorrecta. Solicítala a tu Dungeon Master.',
      });
    }
  }

  res.json({
    valid: true,
    room: {
      roomCode: normCode,
      name: roomRecord?.name || normCode,
      dmDisplayName: roomRecord?.dmDisplayName || 'Dungeon Master',
    },
  });
});

// Close Room (called when DM leaves to lobby - room ceases to exist)
apiRouter.post('/rooms/close', (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'Código de mesa requerido.' });
  }

  const normCode = roomCode.trim().toUpperCase();
  dataStore.closeRoom(normCode);
  if (rooms[normCode]) {
    delete rooms[normCode];
  }

  res.json({ success: true, message: 'Mesa cerrada correctamente.' });
});

// 2. Room State Sync (Get full room status with AFK Presence)
apiRouter.get('/session/room/:roomCode', (req, res) => {
  const normCode = req.params.roomCode.trim().toUpperCase();
  const roomRecord = dataStore.getRoom(normCode);

  // If room does not exist or was closed by DM, return closed error
  if (!roomRecord) {
    return res.status(404).json({
      roomCode: normCode,
      closed: true,
      error: 'La mesa no existe o ha sido cerrada por el Dungeon Master.',
    });
  }

  const room = getOrCreateRoom(normCode);
  const now = Date.now();

  // Prune inactive players (idle > 15 min)
  const activeParty = Object.values(room.party).filter(
    (p) => now - p.lastPing < 15 * 60 * 1000
  );

  const dmActive = Boolean(room.dmConnected && (now - (room.dmLastPing || 0) < 15 * 60 * 1000));

  res.json({
    roomCode: room.roomCode,
    party: activeParty,
    dmConnected: dmActive,
    dmLiveMessage: room.dmLiveMessage || '',
    dmPresenceStatus: room.dmPresenceStatus || (dmActive ? 'active' : 'offline'),
    dmIdleSeconds: room.dmIdleSeconds || 0,
    dmLastRoll: room.dmLastRoll,
    rollFeed: room.rollFeed.slice(-30),
    dmAnnouncements: room.dmAnnouncements.slice(-10),
    currentQuest: room.currentQuest,
    quickNotification: room.quickNotification,
    showCombatantsOnTable: Boolean(room.showCombatantsOnTable),
    liveCombatants: room.liveCombatants || [],
  });
});

// 2b. Post DM Heartbeat, Live Message, Presence & Active Encounter Combatants
apiRouter.post('/session/room/:roomCode/dm-heartbeat', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const {
    dmLiveMessage,
    dmConnected = true,
    presenceStatus = 'active',
    idleSeconds = 0,
    showCombatantsOnTable,
    liveCombatants,
  } = req.body;

  room.dmConnected = dmConnected;
  room.dmLastPing = Date.now();
  room.dmPresenceStatus = presenceStatus;
  room.dmIdleSeconds = idleSeconds;
  if (dmLiveMessage !== undefined) {
    room.dmLiveMessage = dmLiveMessage;
  }
  if (showCombatantsOnTable !== undefined) {
    room.showCombatantsOnTable = Boolean(showCombatantsOnTable);
  }
  if (Array.isArray(liveCombatants)) {
    room.liveCombatants = liveCombatants;
  }
  room.lastUpdated = Date.now();
  res.json({
    success: true,
    dmLiveMessage: room.dmLiveMessage,
    dmPresenceStatus: room.dmPresenceStatus,
    showCombatantsOnTable: room.showCombatantsOnTable,
    liveCombatants: room.liveCombatants,
  });
});

// 3. Post Player Heartbeat & 4-Tier Presence Update + Live Stats & Coins
apiRouter.post('/session/room/:roomCode/heartbeat', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const {
    characterId,
    characterName,
    playerName,
    currentHp,
    maxHp,
    ac,
    passivePerception,
    level,
    characterClass,
    presenceStatus = 'active',
    idleSeconds = 0,
    lastRoll,
    abilities,
    currency,
  } = req.body;

  if (characterId) {
    const existing = room.party[characterId];
    room.party[characterId] = {
      characterId,
      characterName: characterName || 'Aventurero',
      playerName: playerName || 'Jugador',
      currentHp: Number(currentHp) || 0,
      maxHp: Number(maxHp) || 10,
      ac: Number(ac) || 10,
      passivePerception: Number(passivePerception) || 10,
      level: Number(level) || 1,
      characterClass: characterClass || 'Aventurero',
      lastPing: Date.now(),
      presenceStatus,
      idleSeconds,
      lastRoll: lastRoll || existing?.lastRoll,
      abilities: abilities || existing?.abilities,
      currency: currency || existing?.currency,
    };
    room.lastUpdated = Date.now();
  }

  res.json({ success: true });
});

// Player Leave Room (trigger leave backup)
apiRouter.post('/session/room/:roomCode/leave', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const { characterId, character, ownerEmail } = req.body;

  if (characterId && room.party[characterId]) {
    delete room.party[characterId];
    room.lastUpdated = Date.now();
  }

  if (character) {
    dataStore.addRotatingBackup(character, ownerEmail || 'jugador@weroll.app', 'leave');
  }

  res.json({ success: true });
});

// ==========================================
// VAULT PERSISTENCE & ROTATING BACKUPS
// ==========================================

// Save Player Sheet to Server Vault + Trigger Join/Periodic Backup
apiRouter.post('/vault/sheets', (req, res) => {
  const { character, ownerEmail, reason = 'join' } = req.body;
  if (!character || !character.id) {
    return res.status(400).json({ error: 'Ficha de personaje requerida.' });
  }

  const email = (ownerEmail || 'jugador@weroll.app').toLowerCase();
  const allSheets = dataStore.getPlayerSheets();
  const userSheets = allSheets.filter((s) => s.ownerEmail === email);
  const isExisting = userSheets.some((s) => s.id === character.id);

  if (!isExisting && userSheets.length >= 3) {
    return res.status(400).json({
      error: 'Límite alcanzado: máximo 3 personajes por cuenta. Elimina una ficha existente para crear una nueva.',
    });
  }

  dataStore.savePlayerSheet({
    id: character.id,
    ownerEmail: email,
    name: character.name,
    character,
    updatedAt: Date.now(),
  });

  // Also rotate backup
  dataStore.addRotatingBackup(character, email, reason as any);

  res.json({ success: true, sheetId: character.id });
});

// Delete Player Sheet
apiRouter.delete('/vault/sheets/:id', (req, res) => {
  const ownerEmail = (req.query.ownerEmail as string || req.body?.ownerEmail || '').toLowerCase();
  const success = dataStore.deletePlayerSheet(req.params.id, ownerEmail);
  if (!success) {
    return res.status(404).json({ error: 'Ficha de personaje no encontrada.' });
  }
  res.json({ success: true, message: 'Ficha eliminada correctamente.' });
});

// Get Player Sheets from Server Vault
apiRouter.get('/vault/sheets', (req, res) => {
  const ownerEmail = (req.query.ownerEmail as string || '').toLowerCase();
  const allSheets = dataStore.getPlayerSheets();
  if (ownerEmail) {
    const filtered = allSheets.filter((s) => s.ownerEmail === ownerEmail);
    return res.json({ sheets: filtered });
  }
  res.json({ sheets: allSheets });
});

// Save World Sheet to Server Vault
apiRouter.post('/vault/worlds', (req, res) => {
  const { world } = req.body;
  if (!world || !world.id) {
    return res.status(400).json({ error: 'World Sheet requerido.' });
  }

  const email = (world.ownerEmail || 'dm@weroll.app').toLowerCase();
  const allWorlds = dataStore.getWorldSheets();
  const userWorlds = allWorlds.filter((w) => w.ownerEmail === email);
  const isExisting = userWorlds.some((w) => w.id === world.id);

  if (!isExisting && userWorlds.length >= 3) {
    return res.status(400).json({
      error: 'Límite alcanzado: máximo 3 World Sheets por cuenta. Elimina uno existente para crear otro.',
    });
  }

  dataStore.saveWorldSheet({
    id: world.id,
    ownerEmail: email,
    name: world.name || 'Mundo Sin Nombre',
    description: world.description,
    roomCode: (world.roomCode || 'MESA-DRAGON').toUpperCase(),
    roomPassword: world.roomPassword,
    workspace: world.workspace,
    updatedAt: Date.now(),
  });

  res.json({ success: true, worldId: world.id });
});

// Update World Sheet Config (Name, RoomCode, Password)
apiRouter.put('/vault/worlds/:id', (req, res) => {
  const { name, roomCode, roomPassword, description, workspace, ownerEmail } = req.body;
  const email = (ownerEmail || '').toLowerCase();

  const updated = dataStore.updateWorldSheet(
    req.params.id,
    {
      ...(name ? { name } : {}),
      ...(roomCode ? { roomCode: roomCode.trim().toUpperCase() } : {}),
      ...(roomPassword !== undefined ? { roomPassword } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(workspace ? { workspace } : {}),
    },
    email || undefined
  );

  if (!updated) {
    return res.status(404).json({ error: 'World Sheet no encontrado.' });
  }

  res.json({ success: true, world: updated });
});

// Delete World Sheet
apiRouter.delete('/vault/worlds/:id', (req, res) => {
  const ownerEmail = (req.query.ownerEmail as string || req.body?.ownerEmail || '').toLowerCase();
  const success = dataStore.deleteWorldSheet(req.params.id, ownerEmail);
  if (!success) {
    return res.status(404).json({ error: 'World Sheet no encontrado.' });
  }
  res.json({ success: true, message: 'World Sheet eliminado correctamente.' });
});

// Get World Sheets from Server Vault
apiRouter.get('/vault/worlds', (req, res) => {
  const ownerEmail = (req.query.ownerEmail as string || '').toLowerCase();
  const allWorlds = dataStore.getWorldSheets();
  if (ownerEmail) {
    const filtered = allWorlds.filter((w) => w.ownerEmail === ownerEmail);
    return res.json({ worlds: filtered });
  }
  res.json({ worlds: allWorlds });
});

// Get Rotating Backups (for Admin viewer)
apiRouter.get('/vault/backups', (req, res) => {
  const backups = dataStore.getBackups();
  res.json({ backups });
});

// Master Full Database Backup Export for Admin
apiRouter.get('/vault/backup-all', (req, res) => {
  const backup = dataStore.getFullBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="weroll-database-backup-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(backup);
});

// Detailed list of all backups, player sheets and world sheets for the Admin Vault
apiRouter.get('/admin/vault/details', (req, res) => {
  const sheets = dataStore.getPlayerSheets();
  const worlds = dataStore.getWorldSheets();
  const backupsMap = dataStore.getBackups();
  res.json({
    sheets,
    worlds,
    backups: Object.values(backupsMap),
  });
});

// Download individual player sheet JSON
apiRouter.get('/admin/vault/sheet/:id/download', (req, res) => {
  const sheets = dataStore.getPlayerSheets();
  const sheet = sheets.find((s) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: 'Ficha de personaje no encontrada.' });
  }
  const safeName = (sheet.name || 'personaje').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="sheet-${safeName}-${sheet.id}.json"`);
  res.json(sheet);
});

// Download individual world sheet JSON
apiRouter.get('/admin/vault/world/:id/download', (req, res) => {
  const worlds = dataStore.getWorldSheets();
  const world = worlds.find((w) => w.id === req.params.id);
  if (!world) {
    return res.status(404).json({ error: 'World Sheet no encontrado.' });
  }
  const safeName = (world.name || 'campaña').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="world-${safeName}-${world.id}.json"`);
  res.json(world);
});

// Download individual rotating backup JSON
apiRouter.get('/admin/vault/backup/:charId/download', (req, res) => {
  const backups = dataStore.getBackups();
  const entry = backups[req.params.charId];
  if (!entry) {
    return res.status(404).json({ error: 'Respaldo no encontrado.' });
  }
  const safeName = (entry.characterName || 'backup').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-${safeName}-${entry.characterId}.json"`);
  res.json(entry);
});

// Restore / Upload Backup JSON to Server Vault
apiRouter.post('/admin/vault/restore', (req, res) => {
  try {
    const result = dataStore.restoreBackup(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error al restaurar respaldo.' });
  }
});

// ==========================================
// CHANGELOG / UPDATES BLOG ADMIN MANAGEMENT
// ==========================================
apiRouter.get('/admin/changelog', (req, res) => {
  res.json({ changelog: dataStore.getChangelog() });
});

apiRouter.post('/admin/changelog', (req, res) => {
  const { version, title, date, changes } = req.body;
  if (!version || !title) {
    return res.status(400).json({ error: 'Versión y título requeridos.' });
  }
  const entry = {
    version: version.trim(),
    title: title.trim(),
    date: date || new Date().toISOString().split('T')[0],
    changes: Array.isArray(changes) ? changes : [changes || 'Actualización de sistema'],
  };
  const list = dataStore.addChangelogEntry(entry);
  res.json({ success: true, changelog: list });
});

apiRouter.put('/admin/changelog/:index', (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const { version, title, date, changes } = req.body;
  if (isNaN(idx)) {
    return res.status(400).json({ error: 'Índice inválido.' });
  }
  const entry = {
    version: version.trim(),
    title: title.trim(),
    date: date || new Date().toISOString().split('T')[0],
    changes: Array.isArray(changes) ? changes : [changes || 'Actualización de sistema'],
  };
  const list = dataStore.updateChangelogEntry(idx, entry);
  if (!list) {
    return res.status(404).json({ error: 'Entrada de changelog no encontrada.' });
  }
  res.json({ success: true, changelog: list });
});

apiRouter.delete('/admin/changelog/:index', (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx)) {
    return res.status(400).json({ error: 'Índice inválido.' });
  }
  const list = dataStore.deleteChangelogEntry(idx);
  if (!list) {
    return res.status(404).json({ error: 'Entrada de changelog no encontrada.' });
  }
  res.json({ success: true, changelog: list });
});

// Persistent Host Settings
apiRouter.get('/settings', (req, res) => {
  res.json(dataStore.getHostSettings());
});

apiRouter.post('/settings', (req, res) => {
  if (req.body) {
    dataStore.saveHostSettings(req.body);
  }
  res.json({ success: true, settings: dataStore.getHostSettings() });
});

// 4. Post Roll to Room Feed & Store Last Roll per member / DM
apiRouter.post('/session/room/:roomCode/roll', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const rollData: DiceRollResult = req.body;
  const { characterId, isDm } = req.query;

  if (rollData && rollData.rollerName) {
    const formattedRoll = {
      ...rollData,
      id: rollData.id || `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    room.rollFeed.push(formattedRoll);

    if (isDm === 'true' || rollData.rollerName.toLowerCase().includes('dungeon master') || rollData.rollerName.toLowerCase() === 'dm') {
      room.dmLastRoll = formattedRoll;
    } else if (characterId && room.party[characterId as string]) {
      room.party[characterId as string].lastRoll = formattedRoll;
    }

    if (room.rollFeed.length > 50) {
      room.rollFeed.shift();
    }
    room.lastUpdated = Date.now();
  }

  res.json({ success: true, count: room.rollFeed.length });
});

// 5. Post DM Announcements, Current Quest, and Quick Notification
apiRouter.post('/session/room/:roomCode/announce', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const { title, content, quest, notification } = req.body;

  if (quest !== undefined) {
    room.currentQuest = quest;
  }
  if (notification !== undefined) {
    room.quickNotification = notification;
  }

  if (content) {
    room.dmAnnouncements.push({
      id: `ann-${Date.now()}`,
      title: title || 'Aviso del Dungeon Master',
      content,
      timestamp: Date.now(),
    });
    if (room.dmAnnouncements.length > 20) {
      room.dmAnnouncements.shift();
    }
  }

  room.lastUpdated = Date.now();
  res.json({ success: true, quest: room.currentQuest, notification: room.quickNotification });
});

// 6. El Sabio Arcano Chat (Player & DM)
apiRouter.post('/gemini/chat', async (req, res) => {
  const { prompt, characterContext, dmContext, isDm, model } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;

  if (!prompt) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const ai = getGeminiClient(customKey);

  if (!ai) {
    const offlineAnswer = generateOfflineAssistantResponse(prompt, characterContext, dmContext, isDm);
    return res.json({ text: offlineAnswer, isOffline: true });
  }

  try {
    let systemInstruction = `Eres "El Sabio Arcano", una entidad venerable, sabia y paciente que actúa como árbitro maestro del juego de rol Dungeons & Dragons 5ª Edición (SRD 5E) para jugadores de habla hispana.
NORMAS ESTRICTAS:
1. NUNCA menciones que eres una IA, un modelo de lenguaje o Gemini. Preséntate siempre como "El Sabio Arcano".
2. Conoces a la perfección las reglas oficiales de 5E: acciones en combate, estados (cegado, paralizado, etc.), coberturas, espacios de conjuro, ataques de oportunidad, etc.
3. Si el jugador pregunta sobre su inventario, características o acciones, revisa su contexto.
4. Si el Dungeon Master te consulta, eres su consejero confidencial de campaña: conoces sus PNJs, monstruos, lugares y secretos y puedes ayudarle a improvisar trampas, equilibrar combates y desarrollar la trama.
5. Responde con calidez, sabiduría arcana, formato claro y viñetas cuando sea pedagógico.`;


    let contextSnippet = '';
    if (characterContext) {
      contextSnippet += `\n\n[Ficha del Personaje que consulta]
Nombre: ${characterContext.name || 'Sin nombre'} (${characterContext.race || ''} ${characterContext.characterClass || ''} Nivel ${characterContext.level || 1})
PG: ${characterContext.currentHp}/${characterContext.maxHp} | CA: ${characterContext.armorClass || 10} | Inic: ${characterContext.initiativeBonus || 0}
FUE: ${characterContext.abilities?.str?.score || 10}, DES: ${characterContext.abilities?.dex?.score || 10}, CON: ${characterContext.abilities?.con?.score || 10}, INT: ${characterContext.abilities?.int?.score || 10}, SAB: ${characterContext.abilities?.wis?.score || 10}, CAR: ${characterContext.abilities?.cha?.score || 10}
Inventario: ${(characterContext.inventory || []).map((i: any) => `${i.name} (x${i.quantity || 1}${i.equipped ? ', Equipado' : ''})`).join(', ') || 'Vacío'}
Monedas: ${characterContext.currency?.gp || 0} PO, ${characterContext.currency?.sp || 0} PP, ${characterContext.currency?.cp || 0} PC
Ataques: ${(characterContext.attacks || []).map((a: any) => `${a.name} (+${a.attackBonus}, ${a.damageDice} ${a.damageType})`).join('; ') || 'Ninguno'}
Rasgos: ${(characterContext.featuresAndTraits || []).map((f: any) => f.name).join(', ') || 'Ninguno'}`;
    }

    if (dmContext) {
      contextSnippet += `\n\n[ARCHIVO CONFIDENCIAL DE CAMPAÑA DEL DUNGEON MASTER]
Campaña: ${dmContext.campaignTitle || 'Aventura Principal'}
Misión / Objetivo Activo: ${dmContext.currentQuest || 'Sin misión fijada'}

NPCs Registrados (${(dmContext.npcs || []).length}):
${(dmContext.npcs || []).map((n: any) => `• ${n.name} (${n.race} ${n.occupation}, Actitud: ${n.attitude}, Carpeta: ${n.folder || 'General'}). Ubicación: ${n.location}. Secreto DM: ${n.secretOrHook || 'Ninguno'}. Notas: ${n.notes || 'Sin notas'}. Evolución: ${n.evolution || 'Sin cambios recientes'}`).join('\n')}

Monstruos y Criaturas (${(dmContext.monsters || []).length}):
${(dmContext.monsters || []).map((m: any) => `• ${m.name} (CR ${m.cr}, CA ${m.ac}, PG ${m.hp}/${m.maxHp}, ${m.size} ${m.type}). Ataques: ${(m.actions || []).map((a: any) => `${a.name} (+${a.toHit}, ${a.damage} ${a.damageType})`).join(', ')}. Notas: ${m.notes || 'Ninguna'}`).join('\n')}

Lugares, Mazmorras y Mapas (${(dmContext.locations || []).length}):
${(dmContext.locations || []).map((l: any) => `• ${l.name} (${l.type}, Región: ${l.region || 'Desconocida'}). Puntos clave: ${(l.pointsOfInterest || []).join(', ') || 'Sin puntos'}. Secretos DM: ${l.secretsForDm || 'Ninguno'}. Notas tácticas: ${l.notes || 'Sin notas'}. Evolución: ${l.evolution || 'Sin cambios'}`).join('\n')}

Diario de Sesiones y Crónicas (${(dmContext.campaignLogs || []).length}):
${(dmContext.campaignLogs || []).map((log: any) => `• Sesión ${log.sessionNumber}: "${log.title}" (${log.date}). Resumen: ${log.summary}. Público: ${log.publicNotes || 'N/A'}. Notas Secretas DM: ${log.privateNotes || 'N/A'}`).join('\n')}

Resúmenes de Combates Anteriores (${(dmContext.combatSummaries || []).length}):
${(dmContext.combatSummaries || []).map((cs: any) => `• "${cs.name}" (${cs.date}, ${cs.roundsCount} rondas). Participantes: ${(cs.participants || []).join(', ')}. Notas del DM: ${cs.notes || 'Sin notas'}`).join('\n')}`;
    }

    const fullPrompt = `${contextSnippet ? contextSnippet + '\n\n' : ''}Consulta: ${prompt}`;

    const host = dataStore.getHostSettings();
    const chosenModel = model || host.aiModel || 'gemini-flash-lite-latest';
    const response = await ai.models.generateContent({
      model: chosenModel,
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || 'Las energías arcanas permanecen en silencio.' });
  } catch (error: any) {
    console.error('Error in chat:', error);
    const offlineAnswer = generateOfflineAssistantResponse(prompt, characterContext, dmContext, isDm);
    res.json({
      text: `${offlineAnswer}\n\n*(Respuesta consultada mediante el Compendio Arcano)*`,
      isOffline: true,
    });
  }
});

// 7. AI Co-Pilot NPC Generator / Assist
apiRouter.post('/gemini/generate-npc', async (req, res) => {
  const { name, race, occupation, location, attitude, theme } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || 'Torvin Barbaferro',
      race: race || 'Enano de las Colinas',
      occupation: occupation || 'Herrero de armas rúnicas',
      attitude: attitude || 'Neutral',
      location: location || 'Plaza de los Yunque',
      appearance: 'Brazos anchos como robles, delantal de cuero cubierto de hollín y ojos astutos.',
      personality: 'Orgulloso de su forja, desconfía de la magia débil pero respeta el acero auténtico.',
      secretOrHook: 'Encontró un trozo de meteorito estrellado en la mina norte que murmura al ser golpeado.',
      notes: 'Tiene amistad con el tabernero local.',
      evolution: 'Dispuesto a fabricar armas con descuento si le traen carbón especial.',
      stats: { hp: 35, ac: 14, cr: '1', notes: 'Martillo de guerra +4 (1d8+2)' },
    });
  }

  try {
    const prompt = `Actúa como co-piloto del Dungeon Master de D&D 5E.
Completa o genera los detalles faltantes para este PNJ (NPC) en formato JSON válido.
Datos proporcionados por el DM (mantén estos datos y complementa los vacíos):
- Nombre: ${name || 'Generar uno evocador'}
- Raza: ${race || 'Generar una acorde'}
- Oficio/Rol: ${occupation || 'Generar un rol interesante'}
- Ubicación: ${location || 'Generar ubicación adecuada'}
- Actitud: ${attitude || 'Neutral'}
- Tema/Ambiente: ${theme || 'Fantasía medieval estándar'}

Formato JSON estricto:
{
  "name": "Nombre completo",
  "race": "Raza",
  "occupation": "Rol o profesión",
  "attitude": "Aliado" | "Amistoso" | "Neutral" | "Desconfiado" | "Hostil",
  "location": "Lugar exacto",
  "appearance": "Descripción física distintiva (2 frases)",
  "personality": "Manera de hablar y comportamiento",
  "secretOrHook": "Secreto para el DM o gancho de aventura",
  "notes": "Notas privadas breves del DM",
  "evolution": "Posible desarrollo o cambios durante la campaña",
  "stats": { "hp": 30, "ac": 13, "cr": "1/2", "notes": "Notas rápidas de combate" }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar NPC con IA' });
  }
});

// 8. AI Co-Pilot Monster Generator / Assist
apiRouter.post('/gemini/generate-monster', async (req, res) => {
  const { name, cr, type, environment } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || ' acechador de las Criptas',
      size: 'Mediano',
      type: type || 'Muerto viviente',
      alignment: 'Neutral Maligno',
      cr: cr || '2',
      ac: 14,
      hp: 45,
      maxHp: 45,
      speed: '30 pies, trepar 30 pies',
      str: 14,
      dex: 16,
      con: 14,
      int: 8,
      wis: 12,
      cha: 6,
      traits: [{ name: 'Salto Emboscador', description: 'Si salta al menos 15 pies hacia una criatura, tiene ventaja en el ataque.' }],
      actions: [
        { id: 'ma-1', name: 'Garras Venenosas', type: 'melee', toHit: 5, damage: '2d6+3', damageType: 'Cortante + 1d6 Veneno', description: 'Ataque cuerpo a cuerpo' },
        { id: 'ma-2', name: 'Alarido Aterrador (Recarga 6)', type: 'ranged', toHit: 0, damage: '2d8', damageType: 'Psíquico', description: 'Salvación SAB CD 12 o Asustado por 1 min.' },
      ],
      notes: 'Evita la luz solar directa.',
    });
  }

  try {
    const prompt = `Actúa como diseñador de monstruos para el Dungeon Master de D&D 5E.
Completa o genera las estadísticas completas de este monstruo en formato JSON.
Datos del DM:
- Nombre: ${name || 'Monstruo original'}
- Desafío (CR deseado): ${cr || '2'}
- Tipo de criatura: ${type || 'Monstruosidad o Muerto viviente'}
- Entorno: ${environment || 'Mazmorra oscura'}

Estructura requerida en JSON:
{
  "name": "Nombre",
  "size": "Mediano" | "Grande" | "Pequeño" | "Enorme",
  "type": "Tipo de criatura",
  "alignment": "Alineamiento",
  "cr": "1" | "2" | "3" | etc.,
  "ac": 14,
  "hp": 45,
  "maxHp": 45,
  "speed": "30 pies",
  "str": 14, "dex": 14, "con": 14, "int": 10, "wis": 10, "cha": 8,
  "traits": [ { "name": "Rasgo", "description": "Efecto" } ],
  "actions": [
    { "id": "ma-1", "name": "Ataque 1", "type": "melee", "toHit": 5, "damage": "1d8+3", "damageType": "Cortante", "description": "Detalle" },
    { "id": "ma-2", "name": "Ataque 2", "type": "ranged", "toHit": 4, "damage": "1d6+2", "damageType": "Perforante", "description": "Detalle" }
  ],
  "notes": "Estrategia para el DM"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar monstruo con IA' });
  }
});

// 9. AI Co-Pilot Location Generator / Assist
apiRouter.post('/gemini/generate-location', async (req, res) => {
  const { name, type, region, theme } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || 'Criptas de la Lanza Helada',
      type: type || 'Mazmorra',
      region: region || 'Paso de la Ventisca',
      description: 'Antiguo complejo funerario tallado en roca helada donde estalactitas gotean sobre ataúdes olvidados.',
      secretsForDm: 'Una palanca oculta tras el altar descongela el mecanismo de la puerta hacia la cámara del tesoro.',
      notes: 'Peligro ambiental: frío extremo (-10°C). Cada hora requiere salvación de CON CD 10.',
      evolution: 'Si los aventureros rompen el cristal de escarcha, el hielo de toda la cueva empezará a derretirse.',
      pointsOfInterest: ['La Galería de las Estatuas Congeladas', 'El Pozo de Hielo Negro', 'El Sepulcro del General'],
    });
  }

  try {
    const prompt = `Crea o complementa un lugar de D&D 5E para el Dungeon Master en formato JSON válido.
Datos del DM:
- Nombre: ${name || 'Generar nombre sugerente'}
- Tipo: ${type || 'Mazmorra, Taberna o Villa'}
- Región: ${region || 'Tierras salvajes'}
- Tema/Ambiente: ${theme || 'Misterio y peligro'}

Formato JSON:
{
  "name": "Nombre",
  "type": "Ciudad" | "Mazmorra" | "Templo" | "Bosque" | "Castillo" | "Taberna" | "Ruinas" | "Poblado",
  "region": "Región",
  "description": "Descripción sensorial para leer a los jugadores",
  "secretsForDm": "Secretos, trampas ocultas y tesoros para el DM",
  "notes": "Notas tácticas y peligros ambientales",
  "evolution": "Cómo puede cambiar o reaccionar este lugar según lo que hagan los personajes",
  "pointsOfInterest": ["Punto clave 1", "Punto clave 2", "Punto clave 3"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar lugar con IA' });
  }
});

// 10. AI Relational Assist (Draft base + Entity Relationships)
apiRouter.post('/gemini/assist-entity', async (req, res) => {
  const { entityType, name, concept, tone, relatedEntities = [], dmSecretsNotes = '', folder = 'General' } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  const relationshipsText = (relatedEntities.length > 0)
    ? `\nENTIDADES Y LUGARES VINCULADOS O RELACIONADOS (Obligatorio integrarlos en la historia o trasfondo):\n${relatedEntities.map((r: string) => `• ${r}`).join('\n')}`
    : '';

  if (!ai) {
    // Offline coherent fallback
    if (entityType === 'npc') {
      return res.json({
        name: name || 'Kaelen el Silencioso',
        folder,
        race: 'Semielfo',
        occupation: concept ? `Especialista: ${concept}` : 'Explorador y confidente',
        attitude: (tone as any) || 'Neutral',
        location: relatedEntities[0] || 'Taberna del Jabalí',
        appearance: 'Capa gris desgastada por la lluvia, mirada analítica y una cicatriz en la muñeca derecha.',
        personality: 'Habla en voz baja y reflexiva. Leal con quienes demuestran palabra.',
        secretOrHook: dmSecretsNotes || (relatedEntities.length > 0 ? `Tiene un acuerdo secreto relacionado con ${relatedEntities.join(' y ')}.` : 'Guarda una carta con el sello real que no ha podido entregar.'),
        notes: `Vinculado con: ${relatedEntities.join(', ') || 'Nadie en particular'}. ${dmSecretsNotes}`,
        evolution: 'Dispuesto a compartir información clave si los aventureros le ayudan a resolver una vieja deuda.',
        stats: { hp: 32, ac: 14, cr: '2', notes: 'Daga rápida +5 (1d4+3) y tirada de sigilo +6' },
      });
    } else if (entityType === 'monster') {
      return res.json({
        name: name || 'Acechador de las Sombras',
        folder,
        size: 'Mediano',
        type: 'Monstruosidad',
        alignment: 'Neutral Maligno',
        cr: '3',
        ac: 14,
        hp: 45,
        maxHp: 45,
        speed: '40 pies, trepar 30 pies',
        str: 14, dex: 16, con: 14, int: 8, wis: 12, cha: 6,
        traits: [{ name: 'Furtivo en Sombras', description: 'Tiene ventaja en tiradas de Sigilo en luz tenue u oscuridad.' }],
        actions: [
          { id: 'm-atk-rel-1', name: 'Zarpazo Desgarrador', type: 'melee', toHit: 5, damage: '2d6+3', damageType: 'Cortante', range: '5 pies', description: 'Ataque con garras afiladas.' },
          { id: 'm-atk-rel-2', name: 'Mordisco Venenoso', type: 'melee', toHit: 5, damage: '1d8+3', damageType: 'Perforante + 2d4 Veneno', range: '5 pies', description: 'Inyecta toxina paralizante.' },
        ],
        notes: `Criatura asociada a ${relatedEntities.join(', ') || 'las profundidades'}. ${concept || ''}`,
      });
    } else if (entityType === 'location') {
      return res.json({
        name: name || 'Cripta Olvidada',
        folder,
        region: 'Tierras Bajas',
        type: 'Ruinas',
        description: `Un antiguo enclave de piedra gris y moho. ${concept || 'Guarda vestigios de una civilización anterior.'}`,
        secretsForDm: dmSecretsNotes || `Existe un pasaje secreto que conecta directamente con ${relatedEntities[0] || 'la superficie'}.`,
        notes: `Puntos de contacto: ${relatedEntities.join(', ') || 'Sin vínculos previos'}.`,
        evolution: 'Si los personajes alteran el sello central, las criaturas del lugar despertarán.',
        pointsOfInterest: ['El Arco de Entrada Derrumbado', 'El Sarcófago Rúnico', 'El Foso de las Ofrendas'],
      });
    } else {
      return res.json({
        name: name || 'Reliquia de la Vorágine',
        folder,
        kind: 'item',
        rarity: 'Raro',
        category: 'Objeto Mágico',
        whoHasIt: relatedEntities[0] || 'En custodia secreta',
        whereFound: 'En las profundidades del santuario',
        description: `Un artefacto que pulsa con energía arcana. ${concept || ''}`,
        properties: '+1 a tiradas de ataque y salvación. 3 cargas para proyectar ráfaga mística.',
        dmSecrets: dmSecretsNotes || 'Si se usa contra un aliado, su brillo se extingue durante un mes lunar.',
      });
    }
  }

  try {
    const prompt = `Actúa como diseñador maestro de campañas de D&D 5ª Edición (SRD 5E).
El Dungeon Master está creando un ${entityType.toUpperCase()} y te ha proporcionado un borrador base:
• Nombre tentativo: ${name || 'A elegir por la IA'}
• Concepto / Rol: ${concept || 'Personaje / elemento relevante de la aventura'}
• Tono / Actitud / Nivel: ${tone || 'Apropiado para aventura de nivel medio'}
• Notas / Secretos del DM: ${dmSecretsNotes || 'Ninguno especificado'}
${relationshipsText}

INSTRUCCIONES:
1. Rellena todos los campos de forma creativa, profesional y coherente con las reglas de 5E.
2. Es VITAL que incorpores las entidades y lugares vinculados en el trasfondo, secretos o notas del DM.
3. Responde ÚNICAMENTE un JSON válido con la siguiente estructura según el tipo:

${entityType === 'npc' ? `{
  "name": "Nombre final",
  "folder": "${folder}",
  "race": "Raza D&D 5E",
  "occupation": "Ocupación / Clase",
  "attitude": "Amistoso / Neutral / Desconfiado / Hostil / Aliado",
  "location": "Ubicación actual",
  "appearance": "Descripción física detallada",
  "personality": "Rasgos de personalidad y forma de actuar",
  "secretOrHook": "Secreto o gancho de aventura que involucra a las entidades vinculadas",
  "notes": "Notas confidenciales del DM",
  "evolution": "Posible evolución según decisiones de los jugadores",
  "stats": { "hp": 30, "ac": 13, "cr": "2", "notes": "Ataques o conjuros básicos" }
}` : entityType === 'monster' ? `{
  "name": "Nombre final",
  "folder": "${folder}",
  "size": "Mediano",
  "type": "Tipo de criatura",
  "alignment": "Alineamiento",
  "cr": "2",
  "ac": 13,
  "hp": 35,
  "maxHp": 35,
  "speed": "30 pies",
  "str": 14, "dex": 12, "con": 14, "int": 10, "wis": 10, "cha": 8,
  "traits": [{ "name": "Rasgo 1", "description": "Detalle del rasgo" }],
  "actions": [
    { "name": "Ataque 1", "type": "melee", "toHit": 4, "damage": "1d8+2", "damageType": "Cortante", "range": "5 pies", "description": "Efecto adicional" }
  ],
  "notes": "Notas del DM sobre su hábitat y relación con ${relatedEntities.join(', ') || 'el entorno'}"
}` : entityType === 'location' ? `{
  "name": "Nombre final",
  "folder": "${folder}",
  "region": "Región",
  "type": "Mazmorra / Ciudad / Taberna / Ruinas / Templo / Bosque",
  "description": "Descripción sensorial para los jugadores",
  "secretsForDm": "Secretos para el DM vinculados a ${relatedEntities.join(', ') || 'la historia'}",
  "notes": "Notas tácticas",
  "evolution": "Cómo reacciona o cambia el lugar",
  "pointsOfInterest": ["Punto clave 1", "Punto clave 2", "Punto clave 3"]
}` : `{
  "name": "Nombre final",
  "folder": "${folder}",
  "kind": "item",
  "rarity": "Raro",
  "category": "Arma / Armadura / Objeto Mágico / Poción",
  "whoHasIt": "Quién lo posee o poseía",
  "whereFound": "Ubicación o botín",
  "description": "Descripción visual e historia",
  "properties": "Estadísticas mecánicas de 5E",
  "dmSecrets": "Secretos o maldición para el DM"
}`}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Error generating relational assist:', err);
    res.status(500).json({ error: 'Error al autorrellenar con IA' });
  }
});

// Offline assistant fallback
function generateOfflineAssistantResponse(query: string, characterContext?: any, dmContext?: any, isDm?: boolean): string {
  const q = query.toLowerCase();

  if (characterContext && (q.includes('tengo') || q.includes('objeto') || q.includes('mochila') || q.includes('inventario') || q.includes('armadura') || q.includes('arma'))) {
    const items = (characterContext.inventory || []).map((i: any) => `• ${i.name} (x${i.quantity || 1}${i.equipped ? ' - Equipado' : ''})`).join('\n');
    return `📦 **Inventario de ${characterContext.name || 'tu personaje'}:**\n\n${items || 'No tienes objetos registrados en tu hoja actualmente.'}\n\nMonedero: ${characterContext.currency?.gp || 0} PO (Oro), ${characterContext.currency?.sp || 0} PP (Plata), ${characterContext.currency?.cp || 0} PC (Cobre).`;
  }

  if (isDm && dmContext) {
    if (q.includes('npc') || q.includes('pnj') || q.includes('personaje')) {
      const npcs = (dmContext.npcs || []).map((n: any) => `• **${n.name}** (${n.race} ${n.occupation}, ${n.attitude}): ${n.location}. Secreto: "${n.secretOrHook || 'Sin secreto'}". Evolución: ${n.evolution || 'Sin cambios'}`).join('\n');
      return `👥 **NPCs Registrados en la Campaña:**\n\n${npcs || 'No tienes NPCs registrados aún en tus carpetas.'}`;
    }

    if (q.includes('lugar') || q.includes('mazmorra') || q.includes('mapa') || q.includes('ciudad') || q.includes('villa')) {
      const locs = (dmContext.locations || []).map((l: any) => `• **${l.name}** (${l.type}, Región: ${l.region || 'Desconocida'}): ${l.description.slice(0, 100)}... Secreto: "${l.secretsForDm || 'Ninguno'}"`).join('\n');
      return `🗺️ **Lugares y Mazmorras Registrados:**\n\n${locs || 'No hay lugares guardados en tu archivero.'}`;
    }

    if (q.includes('monstruo') || q.includes('enemigo') || q.includes('bestia')) {
      const mons = (dmContext.monsters || []).map((m: any) => `• **${m.name}** (CR ${m.cr}, CA ${m.ac}, PG ${m.hp}/${m.maxHp}) - Ataques: ${(m.actions || []).map((a: any) => a.name).join(', ') || 'Ataque básico'}`).join('\n');
      return `💀 **Bestiario y Monstruos de la Campaña:**\n\n${mons || 'No hay monstruos registrados actualmente.'}`;
    }

    if (q.includes('combate') || q.includes('resumen') || q.includes('pelea')) {
      const sums = (dmContext.combatSummaries || []).map((s: any) => `• **${s.name}** (${s.date}, ${s.roundsCount} rondas): Participantes: ${(s.participants || []).join(', ')}. Resumen DM: "${s.notes || 'Sin notas'}"`).join('\n');
      return `⚔️ **Resúmenes de Combates Archivados:**\n\n${sums || 'Aún no has archivado ningún combate finalizado.'}`;
    }

    if (q.includes('diario') || q.includes('cronica') || q.includes('crónica') || q.includes('sesion') || q.includes('sesión')) {
      const logs = (dmContext.campaignLogs || []).map((l: any) => `• **Sesión ${l.sessionNumber}: ${l.title}** (${l.date}): ${l.summary}`).join('\n');
      return `📖 **Diario de Campaña:**\n\n${logs || 'No hay entradas en la crónica de campaña.'}`;
    }
  }

  if (q.includes('ataque de oportunidad') || q.includes('oportunidad')) {
    return `⚔️ **Ataque de Oportunidad (D&D 5E):**\n\n• Se desencadena cuando una criatura hostil que puedes ver sale voluntariamente de tu alcance cuerpo a cuerpo (generalmente 5 pies).\n• Consume tu **Reacción** de la ronda.\n• Realizas un único ataque con arma cuerpo a cuerpo justo antes de que la criatura abandone tu alcance.\n• *Excepción:* No provoca ataque de oportunidad si la criatura realiza la acción de **Destrabarse (Disengage)** o si es movida a la fuerza (por ejemplo, empujada).`;
  }

  if (q.includes('dos conjuros') || q.includes('lanzar 2') || q.includes('accion adicional') || q.includes('bonus action')) {
    return `✨ **Lanzar Conjuros con Acción Adicional:**\n\n• Si lanzas un conjuro con tiempo de lanzamiento de **Acción Adicional** (como *Palabra de Curación* o *Paso Brumoso*), durante ese mismo turno **no puedes lanzar ningún otro conjuro**, excepto un **Truco (Cantrip)** con tiempo de lanzamiento de 1 Acción.\n• No puedes lanzar dos conjuros de nivel 1 o superior en el mismo turno a menos que uses *Oleada de Acción (Action Surge)* de Guerrero.`;
  }

  if (q.includes('concentracion') || q.includes('concentración')) {
    return `🧠 **Reglas de Concentración:**\n\n• Solo puedes mantener la concentración en **un solo conjuro a la vez**.\n• Si recibes daño mientras te concentras, debes hacer una tirada de salvación de **Constitución**.\n• La CD es igual a **10 o la mitad del daño recibido** (el número que sea mayor).\n• Si recibes daño de múltiples fuentes, tiras por cada una por separado.\n• Quedar Incapacitado o Muerto rompe la concentración automáticamente.`;
  }

  if (q.includes('descanso') || q.includes('dormir') || q.includes('curar')) {
    return `🏕️ **Descansos en 5E:**\n\n• **Descanso Corto (Short Rest):** Al menos 1 hora de reposo ligero. Puedes gastar Dados de Golpe para curarte (Dado + tu mod de Constitución por cada dado gastado).\n• **Descanso Largo (Long Rest):** 8 horas (al menos 6 de sueño). Recuperas todos tus Puntos de Golpe perdidos y hasta la mitad de tus Dados de Golpe máximos. Solo puedes beneficiarte de un descanso largo cada 24 horas.`;
  }

  return `📜 **El Sabio Arcano:**\n\nHas consultado sobre: "${query}".\n\nEn las reglas de D&D 5E:\n• **Tiradas de D20:** 1d20 + Modificador de Característica + Bonificador de Competencia (si eres competente).\n• **Ventaja/Desventaja:** Tiras 2 dados d20 y te quedas con el más alto (Ventaja) o con el más bajo (Desventaja).\n• **Regla de Oro:** El Dungeon Master siempre tiene la última palabra para adaptar las reglas al ritmo de la historia.\n\nPuedes consultarme sobre reglas de combate, estados alterados, el inventario de tu personaje o pedir consejo al DM.`;
}
