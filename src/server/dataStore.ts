import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Character5e, DMWorkspace, HostSettings, ChangelogEntry } from '../types/dnd.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data_store');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  password: string;
  role: 'player' | 'dm' | 'both' | 'moderator';
  status: 'pending' | 'approved' | 'rejected';
  registeredAt: number;
  approvedAt?: number;
  approvedBy?: string;
  lastActiveAt: number;
}

export interface RoomRecord {
  roomCode: string;
  name: string;
  dmEmail: string;
  dmDisplayName: string;
  password?: string;
  worldSheetId?: string;
  createdAt: number;
  lastUpdated: number;
}

export interface PlayerSheetRecord {
  id: string;
  ownerEmail: string;
  name: string;
  character: Character5e;
  updatedAt: number;
}

export interface WorldSheetRecord {
  id: string;
  ownerEmail: string;
  name: string;
  description?: string;
  roomCode: string;
  roomPassword?: string;
  workspace: DMWorkspace;
  updatedAt: number;
}

export interface RotatingBackupSlot {
  timestamp: number;
  reason: 'join' | 'leave' | 'manual';
  snapshot: Character5e;
}

export interface PlayerRotatingBackup {
  characterId: string;
  ownerEmail: string;
  characterName: string;
  // Strictly 2 rotating versions: slot 0 (older) and slot 1 (newer)
  slots: RotatingBackupSlot[];
  lastRotatedAt: number;
}

// Helpers for reading/writing JSON files safely
function readJSON<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      writeJSON(filename, fallback);
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return fallback;
  }
}

function writeJSON<T>(filename: string, data: T): void {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  }
}

// Initial Admin User Seed
const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr-admin-master',
    email: 'admin@weroll.app',
    displayName: 'Administrador Supremo',
    password: 'admin',
    role: 'moderator',
    status: 'approved',
    registeredAt: Date.now(),
    approvedAt: Date.now(),
    approvedBy: 'SYSTEM',
    lastActiveAt: Date.now(),
  },
];

export const dataStore = {
  // --- USERS ---
  getUsers(): UserAccount[] {
    const users = readJSON<UserAccount[]>('users.json', DEFAULT_USERS);
    if (users.length === 0) {
      this.saveUsers(DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return users;
  },

  saveUsers(users: UserAccount[]): void {
    writeJSON('users.json', users);
  },

  findUserByEmail(email: string): UserAccount | undefined {
    const users = this.getUsers();
    return users.find((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
  },

  createUser(account: Omit<UserAccount, 'id' | 'registeredAt' | 'lastActiveAt'>): UserAccount {
    const users = this.getUsers();
    const newUser: UserAccount = {
      ...account,
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  },

  updateUserStatus(id: string, status: 'approved' | 'rejected', approvedBy: string): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].status = status;
    users[idx].approvedAt = Date.now();
    users[idx].approvedBy = approvedBy;
    this.saveUsers(users);
    return users[idx];
  },

  updateUserRole(id: string, role: 'player' | 'dm' | 'moderator'): UserAccount | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].role = role;
    this.saveUsers(users);
    return users[idx];
  },

  // --- ROOMS WITH PASSWORDS ---
  getRooms(): Record<string, RoomRecord> {
    return readJSON<Record<string, RoomRecord>>('rooms.json', {});
  },

  saveRooms(rooms: Record<string, RoomRecord>): void {
    writeJSON('rooms.json', rooms);
  },

  setRoom(record: RoomRecord): void {
    const rooms = this.getRooms();
    const code = record.roomCode.trim().toUpperCase();
    rooms[code] = {
      ...record,
      roomCode: code,
      lastUpdated: Date.now(),
    };
    this.saveRooms(rooms);
  },

  getRoom(code: string): RoomRecord | undefined {
    const rooms = this.getRooms();
    return rooms[code.trim().toUpperCase()];
  },

  // --- PLAYER SHEETS VAULT ---
  getPlayerSheets(): PlayerSheetRecord[] {
    return readJSON<PlayerSheetRecord[]>('sheets.json', []);
  },

  savePlayerSheet(sheet: PlayerSheetRecord): void {
    const sheets = this.getPlayerSheets();
    const idx = sheets.findIndex((s) => s.id === sheet.id);
    if (idx >= 0) {
      sheets[idx] = { ...sheet, updatedAt: Date.now() };
    } else {
      sheets.push({ ...sheet, updatedAt: Date.now() });
    }
    writeJSON('sheets.json', sheets);
  },

  deletePlayerSheet(id: string, ownerEmail?: string): boolean {
    let sheets = this.getPlayerSheets();
    const initialLen = sheets.length;
    sheets = sheets.filter((s) => {
      if (s.id !== id) return true;
      if (ownerEmail && s.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return true;
      return false;
    });
    if (sheets.length < initialLen) {
      writeJSON('sheets.json', sheets);
      return true;
    }
    return false;
  },

  // --- WORLD SHEETS VAULT ---
  getWorldSheets(): WorldSheetRecord[] {
    return readJSON<WorldSheetRecord[]>('worlds.json', []);
  },

  saveWorldSheet(world: WorldSheetRecord): void {
    const worlds = this.getWorldSheets();
    const idx = worlds.findIndex((w) => w.id === world.id);
    if (idx >= 0) {
      worlds[idx] = { ...world, updatedAt: Date.now() };
    } else {
      worlds.push({ ...world, updatedAt: Date.now() });
    }
    writeJSON('worlds.json', worlds);
  },

  updateWorldSheet(id: string, updates: Partial<WorldSheetRecord>, ownerEmail?: string): WorldSheetRecord | null {
    const worlds = this.getWorldSheets();
    const idx = worlds.findIndex((w) => {
      if (w.id !== id) return false;
      if (ownerEmail && w.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return false;
      return true;
    });
    if (idx === -1) return null;
    worlds[idx] = {
      ...worlds[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    writeJSON('worlds.json', worlds);
    return worlds[idx];
  },

  deleteWorldSheet(id: string, ownerEmail?: string): boolean {
    let worlds = this.getWorldSheets();
    const initialLen = worlds.length;
    worlds = worlds.filter((w) => {
      if (w.id !== id) return true;
      if (ownerEmail && w.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) return true;
      return false;
    });
    if (worlds.length < initialLen) {
      writeJSON('worlds.json', worlds);
      return true;
    }
    return false;
  },

  closeRoom(code: string): boolean {
    const rooms = this.getRooms();
    const norm = code.trim().toUpperCase();
    if (rooms[norm]) {
      delete rooms[norm];
      this.saveRooms(rooms);
      return true;
    }
    return false;
  },

  // --- ROTATING 2-VERSION BACKUPS ---
  getBackups(): Record<string, PlayerRotatingBackup> {
    return readJSON<Record<string, PlayerRotatingBackup>>('backups.json', {});
  },

  addRotatingBackup(character: Character5e, ownerEmail: string, reason: 'join' | 'leave' | 'manual'): void {
    const backups = this.getBackups();
    const charId = character.id;
    let entry = backups[charId];

    if (!entry) {
      entry = {
        characterId: charId,
        ownerEmail: ownerEmail || 'jugador@weroll.app',
        characterName: character.name,
        slots: [],
        lastRotatedAt: Date.now(),
      };
    }

    const newSlot: RotatingBackupSlot = {
      timestamp: Date.now(),
      reason,
      snapshot: JSON.parse(JSON.stringify(character)),
    };

    // Keep strictly up to 2 rotating slots: if 2 exist, shift the older one out
    if (entry.slots.length >= 2) {
      entry.slots.shift();
    }
    entry.slots.push(newSlot);
    entry.characterName = character.name;
    entry.lastRotatedAt = Date.now();

    backups[charId] = entry;
    writeJSON('backups.json', backups);
  },

  // --- PERSISTENT HOST SETTINGS & CHANGELOG ---
  getHostSettings(): HostSettings {
    const defaultSettings: HostSettings = {
      headerTitle: 'WeRoll',
      headerSubtitle: 'Companion & DM Suite v0.1',
      headerLogoIcon: 'shield',
      aiModel: 'gemini-flash-lite-latest',
      moderatorPassword: 'admin',
      dmPassword: '',
      oracleWelcomeMessage:
        'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?',
      developerNotice: {
        enabled: true,
        title: 'WeRoll • Actualizaciones v0.1',
        content:
          'Bienvenido a WeRoll v0.1. Se ha implementado el Hub de partidas, salas con contraseña del DM, aprobación de usuarios, estados de actividad AFK, respaldos rotativos en servidor y borrador IA relacional.',
        version: '0.1',
      },
      changelog: [
        {
          version: '0.1',
          date: '2026-10-16',
          title: 'Lanzamiento WeRoll v0.1: Suite Completa & Bóveda de Servidor',
          changes: [
            'Hub visual de selección de World Sheets (DM) y Player Sheets (Jugador).',
            'Salas de juego protegidas por contraseña configurada por el DM.',
            'Sistema de registro de usuarios con preaprobación del Administrador.',
            'Monitoreo de actividad en 4 estados: Activo, Pausa, Pensando y AFK.',
            'Respaldos rotativos de 2 versiones por jugador en el servidor.',
            'Bóveda del servidor con descargas JSON individuales y respaldo total.',
            'Borrador IA relacional para vincular NPCs, lugares y monstruos.',
            'Manual SRD 5E completo con compendio de objetos y conjuros.',
          ],
        },
      ],
    };

    return readJSON<HostSettings>('settings.json', defaultSettings);
  },

  saveHostSettings(settings: HostSettings): void {
    writeJSON('settings.json', settings);
  },

  // --- FULL DATABASE BACKUP EXPORT ---
  getFullBackup(): object {
    return {
      exportedAt: new Date().toISOString(),
      platform: 'WeRoll 5E',
      users: this.getUsers().map((u) => ({ ...u, password: '[REDACTED]' })),
      rooms: this.getRooms(),
      sheets: this.getPlayerSheets(),
      worlds: this.getWorldSheets(),
      backups: this.getBackups(),
      settings: this.getHostSettings(),
    };
  },
};
