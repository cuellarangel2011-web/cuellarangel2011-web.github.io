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
  ArrowLeft,
  LayoutGrid,
} from 'lucide-react';
import {
  Character5e,
  DMWorkspace,
  DiceRollResult,
  RollMode,
  UserRole,
  HostSettings,
  InventoryItem,
  WorldSheetSummary,
  LiveCombatantMini,
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
  loadAuthUser,
  saveAuthUser,
  AuthSessionUser,
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
import { ChangelogModal } from './components/host/ChangelogModal';
import { LobbyPortalView } from './components/lobby/LobbyPortalView';
import { calculateProficiencyBonus, calculatePassivePerception } from './utils/dnd-math';
import { SAMPLE_DM_WORKSPACE } from './data/srd';

export default function App() {
  // Authentication & Session
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(() => loadAuthUser());
  const [userRole, setUserRole] = useState<UserRole>(() => loadUserRole() || authUser?.role || 'player');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);

  // App View Architecture: 'lobby' is the primary portal
  const [appView, setAppView] = useState<'lobby' | 'player-session' | 'player-solo' | 'dm-session'>('lobby');

  // Host Settings
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => loadHostSettings());
  const [isChangelogOpen, setIsChangelogOpen] = useState<boolean>(false);
  const [dismissedDevNotice, setDismissedDevNotice] = useState<boolean>(false);

  // Persistence State
  const [characters, setCharacters] = useState<Character5e[]>(() => loadCharacters());
  const [activeCharId, setActiveCharId] = useState<string>(() => loadActiveCharacterId());
  const [dmWorkspace, setDmWorkspace] = useState<DMWorkspace>(() => loadDMWorkspace());
  const [roomCode, setRoomCode] = useState<string>(() => loadRoomCode() || 'MESA-DRAGON');
  const [worldSheets, setWorldSheets] = useState<WorldSheetSummary[]>([]);
  const [activeWorld, setActiveWorld] = useState<WorldSheetSummary | null>(null);

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
  const [roomClosedAlert, setRoomClosedAlert] = useState<string>('');
  const [showCombatantsOnTable, setShowCombatantsOnTable] = useState<boolean>(false);
  const [liveCombatants, setLiveCombatants] = useState<LiveCombatantMini[]>([]);

  // Refs to always access freshest state inside intervals and async callbacks without stale closures
  const activeCharacterRef = useRef<Character5e | undefined>(activeCharacter);
  useEffect(() => {
    activeCharacterRef.current = activeCharacter;
  }, [activeCharacter]);

  const dmWorkspaceRef = useRef<DMWorkspace>(dmWorkspace);
  useEffect(() => {
    dmWorkspaceRef.current = dmWorkspace;
  }, [dmWorkspace]);

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
        } else if (type === 'COMBATANTS_UPDATE') {
          setShowCombatantsOnTable(payload.showCombatantsOnTable);
          setLiveCombatants(payload.liveCombatants || []);
        } else if (type === 'SETTINGS_UPDATED') {
          setHostSettings(payload);
          saveHostSettings(payload);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Live synchronize host settings across all instances, browsers & computers
  useEffect(() => {
    let isMounted = true;
    const syncHostSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok && isMounted) {
          const fresh: HostSettings = await res.json();
          if (fresh && typeof fresh === 'object') {
            setHostSettings((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
                saveHostSettings(fresh);
                return fresh;
              }
              return prev;
            });
          }
        }
      } catch (err) {}
    };

    syncHostSettings();
    const interval = setInterval(syncHostSettings, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Send player heartbeat to room server
  const sendPlayerHeartbeat = async (char?: Character5e) => {
    const target = char || activeCharacterRef.current;
    if (!target) return;
    try {
      const prof = calculateProficiencyBonus(target.level);
      const pp = calculatePassivePerception(
        target.abilities.wis.score,
        target.skills.perception,
        prof
      );

      await fetch(`/api/session/room/${roomCode}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: target.id,
          characterName: target.name,
          playerName: target.playerName,
          currentHp: target.currentHp,
          maxHp: target.maxHp,
          ac: target.armorClass,
          passivePerception: pp,
          level: target.level,
          characterClass: `${target.race} ${target.characterClass}`,
          lastRoll: recentRoll,
          abilities: {
            str: target.abilities.str.score,
            dex: target.abilities.dex.score,
            con: target.abilities.con.score,
            int: target.abilities.int.score,
            wis: target.abilities.wis.score,
            cha: target.abilities.cha.score,
          },
          currency: target.currency,
        }),
      });
    } catch (e) {}
  };

  // Send DM heartbeat & active combatants to room server
  const sendDmHeartbeat = async (ws?: DMWorkspace) => {
    const targetWs = ws || dmWorkspaceRef.current;
    if (!targetWs) return;

    try {
      const shouldBroadcast = Boolean(targetWs.activeEncounter?.broadcastEnemiesToTable);
      const combatantsMini: LiveCombatantMini[] = (targetWs.activeEncounter?.combatants || []).map((c) => ({
        id: c.id,
        name: c.name,
        hp: c.hp,
        maxHp: c.maxHp,
        ac: c.ac,
        passivePerception: c.passivePerception ?? 10,
        faction: c.faction || (c.isPlayer ? 'ally' : 'enemy'),
        isPlayer: Boolean(c.isPlayer),
        conditions: c.conditions || [],
      }));

      await fetch(`/api/session/room/${roomCode}/dm-heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmLiveMessage: targetWs.dmLiveMessage || '',
          dmConnected: true,
          showCombatantsOnTable: shouldBroadcast,
          liveCombatants: combatantsMini,
        }),
      });
    } catch (e) {}
  };

  // Fetch world sheets for the authenticated DM
  const fetchWorldSheets = async () => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/vault/worlds?ownerEmail=${encodeURIComponent(authUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.worlds)) {
          setWorldSheets(data.worlds);
        }
      }
    } catch (err) {
      console.error('Error fetching world sheets:', err);
    }
  };

  useEffect(() => {
    if (authUser && authUser.status === 'approved') {
      fetchWorldSheets();
    }
  }, [authUser?.email, authUser?.status]);

  // Poll room server state & heartbeat active character / DM (Only when inside active session)
  useEffect(() => {
    if (appView !== 'player-session' && appView !== 'dm-session') {
      return;
    }

    let isMounted = true;

    const syncSession = async () => {
      try {
        // Send player heartbeat if player session
        if (appView === 'player-session') {
          await sendPlayerHeartbeat(activeCharacterRef.current);
        }

        // Send DM heartbeat if DM session
        if (appView === 'dm-session') {
          await sendDmHeartbeat(dmWorkspaceRef.current);
        }

        // Fetch full room state
        const res = await fetch(`/api/session/room/${roomCode}`);
        if (!isMounted) return;

        if (res.status === 404) {
          const data = await res.json().catch(() => ({}));
          // If the room was closed by DM or does not exist, return player to lobby
          if (appView === 'player-session') {
            setRoomClosedAlert(data.error || 'La mesa ha sido cerrada por el Dungeon Master.');
            setAppView('lobby');
            return;
          }
        }

        if (res.ok) {
          const data = await res.json();
          if (data.closed && appView === 'player-session') {
            setRoomClosedAlert(data.error || 'El Dungeon Master ha cerrado la mesa.');
            setAppView('lobby');
            return;
          }

          setPartyMembers(data.party || []);
          if (Array.isArray(data.rollFeed)) {
            setRollFeed(data.rollFeed);
          }
          setServerDmConnected(Boolean(data.dmConnected));
          setServerDmLiveMessage(data.dmLiveMessage || '');
          if (data.dmLastRoll) {
            setServerDmLastRoll(data.dmLastRoll);
          }
          if (data.showCombatantsOnTable !== undefined) {
            setShowCombatantsOnTable(Boolean(data.showCombatantsOnTable));
          }
          if (Array.isArray(data.liveCombatants)) {
            setLiveCombatants(data.liveCombatants);
          }
        }
      } catch (err) {
        // Offline handling
      }
    };

    syncSession();
    const interval = setInterval(syncSession, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [appView, roomCode]);

  // Auth / Role Selection Callback
  const handleSelectRole = (role: UserRole, user?: AuthSessionUser) => {
    setUserRole(role);
    saveUserRole(role);
    if (user) {
      setAuthUser(user);
      saveAuthUser(user);
    }
    setIsRoleModalOpen(false);
    setAppView('lobby');
  };

  const handleLogout = () => {
    setAuthUser(null);
    saveAuthUser(null);
    saveUserRole(null);
    setAppView('lobby');
  };

  const handleRefreshAuthStatus = async () => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/auth/me?email=${encodeURIComponent(authUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status) {
          const updated: AuthSessionUser = {
            id: data.id,
            email: data.email,
            displayName: data.displayName,
            role: data.role || authUser.role,
            status: data.status,
          };
          setAuthUser(updated);
          saveAuthUser(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Launch Player Sheet into active table
  const handleSelectCharacterToPlay = (character: Character5e, code: string) => {
    setActiveCharId(character.id);
    saveActiveCharacterId(character.id);
    setRoomCode(code);
    saveRoomCode(code);
    setAppView('player-session');
  };

  // Open Player Sheet in solo / editing mode from lobby
  const handleEditCharacterSolo = (character: Character5e) => {
    setActiveCharId(character.id);
    saveActiveCharacterId(character.id);
    setAppView('player-solo');
  };

  // Delete Character
  const handleDeleteCharacter = async (charId: string): Promise<boolean> => {
    if (!authUser?.email) return false;
    try {
      const res = await fetch(`/api/vault/sheets/${charId}?ownerEmail=${encodeURIComponent(authUser.email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== charId));
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Save Character to Cloud Vault
  const handlePlayerSaveToCloud = async () => {
    if (activeCharacter && authUser?.email) {
      try {
        await fetch('/api/vault/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: activeCharacter,
            ownerEmail: authUser.email,
            reason: 'manual',
          }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Player leaves table and returns to lobby
  const handlePlayerReturnToLobby = async () => {
    if (activeCharacter && authUser?.email) {
      await handlePlayerSaveToCloud();
      try {
        await fetch(`/api/session/room/${roomCode}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: activeCharacter.id,
            character: activeCharacter,
            ownerEmail: authUser.email,
          }),
        });
      } catch (e) {}
    }
    setAppView('lobby');
  };

  // Create World Sheet (Clean slate starting from zero)
  const handleCreateWorldSheet = async (config: { name: string; roomCode: string; roomPassword?: string }) => {
    if (!authUser?.email) return;

    const newWorld: WorldSheetSummary = {
      id: `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerEmail: authUser.email,
      name: config.name,
      roomCode: config.roomCode,
      roomPassword: config.roomPassword,
      lastPlayed: Date.now(),
      workspace: {
        ...SAMPLE_DM_WORKSPACE,
        npcs: [],
        monsters: [],
        locations: [],
        campaignLogs: [],
        combatSummaries: [],
        customItemsAndSpells: [],
        folders: ['General', 'Campaña'],
        activeEncounter: {
          id: `enc-${Date.now()}`,
          name: 'Combate',
          round: 1,
          currentTurnIndex: 0,
          combatants: [],
          isActive: false,
          combatNotes: '',
          combatLog: [],
        },
      },
    };

    const res = await fetch('/api/vault/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ world: newWorld }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al guardar World Sheet.');
    }

    setWorldSheets((prev) => [...prev, newWorld]);
  };

  // Update World Sheet Config (Name, RoomCode, Password)
  const handleUpdateWorldSheetConfig = async (worldId: string, updates: { name: string; roomCode: string; roomPassword?: string }) => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/vault/worlds/${worldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, ownerEmail: authUser.email }),
      });
      if (res.ok) {
        setWorldSheets((prev) =>
          prev.map((w) => (w.id === worldId ? { ...w, ...updates } : w))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete World Sheet
  const handleDeleteWorldSheet = async (worldId: string) => {
    if (!authUser?.email) return;
    try {
      const res = await fetch(`/api/vault/worlds/${worldId}?ownerEmail=${encodeURIComponent(authUser.email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWorldSheets((prev) => prev.filter((w) => w.id !== worldId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // DM Opens World Sheet -> Room becomes ACTIVE on server
  const handleOpenWorldSheet = async (world: WorldSheetSummary) => {
    setActiveWorld(world);
    setDmWorkspace(world.workspace);
    setRoomCode(world.roomCode);
    saveRoomCode(world.roomCode);

    // Register active room on server
    try {
      await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: world.roomCode,
          name: world.name,
          dmEmail: authUser?.email || 'dm@weroll.app',
          dmDisplayName: authUser?.displayName || 'Dungeon Master',
          password: world.roomPassword,
          worldSheetId: world.id,
        }),
      });
    } catch (e) {
      console.error('Error activating room:', e);
    }

    setAppView('dm-session');
  };

  // DM Saves World Sheet to Cloud Vault
  const handleDmSaveToCloud = async () => {
    if (activeWorld && authUser?.email) {
      try {
        await fetch('/api/vault/worlds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            world: {
              ...activeWorld,
              workspace: dmWorkspace,
              lastPlayed: Date.now(),
            },
          }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // DM Saves World Sheet and Closes Room (Table ceases to exist!)
  const handleDmSaveAndReturnToLobby = async () => {
    await handleDmSaveToCloud();

    // Close room on server
    try {
      await fetch('/api/rooms/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode }),
      });
    } catch (e) {
      console.error('Error closing room:', e);
    }

    setAppView('lobby');
    fetchWorldSheets();
  };

  // Character updates
  const handleUpdateCharacter = (updated: Character5e) => {
    activeCharacterRef.current = updated;
    const newChars = characters.map((c) => (c.id === updated.id ? updated : c));
    setCharacters(newChars);
    saveCharacters(newChars);

    if (appView === 'player-session') {
      const prof = calculateProficiencyBonus(updated.level);
      const pp = calculatePassivePerception(
        updated.abilities.wis.score,
        updated.skills.perception,
        prof
      );

      // Optimistic update of local player card so HP, stats and coins refresh INSTANTLY
      setPartyMembers((prev) =>
        prev.map((m) =>
          m.characterId === updated.id
            ? {
                ...m,
                currentHp: updated.currentHp,
                maxHp: updated.maxHp,
                ac: updated.armorClass,
                passivePerception: pp,
                abilities: {
                  str: updated.abilities.str.score,
                  dex: updated.abilities.dex.score,
                  con: updated.abilities.con.score,
                  int: updated.abilities.int.score,
                  wis: updated.abilities.wis.score,
                  cha: updated.abilities.cha.score,
                },
                currency: updated.currency,
              }
            : m
        )
      );

      // Immediate heartbeat push to server
      sendPlayerHeartbeat(updated);
    }
  };

  // Handle dice rolls
  const handleTriggerRoll = (title: string, modifier: number, diceType: number = 20) => {
    setRollerTitle(title);
    setRollerMod(modifier);
    setRollerSides(diceType);
    setRollerMode('normal');
    setIsRollerOpen(true);
  };

  const handleRollComplete = async (result: DiceRollResult) => {
    setRecentRoll(result);
    setRollFeed((prev) => [...prev, result]);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'NEW_ROLL',
        payload: result,
      });
    }

    try {
      const isDmRoll = appView === 'dm-session';
      await fetch(`/api/session/room/${roomCode}/roll?isDm=${isDmRoll}&characterId=${activeCharacter?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    } catch (e) {}
  };

  const handleBroadcastAnnouncement = (title: string, content: string) => {
    const ann = { title, content };
    setActiveAnnouncement(ann);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'ANNOUNCEMENT',
        payload: ann,
      });
    }
  };

  const handleOpenAIOracle = (initialPrompt?: string) => {
    if (initialPrompt) setOracleInitialPrompt(initialPrompt);
    setIsOracleOpen(true);
  };

  const handleSaveHostSettings = async (newSettings: HostSettings) => {
    setHostSettings(newSettings);
    saveHostSettings(newSettings);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          setHostSettings(data.settings);
          saveHostSettings(data.settings);
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'SETTINGS_UPDATED',
        payload: newSettings,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#101115] text-[#e2d9cc] flex flex-col font-sans selection:bg-amber-700 selection:text-white">
      {/* =================================================================== */}
      {/* TOP COMPACT APPLICATION HEADER                                      */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 bg-[#14151b]/95 backdrop-blur-md border-b border-amber-900/40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Left: Branding & Return to Lobby */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAppView('lobby')}
              className="flex items-center gap-2.5 text-left group transition"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500/80 shadow flex items-center justify-center text-amber-200 group-hover:scale-105 transition">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-cinzel font-black text-lg text-amber-300 tracking-wider block leading-tight group-hover:text-amber-200 transition">
                  {hostSettings.headerTitle || 'WeRoll'}
                </span>
                <span className="text-[10px] text-stone-400 font-cinzel font-semibold tracking-wider block">
                  {hostSettings.headerSubtitle || 'Companion & DM Suite v0.4'}
                </span>
              </div>
            </button>

            {appView !== 'lobby' && (
              <button
                onClick={() => {
                  if (appView === 'dm-session') {
                    handleDmSaveAndReturnToLobby();
                  } else {
                    handlePlayerReturnToLobby();
                  }
                }}
                className="ml-3 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-cinzel font-bold text-xs transition flex items-center gap-1.5 border border-stone-700 shadow"
                title="Salir al portal principal"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Lobby</span>
              </button>
            )}
          </div>

          {/* Center: Quick Dice Roller */}
          <div className="hidden md:flex items-center">
            <QuickDiceBar
              onQuickRoll={(sides) => handleTriggerRoll(`d${sides}`, 0, sides)}
              onOpenFullRoller={() => {
                setRollerTitle('Tirada General');
                setRollerMod(0);
                setRollerSides(20);
                setRollerMode('normal');
                setIsRollerOpen(true);
              }}
              recentRoll={recentRoll}
            />
          </div>

          {/* Right: Tools & Utilities */}
          <div className="flex items-center gap-2">
            {/* Compendium */}
            <button
              onClick={() => setIsCompendiumOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#20212b] border border-stone-800 hover:border-amber-700 text-stone-300 text-xs font-cinzel font-semibold transition"
              title="Manual SRD 5E"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Manual 5E</span>
            </button>

            {/* Oracle IA */}
            <button
              onClick={() => {
                setOracleInitialPrompt('');
                setIsOracleOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-700/60 text-purple-200 text-xs font-cinzel font-bold transition shadow"
              title="Sabio Arcano IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="hidden sm:inline">Oráculo IA</span>
            </button>

            {/* Updates Blog */}
            <button
              onClick={() => setIsChangelogOpen(true)}
              className="p-2 rounded-lg bg-[#181920] hover:bg-[#20212b] border border-stone-800 hover:border-amber-700 text-stone-300 text-xs font-cinzel transition"
              title="Blog de actualizaciones"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* MAIN CONTENT AREA                                                   */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
        {/* Room Closed Notification Alert */}
        {roomClosedAlert && (
          <div className="bg-red-950/80 border border-red-700 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-900/60 border border-red-600 flex items-center justify-center text-red-200 shrink-0">
                <X className="w-4 h-4" />
              </div>
              <p className="text-xs text-red-200 font-cinzel font-bold leading-relaxed">
                {roomClosedAlert}
              </p>
            </div>
            <button
              onClick={() => setRoomClosedAlert('')}
              className="p-1 rounded text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Developer Announcement Banner (Configured in Admin Settings) */}
        {(hostSettings.developerAnnouncement?.enabled || (hostSettings.developerAnnouncement as any)?.active) &&
          hostSettings.developerAnnouncement?.content &&
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

        {/* 1. LOBBY VIEW (Primary Portal) */}
        {appView === 'lobby' && (
          <LobbyPortalView
            authUser={authUser}
            hostSettings={hostSettings}
            onLogout={handleLogout}
            onOpenAuthModal={() => setIsRoleModalOpen(true)}
            onOpenChangelog={() => setIsChangelogOpen(true)}
            onSelectCharacterToPlay={handleSelectCharacterToPlay}
            onEditCharacterSolo={handleEditCharacterSolo}
            onDeleteCharacter={handleDeleteCharacter}
            onCreateNewCharacter={() => setIsCreatorOpen(true)}
            worldSheets={worldSheets}
            onOpenWorldSheet={handleOpenWorldSheet}
            onCreateWorldSheet={handleCreateWorldSheet}
            onUpdateWorldSheetConfig={handleUpdateWorldSheetConfig}
            onDeleteWorldSheet={handleDeleteWorldSheet}
            onSaveHostSettings={handleSaveHostSettings}
            onRefreshAuthStatus={handleRefreshAuthStatus}
          />
        )}

        {/* 2. ACTIVE SESSION: PARTY STATUS BAR (In Session Only) */}
        {(appView === 'player-session' || appView === 'dm-session') && (
          <PartySessionBar
            roomCode={roomCode}
            onChangeRoomCode={(code) => {
              setRoomCode(code);
              saveRoomCode(code);
            }}
            partyMembers={partyMembers}
            recentRollsCount={rollFeed.length}
            dmLastRoll={serverDmLastRoll}
            onOpenRollFeed={() => setIsRollFeedOpen(true)}
            activeAnnouncement={activeAnnouncement}
            onDismissAnnouncement={() => setActiveAnnouncement(null)}
            isDmMode={appView === 'dm-session'}
            dmConnected={serverDmConnected}
            dmLiveMessage={serverDmLiveMessage}
            showCombatantsOnTable={showCombatantsOnTable}
            liveCombatants={liveCombatants}
            onUpdateDmLiveMessage={(msg) => {
              setServerDmLiveMessage(msg);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'DM_LIVE_MESSAGE',
                  payload: msg,
                });
              }
            }}
          />
        )}

        {/* 3. PLAYER SHEET (Active Session or Solo Edit) */}
        {(appView === 'player-session' || appView === 'player-solo') && activeCharacter && (
          <CharacterSheetView
            character={activeCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onTriggerRoll={handleTriggerRoll}
            isInActiveRoom={appView === 'player-session'}
            roomCode={roomCode}
            onReturnToLobby={handlePlayerReturnToLobby}
            onSaveToCloud={handlePlayerSaveToCloud}
            isLocked={!isCharacterUnlocked(activeCharacter.id, activeCharacter.password)}
            onUnlockRequest={() => {
              setPasswordModalConfig({
                isOpen: true,
                title: `Desbloquear ${activeCharacter.name}`,
                description: 'Esta ficha de personaje está protegida por contraseña.',
                expectedPassword: activeCharacter.password,
                onSuccess: () => setCharacterUnlocked(activeCharacter.id),
              });
            }}
          />
        )}

        {/* 4. DUNGEON MASTER SCREEN (Active Session) */}
        {appView === 'dm-session' && (
          <DMScreenView
            workspace={dmWorkspace}
            onUpdateWorkspace={(updated) => {
              dmWorkspaceRef.current = updated;
              setDmWorkspace(updated);
              saveDMWorkspace(updated);

              const shouldBroadcast = Boolean(updated.activeEncounter?.broadcastEnemiesToTable);
              setShowCombatantsOnTable(shouldBroadcast);

              const combatantsMini: LiveCombatantMini[] = (updated.activeEncounter?.combatants || []).map((c) => ({
                id: c.id,
                name: c.name,
                hp: c.hp,
                maxHp: c.maxHp,
                ac: c.ac,
                passivePerception: c.passivePerception ?? 10,
                faction: c.faction || (c.isPlayer ? 'ally' : 'enemy'),
                isPlayer: Boolean(c.isPlayer),
                conditions: c.conditions || [],
              }));
              setLiveCombatants(combatantsMini);

              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'COMBATANTS_UPDATE',
                  payload: {
                    showCombatantsOnTable: shouldBroadcast,
                    liveCombatants: combatantsMini,
                  },
                });
              }

              sendDmHeartbeat(updated);
            }}
            worldName={activeWorld?.name}
            roomCode={roomCode}
            onSaveAndReturnToLobby={handleDmSaveAndReturnToLobby}
            onSaveToCloud={handleDmSaveToCloud}
            onTriggerRoll={handleTriggerRoll}
            onBroadcastAnnouncement={handleBroadcastAnnouncement}
            onOpenAIOracle={handleOpenAIOracle}
            onUpdateDmLiveMessage={(msg) => {
              setServerDmLiveMessage(msg);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({
                  type: 'DM_LIVE_MESSAGE',
                  payload: msg,
                });
              }
            }}
          />
        )}
      </main>

      {/* =================================================================== */}
      {/* GLOBAL MODALS                                                       */}
      {/* =================================================================== */}

      {/* Character Creator Modal */}
      {isCreatorOpen && (
        <CharacterCreatorModal
          isOpen={isCreatorOpen}
          onClose={() => setIsCreatorOpen(false)}
          onCharacterCreated={async (newChar) => {
            const charWithOwner = {
              ...newChar,
              ownerEmail: authUser?.email || 'jugador@weroll.app',
            };

            // Save to server vault
            if (authUser?.email) {
              try {
                await fetch('/api/vault/sheets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    character: charWithOwner,
                    ownerEmail: authUser.email,
                  }),
                });
              } catch (e) {
                console.error(e);
              }
            }

            const updatedList = [...characters, charWithOwner];
            setCharacters(updatedList);
            saveCharacters(updatedList);
            setActiveCharId(charWithOwner.id);
            saveActiveCharacterId(charWithOwner.id);
            setIsCreatorOpen(false);
          }}
        />
      )}

      {/* Role Selection / Login / Register Modal */}
      {isRoleModalOpen && (
        <RoleSelectionModal
          isOpen={isRoleModalOpen}
          canClose={Boolean(authUser)}
          onClose={() => setIsRoleModalOpen(false)}
          dmPasswordExpected={hostSettings.dmPassword || ''}
          moderatorPasswordExpected={hostSettings.moderatorPassword || 'admin'}
          onSelectRole={handleSelectRole}
        />
      )}

      {/* Password Prompt Modal */}
      {passwordModalConfig.isOpen && (
        <PasswordPromptModal
          isOpen={passwordModalConfig.isOpen}
          title={passwordModalConfig.title}
          description={passwordModalConfig.description}
          expectedPassword={passwordModalConfig.expectedPassword}
          onClose={() => setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }))}
          onSuccess={() => {
            passwordModalConfig.onSuccess();
            setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      )}

      {/* Changelog Modal */}
      {isChangelogOpen && (
        <ChangelogModal
          isOpen={isChangelogOpen}
          onClose={() => setIsChangelogOpen(false)}
          changelog={hostSettings.changelog || []}
          currentVersion={hostSettings.headerSubtitle?.replace(/[^0-9.]/g, '') || '0.1'}
        />
      )}

      {/* Rules Compendium Modal */}
      {isCompendiumOpen && (
        <RulesCompendiumModal
          isOpen={isCompendiumOpen}
          onClose={() => setIsCompendiumOpen(false)}
          onAskOracle={(topic) => {
            setIsCompendiumOpen(false);
            handleOpenAIOracle(topic);
          }}
        />
      )}

      {/* Arcane Oracle (Gemini Flash) */}
      {isOracleOpen && (
        <ArcaneOracleModal
          isOpen={isOracleOpen}
          onClose={() => setIsOracleOpen(false)}
          initialPrompt={oracleInitialPrompt}
          characterContext={appView !== 'dm-session' ? activeCharacter : undefined}
          dmContext={appView === 'dm-session' ? dmWorkspace : undefined}
          welcomeMessage={hostSettings.oracleWelcomeMessage}
          customApiKey={hostSettings.apiKeyOverride}
          customModel={hostSettings.aiModel}
        />
      )}

      {/* Live Dice Roll Feed Modal */}
      {isRollFeedOpen && (
        <LiveRollFeedModal
          isOpen={isRollFeedOpen}
          onClose={() => setIsRollFeedOpen(false)}
          rolls={rollFeed}
        />
      )}

      {/* Full Dice Roller Modal */}
      {isRollerOpen && (
        <DiceRollerModal
          isOpen={isRollerOpen}
          onClose={() => setIsRollerOpen(false)}
          initialRollTitle={rollerTitle}
          initialModifier={rollerMod}
          initialDiceType={rollerSides}
          initialMode={rollerMode}
          rollerName={
            appView === 'dm-session'
              ? 'Dungeon Master'
              : activeCharacter
              ? `${activeCharacter.name} (${activeCharacter.playerName})`
              : authUser?.displayName || 'Aventurero'
          }
          onRollComplete={handleRollComplete}
        />
      )}
    </div>
  );
}
