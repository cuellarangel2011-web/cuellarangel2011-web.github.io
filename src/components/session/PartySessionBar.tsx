import React, { useState } from 'react';
import {
  Users,
  Wifi,
  Radio,
  Bell,
  Eye,
  Shield,
  Heart,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  AlertTriangle,
  Dices,
  Sparkles,
} from 'lucide-react';
import { DiceRollResult, PartyMemberLive, PresenceStatus } from '../../types/dnd';

interface PartySessionBarProps {
  roomCode: string;
  onChangeRoomCode: (code: string) => void;
  partyMembers: PartyMemberLive[];
  recentRollsCount?: number;
  dmLastRoll?: DiceRollResult;
  onOpenRollFeed: () => void;
  currentQuest?: string;
  quickNotification?: string;
  onDismissNotification?: () => void;
  activeAnnouncement?: { title: string; content: string } | null;
  onDismissAnnouncement?: () => void;
  isDmMode: boolean;
  dmConnected?: boolean;
  dmLiveMessage?: string;
  dmPresenceStatus?: PresenceStatus;
  dmIdleSeconds?: number;
  onUpdateDmLiveMessage?: (msg: string) => void;
}

export const PartySessionBar: React.FC<PartySessionBarProps> = ({
  roomCode,
  onChangeRoomCode,
  partyMembers,
  dmLastRoll,
  onOpenRollFeed,
  currentQuest,
  quickNotification,
  onDismissNotification,
  activeAnnouncement,
  onDismissAnnouncement,
  isDmMode,
  dmConnected = false,
  dmLiveMessage = '',
  dmPresenceStatus = 'active',
  dmIdleSeconds = 0,
  onUpdateDmLiveMessage,
}) => {
  const [showRoomModal, setShowRoomModal] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>(roomCode);
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditingDmMsg, setIsEditingDmMsg] = useState<boolean>(false);
  const [localDmMsg, setLocalDmMsg] = useState<string>(dmLiveMessage);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}?room=${roomCode}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Compile list of dice to show (DM die + each player's last roll)
  const allDiceBadges: { name: string; isDm?: boolean; roll?: DiceRollResult }[] = [];

  // DM Die
  allDiceBadges.push({
    name: 'Dungeon Master',
    isDm: true,
    roll: dmLastRoll,
  });

  // Each connected party member
  partyMembers.forEach((member) => {
    allDiceBadges.push({
      name: member.characterName,
      roll: member.lastRoll,
    });
  });

  const renderPresenceBadge = (status?: string, idleSec: number = 0) => {
    if (status === 'afk' || idleSec > 600) {
      const mins = Math.max(1, Math.floor(idleSec / 60));
      return (
        <span className="flex items-center gap-1 text-[9px] text-stone-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
          Ausente ({mins}m)
        </span>
      );
    }
    if (status === 'thinking' || idleSec > 180) {
      return (
        <span className="flex items-center gap-1 text-[9px] text-blue-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Pensando...
        </span>
      );
    }
    if (status === 'idle' || idleSec > 60) {
      return (
        <span className="flex items-center gap-1 text-[9px] text-amber-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          En Pausa
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        En Línea
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* 1. Misión / Objetivo Actual Pinned Banner */}
      {currentQuest && (
        <div className="bg-gradient-to-r from-[#1f1b14] via-[#241f17] to-[#1c1914] border border-amber-600/40 rounded-xl px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-amber-400 shrink-0 animate-spin-slow" />
            <div>
              <span className="font-cinzel font-bold text-amber-300 mr-2 tracking-wide uppercase text-[11px]">
                Misión Actual:
              </span>
              <span className="text-stone-200">{currentQuest}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Notificación Rápida del DM */}
      {quickNotification && (
        <div className="bg-gradient-to-r from-red-950/70 via-stone-900 to-red-950/70 border border-red-700/60 rounded-xl px-4 py-2 shadow-md flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-bold font-cinzel text-red-300">Aviso Rápido del DM:</span>
            <span>{quickNotification}</span>
          </div>
          {onDismissNotification && (
            <button
              onClick={onDismissNotification}
              className="text-stone-400 hover:text-stone-100 text-[10px] px-2 py-0.5 rounded bg-stone-800"
            >
              Entendido
            </button>
          )}
        </div>
      )}

      {/* 3. Narrativa / Anuncio Especial Revelado */}
      {activeAnnouncement && (
        <div className="p-4 bg-gradient-to-r from-amber-950 via-[#221c17] to-amber-950 border-2 border-amber-500 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="font-cinzel font-bold text-amber-300 text-sm tracking-wider uppercase">
                Mensaje del Dungeon Master: {activeAnnouncement.title}
              </span>
            </div>
            {onDismissAnnouncement && (
              <button
                onClick={onDismissAnnouncement}
                className="text-stone-400 hover:text-stone-100 text-xs px-2 py-0.5 rounded bg-stone-900 border border-stone-700"
              >
                Cerrar
              </button>
            )}
          </div>
          <p className="mt-2 text-xs sm:text-sm text-amber-100/90 leading-relaxed italic bg-black/30 p-3 rounded-lg border border-amber-900/40">
            "{activeAnnouncement.content}"
          </p>
        </div>
      )}

      {/* 4. Main Party & Live Dice Bar Header */}
      <div className="bg-[#181920] border border-amber-900/40 rounded-xl px-4 py-3 shadow flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Room identifier */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setShowRoomModal(true)}
            className="cursor-pointer flex items-center gap-2 bg-[#121316] hover:bg-[#1a1b22] px-3 py-1.5 rounded-lg border border-stone-800 hover:border-amber-700/60 transition group"
            title="Cambiar o compartir código de sala de juego"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-stone-400">Mesa:</span>
            <span className="font-mono font-bold text-amber-300 group-hover:text-amber-200">
              {roomCode}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-400">
            <Users className="w-3.5 h-3.5 text-amber-500" />
            <span>{partyMembers.length} Jugadores en Vivo</span>
          </div>
        </div>

        {/* Center / Right: Individual Live Dice per Character & DM */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-cinzel font-bold text-stone-400 whitespace-nowrap mr-1 flex items-center gap-1">
            <Dices className="w-4 h-4 text-amber-500" />
            Últimos Dados:
          </span>

          <div className="flex items-center gap-2">
            {allDiceBadges.map((badge, idx) => {
              const r = badge.roll;
              return (
                <div
                  key={idx}
                  onClick={onOpenRollFeed}
                  className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition shadow-sm ${
                    r
                      ? r.isCrit
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse'
                        : r.isFumble
                        ? 'bg-red-950/80 border-red-700 text-red-300'
                        : 'bg-[#121316] border-stone-700 text-stone-200 hover:border-amber-600'
                      : 'bg-[#121316] border-stone-800 text-stone-500'
                  }`}
                  title={
                    r
                      ? `${badge.name}: ${r.rollTitle} -> ${r.total} (${r.formula})`
                      : `${badge.name}: Aún no ha lanzado dados`
                  }
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-cinzel font-bold text-stone-400 truncate max-w-[80px]">
                      {badge.name}
                    </span>
                    <span className="text-[9px] font-mono text-stone-500">
                      {r ? `d${r.diceType}` : 'd20'}
                    </span>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center font-cinzel font-black text-sm border ${
                      r
                        ? r.isCrit
                          ? 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-sm'
                          : r.isFumble
                          ? 'bg-red-600/30 border-red-500 text-red-300'
                          : 'bg-[#181920] border-stone-700 text-amber-400'
                        : 'bg-[#181920] border-stone-800 text-stone-600'
                    }`}
                  >
                    {r ? r.total : '-'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toggle party list expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-[#121316] text-stone-400 hover:text-stone-200 ml-1 shrink-0"
            title={isExpanded ? 'Contraer grupo' : 'Expandir grupo'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 5. Connected Party Member Cards & Dungeon Master Live Card */}
      {isExpanded && (dmConnected || isDmMode || partyMembers.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {/* Dungeon Master Live Card */}
          {(dmConnected || isDmMode) && (
            <div className="bg-gradient-to-br from-[#1a1426] via-[#161720] to-[#14121a] border-2 border-purple-600/70 rounded-xl p-3 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-purple-700 flex items-center justify-center text-purple-200">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-cinzel font-bold text-purple-300 text-xs tracking-wide">
                      Dungeon Master
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderPresenceBadge(dmPresenceStatus, dmIdleSeconds)}
                  </div>
                </div>

                <div className="text-[10px] text-purple-400 font-semibold mb-1">
                  Guía de Mesa • Narrador
                </div>

                {/* DM Live Message Box */}
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-2 my-1 text-xs">
                  <div className="text-[9px] font-cinzel uppercase text-purple-300 font-bold mb-0.5 flex items-center justify-between">
                    <span>Mensaje para la Mesa:</span>
                    {isDmMode && !isEditingDmMsg && (
                      <button
                        onClick={() => {
                          setLocalDmMsg(dmLiveMessage || '');
                          setIsEditingDmMsg(true);
                        }}
                        className="text-[9px] text-amber-400 hover:text-amber-300 underline font-normal"
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {isEditingDmMsg ? (
                    <div className="space-y-1.5 mt-1">
                      <textarea
                        value={localDmMsg}
                        onChange={(e) => setLocalDmMsg(e.target.value)}
                        placeholder="Escribe el mensaje en vivo para todos los jugadores..."
                        rows={2}
                        className="w-full bg-[#121316] border border-purple-500 rounded p-1.5 text-xs text-stone-100"
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setIsEditingDmMsg(false)}
                          className="px-2 py-0.5 rounded text-[10px] text-stone-400 hover:bg-stone-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateDmLiveMessage) onUpdateDmLiveMessage(localDmMsg);
                            setIsEditingDmMsg(false);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-bold"
                        >
                          Enviar a Mesa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-stone-200 text-xs italic leading-snug">
                      "{dmLiveMessage || 'El Dungeon Master está orquestando los hilos del destino...'}"
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-purple-900/40 flex items-center justify-between text-[10px] text-stone-400">
                <span className="text-stone-400">Rol: <strong>Director de Juego</strong></span>
                <span className="font-mono text-purple-300">Sala: {roomCode}</span>
              </div>
            </div>
          )}

          {partyMembers.map((member) => (
            <div
              key={member.characterId}
              className="bg-[#181920] border border-stone-800 rounded-xl p-3 flex flex-col justify-between shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-cinzel font-bold text-stone-200 text-xs truncate max-w-[130px]" title={member.characterName}>
                    {member.characterName}
                  </span>
                  {renderPresenceBadge(member.presenceStatus, member.idleSeconds)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-400 mb-2">
                  <span className="truncate max-w-[110px]" title={member.playerName}>Jugador: {member.playerName}</span>
                  <span className="text-amber-400/90 font-mono text-[10px]">
                    Niv {member.level} {member.characterClass}
                  </span>
                </div>

                {/* HP Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-red-400">
                      <Heart className="w-3 h-3" /> PG:
                    </span>
                    <span className="text-stone-300">
                      {member.currentHp} / {member.maxHp}
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                    <div
                      className={`h-full ${
                        member.currentHp / member.maxHp > 0.5
                          ? 'bg-emerald-500'
                          : member.currentHp / member.maxHp > 0.2
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, (member.currentHp / member.maxHp) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-500" /> CA: <strong>{member.ac}</strong>
                </span>
                <span>
                  PP: <strong>{member.passivePerception}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room Code Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#181920] border-2 border-amber-900/60 rounded-xl p-5 text-stone-200 shadow-2xl">
            <h3 className="font-cinzel font-bold text-lg mb-2 text-amber-300">
              Conexión de la Mesa de Juego
            </h3>
            <p className="text-xs text-stone-400 mb-4 leading-relaxed">
              Ingresa el mismo código de sala (o IP de red) que tus compañeros. El DM y todos los jugadores compartirán las tiradas en vivo, la misión activa y los dados de cada aventurero.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-stone-400 mb-1">
                Código de Sala o IP
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Ej. MESA-DRAGON o 192.168.1.100"
                className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 font-mono font-bold text-sm tracking-wider"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeRoomCode(inputCode.trim() || 'MESA-DRAGON');
                    setShowRoomModal(false);
                  }}
                  className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs"
                >
                  Unirse a Sala
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
