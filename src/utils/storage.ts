import { Character5e, DMWorkspace, HostSettings, UserRole } from '../types/dnd';
import { SAMPLE_CHARACTER, SAMPLE_DM_WORKSPACE } from '../data/srd';

const STORAGE_KEYS = {
  CHARACTERS: 'dnd_5e_characters_v2',
  ACTIVE_CHAR_ID: 'dnd_5e_active_character_id_v2',
  DM_WORKSPACE: 'dnd_5e_dm_workspace_v2',
  ROOM_CODE: 'dnd_5e_room_code_v2',
  HOST_SETTINGS: 'dnd_5e_host_settings_v2',
  UNLOCKED_CHARS: 'dnd_5e_unlocked_chars_session',
  DM_UNLOCKED: 'dnd_5e_dm_unlocked_session',
  USER_ROLE: 'dnd_5e_user_role_v1',
  AUTH_USER: 'dnd_5e_auth_user_v2',
  ACTIVE_WORLD_ID: 'dnd_5e_active_world_id_v2',
};

export const DEFAULT_HOST_SETTINGS: HostSettings = {
  apiKeyOverride: '',
  aiModel: 'gemini-2.5-flash',
  dmPassword: '',
  moderatorPassword: 'admin',
  headerTitle: 'WeRoll',
  headerSubtitle: 'Companion & DM Suite v0.1',
  headerLogoIcon: 'shield',
  developerNotice: {
    enabled: true,
    title: 'WeRoll • Actualizaciones v0.1',
    content: 'Bienvenido a WeRoll v0.1. Se ha implementado el sistema de roles protegidos (Jugador, DM, Moderador), carpetas jerárquicas hasta 3 niveles, objetos y conjuros para el DM con compendio genérico, mensaje en vivo del DM en la mesa y reinicio de combates.',
    version: '0.1',
  },
  oracleWelcomeMessage: 'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?',
  changelog: [
    {
      version: '0.1',
      date: '2026-10-15',
      title: 'Lanzamiento Inicial v0.1',
      changes: [
        'Autenticación por roles independientes: Jugador, Dungeon Master y Moderador.',
        'Carpetas jerárquicas de hasta 3 niveles (Raíz / Subcarpeta / Sub-subcarpeta) con filtrado acumulativo.',
        'Apartado de Objetos y Conjuros únicos para el DM con compendio genérico SRD.',
        'Mensaje en vivo del DM visible en la tarjeta de conectado para todos los jugadores.',
        'Bloc de notas de combate en tiempo real, tiradas automáticas con audio y botón de reinicio.',
        'Generador asistido con IA para rellenar huecos en monstruos, lugares y NPCs.',
        'Manual de usuario 5E completo con armas, armaduras, conjuros y reglas ampliadas.'
      ],
    },
  ],
  roleSwitchingAllowed: 'strict',
};

export function folderMatchesFilter(entityFolder: string | undefined, selectedFolder: string): boolean {
  if (selectedFolder === 'all') return true;
  const folder = entityFolder?.trim() || 'General';
  if (folder === selectedFolder) return true;
  if (folder.startsWith(`${selectedFolder} / `)) return true;
  return false;
}

export function getFolderDepth(folder: string): number {
  if (!folder) return 1;
  return folder.split(' / ').length;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
}

export function loadAuthUser(): AuthSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuthUser(user: AuthSessionUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  } catch {}
}

export function loadActiveWorldId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORLD_ID);
  } catch {
    return null;
  }
}

export function saveActiveWorldId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WORLD_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORLD_ID);
    }
  } catch {}
}

export function loadUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE) as UserRole | null;
    if (role === 'player' || role === 'dm' || role === 'both' || role === 'moderator' || role === 'admin') {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveUserRole(role: UserRole | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (role) {
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    }
  } catch (e) {
    console.error('Error saving user role:', e);
  }
}

export function loadCharacters(): Character5e[] {
  if (typeof window === 'undefined') return [SAMPLE_CHARACTER];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (!data) {
      saveCharacters([SAMPLE_CHARACTER]);
      return [SAMPLE_CHARACTER];
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [SAMPLE_CHARACTER];
  } catch (e) {
    console.error('Error loading characters from localStorage:', e);
    return [SAMPLE_CHARACTER];
  }
}

export function saveCharacters(characters: Character5e[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
  } catch (e) {
    console.error('Error saving characters to localStorage:', e);
  }
}

export function loadActiveCharacterId(): string {
  if (typeof window === 'undefined') return SAMPLE_CHARACTER.id;
  try {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAR_ID);
    return id || SAMPLE_CHARACTER.id;
  } catch {
    return SAMPLE_CHARACTER.id;
  }
}

export function saveActiveCharacterId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAR_ID, id);
  } catch (e) {
    console.error('Error saving active character ID:', e);
  }
}

export function loadDMWorkspace(): DMWorkspace {
  if (typeof window === 'undefined') return SAMPLE_DM_WORKSPACE;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DM_WORKSPACE);
    if (!data) {
      saveDMWorkspace(SAMPLE_DM_WORKSPACE);
      return SAMPLE_DM_WORKSPACE;
    }
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return SAMPLE_DM_WORKSPACE;
    return {
      ...SAMPLE_DM_WORKSPACE,
      ...parsed,
      npcs: Array.isArray(parsed.npcs) ? parsed.npcs : SAMPLE_DM_WORKSPACE.npcs,
      monsters: Array.isArray(parsed.monsters) ? parsed.monsters : SAMPLE_DM_WORKSPACE.monsters,
      locations: Array.isArray(parsed.locations) ? parsed.locations : SAMPLE_DM_WORKSPACE.locations,
      campaignLogs: Array.isArray(parsed.campaignLogs) ? parsed.campaignLogs : SAMPLE_DM_WORKSPACE.campaignLogs,
      combatSummaries: Array.isArray(parsed.combatSummaries) ? parsed.combatSummaries : (SAMPLE_DM_WORKSPACE.combatSummaries || []),
      customItemsAndSpells: Array.isArray(parsed.customItemsAndSpells) ? parsed.customItemsAndSpells : (SAMPLE_DM_WORKSPACE.customItemsAndSpells || []),
      dmLiveMessage: parsed.dmLiveMessage !== undefined ? parsed.dmLiveMessage : SAMPLE_DM_WORKSPACE.dmLiveMessage,
      folders: Array.isArray(parsed.folders) ? parsed.folders : SAMPLE_DM_WORKSPACE.folders,
      activeEncounter: {
        ...SAMPLE_DM_WORKSPACE.activeEncounter,
        ...(parsed.activeEncounter || {}),
        combatants: Array.isArray(parsed.activeEncounter?.combatants)
          ? parsed.activeEncounter.combatants
          : SAMPLE_DM_WORKSPACE.activeEncounter.combatants,
        combatLog: Array.isArray(parsed.activeEncounter?.combatLog)
          ? parsed.activeEncounter.combatLog
          : [],
      },
    };
  } catch (e) {
    console.error('Error loading DM workspace:', e);
    return SAMPLE_DM_WORKSPACE;
  }
}

export function saveDMWorkspace(workspace: DMWorkspace): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DM_WORKSPACE, JSON.stringify(workspace));
  } catch (e) {
    console.error('Error saving DM workspace:', e);
  }
}

export function loadHostSettings(): HostSettings {
  if (typeof window === 'undefined') return DEFAULT_HOST_SETTINGS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HOST_SETTINGS);
    if (!data) return DEFAULT_HOST_SETTINGS;
    return { ...DEFAULT_HOST_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_HOST_SETTINGS;
  }
}

export function saveHostSettings(settings: HostSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.HOST_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving host settings:', e);
  }
}

export function loadRoomCode(): string {
  if (typeof window === 'undefined') return 'MESA-DRAGON';
  try {
    return localStorage.getItem(STORAGE_KEYS.ROOM_CODE) || 'MESA-DRAGON';
  } catch {
    return 'MESA-DRAGON';
  }
}

export function saveRoomCode(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code.toUpperCase().trim());
  } catch (e) {
    console.error('Error saving room code:', e);
  }
}

// Session Unlocks
export function isCharacterUnlocked(charId: string, charPassword?: string): boolean {
  if (!charPassword || !charPassword.trim()) return true;
  if (typeof window === 'undefined') return true;
  try {
    const unlocked = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UNLOCKED_CHARS) || '[]');
    return unlocked.includes(charId);
  } catch {
    return false;
  }
}

export function setCharacterUnlocked(charId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const unlocked = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UNLOCKED_CHARS) || '[]');
    if (!unlocked.includes(charId)) {
      unlocked.push(charId);
      sessionStorage.setItem(STORAGE_KEYS.UNLOCKED_CHARS, JSON.stringify(unlocked));
    }
  } catch {}
}

export function isDMUnlocked(workspacePassword?: string): boolean {
  if (!workspacePassword || !workspacePassword.trim()) return true;
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(STORAGE_KEYS.DM_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setDMUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.DM_UNLOCKED, unlocked ? 'true' : 'false');
  } catch {}
}

export function exportBackupData(): string {
  const characters = loadCharacters();
  const dm = loadDMWorkspace();
  const room = loadRoomCode();
  const host = loadHostSettings();
  const payload = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    characters,
    dmWorkspace: dm,
    roomCode: room,
    hostSettings: { ...host, apiKeyOverride: undefined }, // Don't export secret API keys
  };
  return JSON.stringify(payload, null, 2);
}

export function importBackupData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.characters && Array.isArray(data.characters)) {
      saveCharacters(data.characters);
      if (data.characters[0]?.id) {
        saveActiveCharacterId(data.characters[0].id);
      }
    }
    if (data.dmWorkspace) {
      saveDMWorkspace(data.dmWorkspace);
    }
    if (data.roomCode) {
      saveRoomCode(data.roomCode);
    }
    return true;
  } catch (e) {
    console.error('Failed to import backup data:', e);
    return false;
  }
}
