import React, { useState } from 'react';
import {
  Shield,
  Heart,
  Zap,
  Sword,
  BookOpen,
  Backpack,
  Scroll,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  Flame,
  CheckCircle,
  XCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Edit2,
  Edit3,
  Lock,
  Unlock,
  Upload,
  ArrowLeft,
  Cloud,
  Coins,
} from 'lucide-react';
import { EntityAvatar } from '../common/EntityAvatar';
import { AvatarCustomizerModal } from '../common/AvatarCustomizerModal';
import {
  Character5e,
  AbilityKey,
  SkillKey,
  AttackAction,
  InventoryItem,
  SpellItem,
  Currency,
} from '../../types/dnd';
import {
  calculateModifier,
  formatModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  calculateSpellSaveDC,
  calculateSpellAttackBonus,
  calculateCarryCapacity,
} from '../../utils/dnd-math';
import { ABILITY_LABELS, SKILL_METADATA } from '../../data/srd';

interface CharacterSheetViewProps {
  character: Character5e;
  onUpdateCharacter: (updated: Character5e) => void;
  onTriggerRoll: (title: string, modifier: number, diceType?: number) => void;
  isLocked?: boolean;
  onUnlockRequest?: () => void;
  onSaveToCloud?: () => void;
  onReturnToLobby?: () => void;
  isInActiveRoom?: boolean;
  roomCode?: string;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character,
  onUpdateCharacter,
  onTriggerRoll,
  isLocked = false,
  onUnlockRequest,
  onSaveToCloud,
  onReturnToLobby,
  isInActiveRoom = false,
  roomCode,
}) => {
  const [activeTab, setActiveTab] = useState<'combat' | 'skills' | 'spells' | 'inventory' | 'features'>('combat');
  const [hpChangeAmount, setHpChangeAmount] = useState<number>(1);
  const [showHpModal, setShowHpModal] = useState<boolean>(false);
  const [hpModalMode, setHpModalMode] = useState<'heal' | 'damage' | 'temp'>('damage');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);

  // Modals for Adding / Editing Attacks
  const [editingAttack, setEditingAttack] = useState<AttackAction | null>(null);
  const [attackForm, setAttackForm] = useState<Partial<AttackAction>>({
    name: '',
    type: 'melee',
    attackBonus: 5,
    damageDice: '1d8+3',
    damageType: 'Cortante',
    range: '',
    notes: '',
  });

  // Modals for Adding / Editing Inventory Items
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<Partial<InventoryItem>>({
    name: '',
    quantity: 1,
    weight: 1,
    category: 'Equipo',
    rarity: 'Común',
    description: '',
    equipped: false,
    attunement: false,
  });

  // Modals for Adding / Editing Spells
  const [editingSpell, setEditingSpell] = useState<SpellItem | null>(null);
  const [spellForm, setSpellForm] = useState<Partial<SpellItem>>({
    name: '',
    level: 1,
    school: 'Evocación',
    castingTime: '1 Acción',
    range: '60 pies',
    components: 'V, S',
    duration: 'Instantáneo',
    description: '',
    prepared: true,
  });

  // Currency Modal & State
  const [showCurrencyModal, setShowCurrencyModal] = useState<boolean>(false);
  const [currencyForm, setCurrencyForm] = useState<Currency>({
    gp: 0,
    sp: 0,
    cp: 0,
    ep: 0,
    pp: 0,
  });
  const [quickDelta, setQuickDelta] = useState<number>(10);
  const [quickCoin, setQuickCoin] = useState<keyof Currency>('gp');

  const handleOpenCurrencyModal = () => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const curr = character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    setCurrencyForm({
      cp: curr.cp ?? 0,
      sp: curr.sp ?? 0,
      ep: curr.ep ?? 0,
      gp: curr.gp ?? 0,
      pp: curr.pp ?? 0,
    });
    setShowCurrencyModal(true);
  };

  const handleSaveCurrency = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    onUpdateCharacter({
      ...character,
      currency: {
        cp: Math.max(0, Math.floor(Number(currencyForm.cp) || 0)),
        sp: Math.max(0, Math.floor(Number(currencyForm.sp) || 0)),
        ep: Math.max(0, Math.floor(Number(currencyForm.ep) || 0)),
        gp: Math.max(0, Math.floor(Number(currencyForm.gp) || 0)),
        pp: Math.max(0, Math.floor(Number(currencyForm.pp) || 0)),
      },
    });
    setShowCurrencyModal(false);
  };

  const adjustQuickCurrency = (coin: keyof Currency, delta: number) => {
    setCurrencyForm((prev) => ({
      ...prev,
      [coin]: Math.max(0, (Number(prev[coin]) || 0) + delta),
    }));
  };

  const profBonus = calculateProficiencyBonus(character.level);
  const passivePerception = calculatePassivePerception(
    character.abilities.wis.score,
    character.skills.perception,
    profBonus
  );

  // HP Adjustments
  const applyHpChange = () => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const amt = Math.max(0, hpChangeAmount);
    let updated = { ...character };

    if (hpModalMode === 'heal') {
      updated.currentHp = Math.min(updated.maxHp, updated.currentHp + amt);
    } else if (hpModalMode === 'damage') {
      if (updated.tempHp > 0) {
        if (amt <= updated.tempHp) {
          updated.tempHp -= amt;
        } else {
          const remaining = amt - updated.tempHp;
          updated.tempHp = 0;
          updated.currentHp = Math.max(0, updated.currentHp - remaining);
        }
      } else {
        updated.currentHp = Math.max(0, updated.currentHp - amt);
      }
    } else if (hpModalMode === 'temp') {
      updated.tempHp = amt;
    }

    onUpdateCharacter(updated);
    setShowHpModal(false);
  };

  // Short rest hit dice roll
  const handleShortRestHitDie = () => {
    const match = character.hitDiceTotal.match(/d(\d+)/);
    const dieSides = match ? parseInt(match[1], 10) : 8;
    const conMod = calculateModifier(character.abilities.con.score);

    onTriggerRoll(`Descanso Corto: Dado de Golpe (1d${dieSides} + CON)`, conMod, dieSides);

    const maxDiceCount = parseInt(character.hitDiceTotal, 10) || character.level;
    if (character.hitDiceUsed < maxDiceCount && !isLocked) {
      onUpdateCharacter({
        ...character,
        hitDiceUsed: character.hitDiceUsed + 1,
      });
    }
  };

  const handleLongRest = () => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const maxDiceCount = parseInt(character.hitDiceTotal, 10) || character.level;
    const diceRegained = Math.max(1, Math.floor(maxDiceCount / 2));
    onUpdateCharacter({
      ...character,
      currentHp: character.maxHp,
      tempHp: 0,
      hitDiceUsed: Math.max(0, character.hitDiceUsed - diceRegained),
      deathSaves: { successes: 0, failures: 0 },
      spellSlots: character.spellSlots.map((s) => ({ ...s, expended: 0 })),
    });
  };

  const toggleDeathSave = (type: 'successes' | 'failures', index: number) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const current = character.deathSaves[type];
    const nextVal = current === index + 1 ? index : index + 1;
    onUpdateCharacter({
      ...character,
      deathSaves: {
        ...character.deathSaves,
        [type]: nextVal,
      },
    });
  };

  const cycleSkillProficiency = (key: SkillKey) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    const current = character.skills[key] || 'none';
    const next: 'none' | 'proficient' | 'expertise' =
      current === 'none' ? 'proficient' : current === 'proficient' ? 'expertise' : 'none';

    onUpdateCharacter({
      ...character,
      skills: {
        ...character.skills,
        [key]: next,
      },
    });
  };

  const toggleSaveProficiency = (key: AbilityKey) => {
    if (isLocked) {
      if (onUnlockRequest) onUnlockRequest();
      return;
    }
    onUpdateCharacter({
      ...character,
      abilities: {
        ...character.abilities,
        [key]: {
          ...character.abilities[key],
          proficientSave: !character.abilities[key].proficientSave,
        },
      },
    });
  };

  const totalWeight = character.inventory.reduce((sum, item) => sum + (item.weight * (item.quantity || 1)), 0);
  const carryCap = calculateCarryCapacity(character.abilities.str.score);

  return (
    <div className="space-y-6">
      {/* Lobby Navigation & Cloud Save Bar */}
      {(onReturnToLobby || onSaveToCloud) && (
        <div className="bg-[#14151b] border border-amber-900/50 rounded-2xl p-3 px-4 shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onReturnToLobby && (
              <button
                onClick={onReturnToLobby}
                className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-cinzel font-bold text-xs transition flex items-center gap-2 border border-stone-700 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Regresar al Lobby</span>
              </button>
            )}
            {isInActiveRoom && roomCode ? (
              <span className="px-3 py-1 rounded-xl bg-[#181922] border border-stone-800 text-xs font-mono text-amber-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Mesa: <strong>{roomCode}</strong>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-400 font-cinzel">
                Modo Edición en Solitario
              </span>
            )}
          </div>

          {onSaveToCloud && (
            <button
              onClick={onSaveToCloud}
              className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-cinzel font-bold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Guardar en la Nube
            </button>
          )}
        </div>
      )}

      {/* 1. Header Banner: Character Identity & Lock Status */}
      <div className="bg-[#1b1c23] border border-amber-900/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className={`relative group ${!isLocked ? 'cursor-pointer' : ''}`}
              onClick={() => !isLocked && setIsAvatarModalOpen(true)}
              title={!isLocked ? 'Haz clic para cambiar la ilustración o el icono del personaje' : undefined}
            >
              <EntityAvatar
                avatarType={character.avatarType || (character.avatarUrl ? 'custom' : 'icon')}
                customUrl={character.avatarCustomUrl || character.avatarUrl}
                iconId={character.avatarIcon || 'anonymous'}
                size="2xl"
                className="group-hover:border-amber-400 transition shadow-xl"
              />
              {!isLocked && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center transition text-amber-300">
                  <Edit3 className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold font-cinzel text-amber-200 tracking-wide">
                  {character.name}
                </h1>
                <button
                  onClick={() => {
                    if (isLocked) {
                      if (onUnlockRequest) onUnlockRequest();
                      return;
                    }
                    onUpdateCharacter({ ...character, inspiration: !character.inspiration });
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-cinzel font-bold tracking-wider flex items-center gap-1 border transition ${
                    character.inspiration
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-amber-500/20 shadow-md animate-pulse'
                      : 'bg-stone-800 text-stone-500 border-stone-700 hover:text-stone-300'
                  }`}
                  title="Inspiración del DM"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {character.inspiration ? 'INSPIRADO' : 'Inspiración'}
                </button>

                {/* Password / Lock Indicator */}
                {character.password && (
                  <button
                    onClick={onUnlockRequest}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono flex items-center gap-1 border transition ${
                      isLocked
                        ? 'bg-red-950/80 text-red-300 border-red-700 hover:bg-red-900'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    }`}
                    title={isLocked ? 'Hoja bloqueada con contraseña. Haz clic para desbloquear edición.' : 'Hoja desbloqueada para editar'}
                  >
                    {isLocked ? <Lock className="w-3 h-3 text-red-400" /> : <Unlock className="w-3 h-3 text-emerald-400" />}
                    <span>{isLocked ? 'Solo Lectura' : 'Editando'}</span>
                  </button>
                )}
              </div>
              <div className="text-stone-400 text-xs sm:text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-amber-400/90">
                  {character.race} {character.characterClass}
                </span>
                <span>• Nivel {character.level}</span>
                {character.subclass && <span>({character.subclass})</span>}
                <span>• {character.background}</span>
                <span>• {character.alignment}</span>
              </div>
            </div>
          </div>

          {/* Quick Badges: CA, Iniciativa, Velocidad, Competencia */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="bg-[#121316] border border-amber-900/50 rounded-xl px-3.5 py-2 text-center min-w-[70px]">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3 text-amber-500" />
                CA
              </div>
              <div className="text-xl font-cinzel font-black text-amber-300">{character.armorClass}</div>
            </div>

            <div
              onClick={() => onTriggerRoll('Iniciativa', character.initiativeBonus)}
              className="cursor-pointer bg-[#121316] border border-amber-900/50 hover:border-amber-500 rounded-xl px-3.5 py-2 text-center min-w-[70px] transition group"
              title="Haz clic para tirar Iniciativa"
            >
              <div className="text-[10px] uppercase tracking-wider text-stone-400 flex items-center justify-center gap-1 group-hover:text-amber-400">
                <Zap className="w-3 h-3 text-amber-500" />
                Inic.
              </div>
              <div className="text-xl font-cinzel font-black text-stone-100 group-hover:text-amber-300">
                {formatModifier(character.initiativeBonus)}
              </div>
            </div>

            <div className="bg-[#121316] border border-amber-900/50 rounded-xl px-3.5 py-2 text-center min-w-[70px]">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">Velocidad</div>
              <div className="text-xl font-cinzel font-black text-stone-100">{character.speed} ft</div>
            </div>

            <div className="bg-[#121316] border border-amber-900/50 rounded-xl px-3.5 py-2 text-center min-w-[70px]">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">Comp.</div>
              <div className="text-xl font-cinzel font-black text-amber-400">+{profBonus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Health & Survival Bar + Rest Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* HP Tracker Box */}
        <div className="md:col-span-2 bg-[#181920] border border-stone-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="font-cinzel font-bold text-sm text-stone-200">Puntos de Golpe (PG)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setHpModalMode('damage');
                  setShowHpModal(true);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 transition"
              >
                - Daño
              </button>
              <button
                onClick={() => {
                  setHpModalMode('heal');
                  setShowHpModal(true);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition"
              >
                + Curar
              </button>
              <button
                onClick={() => {
                  setHpModalMode('temp');
                  setShowHpModal(true);
                }}
                className="px-2 py-1 text-xs rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 transition"
              >
                PG Temp
              </button>
            </div>
          </div>

          {/* Bar */}
          <div className="h-4 bg-stone-900 rounded-full overflow-hidden border border-stone-700/60 mb-2 relative">
            <div
              className={`h-full transition-all duration-300 ${
                character.currentHp / character.maxHp > 0.5
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                  : character.currentHp / character.maxHp > 0.2
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                  : 'bg-gradient-to-r from-red-700 to-red-500 animate-pulse'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (character.currentHp / character.maxHp) * 100))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
            <div>
              Actual: <span className="font-bold text-lg text-stone-100">{character.currentHp}</span> / {character.maxHp}
              {character.tempHp > 0 && (
                <span className="text-blue-400 font-bold ml-2">+{character.tempHp} Temp</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>
                Dados de Golpe: {character.hitDiceTotal} ({parseInt(character.hitDiceTotal, 10) - character.hitDiceUsed} disp.)
              </span>
            </div>
          </div>
        </div>

        {/* Death Saves & Rests Box */}
        <div className="bg-[#181920] border border-stone-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold font-cinzel text-stone-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Tiradas de Muerte</span>
              <button
                onClick={() => onTriggerRoll('Tirada de Salvación contra Muerte', 0)}
                className="text-[10px] text-amber-400 hover:underline"
              >
                Tirar d20
              </button>
            </div>
            {/* Successes */}
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-emerald-400">Éxitos:</span>
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDeathSave('successes', idx)}
                    className={`w-4 h-4 rounded-full border transition ${
                      character.deathSaves.successes > idx
                        ? 'bg-emerald-500 border-emerald-400 shadow-sm'
                        : 'border-stone-600 hover:border-emerald-500'
                    }`}
                  />
                ))}
              </div>
            </div>
            {/* Failures */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400">Fracasos:</span>
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDeathSave('failures', idx)}
                    className={`w-4 h-4 rounded-full border transition ${
                      character.deathSaves.failures > idx
                        ? 'bg-red-600 border-red-500 shadow-sm'
                        : 'border-stone-600 hover:border-red-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-stone-800 mt-2">
            <button
              onClick={handleShortRestHitDie}
              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
              title="Gasta 1 Dado de Golpe y suma mod CON"
            >
              Descanso Corto
            </button>
            <button
              onClick={handleLongRest}
              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 transition"
              title="Recupera todos los PG y mitad de Dados de Golpe"
            >
              Descanso Largo
            </button>
          </div>
        </div>
      </div>

      {/* 3. Ability Scores Grid (6 Attributes) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(character.abilities) as AbilityKey[]).map((key) => {
          const ab = character.abilities[key];
          const mod = calculateModifier(ab.score);
          const saveMod = mod + (ab.proficientSave ? profBonus : 0);
          const meta = ABILITY_LABELS[key];

          return (
            <div
              key={key}
              className="bg-[#181920] border border-amber-900/30 rounded-xl p-3 flex flex-col items-center justify-between shadow relative hover:border-amber-700/60 transition group"
            >
              <div className="text-xs font-cinzel font-bold text-amber-400/90 tracking-wider">
                {meta.abbr}
              </div>
              <div className="text-[11px] text-stone-400">{meta.nameEs}</div>

              <button
                type="button"
                onClick={() => onTriggerRoll(`Prueba de ${meta.nameEs}`, mod)}
                className="my-1 w-14 h-14 rounded-full bg-[#121316] border-2 border-stone-700 group-hover:border-amber-500 flex items-center justify-center font-cinzel font-black text-2xl text-stone-100 group-hover:text-amber-300 transition shadow"
                title={`Haz clic para tirar Prueba de ${meta.nameEs} (d20 + ${mod})`}
              >
                {formatModifier(mod)}
              </button>

              <div className="text-xs text-stone-400 font-mono">Puntuación: {ab.score}</div>

              <div className="w-full mt-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => toggleSaveProficiency(key)}
                  className={`w-3.5 h-3.5 rounded-full border ${
                    ab.proficientSave ? 'bg-amber-500 border-amber-400' : 'border-stone-600'
                  }`}
                  title="Competencia en Tirada de Salvación"
                />
                <button
                  type="button"
                  onClick={() => onTriggerRoll(`Salvación de ${meta.nameEs}`, saveMod)}
                  className="font-medium text-stone-300 hover:text-amber-400 transition"
                  title="Tirar Salvación"
                >
                  Salv: {formatModifier(saveMod)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Tab Navigation */}
      <div className="border-b border-stone-800 flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        {[
          { id: 'combat', label: 'Combate y Acciones', icon: Sword },
          { id: 'skills', label: 'Habilidades (Skills)', icon: BookOpen },
          { id: 'spells', label: 'Lanza-Conjuros', icon: Flame },
          { id: 'inventory', label: 'Equipo e Inventario', icon: Backpack },
          { id: 'features', label: 'Rasgos y Trasfondo', icon: Scroll },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-cinzel font-semibold tracking-wider transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'bg-[#1e2029] text-amber-300 border-amber-500'
                  : 'text-stone-400 border-transparent hover:text-stone-200 hover:bg-[#15161c]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 5. TAB CONTENTS */}
      {/* TAB 1: Combat & Attacks */}
      {activeTab === 'combat' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel font-bold text-lg text-amber-200">Ataques y Acciones</h3>
            <button
              onClick={() => {
                if (isLocked) {
                  if (onUnlockRequest) onUnlockRequest();
                  return;
                }
                setEditingAttack({
                  id: `atk-${Date.now()}`,
                  name: '',
                  type: 'melee',
                  attackBonus: 5,
                  damageDice: '1d8+3',
                  damageType: 'Cortante',
                  range: '',
                  notes: '',
                });
                setAttackForm({
                  name: '',
                  type: 'melee',
                  attackBonus: 5,
                  damageDice: '1d8+3',
                  damageType: 'Cortante',
                  range: '',
                  notes: '',
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-white text-xs font-semibold font-cinzel transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Ataque</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {character.attacks.map((atk) => (
              <div
                key={atk.id}
                className="bg-[#181920] border border-stone-800 rounded-xl p-4 shadow flex flex-col justify-between hover:border-amber-800/60 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-100 font-cinzel text-base">{atk.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          setEditingAttack(atk);
                          setAttackForm(atk);
                        }}
                        className="text-stone-400 hover:text-amber-400 p-1"
                        title="Editar ataque"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          onUpdateCharacter({
                            ...character,
                            attacks: character.attacks.filter((a) => a.id !== atk.id),
                          });
                        }}
                        className="text-stone-500 hover:text-red-400 p-1"
                        title="Eliminar ataque"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-stone-400 mb-2">
                    Tipo: {atk.type === 'melee' ? 'Cuerpo a cuerpo' : atk.type === 'ranged' ? 'A distancia' : 'Mágico'}
                    {atk.range && ` • Alcance: ${atk.range}`}
                  </div>
                  {atk.notes && <div className="text-xs text-stone-500 italic mb-3">{atk.notes}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800">
                  <button
                    onClick={() => onTriggerRoll(`Ataque con ${atk.name}`, atk.attackBonus)}
                    className="py-1.5 px-2 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300 font-bold text-xs flex items-center justify-center gap-1 transition"
                  >
                    <Sword className="w-3.5 h-3.5" />
                    <span>+{atk.attackBonus} Impacto</span>
                  </button>
                  <button
                    onClick={() => {
                      const match = atk.damageDice.match(/^(\d*)d(\d+)([+-]\d+)?$/);
                      const sides = match ? parseInt(match[2], 10) : 8;
                      const mod = match && match[3] ? parseInt(match[3], 10) : 0;
                      onTriggerRoll(`Daño: ${atk.name} (${atk.damageType})`, mod, sides);
                    }}
                    className="py-1.5 px-2 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-mono font-semibold flex items-center justify-center gap-1 transition"
                  >
                    <span>{atk.damageDice}</span>
                    <span className="text-[10px] text-stone-400">({atk.damageType})</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit / Add Attack Modal */}
          {editingAttack && (
            <div className="bg-[#1b1c24] border border-amber-800/80 rounded-xl p-4 mt-3 animate-in fade-in">
              <h4 className="font-cinzel font-bold text-sm text-amber-300 mb-3">
                {character.attacks.some((a) => a.id === editingAttack.id) ? 'Editar Ataque / Arma' : 'Nuevo Ataque / Arma'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Nombre del Arma / Ataque</label>
                  <input
                    type="text"
                    value={attackForm.name}
                    onChange={(e) => setAttackForm({ ...attackForm, name: e.target.value })}
                    placeholder="Ej. Espada Larga +1"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Bonificador al Impacto</label>
                  <input
                    type="number"
                    value={attackForm.attackBonus}
                    onChange={(e) => setAttackForm({ ...attackForm, attackBonus: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Dados de Daño</label>
                  <input
                    type="text"
                    value={attackForm.damageDice}
                    onChange={(e) => setAttackForm({ ...attackForm, damageDice: e.target.value })}
                    placeholder="Ej. 1d8+3"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Tipo de Daño</label>
                  <input
                    type="text"
                    value={attackForm.damageType}
                    onChange={(e) => setAttackForm({ ...attackForm, damageType: e.target.value })}
                    placeholder="Cortante, Perforante, etc."
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Alcance / Rango</label>
                  <input
                    type="text"
                    value={attackForm.range}
                    onChange={(e) => setAttackForm({ ...attackForm, range: e.target.value })}
                    placeholder="5 pies o 30/120"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Tipo de Ataque</label>
                  <select
                    value={attackForm.type}
                    onChange={(e) => setAttackForm({ ...attackForm, type: e.target.value as any })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  >
                    <option value="melee">Cuerpo a cuerpo</option>
                    <option value="ranged">A distancia</option>
                    <option value="spell">Conjuro / Mágico</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">Notas especiales / Propiedades</label>
                <input
                  type="text"
                  value={attackForm.notes}
                  onChange={(e) => setAttackForm({ ...attackForm, notes: e.target.value })}
                  placeholder="Ej. Versátil (1d10), Sutil, Plata, etc."
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingAttack(null)} className="px-3 py-1 text-xs text-stone-400 hover:text-stone-200">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (attackForm.name) {
                      const exists = character.attacks.some((a) => a.id === editingAttack.id);
                      const updated = exists
                        ? character.attacks.map((a) =>
                            a.id === editingAttack.id ? { ...a, ...(attackForm as AttackAction) } : a
                          )
                        : [...character.attacks, { ...attackForm, id: editingAttack.id } as AttackAction];

                      onUpdateCharacter({ ...character, attacks: updated });
                      setEditingAttack(null);
                    }
                  }}
                  className="px-4 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-cinzel font-bold"
                >
                  Guardar Ataque
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Skills & Proficiencies */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#181920] p-3 rounded-xl border border-stone-800">
            <div className="text-xs text-stone-300">
              <span className="font-bold text-amber-400">Percepción Pasiva:</span> {passivePerception} (10 + Sabiduría + Bonificador de Percepción)
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border border-stone-600 inline-block" /> Sin comp.
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Competente
              </span>
              <span className="flex items-center gap-1">
                <span className="text-amber-400 font-bold">★</span> Pericia (x2)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(Object.keys(SKILL_METADATA) as SkillKey[]).map((key) => {
              const meta = SKILL_METADATA[key];
              const level = character.skills[key] || 'none';
              const abilityMod = calculateModifier(character.abilities[meta.ability].score);
              const totalBonus =
                abilityMod + (level === 'expertise' ? profBonus * 2 : level === 'proficient' ? profBonus : 0);

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-2.5 bg-[#181920] border border-stone-800/90 hover:border-amber-900/60 rounded-lg transition"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cycleSkillProficiency(key)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] transition ${
                        level === 'expertise'
                          ? 'bg-amber-600 border-amber-400 text-stone-900 font-black shadow-sm'
                          : level === 'proficient'
                          ? 'bg-amber-500 border-amber-400 text-stone-950 font-bold'
                          : 'border-stone-600 hover:border-stone-400 text-transparent'
                      }`}
                      title="Haz clic para cambiar entre: Sin competencia, Competente, Pericia"
                    >
                      {level === 'expertise' ? '★' : '●'}
                    </button>
                    <div>
                      <div className="text-xs font-semibold text-stone-200">{meta.nameEs}</div>
                      <div className="text-[10px] text-stone-500 uppercase">{meta.ability}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onTriggerRoll(`Prueba de ${meta.nameEs}`, totalBonus)}
                    className="px-2.5 py-1 rounded bg-[#121316] hover:bg-amber-950/80 border border-stone-700 hover:border-amber-600 font-mono font-bold text-xs text-amber-300 transition"
                    title={`Tirar ${meta.nameEs} (1d20 + ${totalBonus})`}
                  >
                    {formatModifier(totalBonus)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Spellcasting */}
      {activeTab === 'spells' && (
        <div className="space-y-4">
          <div className="bg-[#181920] border border-amber-900/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-cinzel font-bold text-amber-300 text-lg">Grimorio de Conjuros</h3>
              <p className="text-xs text-stone-400">
                Gestiona tus espacios de conjuro por nivel y conjuros preparados.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#121316] border border-amber-900/40 px-3 py-1.5 rounded-lg text-center">
                <div className="text-[10px] text-stone-400 uppercase">CD Salvación</div>
                <div className="font-cinzel font-black text-amber-400 text-lg">
                  {character.spellSaveDcOverride || calculateSpellSaveDC(character.abilities.int.score, profBonus)}
                </div>
              </div>
              <div className="bg-[#121316] border border-amber-900/40 px-3 py-1.5 rounded-lg text-center">
                <div className="text-[10px] text-stone-400 uppercase">Ataque Conjuro</div>
                <div className="font-cinzel font-black text-stone-100 text-lg">
                  +{character.spellAttackBonusOverride || calculateSpellAttackBonus(character.abilities.int.score, profBonus)}
                </div>
              </div>
              <button
                onClick={() => {
                  if (isLocked) {
                    if (onUnlockRequest) onUnlockRequest();
                    return;
                  }
                  setEditingSpell({
                    id: `spell-${Date.now()}`,
                    name: '',
                    level: 1,
                    school: 'Evocación',
                    castingTime: '1 Acción',
                    range: '60 pies',
                    components: 'V, S',
                    duration: 'Instantáneo',
                    description: '',
                    prepared: true,
                  });
                  setSpellForm({
                    name: '',
                    level: 1,
                    school: 'Evocación',
                    castingTime: '1 Acción',
                    range: '60 pies',
                    components: 'V, S',
                    duration: 'Instantáneo',
                    description: '',
                    prepared: true,
                  });
                }}
                className="flex items-center gap-1 px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-cinzel font-bold transition shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Conjuro</span>
              </button>
            </div>
          </div>

          {/* Spell Slots tracker (Levels 1 to 9) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
              const slot = character.spellSlots.find((s) => s.level === lvl) || {
                level: lvl,
                total: lvl <= 2 ? 4 - lvl : 0,
                expended: 0,
              };

              return (
                <div key={lvl} className="bg-[#181920] border border-stone-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-cinzel font-bold text-amber-400/90">Nivel {lvl}</span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {slot.total - slot.expended}/{slot.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: slot.total }).map((_, idx) => {
                      const isUsed = idx < slot.expended;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              if (onUnlockRequest) onUnlockRequest();
                              return;
                            }
                            const newSlots = [...character.spellSlots];
                            const existingIdx = newSlots.findIndex((s) => s.level === lvl);
                            const nextExpended = isUsed ? slot.expended - 1 : slot.expended + 1;

                            if (existingIdx >= 0) {
                              newSlots[existingIdx].expended = Math.max(0, Math.min(slot.total, nextExpended));
                            } else {
                              newSlots.push({ level: lvl, total: slot.total, expended: nextExpended });
                            }
                            onUpdateCharacter({ ...character, spellSlots: newSlots });
                          }}
                          className={`w-4 h-4 rounded-full border transition ${
                            isUsed
                              ? 'bg-stone-800 border-stone-700'
                              : 'bg-amber-500 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          }`}
                          title={`Espacio de nivel ${lvl} (${isUsed ? 'Gastado' : 'Disponible'})`}
                        />
                      );
                    })}
                    {slot.total === 0 && <span className="text-[10px] text-stone-600 italic">Sin espacios</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spells List */}
          <div className="space-y-2">
            {character.spells.length === 0 ? (
              <div className="text-center py-8 bg-[#181920] border border-stone-800 rounded-xl text-stone-500 text-sm italic">
                Aún no tienes conjuros registrados. ¡Añade trucos o conjuros a tu grimorio!
              </div>
            ) : (
              character.spells.map((spell) => (
                <div
                  key={spell.id}
                  className="bg-[#181920] border border-stone-800 rounded-xl p-3.5 hover:border-amber-900/60 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          const updated = character.spells.map((s) =>
                            s.id === spell.id ? { ...s, prepared: !s.prepared } : s
                          );
                          onUpdateCharacter({ ...character, spells: updated });
                        }}
                        className={`text-xs px-2 py-0.5 rounded font-cinzel font-bold border transition ${
                          spell.prepared
                            ? 'bg-amber-950/80 text-amber-300 border-amber-600'
                            : 'bg-stone-800 text-stone-500 border-stone-700'
                        }`}
                        title="Marcar como preparado"
                      >
                        {spell.prepared ? 'Preparado' : 'No prep.'}
                      </button>
                      <span className="font-bold font-cinzel text-stone-100">{spell.name}</span>
                      <span className="text-xs text-stone-400">
                        ({spell.level === 0 ? 'Truco' : `Nivel ${spell.level}`} - {spell.school})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          onTriggerRoll(
                            `Conjuro: ${spell.name}`,
                            calculateSpellAttackBonus(character.abilities.int.score, profBonus)
                          )
                        }
                        className="px-2 py-1 text-xs bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded font-semibold"
                      >
                        Lanzar
                      </button>
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          setEditingSpell(spell);
                          setSpellForm(spell);
                        }}
                        className="text-stone-400 hover:text-amber-400 p-1"
                        title="Editar conjuro"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          onUpdateCharacter({
                            ...character,
                            spells: character.spells.filter((s) => s.id !== spell.id),
                          });
                        }}
                        className="text-stone-500 hover:text-red-400 p-1"
                        title="Eliminar conjuro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-stone-400 flex flex-wrap gap-x-4 gap-y-1 mb-2">
                    <span>Tiempo: {spell.castingTime}</span>
                    <span>Alcance: {spell.range}</span>
                    <span>Componentes: {spell.components}</span>
                    <span>Duración: {spell.duration}</span>
                  </div>
                  {spell.description && <div className="text-xs text-stone-300 leading-relaxed">{spell.description}</div>}
                </div>
              ))
            )}
          </div>

          {/* Edit / Add Spell Modal */}
          {editingSpell && (
            <div className="bg-[#1b1c24] border border-amber-800/80 rounded-xl p-4 mt-3 animate-in fade-in">
              <h4 className="font-cinzel font-bold text-sm text-amber-300 mb-3">
                {character.spells.some((s) => s.id === editingSpell.id) ? 'Editar Conjuro' : 'Añadir Nuevo Conjuro'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Nombre del Conjuro</label>
                  <input
                    type="text"
                    value={spellForm.name}
                    onChange={(e) => setSpellForm({ ...spellForm, name: e.target.value })}
                    placeholder="Ej. Proyectil Mágico"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Nivel (0 para Truco)</label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={spellForm.level}
                    onChange={(e) => setSpellForm({ ...spellForm, level: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Escuela de Magia</label>
                  <input
                    type="text"
                    value={spellForm.school}
                    onChange={(e) => setSpellForm({ ...spellForm, school: e.target.value })}
                    placeholder="Evocación, Ilusión, etc."
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Tiempo de Lanzamiento</label>
                  <input
                    type="text"
                    value={spellForm.castingTime}
                    onChange={(e) => setSpellForm({ ...spellForm, castingTime: e.target.value })}
                    placeholder="1 Acción, 1 Acción Adicional"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Alcance</label>
                  <input
                    type="text"
                    value={spellForm.range}
                    onChange={(e) => setSpellForm({ ...spellForm, range: e.target.value })}
                    placeholder="60 pies, Tacto, Personal"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Componentes (V, S, M)</label>
                  <input
                    type="text"
                    value={spellForm.components}
                    onChange={(e) => setSpellForm({ ...spellForm, components: e.target.value })}
                    placeholder="V, S, M"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Duración</label>
                  <input
                    type="text"
                    value={spellForm.duration}
                    onChange={(e) => setSpellForm({ ...spellForm, duration: e.target.value })}
                    placeholder="Instantáneo, Concentración (1 min)"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">Efectos y Descripción del Conjuro</label>
                <textarea
                  value={spellForm.description}
                  onChange={(e) => setSpellForm({ ...spellForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingSpell(null)} className="px-3 py-1 text-xs text-stone-400">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (spellForm.name) {
                      const exists = character.spells.some((s) => s.id === editingSpell.id);
                      const updated = exists
                        ? character.spells.map((s) =>
                            s.id === editingSpell.id ? { ...s, ...(spellForm as SpellItem) } : s
                          )
                        : [...character.spells, { ...spellForm, id: editingSpell.id } as SpellItem];

                      onUpdateCharacter({ ...character, spells: updated });
                      setEditingSpell(null);
                    }
                  }}
                  className="px-4 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-cinzel font-bold"
                >
                  Guardar Conjuro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Inventory & Currency */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-[#181920] border border-amber-900/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-600/60 flex items-center justify-center text-amber-300 shadow">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="font-cinzel font-bold text-amber-300 text-sm flex items-center gap-1.5">
                  Bolsa de Monedas & Tesoro
                </div>
                <div className="text-[10px] text-stone-400 font-sans">
                  Total aprox: ~{(
                    ((character.currency?.pp || 0) * 10) +
                    (character.currency?.gp || 0) +
                    ((character.currency?.ep || 0) * 0.5) +
                    ((character.currency?.sp || 0) * 0.1) +
                    ((character.currency?.cp || 0) * 0.01)
                  ).toFixed(2)} PO en valor
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {[
                  { key: 'gp', name: 'Oro', label: 'PO', color: 'text-amber-300', border: 'hover:border-amber-500/80' },
                  { key: 'sp', name: 'Plata', label: 'PP', color: 'text-stone-300', border: 'hover:border-stone-400/80' },
                  { key: 'cp', name: 'Cobre', label: 'PC', color: 'text-orange-400', border: 'hover:border-orange-500/80' },
                  { key: 'ep', name: 'Electro', label: 'PE', color: 'text-yellow-600', border: 'hover:border-yellow-600/80' },
                  { key: 'pp', name: 'Platino', label: 'PL', color: 'text-cyan-300', border: 'hover:border-cyan-400/80' },
                ].map((coin) => (
                  <button
                    key={coin.key}
                    type="button"
                    onClick={handleOpenCurrencyModal}
                    title={`Editar monedas de ${coin.name}. Haz clic para abrir la bolsa.`}
                    className={`flex items-center gap-1.5 bg-[#121316] hover:bg-stone-800/80 px-2.5 py-1.5 rounded-lg border border-stone-800 transition ${coin.border} cursor-pointer group`}
                  >
                    <span className={`font-bold font-mono text-xs sm:text-sm ${coin.color}`}>
                      {(character.currency?.[coin.key as keyof typeof character.currency] ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-stone-500 group-hover:text-stone-300 uppercase font-mono font-bold">
                      {coin.label}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleOpenCurrencyModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-xs shadow-md transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Bolsa</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 px-1">
            <div>
              Peso portado:{' '}
              <span className={`font-bold font-mono ${totalWeight > carryCap.maxCarry ? 'text-red-400' : 'text-stone-200'}`}>
                {totalWeight.toFixed(1)} lbs
              </span>{' '}
              / Máx: {carryCap.maxCarry} lbs (FUE x 15)
            </div>
            <button
              onClick={() => {
                if (isLocked) {
                  if (onUnlockRequest) onUnlockRequest();
                  return;
                }
                setEditingItem({
                  id: `item-${Date.now()}`,
                  name: '',
                  quantity: 1,
                  weight: 1,
                  category: 'Equipo',
                  rarity: 'Común',
                  description: '',
                  equipped: false,
                  attunement: false,
                });
                setItemForm({
                  name: '',
                  quantity: 1,
                  weight: 1,
                  category: 'Equipo',
                  rarity: 'Común',
                  description: '',
                  equipped: false,
                  attunement: false,
                });
              }}
              className="flex items-center gap-1 px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-semibold font-cinzel transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Objeto</span>
            </button>
          </div>

          {/* Inventory Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {character.inventory.map((item) => (
              <div
                key={item.id}
                className="bg-[#181920] border border-stone-800 rounded-xl p-3 flex flex-col justify-between hover:border-amber-900/60 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-100 text-sm">{item.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 font-medium">
                        {item.category}
                      </span>
                      {item.rarity && item.rarity !== 'Común' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          {item.rarity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          setEditingItem(item);
                          setItemForm(item);
                        }}
                        className="text-stone-400 hover:text-amber-400 p-1"
                        title="Editar objeto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isLocked) {
                            if (onUnlockRequest) onUnlockRequest();
                            return;
                          }
                          onUpdateCharacter({
                            ...character,
                            inventory: character.inventory.filter((i) => i.id !== item.id),
                          });
                        }}
                        className="text-stone-500 hover:text-red-400 p-1"
                        title="Eliminar objeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-stone-400 mb-2">
                    Cantidad: x{item.quantity} • Peso: {item.weight} lbs c/u (Total: {(item.weight * (item.quantity || 1)).toFixed(1)} lbs)
                  </div>
                  {item.description && <div className="text-xs text-stone-400 italic mb-2 leading-relaxed">{item.description}</div>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs">
                  <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.equipped}
                      onChange={(e) => {
                        if (isLocked) {
                          if (onUnlockRequest) onUnlockRequest();
                          return;
                        }
                        const updated = character.inventory.map((i) =>
                          i.id === item.id ? { ...i, equipped: e.target.checked } : i
                        );
                        onUpdateCharacter({ ...character, inventory: updated });
                      }}
                      className="rounded border-stone-700 text-amber-600 focus:ring-0"
                    />
                    <span>Equipado</span>
                  </label>
                  {item.attunement && (
                    <span className="text-[10px] text-amber-400 font-semibold tracking-wider">
                      Requiere Sintonización
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Edit / Add Inventory Item Modal */}
          {editingItem && (
            <div className="bg-[#1b1c24] border border-amber-800/80 rounded-xl p-4 mt-3 animate-in fade-in">
              <h4 className="font-cinzel font-bold text-sm text-amber-300 mb-3">
                {character.inventory.some((i) => i.id === editingItem.id) ? 'Editar Objeto del Inventario' : 'Añadir Nuevo Objeto'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Nombre del Objeto</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="Ej. Cota de Malla"
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Peso Unitario (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={itemForm.weight}
                    onChange={(e) => setItemForm({ ...itemForm, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">Categoría</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as any })}
                    className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                  >
                    <option value="Arma">Arma</option>
                    <option value="Armadura">Armadura</option>
                    <option value="Poción">Poción</option>
                    <option value="Mágico">Mágico</option>
                    <option value="Equipo">Equipo de aventura</option>
                    <option value="Herramienta">Herramienta</option>
                    <option value="Munición">Munición</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">Descripción y Propiedades</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  placeholder="Detalles, bonificaciones, uso..."
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
                />
              </div>
              <div className="flex items-center gap-4 mb-3 text-xs text-stone-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.equipped}
                    onChange={(e) => setItemForm({ ...itemForm, equipped: e.target.checked })}
                    className="rounded border-stone-700 text-amber-600 focus:ring-0"
                  />
                  <span>Equipado</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.attunement}
                    onChange={(e) => setItemForm({ ...itemForm, attunement: e.target.checked })}
                    className="rounded border-stone-700 text-amber-600 focus:ring-0"
                  />
                  <span>Requiere Sintonización</span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingItem(null)} className="px-3 py-1 text-xs text-stone-400">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (itemForm.name) {
                      const exists = character.inventory.some((i) => i.id === editingItem.id);
                      const updated = exists
                        ? character.inventory.map((i) =>
                            i.id === editingItem.id ? { ...i, ...(itemForm as InventoryItem) } : i
                          )
                        : [...character.inventory, { ...itemForm, id: editingItem.id } as InventoryItem];

                      onUpdateCharacter({ ...character, inventory: updated });
                      setEditingItem(null);
                    }
                  }}
                  className="px-4 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-cinzel font-bold"
                >
                  Guardar Objeto
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Features, Personality & Backstory */}
      {activeTab === 'features' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
              <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-2">Rasgos de Personalidad</h4>
              <p className="text-xs text-stone-300 leading-relaxed">{character.personalityTraits || 'Sin registrar.'}</p>
            </div>

            <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
              <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-2">Ideales</h4>
              <p className="text-xs text-stone-300 leading-relaxed">{character.ideals || 'Sin registrar.'}</p>
            </div>

            <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
              <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-2">Vínculos</h4>
              <p className="text-xs text-stone-300 leading-relaxed">{character.bonds || 'Sin registrar.'}</p>
            </div>

            <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
              <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-2">Defectos</h4>
              <p className="text-xs text-stone-300 leading-relaxed">{character.flaws || 'Sin registrar.'}</p>
            </div>
          </div>

          <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
            <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-3">Rasgos Especiales y Dotes</h4>
            <div className="space-y-2.5">
              {character.featuresAndTraits.map((f) => (
                <div key={f.id} className="p-2.5 bg-[#121316] rounded-lg border border-stone-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-amber-200">{f.name}</span>
                    <span className="text-[10px] text-stone-400 uppercase font-mono">{f.source}</span>
                  </div>
                  <div className="text-xs text-stone-300">{f.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#181920] border border-stone-800 rounded-xl p-4">
            <h4 className="font-cinzel font-bold text-amber-300 text-sm mb-2">Historia del Personaje</h4>
            <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">
              {character.backstory || 'Sin historia registrada.'}
            </p>
          </div>
        </div>
      )}

      {/* HP Adjustment Modal */}
      {showHpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#181920] border-2 border-stone-700 rounded-xl p-5 text-stone-200 shadow-2xl">
            <h3 className="font-cinzel font-bold text-lg mb-3 text-stone-100">
              {hpModalMode === 'heal'
                ? 'Curar Puntos de Golpe'
                : hpModalMode === 'damage'
                ? 'Recibir Daño'
                : 'Asignar PG Temporales'}
            </h3>
            <p className="text-xs text-stone-400 mb-4">
              Ingresa la cantidad a {hpModalMode === 'heal' ? 'recuperar' : hpModalMode === 'damage' ? 'restar' : 'establecer'}:
            </p>
            <div className="flex items-center gap-3 mb-5">
              <input
                type="number"
                min="1"
                value={hpChangeAmount}
                onChange={(e) => setHpChangeAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-[#121316] border border-stone-700 text-2xl font-mono font-bold text-center rounded py-2 text-amber-400"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowHpModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-stone-200"
              >
                Cancelar
              </button>
              <button
                onClick={applyHpChange}
                className={`px-5 py-2 text-xs font-cinzel font-bold rounded text-white shadow ${
                  hpModalMode === 'heal'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : hpModalMode === 'damage'
                    ? 'bg-red-700 hover:bg-red-600'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Adjustment Modal */}
      {showCurrencyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#181920] border-2 border-amber-900/80 rounded-3xl p-6 sm:p-7 text-stone-200 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500/80 flex items-center justify-center text-amber-200 shadow-md">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-cinzel font-bold text-lg text-amber-300">
                    Bolsa de Monedas y Tesoro
                  </h3>
                  <p className="text-xs text-stone-400">
                    Ajusta o escribe la cantidad de monedas que porta {character.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCurrencyModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCurrency} className="flex-1 overflow-y-auto space-y-5 pr-1">
              {/* Total Worth Summary */}
              <div className="bg-gradient-to-r from-amber-950/50 via-stone-900 to-amber-950/50 border border-amber-900/50 rounded-2xl p-3.5 flex items-center justify-between">
                <span className="text-xs font-cinzel font-semibold text-stone-300">
                  Valor Estimado Total:
                </span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  ~{(
                    ((Number(currencyForm.pp) || 0) * 10) +
                    (Number(currencyForm.gp) || 0) +
                    ((Number(currencyForm.ep) || 0) * 0.5) +
                    ((Number(currencyForm.sp) || 0) * 0.1) +
                    ((Number(currencyForm.cp) || 0) * 0.01)
                  ).toFixed(2)} Piezas de Oro (PO)
                </span>
              </div>

              {/* Coins Input Grid */}
              <div className="space-y-3">
                {[
                  {
                    key: 'gp' as const,
                    name: 'Piezas de Oro (PO)',
                    abbr: 'PO / GP',
                    color: 'text-amber-300',
                    border: 'border-amber-600/60 focus-within:border-amber-400',
                    btnBg: 'hover:bg-amber-900/60 text-amber-300',
                    desc: 'Moneda estándar de comercio (1 PO = 10 PP = 100 PC)',
                  },
                  {
                    key: 'sp' as const,
                    name: 'Piezas de Plata (PP)',
                    abbr: 'PP / SP',
                    color: 'text-stone-300',
                    border: 'border-stone-600/60 focus-within:border-stone-300',
                    btnBg: 'hover:bg-stone-800 text-stone-300',
                    desc: 'Usada para gastos cotidianos (10 PP = 1 PO)',
                  },
                  {
                    key: 'cp' as const,
                    name: 'Piezas de Cobre (PC)',
                    abbr: 'PC / CP',
                    color: 'text-orange-400',
                    border: 'border-orange-600/60 focus-within:border-orange-400',
                    btnBg: 'hover:bg-orange-950/60 text-orange-400',
                    desc: 'Monedas de menor denominación (100 PC = 1 PO)',
                  },
                  {
                    key: 'ep' as const,
                    name: 'Piezas de Electro (PE)',
                    abbr: 'PE / EP',
                    color: 'text-yellow-600',
                    border: 'border-yellow-700/60 focus-within:border-yellow-500',
                    btnBg: 'hover:bg-yellow-950/60 text-yellow-500',
                    desc: 'Aleación antigua (1 PE = 0.5 PO = 5 PP)',
                  },
                  {
                    key: 'pp' as const,
                    name: 'Piezas de Platino (PL)',
                    abbr: 'PL / PP',
                    color: 'text-cyan-300',
                    border: 'border-cyan-600/60 focus-within:border-cyan-400',
                    btnBg: 'hover:bg-cyan-950/60 text-cyan-300',
                    desc: 'Moneda de alto valor (1 PL = 10 PO)',
                  },
                ].map((c) => (
                  <div
                    key={c.key}
                    className={`bg-[#121316] border ${c.border} rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-cinzel font-bold text-xs ${c.color}`}>
                          {c.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400 font-semibold">
                          {c.abbr}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5">{c.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => adjustQuickCurrency(c.key, -10)}
                        className={`w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 font-mono text-xs font-bold transition flex items-center justify-center ${c.btnBg}`}
                        title="Restar 10"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustQuickCurrency(c.key, -1)}
                        className={`w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 font-mono text-xs font-bold transition flex items-center justify-center ${c.btnBg}`}
                        title="Restar 1"
                      >
                        -1
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={currencyForm[c.key]}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setCurrencyForm((prev) => ({ ...prev, [c.key]: val }));
                        }}
                        className={`w-20 bg-stone-900/90 border border-stone-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-sm outline-none ${c.color}`}
                      />

                      <button
                        type="button"
                        onClick={() => adjustQuickCurrency(c.key, 1)}
                        className={`w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 font-mono text-xs font-bold transition flex items-center justify-center ${c.btnBg}`}
                        title="Sumar 1"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustQuickCurrency(c.key, 10)}
                        className={`w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 font-mono text-xs font-bold transition flex items-center justify-center ${c.btnBg}`}
                        title="Sumar 10"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botones de acción rápida de botín */}
              <div className="bg-[#121316] border border-stone-800 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-cinzel font-bold text-stone-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Ajuste Rápido de Botín / Compra
                  </span>
                  <div className="flex items-center gap-1">
                    {(['gp', 'sp', 'cp', 'pp'] as const).map((coin) => (
                      <button
                        key={coin}
                        type="button"
                        onClick={() => setQuickCoin(coin)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition ${
                          quickCoin === coin
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {coin}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {[-100, -50, -25, -5, +5, +25, +50, +100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => adjustQuickCurrency(quickCoin, amt)}
                      className={`py-1 rounded-lg text-[11px] font-mono font-bold transition border ${
                        amt > 0
                          ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-300 hover:bg-emerald-900'
                          : 'bg-red-950/60 border-red-800/70 text-red-300 hover:bg-red-900'
                      }`}
                    >
                      {amt > 0 ? `+${amt}` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCurrencyModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-cinzel text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Guardar Monedas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Customizer Modal */}
      {isAvatarModalOpen && (
        <AvatarCustomizerModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          title={`Icono / Avatar de ${character.name}`}
          currentType={character.avatarType || (character.avatarUrl ? 'custom' : 'icon')}
          currentCustomUrl={character.avatarCustomUrl || character.avatarUrl}
          currentIconId={character.avatarIcon || 'anonymous'}
          category="player"
          onSave={(data) => {
            onUpdateCharacter({
              ...character,
              avatarType: data.type,
              avatarCustomUrl: data.customUrl,
              avatarUrl: data.customUrl,
              avatarIcon: data.iconId,
            });
          }}
        />
      )}
    </div>
  );
};
