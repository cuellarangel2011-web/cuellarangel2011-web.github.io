import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  User,
  Users,
  Dices,
  BookOpen,
  Sparkles,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Folder,
  Radio,
  FileText,
  HelpCircle,
  Settings,
  KeyRound,
  Crown,
  Lock,
  Unlock,
  Flame,
  CheckCircle,
  X,
  Layers,
} from 'lucide-react';
import {
  Character5e,
  DMWorkspace,
  DiceRollResult,
  RollMode,
  UserRole,
  HostSettings,
  InventoryItem,
} from './types/dnd';
import {
  loadCharacters,
  saveCharacters,
  loadActiveCharacterId,
  saveActiveCharacterId,
  loadDMWorkspace,
  saveDMWorkspace,
  loadRoomCode,
  saveRoomCode,
  loadUserRole,
  saveUserRole,
  loadHostSettings,
  saveHostSettings,
  isCharacterUnlocked,
  setCharacterUnlocked,
  isDMUnlocked,
  setDMUnlocked,
  exportBackupData,
  importBackupData,
} from './utils/storage';
import { CharacterSheetView } from './components/character/CharacterSheetView';
import { CharacterCreatorModal } from './components/character/CharacterCreatorModal';
import { DMScreenView } from './components/dm/DMScreenView';
import { DiceRollerModal } from './components/dice/DiceRollerModal';
import { QuickDiceBar } from './components/dice/QuickDiceBar';
import { RulesCompendiumModal } from './components/rules/RulesCompendiumModal';
import { ArcaneOracleModal } from './components/ai/ArcaneOracleModal';
import { PartySessionBar } from './components/session/PartySessionBar';
import { LiveRollFeedModal } from './components/session/LiveRollFeedModal';
import { RoleSelectionModal } from './components/auth/RoleSelectionModal';
import { PasswordPromptModal } from './components/auth/PasswordPromptModal';
import { HostSettingsModal } from './components/host/HostSettingsModal';
import { ChangelogModal } from './components/host/ChangelogModal';
import { calculateProficiencyBonus, calculatePassivePerception } from './utils/dnd-math';

export default function App() {
  // User Role & Mode state
  const [userRole, setUserRole] = useState<UserRole>(() => loadUserRole() || 'player');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(() => !loadUserRole());
  const [appMode, setAppMode] = useState<'player' | 'dm'>(() => {
    const saved = loadUserRole();
    return saved === 'dm' ? 'dm' : 'player';
  });

  // Host Settings
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => loadHostSettings());
  const [isHostSettingsOpen, setIsHostSettingsOpen] = useState<boolean>(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);
  const [dismissedDevNotice, setDismissedDevNotice] = useState<boolean>(false);

  // Persistence State
  const [characters, setCharacters] = useState<Character5e[]>(() => loadCharacters());
  const [activeCharId, setActiveCharId] = useState<string>(() => loadActiveCharacterId());
  const [dmWorkspace, setDmWorkspace] = useState<DMWorkspace>(() => loadDMWorkspace());
  const [roomCode, setRoomCode] = useState<string>(() => loadRoomCode());
  const [unlockedTick, setUnlockedTick] = useState<number>(0);

  // Password Prompt Modal State
  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    expectedPassword?: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {},
  });

  // Active Character
  const activeCharacter = characters.find((c) => c.id === activeCharId) || characters[0];

  // Modals
  const [isCreatorOpen, setIsCreatorOpen] = useState<boolean>(false);
  const [isCompendiumOpen, setIsCompendiumOpen] = useState<boolean>(false);
  const [isOracleOpen, setIsOracleOpen] = useState<boolean>(false);
  const [oracleInitialPrompt, setOracleInitialPrompt] = useState<string>('');
  const [isRollFeedOpen, setIsRollFeedOpen] = useState<boolean>(false);

  // Dice Roller State
  const [isRollerOpen, setIsRollerOpen] = useState<boolean>(false);
  const [rollerTitle, setRollerTitle] = useState<string>('Tirada General');
  const [rollerMod, setRollerMod] = useState<number>(0);
  const [rollerSides, setRollerSides] = useState<number>(20);
  const [rollerMode, setRollerMode] = useState<RollMode>('normal');
  const [recentRoll, setRecentRoll] = useState<DiceRollResult | null>(null);

  // Multiplayer Live Session State
  const [partyMembers, setPartyMembers] = useState<any[]>([]);
  const [rollFeed, setRollFeed] = useState<DiceRollResult[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<{ title: string; content: string } | null>(null);
  const [serverDmConnected, setServerDmConnected] = useState<boolean>(false);
  const [serverDmLiveMessage, setServerDmLiveMessage] = useState<string>('');
  const [serverDmLastRoll, setServerDmLastRoll] = useState<DiceRollResult | undefined>(undefined);

  // Broadcast channel for instantaneous cross-tab communication
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('dnd_5e_session_channel');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'NEW_ROLL') {
          setRecentRoll(payload);
          setRollFeed((prev) => [...prev, payload]);
        } else if (type === 'ANNOUNCEMENT') {
          setActiveAnnouncement(payload);
        } else if (type === 'DM_LIVE_MESSAGE') {
          setServerDmLiveMessage(payload);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Poll room server state & heartbeat active character / DM
  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        // Send player heartbeat if player mode with active character
        if (appMode === 'player' && activeCharacter) {
          const prof = calculateProficiencyBonus(activeCharacter.level);
          const pp = calculatePassivePerception(
            activeCharacter.abilities.wis.score,
            activeCharacter.skills.perception,
            prof
          );

          await fetch(`/api/session/room/${roomCode}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              characterId: activeCharacter.id,
              characterName: activeCharacter.name,
              playerName: activeCharacter.playerName,
              currentHp: activeCharacter.currentHp,
              maxHp: activeCharacter.maxHp,
              ac: activeCharacter.armorClass,
              passivePerception: pp,
              level: activeCharacter.level,
              characterClass: activeCharacter.characterClass,
            }),
          }).catch(() => {});
        } else if (appMode === 'dm') {
          // Send DM heartbeat & live message
          await fetch(`/api/session/room/${roomCode}/dm-heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dmConnected: true,
              dmLiveMessage: dmWorkspace.dmLiveMessage || '',
            }),
          }).catch(() => {});
        }

        // Fetch room state
        const res = await fetch(`/api/session/room/${roomCode}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.party) setPartyMembers(data.party);
          if (data.dmConnected !== undefined) setServerDmConnected(data.dmConnected);
          if (data.dmLiveMessage !== undefined) setServerDmLiveMessage(data.dmLiveMessage);
          if (data.dmLastRoll) setServerDmLastRoll(data.dmLastRoll);
          if (data.rollFeed && data.rollFeed.length > 0) {
            setRollFeed(data.rollFeed);
            setRecentRoll(data.rollFeed[data.rollFeed.length - 1]);
          }
          if (data.dmAnnouncements && data.dmAnnouncements.length > 0) {
            const latest = data.dmAnnouncements[data.dmAnnouncements.length - 1];
            if (latest && latest.timestamp > Date.now() - 30000) {
              setActiveAnnouncement(latest);
            }
          }
        }
      } catch (e) {
        // Offline or dev network error, silent fallback
      }
    };

    syncSession();
    const interval = setInterval(syncSession, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomCode, appMode, activeCharacter, dmWorkspace.dmLiveMessage]);

  // Handle Role selection
  const handleRoleSelected = (role: UserRole) => {
    setUserRole(role);
    saveUserRole(role);
    setIsRoleModalOpen(false);
    if (role === 'player') {
      setAppMode('player');
    } else if (role === 'dm') {
      setAppMode('dm');
    }
  };

  // Save changes to host settings
  const handleSaveHostSettings = (updated: HostSettings) => {
    setHostSettings(updated);
    saveHostSettings(updated);
  };

  // Open host settings with password check if not moderator
  const handleOpenHostSettings = () => {
    if (userRole === 'moderator') {
      setIsHostSettingsOpen(true);
      return;
    }

    const expected = hostSettings.moderatorPassword || 'admin';
    setPasswordModalConfig({
      isOpen: true,
      title: 'Acceso a Ajustes Privados de Desarrollador',
      description: 'Introduce la contraseña de moderador para configurar API keys, modelos, anuncios y versiones.',
      expectedPassword: expected,
      onSuccess: () => {
        setIsHostSettingsOpen(true);
      },
    });
  };

  // Switch app mode (with DM password check if switching to DM and password configured)
  const handleSwitchMode = (targetMode: 'player' | 'dm') => {
    if (targetMode === 'dm') {
      const dmPass = hostSettings.dmPassword || dmWorkspace.password;
      if (dmPass && !isDMUnlocked(dmPass)) {
        setPasswordModalConfig({
          isOpen: true,
          title: 'Acceso a la Suite de Dungeon Master',
          description: 'Esta pantalla contiene archivos confidenciales, trampas y secretos protegidos por el DM.',
          expectedPassword: dmPass,
          onSuccess: () => {
            setDMUnlocked(true);
            setAppMode('dm');
          },
        });
        return;
      }
    }
    setAppMode(targetMode);
  };

  // Save changes to characters
  const handleUpdateCharacter = (updated: Character5e) => {
    const updatedList = characters.map((c) => (c.id === updated.id ? updated : c));
    setCharacters(updatedList);
    saveCharacters(updatedList);
  };

  // Save changes to DM workspace
  const handleUpdateDMWorkspace = (updated: DMWorkspace) => {
    setDmWorkspace(updated);
    saveDMWorkspace(updated);
  };

  // Add newly created character
  const handleCharacterCreated = (newChar: Character5e) => {
    const updatedList = [...characters, newChar];
    setCharacters(updatedList);
    setActiveCharId(newChar.id);
    saveCharacters(updatedList);
    saveActiveCharacterId(newChar.id);
    setAppMode('player');
  };

  // DM grants an item to the current player character
  const handleGiveItemToPlayer = (item: InventoryItem) => {
    if (!activeCharacter) {
      alert('No hay ningún personaje seleccionado en este dispositivo para recibir el objeto.');
      return;
    }
    const nextInv = [...(activeCharacter.inventory || []), { ...item, id: `inv-${Date.now()}` }];
    const updated = { ...activeCharacter, inventory: nextInv };
    handleUpdateCharacter(updated);
    alert(`¡"${item.name}" ha sido agregado al inventario de ${activeCharacter.name}!`);
  };

  // Update DM live message and broadcast immediately
  const handleUpdateDmLiveMessage = async (msg: string) => {
    const updated = { ...dmWorkspace, dmLiveMessage: msg };
    handleUpdateDMWorkspace(updated);
    setServerDmLiveMessage(msg);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'DM_LIVE_MESSAGE', payload: msg });
    }

    try {
      await fetch(`/api/session/room/${roomCode}/dm-heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmConnected: true,
          dmLiveMessage: msg,
        }),
      });
    } catch {}
  };

  // Trigger roll modal from sheet or DM screen
  const handleTriggerRoll = (title: string, modifier: number, diceType: number = 20) => {
    setRollerTitle(title);
    setRollerMod(modifier);
    setRollerSides(diceType);
    setRollerMode('normal');
    setIsRollerOpen(true);
  };

  // Quick roll 1-click button (d4, d6, d8, d10, d12, d20, d100)
  const handleQuickRoll = (sides: number) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    const isCrit = sides === 20 && roll === 20;
    const isFumble = sides === 20 && roll === 1;

    const result: DiceRollResult = {
      id: `roll-${Date.now()}`,
      rollerName: appMode === 'player' ? activeCharacter?.name || 'Aventurero' : 'Dungeon Master',
      rollTitle: `Tirada Rápida 1d${sides}`,
      formula: `1d${sides}`,
      mode: 'normal',
      diceType: sides,
      rolls: [roll],
      chosenRoll: roll,
      modifier: 0,
      total: roll,
      isCrit,
      isFumble,
      timestamp: Date.now(),
    };

    handleRollComplete(result);
    handleBroadcastRoll(result);
  };

  // Broadcast roll to room & broadcast channel
  const handleBroadcastRoll = async (result: DiceRollResult) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'NEW_ROLL', payload: result });
    }
    try {
      await fetch(`/api/session/room/${roomCode}/roll?isDm=${appMode === 'dm'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    } catch {}
  };

  // Broadcast DM announcement to room & broadcast channel
  const handleBroadcastAnnouncement = async (title: string, content: string) => {
    const payload = { title, content, timestamp: Date.now() };
    setActiveAnnouncement(payload);
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'ANNOUNCEMENT', payload });
    }
    try {
      await fetch(`/api/session/room/${roomCode}/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  };

  const handleRollComplete = (result: DiceRollResult) => {
    setRecentRoll(result);
    setRollFeed((prev) => [...prev, result]);
  };

  // Export / Import Backup Data (Full offline support)
  const handleExportBackup = () => {
    const jsonStr = exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnd5e-respaldo-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content && importBackupData(content)) {
            setCharacters(loadCharacters());
            setActiveCharId(loadActiveCharacterId());
            setDmWorkspace(loadDMWorkspace());
            setRoomCode(loadRoomCode());
            setHostSettings(loadHostSettings());
            alert('¡Datos de personaje y campaña importados exitosamente!');
          } else {
            alert('El archivo no tiene el formato de respaldo correcto.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Render selected logo icon
  const renderLogoIcon = () => {
    const icon = hostSettings.logoIcon || 'shield';
    switch (icon) {
      case 'dragon':
        return <Flame className="w-5 h-5 text-amber-200" />;
      case 'd20':
        return <Dices className="w-5 h-5 text-amber-200" />;
      case 'book':
        return <BookOpen className="w-5 h-5 text-amber-200" />;
      case 'sparkles':
      case 'wand':
        return <Sparkles className="w-5 h-5 text-amber-200" />;
      case 'shield':
      default:
        return <Shield className="w-5 h-5 text-amber-200" />;
    }
  };

  // Check if character is locked by password
  const isCharLocked = Boolean(
    activeCharacter?.password && !isCharacterUnlocked(activeCharacter.id, activeCharacter.password)
  );

  const handleUnlockCharacterRequest = () => {
    if (activeCharacter?.password) {
      setPasswordModalConfig({
        isOpen: true,
        title: `Desbloquear edición de ${activeCharacter.name}`,
        description: 'Introduce la contraseña establecida para este personaje para desbloquear la edición de su hoja.',
        expectedPassword: activeCharacter.password,
        onSuccess: () => {
          setCharacterUnlocked(activeCharacter.id);
          setUnlockedTick((prev) => prev + 1);
        },
      });
    }
  };

  const isStrictRole = hostSettings.roleSwitchingAllowed === 'strict';

  return (
    <div className="min-h-screen bg-[#111216] text-[#e3ded4] pb-24 font-sans selection:bg-amber-700 selection:text-white">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 bg-[#16171f]/95 border-b border-amber-900/50 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo, Title & Version Subtitle with Updates Blog Button */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-500 flex items-center justify-center text-white shadow-md">
                {renderLogoIcon()}
              </div>
              <div>
                <span className="font-cinzel font-black text-lg text-amber-300 tracking-wider block leading-tight">
                  {hostSettings.headerTitle || 'GRIMORIO 5E'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest block">
                    {hostSettings.headerSubtitle || 'Companion & DM Suite v0.1'}
                  </span>
                  <button
                    onClick={() => setIsChangelogOpen(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-[10px] text-amber-300 font-cinzel font-bold transition shadow-sm"
                    title="Ver novedades y notas de versión"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span>Novedades</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Role Display / Mode Switcher based on User Role */}
            <div className="flex items-center gap-2">
              {/* If Moderator: always can toggle player / dm and see crown */}
              {userRole === 'moderator' ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#101115] p-1 rounded-xl border border-stone-800">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('player')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition ${
                        appMode === 'player'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Jugador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('dm')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition ${
                        appMode === 'dm'
                          ? 'bg-purple-700 text-white shadow'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Dungeon Master</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-cinzel font-bold">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Moderador</span>
                    <button
                      onClick={() => setIsRoleModalOpen(true)}
                      className="ml-1 text-[10px] text-stone-400 hover:text-amber-200 underline font-normal"
                      title="Cambiar rol"
                    >
                      (Cambiar)
                    </button>
                  </div>
                </div>
              ) : isStrictRole ? (
                /* Strict Role Mode: Player sees only Player badge; DM sees only DM badge */
                userRole === 'player' ? (
                  <div className="flex items-center gap-2 bg-[#101115] px-3 py-1.5 rounded-xl border border-amber-700/50">
                    <div className="flex items-center gap-1.5 text-amber-300 text-xs font-cinzel font-bold">
                      <User className="w-3.5 h-3.5" />
                      <span>Modo Jugador</span>
                    </div>
                    <button
                      onClick={() => setIsRoleModalOpen(true)}
                      className="text-[10px] text-stone-400 hover:text-stone-200 underline pl-1.5 border-l border-stone-800"
                      title="Cambiar rol de usuario"
                    >
                      Cambiar Rol
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-[#101115] px-3 py-1.5 rounded-xl border border-purple-700/50">
                    <div className="flex items-center gap-1.5 text-purple-300 text-xs font-cinzel font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Modo Dungeon Master</span>
                    </div>
                    <button
                      onClick={() => setIsRoleModalOpen(true)}
                      className="text-[10px] text-stone-400 hover:text-stone-200 underline pl-1.5 border-l border-stone-800"
                      title="Cambiar rol de usuario"
                    >
                      Cambiar Rol
                    </button>
                  </div>
                )
              ) : (
                /* Open Role Mode: User can toggle between player & DM */
                <div className="flex items-center bg-[#101115] p-1 rounded-xl border border-stone-800">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('player')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition ${
                      appMode === 'player'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Jugador</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('dm')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition ${
                      appMode === 'dm'
                        ? 'bg-purple-700 text-white shadow'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Dungeon Master</span>
                  </button>
                  <button
                    onClick={() => setIsRoleModalOpen(true)}
                    className="text-[10px] text-stone-400 hover:text-stone-200 underline px-2"
                    title="Cambiar rol"
                  >
                    Rol
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Tools, Character Selector & Settings */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Character Selector (if player mode) */}
            {appMode === 'player' && (
              <div className="flex items-center gap-1.5 bg-[#101115] px-2.5 py-1 rounded-xl border border-stone-800">
                <span className="text-xs text-stone-500">PJ:</span>
                <select
                  value={activeCharId}
                  onChange={(e) => {
                    setActiveCharId(e.target.value);
                    saveActiveCharacterId(e.target.value);
                  }}
                  className="bg-transparent text-xs font-semibold text-amber-300 focus:outline-none cursor-pointer max-w-[130px] truncate"
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#181920] text-stone-200">
                      {c.name} (Niv {c.level})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsCreatorOpen(true)}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs"
                  title="Crear nuevo personaje"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Compendio SRD */}
            <button
              onClick={() => setIsCompendiumOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#20212b] border border-stone-800 hover:border-amber-700 text-stone-300 text-xs font-cinzel font-semibold transition"
              title="Manual del usuario y compendio de reglas SRD 5E"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Manual 5E</span>
            </button>

            {/* Oráculo Arcano (Gemini Flash) */}
            <button
              onClick={() => {
                setOracleInitialPrompt('');
                setIsOracleOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-700/60 text-purple-200 text-xs font-cinzel font-bold transition shadow"
              title="Consultar al Sabio Arcano con IA (Gemini Flash)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Oráculo IA</span>
            </button>

            {/* Private Host / Developer Settings */}
            <button
              onClick={handleOpenHostSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181920] hover:bg-[#20212b] border border-stone-800 hover:border-amber-700 text-stone-300 hover:text-amber-300 text-xs font-cinzel font-semibold transition"
              title="Ajustes privados de anfitrión (API keys, modelos, anuncios y versiones)"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Ajustes</span>
            </button>

            {/* Offline Export / Import */}
            <div className="flex items-center gap-1 bg-[#101115] p-1 rounded-xl border border-stone-800">
              <button
                onClick={handleExportBackup}
                className="p-1.5 text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition"
                title="Descargar copia de seguridad JSON (Offline)"
                aria-label="Exportar respaldo offline"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleImportBackup}
                className="p-1.5 text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800 transition"
                title="Cargar copia de seguridad JSON"
                aria-label="Importar respaldo offline"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Global Developer Announcement Banner (Configured in Host Settings) */}
        {hostSettings.developerAnnouncement?.active &&
          hostSettings.developerAnnouncement.content &&
          !dismissedDevNotice && (
            <div className="bg-gradient-to-r from-amber-950/80 via-stone-900 to-amber-950/80 border border-amber-600/50 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-cinzel font-bold text-sm text-amber-300">
                    {hostSettings.developerAnnouncement.title || 'Anuncio del Desarrollador'}
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">
                    {hostSettings.developerAnnouncement.content}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissedDevNotice(true)}
                className="text-stone-400 hover:text-stone-200 p-1"
                title="Cerrar anuncio"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* Live Multiplayer Party Status Bar (Shows Connected Players and Connected DM with Live Message) */}
        <PartySessionBar
          roomCode={roomCode}
          onChangeRoomCode={(code) => {
            setRoomCode(code);
            saveRoomCode(code);
          }}
          partyMembers={partyMembers}
          recentRollsCount={rollFeed.length}
          onOpenRollFeed={() => setIsRollFeedOpen(true)}
          activeAnnouncement={activeAnnouncement}
          onDismissAnnouncement={() => setActiveAnnouncement(null)}
          isDmMode={appMode === 'dm'}
          dmConnected={serverDmConnected || appMode === 'dm'}
          dmLiveMessage={appMode === 'dm' ? dmWorkspace.dmLiveMessage : serverDmLiveMessage}
          onUpdateDmLiveMessage={handleUpdateDmLiveMessage}
          dmLastRoll={serverDmLastRoll}
        />

        {/* View Selection: Player Character Sheet or DM Suite */}
        {appMode === 'player' ? (
          activeCharacter ? (
            <CharacterSheetView
              character={activeCharacter}
              onUpdateCharacter={handleUpdateCharacter}
              onTriggerRoll={handleTriggerRoll}
              isLocked={isCharLocked}
              onUnlockRequest={handleUnlockCharacterRequest}
            />
          ) : (
            <div className="text-center py-20 bg-[#181920] rounded-2xl border border-stone-800">
              <h2 className="text-xl font-cinzel font-bold text-amber-300 mb-2">No hay personaje seleccionado</h2>
              <p className="text-xs text-stone-400 mb-4">Crea tu primer aventurero para comenzar tu viaje en 5E.</p>
              <button
                onClick={() => setIsCreatorOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-sm shadow"
              >
                Crear Hoja de Personaje
              </button>
            </div>
          )
        ) : (
          <DMScreenView
            workspace={dmWorkspace}
            onUpdateWorkspace={handleUpdateDMWorkspace}
            onTriggerRoll={handleTriggerRoll}
            onBroadcastAnnouncement={handleBroadcastAnnouncement}
            onOpenAIOracle={(prompt) => {
              setOracleInitialPrompt(prompt || '');
              setIsOracleOpen(true);
            }}
            onUpdateDmLiveMessage={handleUpdateDmLiveMessage}
            onGiveItemToPlayer={handleGiveItemToPlayer}
          />
        )}
      </main>

      {/* Persistent Floating Quick Dice Bar */}
      <QuickDiceBar
        onQuickRoll={handleQuickRoll}
        onOpenFullRoller={() => {
          setRollerTitle('Tirada Personalizada');
          setRollerMod(0);
          setRollerSides(20);
          setRollerMode('normal');
          setIsRollerOpen(true);
        }}
        recentRoll={recentRoll}
      />

      {/* Modals */}
      {/* 1. Full Dice Roller */}
      <DiceRollerModal
        isOpen={isRollerOpen}
        onClose={() => setIsRollerOpen(false)}
        rollerName={appMode === 'player' ? activeCharacter?.name || 'Aventurero' : 'Dungeon Master'}
        initialRollTitle={rollerTitle}
        initialModifier={rollerMod}
        initialDiceType={rollerSides}
        initialMode={rollerMode}
        onRollComplete={handleRollComplete}
        broadcastToRoom={handleBroadcastRoll}
      />

      {/* 2. Character Creation Wizard */}
      <CharacterCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onCharacterCreated={handleCharacterCreated}
      />

      {/* 3. 5E SRD Rules Compendium */}
      <RulesCompendiumModal
        isOpen={isCompendiumOpen}
        onClose={() => setIsCompendiumOpen(false)}
        onAskOracle={(topic) => {
          setIsCompendiumOpen(false);
          setOracleInitialPrompt(topic);
          setIsOracleOpen(true);
        }}
      />

      {/* 4. Gemini Flash Arcane Oracle */}
      <ArcaneOracleModal
        isOpen={isOracleOpen}
        onClose={() => setIsOracleOpen(false)}
        characterContext={appMode === 'player' ? activeCharacter : undefined}
        dmContext={appMode === 'dm' ? dmWorkspace : undefined}
        initialPrompt={oracleInitialPrompt}
        welcomeMessage={hostSettings.oracleWelcomeMessage}
        customApiKey={hostSettings.apiKeyOverride}
        customModel={hostSettings.modelOverride}
      />

      {/* 5. Live Roll Feed */}
      <LiveRollFeedModal
        isOpen={isRollFeedOpen}
        onClose={() => setIsRollFeedOpen(false)}
        rolls={rollFeed}
        onClearRolls={() => setRollFeed([])}
      />

      {/* 6. Role Selection Modal (Jugador / DM / Moderador) */}
      <RoleSelectionModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        canClose={Boolean(userRole)}
        dmPasswordExpected={hostSettings.dmPassword || dmWorkspace.password || ''}
        moderatorPasswordExpected={hostSettings.moderatorPassword || 'admin'}
        onSelectRole={handleRoleSelected}
      />

      {/* 7. Private Host / Developer Settings Modal */}
      <HostSettingsModal
        isOpen={isHostSettingsOpen}
        onClose={() => setIsHostSettingsOpen(false)}
        settings={hostSettings}
        onSaveSettings={handleSaveHostSettings}
      />

      {/* 8. Changelog / Updates Blog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
        changelog={hostSettings.changelog || []}
        currentVersion={hostSettings.headerSubtitle || 'Companion & DM Suite v0.1'}
      />

      {/* 9. Password Prompt Modal (For Character Sheet / DM / Settings unlock) */}
      <PasswordPromptModal
        isOpen={passwordModalConfig.isOpen}
        onClose={() => setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={passwordModalConfig.title}
        description={passwordModalConfig.description}
        expectedPassword={passwordModalConfig.expectedPassword}
        onSuccess={() => {
          passwordModalConfig.onSuccess();
          setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}
