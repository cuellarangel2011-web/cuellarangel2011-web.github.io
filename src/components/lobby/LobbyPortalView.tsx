import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Users,
  Crown,
  KeyRound,
  Lock,
  Unlock,
  Plus,
  Play,
  Edit,
  Trash2,
  Settings,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  AlertCircle,
  Clock,
  Sparkles,
  BookOpen,
  Folder,
  CheckCircle,
  HelpCircle,
  Check,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import {
  Character5e,
  DMWorkspace,
  HostSettings,
  UserRole,
  WorldSheetSummary,
} from '../../types/dnd';
import { AuthSessionUser } from '../auth/RoleSelectionModal';
import { SAMPLE_CHARACTER, SAMPLE_DM_WORKSPACE } from '../../data/srd';

interface LobbyPortalViewProps {
  authUser: AuthSessionUser | null;
  hostSettings: HostSettings;
  onLogout: () => void;
  onOpenAuthModal: () => void;
  onOpenChangelog: () => void;
  onSelectCharacterToPlay: (character: Character5e, roomCode: string) => void;
  onEditCharacterSolo: (character: Character5e) => void;
  onDeleteCharacter: (characterId: string) => Promise<boolean>;
  onCreateNewCharacter: () => void;
  worldSheets: WorldSheetSummary[];
  onOpenWorldSheet: (world: WorldSheetSummary) => void;
  onCreateWorldSheet: (config: { name: string; roomCode: string; roomPassword?: string }) => Promise<void>;
  onUpdateWorldSheetConfig: (worldId: string, updates: { name: string; roomCode: string; roomPassword?: string }) => Promise<void>;
  onDeleteWorldSheet: (worldId: string) => Promise<void>;
  onSaveHostSettings: (settings: HostSettings) => Promise<void>;
  onRefreshAuthStatus: () => Promise<void>;
}

export const LobbyPortalView: React.FC<LobbyPortalViewProps> = ({
  authUser,
  hostSettings,
  onLogout,
  onOpenAuthModal,
  onOpenChangelog,
  onSelectCharacterToPlay,
  onEditCharacterSolo,
  onDeleteCharacter,
  onCreateNewCharacter,
  worldSheets,
  onOpenWorldSheet,
  onCreateWorldSheet,
  onUpdateWorldSheetConfig,
  onDeleteWorldSheet,
  onSaveHostSettings,
  onRefreshAuthStatus,
}) => {
  // Determine available tabs based on user role
  const isModerator = authUser?.role === 'moderator';
  const canPlay = authUser?.role === 'player' || authUser?.role === 'both' || isModerator;
  const canDm = authUser?.role === 'dm' || authUser?.role === 'both' || isModerator;

  const defaultTab = canPlay ? 'characters' : canDm ? 'worlds' : 'characters';
  const [activeTab, setActiveTab] = useState<'characters' | 'worlds' | 'admin'>(defaultTab);

  // Sync tab if role changes
  useEffect(() => {
    if (activeTab === 'admin' && !isModerator) {
      setActiveTab(canPlay ? 'characters' : 'worlds');
    } else if (activeTab === 'characters' && !canPlay) {
      setActiveTab('worlds');
    } else if (activeTab === 'worlds' && !canDm) {
      setActiveTab('characters');
    }
  }, [authUser?.role, isModerator, canPlay, canDm]);

  // Player Join Table Modal state
  const [joinModalChar, setJoinModalChar] = useState<Character5e | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState<string>('MESA-DRAGON');
  const [joinPassword, setJoinPassword] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');
  const [isVerifyingJoin, setIsVerifyingJoin] = useState<boolean>(false);

  // Create World Sheet Modal state
  const [isCreateWorldOpen, setIsCreateWorldOpen] = useState<boolean>(false);
  const [newWorldName, setNewWorldName] = useState<string>('');
  const [newWorldRoomCode, setNewWorldRoomCode] = useState<string>('MESA-1');
  const [newWorldPassword, setNewWorldPassword] = useState<string>('');
  const [worldCreateError, setWorldCreateError] = useState<string>('');
  const [isSavingWorld, setIsSavingWorld] = useState<boolean>(false);

  // Edit World Sheet Modal state
  const [editingWorld, setEditingWorld] = useState<WorldSheetSummary | null>(null);
  const [editWorldName, setEditWorldName] = useState<string>('');
  const [editWorldRoomCode, setEditWorldRoomCode] = useState<string>('');
  const [editWorldPassword, setEditWorldPassword] = useState<string>('');

  // Delete confirmations
  const [charToDelete, setCharToDelete] = useState<Character5e | null>(null);
  const [worldToDelete, setWorldToDelete] = useState<WorldSheetSummary | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [adminSettingsForm, setAdminSettingsForm] = useState<HostSettings>(hostSettings);
  const [adminSaveMessage, setAdminSaveMessage] = useState<string>('');

  // Player Characters filtered by account
  const [playerSheets, setPlayerSheets] = useState<Character5e[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState<boolean>(false);

  // Fetch player sheets for this user from server vault
  const fetchUserSheets = async () => {
    if (!authUser?.email) return;
    setIsLoadingSheets(true);
    try {
      const res = await fetch(`/api/vault/sheets?ownerEmail=${encodeURIComponent(authUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sheets)) {
          setPlayerSheets(data.sheets.map((s: any) => s.character));
        }
      }
    } catch (err) {
      console.error('Error fetching sheets:', err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // Fetch registered users for admin
  const fetchAdminUsers = async () => {
    if (!isModerator) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading admin users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (authUser && authUser.status === 'approved') {
      fetchUserSheets();
    }
    if (isModerator && activeTab === 'admin') {
      fetchAdminUsers();
    }
  }, [authUser?.email, authUser?.status, activeTab, isModerator]);

  // Handle Join Table validation
  const handleJoinTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinRoomCode.trim()) {
      setJoinError('Por favor ingresa el nombre o código de la mesa.');
      return;
    }
    if (!joinModalChar) return;

    setIsVerifyingJoin(true);
    try {
      const res = await fetch('/api/rooms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: joinRoomCode.trim().toUpperCase(),
          password: joinPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setJoinError(data.error || 'No se pudo conectar a la mesa. Verifica el código o contraseña.');
        return;
      }

      // Successful verification -> Launch player sheet inside active table!
      const char = joinModalChar;
      setJoinModalChar(null);
      onSelectCharacterToPlay(char, joinRoomCode.trim().toUpperCase());
    } catch (err) {
      setJoinError('Error al contactar con el servidor de la mesa.');
    } finally {
      setIsVerifyingJoin(false);
    }
  };

  // Handle Create World Sheet
  const handleCreateWorldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorldCreateError('');
    if (!newWorldName.trim()) {
      setWorldCreateError('Por favor asigna un nombre al World Sheet.');
      return;
    }
    if (!newWorldRoomCode.trim()) {
      setWorldCreateError('El código o nombre de la mesa es requerido.');
      return;
    }

    if (worldSheets.length >= 3) {
      setWorldCreateError('Límite alcanzado: máximo 3 World Sheets por cuenta.');
      return;
    }

    setIsSavingWorld(true);
    try {
      await onCreateWorldSheet({
        name: newWorldName.trim(),
        roomCode: newWorldRoomCode.trim().toUpperCase(),
        roomPassword: newWorldPassword.trim() || undefined,
      });
      setIsCreateWorldOpen(false);
      setNewWorldName('');
      setNewWorldRoomCode('MESA-1');
      setNewWorldPassword('');
    } catch (err: any) {
      setWorldCreateError(err.message || 'Error al crear World Sheet.');
    } finally {
      setIsSavingWorld(false);
    }
  };

  // Handle Update World Sheet Config
  const handleUpdateWorldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorld) return;
    try {
      await onUpdateWorldSheetConfig(editingWorld.id, {
        name: editWorldName.trim() || editingWorld.name,
        roomCode: editWorldRoomCode.trim().toUpperCase() || editingWorld.roomCode,
        roomPassword: editWorldPassword.trim() || undefined,
      });
      setEditingWorld(null);
    } catch (err) {
      console.error('Error updating world:', err);
    }
  };

  // Admin user approval toggle
  const handleAdminApproveUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchAdminUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminRejectUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchAdminUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSaveMessage('');
    try {
      await onSaveHostSettings(adminSettingsForm);
      setAdminSaveMessage('¡Ajustes guardados con éxito en el servidor!');
      setTimeout(() => setAdminSaveMessage(''), 4000);
    } catch (e) {
      setAdminSaveMessage('Error al guardar ajustes.');
    }
  };

  // ==========================================
  // VIEW: NOT LOGGED IN / GUEST SCREEN
  // ==========================================
  if (!authUser) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-xl w-full bg-[#16171d] border-2 border-amber-900/60 rounded-3xl p-8 sm:p-10 shadow-2xl text-center relative overflow-hidden animate-in fade-in zoom-in-95">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-purple-600 to-amber-600" />

          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500/80 shadow-xl text-amber-200 mb-6">
            <Shield className="w-10 h-10" />
          </div>

          <h1 className="font-cinzel font-black text-3xl sm:text-4xl text-amber-300 tracking-wider">
            {hostSettings.headerTitle || 'WeRoll 5E'}
          </h1>
          <p className="text-xs text-stone-400 mt-2 uppercase tracking-widest font-cinzel">
            {hostSettings.headerSubtitle || 'Companion & DM Suite v0.1'}
          </p>

          <p className="text-sm text-stone-300 mt-6 leading-relaxed max-w-md mx-auto">
            Bienvenido al portal de aventuras. Para crear, editar y gestionar tus hojas de personaje
            o las pantallas de campaña del Dungeon Master, inicia sesión con tu cuenta o regístrate.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              Iniciar Sesión / Registrarse
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-stone-800 flex items-center justify-center gap-4 text-xs text-stone-400">
            <button
              onClick={onOpenChangelog}
              className="hover:text-amber-300 flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Novedades de la versión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: PENDING APPROVAL SCREEN
  // ==========================================
  if (authUser.status === 'pending') {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-[#181920] border-2 border-amber-700/60 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden animate-in fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-500/80 text-amber-300 mb-5 shadow-lg">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <span className="px-3 py-1 rounded-full text-[11px] font-cinzel font-bold tracking-wider bg-amber-950 border border-amber-600/70 text-amber-300 uppercase">
            Cuenta en Espera de Aprobación
          </span>

          <h2 className="font-cinzel font-black text-2xl text-stone-100 mt-4">
            ¡Hola, {authUser.displayName}!
          </h2>

          <p className="text-xs text-stone-300 mt-3 leading-relaxed">
            Tu cuenta registrada con el correo <span className="text-amber-300 font-mono font-semibold">{authUser.email}</span>{' '}
            y perfil de <strong className="text-amber-200 capitalize">{authUser.role === 'both' ? 'Jugador y Dungeon Master' : authUser.role === 'dm' ? 'Dungeon Master' : 'Jugador'}</strong> ha sido registrada exitosamente.
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-[#121316] border border-amber-900/50 text-left text-xs text-stone-300 space-y-2">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Por motivos de seguridad de las mesas, el Administrador debe aprobar tu cuenta antes de permitir la creación de fichas y partidas.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Una vez aprobada, podrás acceder a tus personajes o pantallas de DM automáticamente.</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onRefreshAuthStatus}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Comprobar si ya fui aprobado
            </button>
            <button
              onClick={onLogout}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-cinzel text-xs transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: APPROVED USER LOBBY PORTAL
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 animate-in fade-in">
      {/* Lobby Top Banner: Welcome, User Badge & Changelog */}
      <div className="bg-gradient-to-r from-[#171821] via-[#1c1d29] to-[#171821] border border-amber-900/60 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500/80 shadow-lg flex items-center justify-center text-amber-200 shrink-0">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-cinzel font-black text-2xl text-amber-300 tracking-wide">
                {hostSettings.headerTitle || 'WeRoll 5E'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950 border border-amber-700 text-amber-300">
                {hostSettings.headerSubtitle || 'Suite v0.1'}
              </span>
              <button
                onClick={onOpenChangelog}
                title="Ver novedades de la versión"
                className="px-2.5 py-1 rounded-xl bg-stone-800/80 hover:bg-amber-950 hover:border-amber-600/60 border border-stone-700 text-stone-300 text-xs font-cinzel transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Updates
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Bienvenido, <strong className="text-stone-200">{authUser.displayName}</strong> ({authUser.email})
            </p>
          </div>
        </div>

        {/* User Role Badge & Logout */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#121316] border border-stone-800 flex items-center gap-2">
            {authUser.role === 'moderator' ? (
              <Crown className="w-4 h-4 text-blue-400" />
            ) : authUser.role === 'dm' ? (
              <Crown className="w-4 h-4 text-purple-400" />
            ) : authUser.role === 'both' ? (
              <Sparkles className="w-4 h-4 text-amber-400" />
            ) : (
              <User className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-xs font-cinzel font-bold text-stone-200 uppercase">
              {authUser.role === 'moderator'
                ? 'Administrador'
                : authUser.role === 'both'
                ? 'Jugador & DM'
                : authUser.role === 'dm'
                ? 'Dungeon Master'
                : 'Jugador'}
            </span>
          </div>

          <button
            onClick={onLogout}
            title="Cerrar Sesión"
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lobby Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-stone-800 pb-2">
        {canPlay && (
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-5 py-2.5 rounded-2xl font-cinzel font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'characters'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <User className="w-4 h-4" />
            Fichas de Jugador ({playerSheets.length}/3)
          </button>
        )}

        {canDm && (
          <button
            onClick={() => setActiveTab('worlds')}
            className={`px-5 py-2.5 rounded-2xl font-cinzel font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'worlds'
                ? 'bg-purple-700 text-white shadow-lg shadow-purple-950/50'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            World Sheets del DM ({worldSheets.length}/3)
          </button>
        )}

        {isModerator && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-5 py-2.5 rounded-2xl font-cinzel font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ml-auto ${
              activeTab === 'admin'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50'
                : 'bg-stone-900 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-blue-900/50'
            }`}
          >
            <Settings className="w-4 h-4 text-blue-300" />
            Panel de Administrador
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: PLAYER SHEETS (FICHAS DE JUGADOR)                            */}
      {/* =================================================================== */}
      {activeTab === 'characters' && canPlay && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-cinzel font-bold text-xl text-stone-100 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                Mis Personajes
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Selecciona un personaje para unirte a una mesa en vivo, o edita su hoja en solitario. Máximo 3 personajes por cuenta.
              </p>
            </div>

            <button
              onClick={onCreateNewCharacter}
              disabled={playerSheets.length >= 3}
              className={`px-5 py-2.5 rounded-2xl font-cinzel font-bold text-xs flex items-center gap-2 transition shadow-lg ${
                playerSheets.length >= 3
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Crear Nuevo Personaje ({playerSheets.length}/3)
            </button>
          </div>

          {playerSheets.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#14151b] border-2 border-dashed border-stone-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/50 border border-amber-900 text-amber-400 flex items-center justify-center mx-auto">
                <User className="w-7 h-7" />
              </div>
              <h3 className="font-cinzel font-bold text-lg text-stone-200">
                Aún no tienes personajes registrados
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
                Crea tu primera ficha de personaje para comenzar a jugar y unirte a las partidas que organice tu Dungeon Master.
              </p>
              <button
                onClick={onCreateNewCharacter}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Mi Primer Personaje
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playerSheets.map((char) => (
                <div
                  key={char.id}
                  className="bg-[#181922] border border-amber-900/50 hover:border-amber-600/70 rounded-3xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Name & Class */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-cinzel font-bold text-lg text-amber-300 group-hover:text-amber-200 transition">
                          {char.name}
                        </h3>
                        <p className="text-xs text-stone-400">
                          {char.race} • {char.characterClass} Nivel {char.level}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-700/60 font-mono font-bold text-xs text-amber-300">
                        Nv. {char.level}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-stone-800 text-center">
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">Puntos Golpe</span>
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {char.currentHp} / {char.maxHp}
                        </span>
                      </div>
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">Armadura</span>
                        <span className="font-mono font-bold text-sm text-blue-400">
                          CA {char.armorClass}
                        </span>
                      </div>
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">Iniciativa</span>
                        <span className="font-mono font-bold text-sm text-amber-400">
                          {char.initiativeBonus >= 0 ? `+${char.initiativeBonus}` : char.initiativeBonus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setJoinModalChar(char);
                        setJoinError('');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Entrar a Mesa
                    </button>

                    <button
                      onClick={() => onEditCharacterSolo(char)}
                      title="Editar ficha en solitario (sin mesa)"
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setCharToDelete(char)}
                      title="Eliminar personaje"
                      className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: WORLD SHEETS (PANTALLAS DEL DUNGEON MASTER)                  */}
      {/* =================================================================== */}
      {activeTab === 'worlds' && canDm && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-cinzel font-bold text-xl text-stone-100 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-400" />
                Mis World Sheets (Pantallas de DM)
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Cada World Sheet es una pantalla completa e independiente del DM (NPCs, mapas, monstruos, diario y combates). Máximo 3 por cuenta.
              </p>
            </div>

            <button
              onClick={() => {
                setIsCreateWorldOpen(true);
                setWorldCreateError('');
              }}
              disabled={worldSheets.length >= 3}
              className={`px-5 py-2.5 rounded-2xl font-cinzel font-bold text-xs flex items-center gap-2 transition shadow-lg ${
                worldSheets.length >= 3
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                  : 'bg-purple-700 hover:bg-purple-600 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Crear World Sheet ({worldSheets.length}/3)
            </button>
          </div>

          {worldSheets.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#14151b] border-2 border-dashed border-stone-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-950/50 border border-purple-900 text-purple-400 flex items-center justify-center mx-auto">
                <Crown className="w-7 h-7" />
              </div>
              <h3 className="font-cinzel font-bold text-lg text-stone-200">
                Aún no tienes World Sheets creados
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
                Crea tu primera pantalla de Dungeon Master para comenzar una campaña con tus propias carpetas, monstruos, NPCs y lugares desde cero.
              </p>
              <button
                onClick={() => setIsCreateWorldOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-cinzel font-bold text-xs shadow-lg transition inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear Mi Primer World Sheet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {worldSheets.map((world) => (
                <div
                  key={world.id}
                  className="bg-[#191924] border border-purple-900/50 hover:border-purple-600/70 rounded-3xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: World Title & Room Code */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-cinzel font-bold text-lg text-purple-300 group-hover:text-purple-200 transition">
                          {world.name}
                        </h3>
                        <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-0.5">
                          <span>Mesa:</span>
                          <span className="font-mono font-bold text-amber-300 bg-[#121316] px-2 py-0.5 rounded border border-stone-800">
                            {world.roomCode}
                          </span>
                        </p>
                      </div>

                      {world.roomPassword ? (
                        <span title="Mesa con contraseña requerida" className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span title="Mesa de acceso libre" className="p-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-400">
                          <Unlock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Entities Counts */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-stone-800/80 text-center my-3">
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">NPCs</span>
                        <span className="font-mono font-bold text-xs text-stone-200">
                          {world.workspace?.npcs?.length || 0}
                        </span>
                      </div>
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">Monstruos</span>
                        <span className="font-mono font-bold text-xs text-stone-200">
                          {world.workspace?.monsters?.length || 0}
                        </span>
                      </div>
                      <div className="bg-[#121316] rounded-xl p-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-cinzel">Lugares</span>
                        <span className="font-mono font-bold text-xs text-stone-200">
                          {world.workspace?.locations?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onOpenWorldSheet(world)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-cinzel font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Abrir Mesa de DM
                    </button>

                    <button
                      onClick={() => {
                        setEditingWorld(world);
                        setEditWorldName(world.name);
                        setEditWorldRoomCode(world.roomCode);
                        setEditWorldPassword(world.roomPassword || '');
                      }}
                      title="Editar configuración de la mesa"
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setWorldToDelete(world)}
                      title="Eliminar World Sheet"
                      className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ADMIN PANEL (SOLO MODERADOR / ADMINISTRADOR)                  */}
      {/* =================================================================== */}
      {activeTab === 'admin' && isModerator && (
        <div className="space-y-8 animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div>
              <h2 className="font-cinzel font-bold text-xl text-blue-300 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Panel de Control de Administrador
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Gestión de cuentas de usuario, bóveda de copias de seguridad de la base de datos y configuración del servidor.
              </p>
            </div>

            <a
              href="/api/vault/backup-all"
              download
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar Respaldo Total (JSON)
            </a>
          </div>

          {/* Section A: User Management & Approvals */}
          <div className="bg-[#161720] border border-stone-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-cinzel font-bold text-base text-stone-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Usuarios Registrados en el Servidor
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Aprueba o rechaza solicitudes de nuevos jugadores y Dungeon Masters.
                </p>
              </div>

              <button
                onClick={fetchAdminUsers}
                disabled={isLoadingUsers}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-cinzel transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                Actualizar Lista
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-500 font-cinzel">
                    <th className="py-2.5 px-3">Nombre</th>
                    <th className="py-2.5 px-3">Correo</th>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {adminUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-800/30">
                      <td className="py-2.5 px-3 font-semibold text-stone-200">{u.displayName}</td>
                      <td className="py-2.5 px-3 font-mono text-stone-400">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-cinzel font-bold bg-[#121316] border border-stone-700 text-stone-300 uppercase">
                          {u.role === 'both' ? 'DM & Jugador' : u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.status === 'approved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : u.status === 'pending'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {u.status === 'approved' ? 'Aprobado' : u.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        {u.status !== 'approved' && (
                          <button
                            onClick={() => handleAdminApproveUser(u.id)}
                            className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-cinzel font-bold text-[10px] transition"
                          >
                            Aprobar
                          </button>
                        )}
                        {u.status !== 'rejected' && u.role !== 'moderator' && (
                          <button
                            onClick={() => handleAdminRejectUser(u.id)}
                            className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-cinzel font-bold text-[10px] transition"
                          >
                            Rechazar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Server Settings & AI Configuration */}
          <form onSubmit={handleAdminSaveSettings} className="bg-[#161720] border border-stone-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="font-cinzel font-bold text-base text-stone-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-400" />
                Configuración del Servidor y Modelos IA
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Personaliza títulos, modelo Gemini para el Sabio Arcano y anuncios para los usuarios.
              </p>
            </div>

            {adminSaveMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs">
                {adminSaveMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Título de la Aplicación
                </label>
                <input
                  type="text"
                  value={adminSettingsForm.headerTitle || ''}
                  onChange={(e) => setAdminSettingsForm({ ...adminSettingsForm, headerTitle: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Subtítulo / Versión
                </label>
                <input
                  type="text"
                  value={adminSettingsForm.headerSubtitle || ''}
                  onChange={(e) => setAdminSettingsForm({ ...adminSettingsForm, headerSubtitle: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Modelo Gemini (IA)
                </label>
                <select
                  value={adminSettingsForm.aiModel || 'gemini-2.5-flash'}
                  onChange={(e) => setAdminSettingsForm({ ...adminSettingsForm, aiModel: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs outline-none focus:border-blue-500"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rápido y recomendado)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Razonamiento profundo)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Gemini API Key (Opcional - Servidor usa env por defecto)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={adminSettingsForm.apiKeyOverride || ''}
                  onChange={(e) => setAdminSettingsForm({ ...adminSettingsForm, apiKeyOverride: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs font-mono outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Saludo Personalizado del Sabio Arcano
              </label>
              <textarea
                rows={2}
                value={adminSettingsForm.oracleWelcomeMessage || ''}
                onChange={(e) => setAdminSettingsForm({ ...adminSettingsForm, oracleWelcomeMessage: e.target.value })}
                className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3 py-2 text-stone-200 text-xs outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-cinzel font-bold text-xs shadow-lg transition"
              >
                Guardar Configuración en el Servidor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: JOIN TABLE AS PLAYER                                         */}
      {/* =================================================================== */}
      {joinModalChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181922] border-2 border-amber-900/80 rounded-3xl p-6 shadow-2xl text-stone-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-500 flex items-center justify-center text-amber-300">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-cinzel font-bold text-lg text-amber-300">
                    Entrar a Mesa en Vivo
                  </h3>
                  <p className="text-xs text-stone-400">
                    Personaje: <strong className="text-stone-200">{joinModalChar.name}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setJoinModalChar(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1.5">
                  Nombre o Código de la Mesa del DM
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: MESA-DRAGON"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 font-mono text-sm uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1.5">
                  Contraseña de la Mesa (Si el DM la configuró)
                </label>
                <input
                  type="password"
                  placeholder="Contraseña establecida por el DM..."
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-[11px] text-stone-400 leading-relaxed">
                ℹ️ Si el Dungeon Master no ha abierto aún la mesa o la contraseña no coincide, no podrás entrar.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinModalChar(null)}
                  className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isVerifyingJoin}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isVerifyingJoin ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Entrar a la Partida'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE WORLD SHEET                                           */}
      {/* =================================================================== */}
      {isCreateWorldOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181924] border-2 border-purple-900/80 rounded-3xl p-6 shadow-2xl text-stone-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-700/30 border border-purple-500 flex items-center justify-center text-purple-300">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-cinzel font-bold text-lg text-purple-300">
                    Nuevo World Sheet de DM
                  </h3>
                  <p className="text-xs text-stone-400">
                    Nueva pantalla de campaña independiente desde cero.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateWorldOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {worldCreateError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs">
                {worldCreateError}
              </div>
            )}

            <form onSubmit={handleCreateWorldSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Nombre del World Sheet
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Campaña de la Costa de la Espada"
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Código o Nombre de la Mesa para Jugadores
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: MESA-DRAGON"
                  value={newWorldRoomCode}
                  onChange={(e) => setNewWorldRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#121316] border border-stone-700 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-stone-100 font-mono text-sm uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Contraseña de la Mesa (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Dejar en blanco para acceso público"
                  value={newWorldPassword}
                  onChange={(e) => setNewWorldPassword(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#121316] border border-stone-800 text-[11px] text-stone-400 leading-relaxed">
                ✨ <strong>Lienzo Limpio:</strong> Las carpetas, NPCs, monstruos y lugares comenzarán desde cero para esta campaña, con acceso al compendio genérico SRD.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateWorldOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingWorld}
                  className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-cinzel font-bold text-xs shadow-lg transition"
                >
                  {isSavingWorld ? 'Creando...' : 'Crear World Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT WORLD SHEET CONFIG                                      */}
      {/* =================================================================== */}
      {editingWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181924] border-2 border-purple-900/80 rounded-3xl p-6 shadow-2xl text-stone-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-cinzel font-bold text-lg text-purple-300">
                  Editar Configuración de Mesa
                </h3>
                <p className="text-xs text-stone-400">
                  Actualiza el nombre, código o contraseña de acceso.
                </p>
              </div>

              <button
                onClick={() => setEditingWorld(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWorldSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Nombre del World Sheet
                </label>
                <input
                  type="text"
                  required
                  value={editWorldName}
                  onChange={(e) => setEditWorldName(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Código de la Mesa
                </label>
                <input
                  type="text"
                  required
                  value={editWorldRoomCode}
                  onChange={(e) => setEditWorldRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-100 font-mono text-sm uppercase outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                  Contraseña de la Mesa
                </label>
                <input
                  type="text"
                  placeholder="Sin contraseña (pública)"
                  value={editWorldPassword}
                  onChange={(e) => setEditWorldPassword(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWorld(null)}
                  className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-cinzel font-bold text-xs shadow-lg transition"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION: DELETE CHARACTER                                      */}
      {/* =================================================================== */}
      {charToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#181922] border-2 border-red-900/80 rounded-3xl p-6 shadow-2xl text-stone-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-cinzel font-bold text-lg text-red-300">
              ¿Eliminar Personaje?
            </h3>
            <p className="text-xs text-stone-400 mt-2 leading-relaxed">
              Estás a punto de eliminar a <strong className="text-stone-200">{charToDelete.name}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setCharToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const id = charToDelete.id;
                  setCharToDelete(null);
                  await onDeleteCharacter(id);
                  fetchUserSheets();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-cinzel font-bold text-xs shadow-lg transition"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONFIRMATION: DELETE WORLD SHEET                                    */}
      {/* =================================================================== */}
      {worldToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#191924] border-2 border-red-900/80 rounded-3xl p-6 shadow-2xl text-stone-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-cinzel font-bold text-lg text-red-300">
              ¿Eliminar World Sheet?
            </h3>
            <p className="text-xs text-stone-400 mt-2 leading-relaxed">
              Estás a punto de eliminar <strong className="text-stone-200">{worldToDelete.name}</strong>. Se perderán todos sus NPCs, monstruos y notas.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setWorldToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const id = worldToDelete.id;
                  setWorldToDelete(null);
                  await onDeleteWorldSheet(id);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-cinzel font-bold text-xs shadow-lg transition"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
