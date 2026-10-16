import React, { useState } from 'react';
import { Send, Users, Shield, Check, AlertCircle, Sparkles, X, Gift } from 'lucide-react';
import { InventoryItem, SpellItem, DMCustomItemOrSpell, PlayerSheetRecord } from '../../types/dnd';

export interface DMTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: {
    kind: 'item' | 'spell';
    title: string;
    item?: InventoryItem;
    spell?: SpellItem;
    customObj?: DMCustomItemOrSpell;
  } | null;
  vaultSheets: PlayerSheetRecord[];
  partyMembers?: any[];
  onSuccessMessage: (msg: string) => void;
}

export const DMTransferModal: React.FC<DMTransferModalProps> = ({
  isOpen,
  onClose,
  entity,
  vaultSheets,
  partyMembers = [],
  onSuccessMessage,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [includeDmSecrets, setIncludeDmSecrets] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !entity) return null;

  // Combine unique character options from live table party + server vault sheets
  const characterOptions = vaultSheets.map((s) => ({
    id: s.character.id || s.id,
    sheetId: s.id,
    name: s.character.name || s.name,
    playerName: s.character.playerName || s.ownerEmail,
    race: s.character.race,
    characterClass: s.character.characterClass,
    level: s.character.level,
  }));

  const handleTransfer = async () => {
    setErrorMsg('');
    if (!selectedCharId) {
      setErrorMsg('Por favor selecciona el personaje al que deseas entregar este elemento.');
      return;
    }

    const targetChar = characterOptions.find((c) => c.id === selectedCharId || c.sheetId === selectedCharId);
    if (!targetChar) {
      setErrorMsg('Personaje de destino no encontrado.');
      return;
    }

    setIsSending(true);

    try {
      // Build payload based on kind
      if (entity.kind === 'item') {
        const itemObj: InventoryItem = entity.item
          ? { ...entity.item, id: `inv-transfer-${Date.now()}` }
          : {
              id: `inv-transfer-${Date.now()}`,
              name: entity.customObj?.name || entity.title,
              quantity: 1,
              weight: 1,
              category: (entity.customObj?.category as any) || 'Equipo',
              rarity: entity.customObj?.rarity || 'Común',
              description:
                (entity.customObj?.description || '') +
                (entity.customObj?.properties ? `\nPropiedades: ${entity.customObj.properties}` : '') +
                (includeDmSecrets && entity.customObj?.dmSecrets ? `\nSecretos DM: ${entity.customObj.dmSecrets}` : ''),
            };

        const res = await fetch(`/api/vault/sheets/${targetChar.sheetId}/give-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: itemObj }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al entregar objeto.');

        // Broadcast to live table session
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('dnd_5e_session_channel');
          bc.postMessage({
            type: 'DM_GAVE_ITEM',
            payload: {
              targetCharacterId: targetChar.id,
              targetCharacterName: targetChar.name,
              item: itemObj,
            },
          });
          bc.close();
        }

        onSuccessMessage(`🎁 ¡"${itemObj.name}" entregado con éxito a ${targetChar.name}!`);
        onClose();
      } else {
        // Spell
        const spellObj: SpellItem = entity.spell
          ? { ...entity.spell, id: `spell-transfer-${Date.now()}` }
          : {
              id: `spell-transfer-${Date.now()}`,
              name: entity.customObj?.name || entity.title,
              level: 1,
              school: entity.customObj?.category || 'Arcano',
              castingTime: '1 acción',
              range: '30 pies',
              components: 'V, S',
              duration: 'Instantánea',
              description:
                (entity.customObj?.description || '') +
                (entity.customObj?.properties ? `\nPropiedades: ${entity.customObj.properties}` : '') +
                (includeDmSecrets && entity.customObj?.dmSecrets ? `\nSecretos DM: ${entity.customObj.dmSecrets}` : ''),
            };

        const res = await fetch(`/api/vault/sheets/${targetChar.sheetId}/give-spell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spell: spellObj }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al entregar conjuro.');

        // Broadcast to live table session
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('dnd_5e_session_channel');
          bc.postMessage({
            type: 'DM_GAVE_SPELL',
            payload: {
              targetCharacterId: targetChar.id,
              targetCharacterName: targetChar.name,
              spell: spellObj,
            },
          });
          bc.close();
        }

        onSuccessMessage(`🪄 ¡Conjuro "${spellObj.name}" enseñado con éxito a ${targetChar.name}!`);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en la conexión con el servidor.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-[#181920] border-2 border-amber-900/80 rounded-3xl shadow-2xl p-6 text-stone-200 flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950 border border-amber-600/80 flex items-center justify-center text-amber-300 shadow">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-base text-amber-300">
                {entity.kind === 'item' ? 'Entregar Objeto a Jugador' : 'Enseñar Conjuro a Jugador'}
              </h3>
              <p className="text-xs text-stone-400">
                Elemento: <strong className="text-stone-200">{entity.title}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Character Selector */}
        <div>
          <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1.5">
            Selecciona el Personaje Destino en la Mesa:
          </label>
          {characterOptions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#121316] border border-stone-800 text-stone-400 text-xs text-center">
              No hay fichas de personajes registradas en la bóveda o en la mesa.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {characterOptions.map((char) => {
                const isSelected = selectedCharId === char.id || selectedCharId === char.sheetId;
                return (
                  <button
                    key={char.sheetId}
                    type="button"
                    onClick={() => setSelectedCharId(char.sheetId)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow ring-1 ring-amber-500'
                        : 'bg-[#121316] border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div>
                      <span className="font-cinzel font-bold text-xs block text-stone-200">
                        {char.name}
                      </span>
                      <span className="text-[10px] text-stone-400 block font-sans">
                        {char.race} {char.characterClass} Nivel {char.level} ({char.playerName})
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DM Secrets checkbox if present */}
        {entity.customObj?.dmSecrets && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121316] border border-stone-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDmSecrets}
              onChange={(e) => setIncludeDmSecrets(e.target.checked)}
              className="rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-cinzel font-semibold text-stone-200 block">
                Incluir Notas Secretas del DM
              </span>
              <span className="text-[10px] text-stone-400 block">
                Permite que el jugador descubra el efecto secreto o la maldición en la descripción.
              </span>
            </div>
          </label>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-cinzel transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={isSending || characterOptions.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Entregando...' : 'Entregar a Jugador'}
          </button>
        </div>
      </div>
    </div>
  );
};
