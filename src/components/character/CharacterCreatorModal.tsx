import React, { useState } from 'react';
import { X, Sparkles, Wand2, Shield, User, Dices } from 'lucide-react';
import { Character5e, AbilityKey } from '../../types/dnd';
import { SRD_CLASSES, SRD_RACES, ABILITY_LABELS } from '../../data/srd';
import { calculateModifier, calculateProficiencyBonus } from '../../utils/dnd-math';

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCharacterCreated: (character: Character5e) => void;
}

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  isOpen,
  onClose,
  onCharacterCreated,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Jugador');
  const [characterClass, setCharacterClass] = useState<string>('Guerrero');
  const [race, setRace] = useState<string>('Humano');
  const [background, setBackground] = useState<string>('Soldado');
  const [alignment, setAlignment] = useState<string>('Neutral Bueno');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const [scores, setScores] = useState<Record<AbilityKey, number>>({
    str: 15,
    dex: 14,
    con: 13,
    int: 12,
    wis: 10,
    cha: 8,
  });

  const [personalityTraits, setPersonalityTraits] = useState<string>('');
  const [ideals, setIdeals] = useState<string>('');
  const [bonds, setBonds] = useState<string>('');
  const [flaws, setFlaws] = useState<string>('');
  const [backstory, setBackstory] = useState<string>('');

  if (!isOpen) return null;

  const handleAiGenerate = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/gemini/generate-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: `${race} ${characterClass} con trasfondo ${background}`,
          characterClass,
          race,
        }),
      });
      const data = await res.json();
      if (data) {
        if (data.name) setName(data.name);
        if (data.backstory) setBackstory(data.backstory);
        if (data.personalityTraits) setPersonalityTraits(data.personalityTraits);
        if (data.ideals) setIdeals(data.ideals);
        if (data.bonds) setBonds(data.bonds);
        if (data.flaws) setFlaws(data.flaws);
        if (data.recommendedScores) setScores(data.recommendedScores);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFinish = () => {
    const classData = SRD_CLASSES[characterClass] || SRD_CLASSES.Guerrero;
    const hitDieNum = parseInt(classData.hitDie.replace('d', ''), 10) || 10;
    const conMod = calculateModifier(scores.con);
    const maxHp = hitDieNum + conMod;

    const newChar: Character5e = {
      id: `char-${Date.now()}`,
      name: name.trim() || 'Aventurero Sin Nombre',
      playerName: playerName.trim() || 'Jugador',
      race,
      characterClass,
      level: 1,
      experience: 0,
      background,
      alignment,
      avatarUrl: avatarUrl || undefined,
      maxHp,
      currentHp: maxHp,
      tempHp: 0,
      armorClass: 10 + calculateModifier(scores.dex),
      initiativeBonus: calculateModifier(scores.dex),
      speed: 30,
      hitDiceTotal: `1${classData.hitDie}`,
      hitDiceUsed: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
      abilities: {
        str: { score: scores.str, proficientSave: classData.savingThrows.includes('str') },
        dex: { score: scores.dex, proficientSave: classData.savingThrows.includes('dex') },
        con: { score: scores.con, proficientSave: classData.savingThrows.includes('con') },
        int: { score: scores.int, proficientSave: classData.savingThrows.includes('int') },
        wis: { score: scores.wis, proficientSave: classData.savingThrows.includes('wis') },
        cha: { score: scores.cha, proficientSave: classData.savingThrows.includes('cha') },
      },
      skills: {
        acrobatics: 'none',
        animalHandling: 'none',
        arcana: 'none',
        athletics: 'none',
        deception: 'none',
        history: 'none',
        insight: 'none',
        intimidation: 'none',
        investigation: 'none',
        medicine: 'none',
        nature: 'none',
        perception: 'none',
        performance: 'none',
        persuasion: 'none',
        religion: 'none',
        sleightOfHand: 'none',
        stealth: 'none',
        survival: 'none',
      },
      armorProficiencies: classData.armorProficiencies,
      weaponProficiencies: classData.weaponProficiencies,
      toolProficiencies: [],
      languages: ['Común'],
      attacks: [
        {
          id: `atk-init-${Date.now()}`,
          name: 'Arma Inicial',
          type: 'melee',
          attackBonus: calculateModifier(scores.str) + 2,
          damageDice: '1d8+' + calculateModifier(scores.str),
          damageType: 'Cortante',
        },
      ],
      spellSlots: [],
      spells: [],
      inventory: [
        {
          id: `inv-pack-${Date.now()}`,
          name: 'Mochila de Aventurero',
          quantity: 1,
          weight: 12,
          category: 'Equipo',
          description: 'Raciones, odre de agua, cuerda de 50 pies, yesquero.',
        },
      ],
      currency: { cp: 10, sp: 10, ep: 0, gp: 15, pp: 0 },
      featuresAndTraits: [
        {
          id: `feat-${Date.now()}`,
          name: `Competencias de ${characterClass}`,
          source: 'Clase',
          description: classData.description,
        },
      ],
      personalityTraits: personalityTraits || 'Curioso y valiente.',
      ideals: ideals || 'Honor: Cumplo mi palabra.',
      bonds: bonds || 'Protejo a mis compañeros de grupo.',
      flaws: flaws || 'A veces actúo sin pensar en el peligro.',
      backstory: backstory || 'Comenzó su viaje para descubrir los misterios del reino.',
      notes: '',
    };

    onCharacterCreated(newChar);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-title"
    >
      <div className="relative w-full max-w-2xl bg-[#181920] border-2 border-amber-900/60 rounded-2xl shadow-2xl p-6 text-stone-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-900/30 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-amber-500" />
            <h2 id="creator-title" className="text-xl font-bold font-cinzel text-amber-400">
              Creador de Personaje 5E (Paso {step} de 3)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Auto-generate button */}
        <div className="mb-4 p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-between gap-3">
          <div className="text-xs text-purple-200">
            ¿Quieres que <strong>Gemini Flash</strong> genere una historia, nombre e ideales coherentes?
          </div>
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isAiLoading}
            className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-cinzel font-bold text-xs flex items-center gap-1.5 shrink-0 transition shadow"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
            <span>{isAiLoading ? 'Invocando...' : 'Autocompletar con IA'}</span>
          </button>
        </div>

        {/* STEP 1: Basic Identity */}
        {step === 1 && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  Nombre del Personaje
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Kaelen Vientosombrío"
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  Nombre del Jugador
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  Clase
                </label>
                <select
                  value={characterClass}
                  onChange={(e) => setCharacterClass(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
                >
                  {Object.keys(SRD_CLASSES).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls} ({SRD_CLASSES[cls].hitDie})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  Raza
                </label>
                <select
                  value={race}
                  onChange={(e) => setRace(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
                >
                  {SRD_RACES.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  Alineamiento
                </label>
                <select
                  value={alignment}
                  onChange={(e) => setAlignment(e.target.value)}
                  className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
                >
                  <option value="Legal Bueno">Legal Bueno</option>
                  <option value="Neutral Bueno">Neutral Bueno</option>
                  <option value="Caótico Bueno">Caótico Bueno</option>
                  <option value="Legal Neutral">Legal Neutral</option>
                  <option value="Neutral Puro">Neutral Puro</option>
                  <option value="Caótico Neutral">Caótico Neutral</option>
                  <option value="Legal Maligno">Legal Maligno</option>
                  <option value="Neutral Maligno">Neutral Maligno</option>
                  <option value="Caótico Maligno">Caótico Maligno</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                URL de Avatar / Retrato (Opcional)
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-2 text-stone-100 text-sm"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Ability Scores */}
        {step === 2 && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <p className="text-xs text-stone-400">
              Distribuye las puntuaciones de característica. Puedes usar el conjunto estándar (15, 14, 13, 12, 10, 8) o ajustarlas manualmente:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(scores) as AbilityKey[]).map((key) => {
                const val = scores[key];
                const mod = calculateModifier(val);
                const meta = ABILITY_LABELS[key];

                return (
                  <div key={key} className="bg-[#121316] border border-stone-800 rounded-xl p-3 text-center">
                    <span className="font-cinzel font-bold text-amber-400 text-sm block">
                      {meta.nameEs} ({meta.abbr})
                    </span>
                    <input
                      type="number"
                      min="3"
                      max="20"
                      value={val}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [key]: Math.max(3, Math.min(20, parseInt(e.target.value, 10) || 10)),
                        })
                      }
                      className="w-16 bg-[#181920] border border-stone-700 font-mono font-bold text-lg text-center rounded py-1 my-1 text-stone-100"
                    />
                    <div className="text-xs text-stone-400 font-mono">Mod: {mod >= 0 ? `+${mod}` : mod}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Personality & Backstory */}
        {step === 3 && (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                Rasgos de Personalidad
              </label>
              <textarea
                value={personalityTraits}
                onChange={(e) => setPersonalityTraits(e.target.value)}
                rows={2}
                placeholder="¿Cómo se comporta tu personaje ante extraños o peligros?"
                className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                Ideales y Vínculos
              </label>
              <textarea
                value={ideals}
                onChange={(e) => setIdeals(e.target.value)}
                rows={2}
                placeholder="¿Por qué lucha? ¿A quién protege?"
                className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
                Historia de Origen (Backstory)
              </label>
              <textarea
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                rows={3}
                placeholder="El pasado que lo llevó a convertirse en aventurero..."
                className="w-full bg-[#121316] border border-stone-700 rounded px-3 py-1.5 text-xs text-stone-100"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-4 border-t border-stone-800 flex justify-between items-center mt-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-xs font-semibold rounded bg-stone-800 text-stone-300 hover:bg-stone-700"
            >
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 text-xs font-cinzel font-bold rounded bg-amber-600 hover:bg-amber-500 text-white"
            >
              Siguiente Paso
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 text-xs font-cinzel font-bold rounded bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg"
            >
              Crear Hoja de Personaje
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
