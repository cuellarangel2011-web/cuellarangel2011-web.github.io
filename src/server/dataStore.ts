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

  updateUserRole(id: string, role: 'player' | 'dm' | 'both' | 'moderator'): UserAccount | null {
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
      headerSubtitle: 'Companion & DM Suite v0.4',
      headerLogoIcon: 'shield',
      aiModel: 'gemini-flash-lite-latest',
      moderatorPassword: 'admin',
      dmPassword: '',
      oracleWelcomeMessage:
        'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?',
      rejectionCustomMessage:
        'Lo lamentamos, por el momento no puedes acceder a WeRoll. Manda mensaje a soporte@weroll.app si quieres una revisión manual de tu caso.',
      adminGreeting: {
        enabled: true,
        title: 'Comunicado del Administrador',
        message:
          '¡Bienvenido a WeRoll 5E! El sistema ahora cuenta con sincronización global en tiempo real y bóveda segura en la nube.',
        type: 'info',
        updatedAt: Date.now(),
      },
      developerNotice: {
        enabled: true,
        title: 'WeRoll • Novedades v0.4',
        content:
          'Sincronización en tiempo real de credenciales maestras, modelo IA, avisos del administrador en Lobby y bóveda persistente en la nube.',
        version: '0.4',
      },
      changelog: [
        {
          version: '0.4',
          date: '2026-10-16',
          title: 'Sincronización Global en la Nube, Avisos de Mantenimiento & Flujo de Acceso',
          changes: [
            'Sincronización instantánea de credenciales maestras de administrador, modelo Gemini y API Key en todas las instancias.',
            'Saludo personalizado y avisos prioritarios del Administrador en el Lobby para anuncios y mantenimiento del servidor.',
            'Flujo de acceso renovado: Entrada directa con correo/contraseña y registro con selección de perfil de acceso.',
            'Persistencia automática en la nube de la gestión de cuentas, roles y bóveda de copias de seguridad.',
          ],
        },
        {
          version: '0.3',
          date: '2026-10-16',
          title: 'Portal Lobby Centralizado, Pantallas de DM (World Sheets) & Salas con Clave',
          changes: [
            'Portal Lobby inicial con segmentación estricta por cuenta de usuario y roles asignados.',
            'World Sheets independientes para el Dungeon Master con reinicio completo de carpetas y hasta 3 por cuenta.',
            'Botón de guardado en la nube y regreso al lobby tanto para el DM como para los jugadores.',
            'Mesas de juego con contraseña establecida por el DM que dejan de existir al cerrar partida.',
          ],
        },
        {
          version: '0.2',
          date: '2026-10-16',
          title: 'Bloc de Combate, Borrador IA Relacional & Compendio de Monstruos',
          changes: [
            'Control de iniciativa y combate en vivo con botón para reiniciar iniciativa y rondas.',
            'Borrador con Inteligencia Artificial relacional para vincular NPCs, lugares y enemigos.',
            'Edición dinámica de ataques cuerpo a cuerpo, a distancia y conjuros para monstruos SRD.',
            'Respaldos automáticos rotativos de 2 versiones por jugador en el servidor.',
          ],
        },
        {
          version: '0.1',
          date: '2026-10-16',
          title: 'Lanzamiento Inicial de WeRoll 5E Companion & DM Suite',
          changes: [
            'Fichas interactivas de personaje D&D 5E con tiradas de dados 3D y reglas SRD.',
            'Pantalla del Dungeon Master y asistente de Sabio Arcano con IA de Google Gemini.',
            'Bóveda del servidor para descargas y respaldos completos en formato JSON.',
          ],
        },
      ],
    };

    const current = readJSON<Partial<HostSettings>>('settings.json', defaultSettings);
    // Deep merge to ensure newly added properties (like adminGreeting and changelog updates) are populated
    const merged: HostSettings = {
      ...defaultSettings,
      ...current,
      developerNotice: {
        ...defaultSettings.developerNotice,
        ...(current.developerNotice || {}),
      },
      adminGreeting: current.adminGreeting ? {
        ...defaultSettings.adminGreeting,
        ...current.adminGreeting,
      } : defaultSettings.adminGreeting,
      changelog: (current.changelog && current.changelog.length > 0)
        ? current.changelog
        : defaultSettings.changelog,
    };
    return merged;
  },

  saveHostSettings(settings: Partial<HostSettings>): HostSettings {
    const current = this.getHostSettings();
    const merged: HostSettings = {
      ...current,
      ...settings,
      developerNotice: {
        ...current.developerNotice,
        ...(settings.developerNotice || {}),
      },
      adminGreeting: settings.adminGreeting
        ? {
            ...(current.adminGreeting || {
              enabled: true,
              title: 'Comunicado del Administrador',
              message: '',
              type: 'info',
            }),
            ...settings.adminGreeting,
          }
        : current.adminGreeting,
      changelog:
        settings.changelog !== undefined
          ? settings.changelog
          : current.changelog,
    };

    writeJSON('settings.json', merged);

    // Synchronize moderator user password in users.json so that any login as admin@weroll.app
    // (or any moderator) immediately uses the newly configured moderator password across all instances
    if (merged.moderatorPassword && merged.moderatorPassword.trim()) {
      const newPass = merged.moderatorPassword.trim();
      const users = this.getUsers();
      let changed = false;
      for (const u of users) {
        if (u.role === 'moderator' || u.email.toLowerCase() === 'admin@weroll.app') {
          if (u.password !== newPass) {
            u.password = newPass;
            changed = true;
          }
        }
      }
      if (changed) {
        this.saveUsers(users);
      }
    }

    return merged;
  },

  // --- CHANGELOG / UPDATES BLOG CRUD ---
  getChangelog(): ChangelogEntry[] {
    const settings = this.getHostSettings();
    return settings.changelog || [];
  },

  addChangelogEntry(entry: ChangelogEntry): ChangelogEntry[] {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    list.unshift(entry);
    settings.changelog = list;
    this.saveHostSettings(settings);
    return list;
  },

  updateChangelogEntry(index: number, updated: ChangelogEntry): ChangelogEntry[] | null {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    if (index < 0 || index >= list.length) return null;
    list[index] = updated;
    settings.changelog = list;
    this.saveHostSettings(settings);
    return list;
  },

  deleteChangelogEntry(index: number): ChangelogEntry[] | null {
    const settings = this.getHostSettings();
    const list = settings.changelog || [];
    if (index < 0 || index >= list.length) return null;
    list.splice(index, 1);
    settings.changelog = list;
    this.saveHostSettings(settings);
    return list;
  },

  // --- FULL DATABASE BACKUP EXPORT & RESTORE ---
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

  restoreBackup(payload: any): { success: boolean; type: string; count: number; message: string } {
    if (!payload || typeof payload !== 'object') {
      throw new Error('El archivo proporcionado no contiene un JSON válido.');
    }

    // Case 1: Full Database Backup Export
    if (payload.sheets || payload.worlds || payload.backups || payload.settings) {
      let restoredSheetsCount = 0;
      let restoredWorldsCount = 0;

      if (Array.isArray(payload.sheets)) {
        const currentSheets = this.getPlayerSheets();
        for (const s of payload.sheets) {
          if (s && s.id && s.character) {
            const idx = currentSheets.findIndex((item) => item.id === s.id);
            if (idx >= 0) currentSheets[idx] = s;
            else currentSheets.push(s);
            restoredSheetsCount++;
          }
        }
        writeJSON('sheets.json', currentSheets);
      }

      if (Array.isArray(payload.worlds)) {
        const currentWorlds = this.getWorldSheets();
        for (const w of payload.worlds) {
          if (w && w.id && w.workspace) {
            const idx = currentWorlds.findIndex((item) => item.id === w.id);
            if (idx >= 0) currentWorlds[idx] = w;
            else currentWorlds.push(w);
            restoredWorldsCount++;
          }
        }
        writeJSON('worlds.json', currentWorlds);
      }

      if (payload.backups && typeof payload.backups === 'object') {
        const currentBackups = this.getBackups();
        Object.assign(currentBackups, payload.backups);
        writeJSON('backups.json', currentBackups);
      }

      if (payload.settings && typeof payload.settings === 'object') {
        const currentSettings = this.getHostSettings();
        const mergedSettings = { ...currentSettings, ...payload.settings };
        this.saveHostSettings(mergedSettings);
      }

      return {
        success: true,
        type: 'full_database',
        count: restoredSheetsCount + restoredWorldsCount,
        message: `Respaldo total restaurado: ${restoredSheetsCount} fichas de jugador y ${restoredWorldsCount} World Sheets importados con éxito.`,
      };
    }

    // Case 2: Single Player Sheet
    if (payload.character && payload.character.id && payload.character.name) {
      this.savePlayerSheet({
        id: payload.id || payload.character.id,
        ownerEmail: payload.ownerEmail || 'jugador@weroll.app',
        name: payload.name || payload.character.name,
        character: payload.character,
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'player_sheet',
        count: 1,
        message: `Ficha de personaje "${payload.character.name}" restaurada con éxito en la bóveda.`,
      };
    }

    // Case 3: Raw Character5e object
    if (payload.name && payload.characterClass && (payload.currentHp !== undefined || payload.abilities)) {
      const charId = payload.id || `char-${Date.now()}`;
      this.savePlayerSheet({
        id: charId,
        ownerEmail: payload.ownerEmail || 'jugador@weroll.app',
        name: payload.name,
        character: { ...payload, id: charId },
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'player_sheet',
        count: 1,
        message: `Ficha de personaje "${payload.name}" importada exitosamente a la bóveda.`,
      };
    }

    // Case 4: Single World Sheet
    if (payload.workspace && (payload.name || payload.roomCode)) {
      const worldId = payload.id || `world-${Date.now()}`;
      this.saveWorldSheet({
        id: worldId,
        ownerEmail: payload.ownerEmail || 'dm@weroll.app',
        name: payload.name || 'Campaña Restaurada',
        description: payload.description,
        roomCode: (payload.roomCode || 'MESA-RESTAURADA').toUpperCase(),
        roomPassword: payload.roomPassword,
        workspace: payload.workspace,
        updatedAt: Date.now(),
      });
      return {
        success: true,
        type: 'world_sheet',
        count: 1,
        message: `World Sheet "${payload.name || 'Campaña Restaurada'}" restaurado con éxito en la bóveda.`,
      };
    }

    throw new Error('El formato JSON no corresponde a un respaldo válido de WeRoll (Respaldo Total, Ficha de Jugador o World Sheet).');
  },
};
