import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Search,
  BookOpen,
  Sword,
  Shield,
  Wand2,
  Package,
  Folder,
  Send,
  Copy,
  Check,
  Gift,
  Lock,
} from 'lucide-react';
import { DMCustomItemOrSpell, InventoryItem, SpellItem, PlayerSheetRecord } from '../../types/dnd';
import { EntityAvatar } from '../common/EntityAvatar';
import { AvatarCustomizerModal } from '../common/AvatarCustomizerModal';
import { DMTransferModal } from './DMTransferModal';
import {
  SRD_WEAPONS,
  SRD_ARMORS,
  SRD_COMMON_SPELLS,
  WeaponDefinition,
  ArmorDefinition,
  SpellDefinition,
} from '../../data/srd';
import { folderMatchesFilter } from '../../utils/storage';

interface DMItemsAndSpellsViewProps {
  customItemsAndSpells: DMCustomItemOrSpell[];
  onUpdateItemsAndSpells: (updated: DMCustomItemOrSpell[]) => void;
  selectedFolder: string;
  folders: string[];
  onGiveItemToPlayer?: (item: InventoryItem) => void;
}

export const DMItemsAndSpellsView: React.FC<DMItemsAndSpellsViewProps> = ({
  customItemsAndSpells = [],
  onUpdateItemsAndSpells,
  selectedFolder,
  folders = [],
  onGiveItemToPlayer,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'custom' | 'srd_weapons' | 'srd_armors' | 'srd_spells'>('custom');
  const [filterType, setFilterType] = useState<'all' | 'item' | 'spell'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string>('');

  // Moving item modal
  const [movingItem, setMovingItem] = useState<DMCustomItemOrSpell | null>(null);

  // Transfer item/spell modal state
  const [vaultSheets, setVaultSheets] = useState<PlayerSheetRecord[]>([]);
  const [transferTarget, setTransferTarget] = useState<{
    kind: 'item' | 'spell';
    title: string;
    item?: InventoryItem;
    spell?: SpellItem;
    customObj?: DMCustomItemOrSpell;
  } | null>(null);

  const fetchVaultSheets = async () => {
    try {
      const res = await fetch('/api/vault/sheets');
      if (res.ok) {
        const data = await res.json();
        setVaultSheets(data.sheets || []);
      }
    } catch (err) {
      console.error('Error loading vault sheets:', err);
    }
  };

  // Form state
  const [form, setForm] = useState<Partial<DMCustomItemOrSpell>>({
    name: '',
    kind: 'item',
    rarity: 'Raro',
    category: 'Arma',
    whoHasIt: '',
    whereFound: '',
    description: '',
    properties: '',
    dmSecrets: '',
    folder: selectedFolder !== 'all' ? selectedFolder : 'General',
  });

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(''), 3000);
  };

  // Filter custom items by folder & type & search
  const filteredCustom = customItemsAndSpells.filter((entry) => {
    const matchesFolder = folderMatchesFilter(entry.folder, selectedFolder);
    const matchesType = filterType === 'all' || entry.kind === filterType;
    const matchesSearch =
      !searchQuery.trim() ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.whoHasIt || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.whereFound || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesType && matchesSearch;
  });

  // Filter SRD lists by search query
  const filteredSrdWeapons = SRD_WEAPONS.filter(
    (w) =>
      !searchQuery.trim() ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.damage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.properties.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSrdArmors = SRD_ARMORS.filter(
    (a) =>
      !searchQuery.trim() ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.ac.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSrdSpells = SRD_COMMON_SPELLS.filter(
    (s) =>
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.school.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      kind: 'item',
      rarity: 'Raro',
      category: 'Arma',
      whoHasIt: '',
      whereFound: '',
      description: '',
      properties: '',
      dmSecrets: '',
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    });
    setShowItemModal(true);
  };

  const handleOpenEdit = (item: DMCustomItemOrSpell) => {
    setEditingId(item.id);
    setForm({ ...item });
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    if (!form.name?.trim()) return;

    if (editingId) {
      const updated = customItemsAndSpells.map((i) =>
        i.id === editingId ? ({ ...i, ...form } as DMCustomItemOrSpell) : i
      );
      onUpdateItemsAndSpells(updated);
      showToast(`¡"${form.name}" actualizado!`);
    } else {
      const newItem: DMCustomItemOrSpell = {
        id: `cis-${Date.now()}`,
        name: form.name.trim(),
        kind: form.kind || 'item',
        rarity: form.rarity || 'Común',
        category: form.category || 'Objeto',
        whoHasIt: form.whoHasIt || 'Nadie / Por descubrir',
        whereFound: form.whereFound || 'Por definir',
        description: form.description || '',
        properties: form.properties || '',
        dmSecrets: form.dmSecrets || '',
        folder: form.folder || (selectedFolder !== 'all' ? selectedFolder : 'General'),
      };
      onUpdateItemsAndSpells([...customItemsAndSpells, newItem]);
      showToast(`¡"${newItem.name}" creado como objeto único del DM!`);
    }
    setShowItemModal(false);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('¿Eliminar este objeto/conjuro de la campaña?')) {
      onUpdateItemsAndSpells(customItemsAndSpells.filter((i) => i.id !== id));
      showToast('Elemento eliminado.');
    }
  };

  // Clone from SRD Weapon
  const handleCloneFromWeapon = (w: WeaponDefinition) => {
    setEditingId(null);
    setForm({
      name: `${w.name} de Leyenda`,
      kind: 'item',
      rarity: 'Raro',
      category: `Arma (${w.category} ${w.rangeType})`,
      whoHasIt: 'Jefe orco / Guardia de la cripta',
      whereFound: 'En un pedestal con runas antiguas',
      description: `Versión magistral de ${w.name}. Forjada con acero élfico templado en fuego sagrado.`,
      properties: `Daño: ${w.damage} ${w.damageType}. Peso: ${w.weight} lb. Propiedades: ${w.properties.join(', ') || 'Estándar'}.`,
      dmSecrets: 'Brilla tenuemente cuando hay monstruos hostiles a 60 pies.',
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    });
    setActiveSubTab('custom');
    setShowItemModal(true);
  };

  // Clone from SRD Armor
  const handleCloneFromArmor = (a: ArmorDefinition) => {
    setEditingId(null);
    setForm({
      name: `${a.name} de los Antiguos`,
      kind: 'item',
      rarity: 'Muy Raro',
      category: `Armadura (${a.category})`,
      whoHasIt: 'Estatua del caballero en el santuario',
      whereFound: 'Cofre ceremonial en las ruinas',
      description: `Protección superior basada en ${a.name}. Placas grabadas con bendiciones sagradas.`,
      properties: `CA: ${a.ac}. Coste base: ${a.cost}. Peso: ${a.weight} lb.${a.strengthReq ? ` FUE mín: ${a.strengthReq}.` : ''}`,
      dmSecrets: 'Otorga resistencia a daño necrótico 1 vez por descanso largo.',
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    });
    setActiveSubTab('custom');
    setShowItemModal(true);
  };

  // Clone from SRD Spell
  const handleCloneFromSpell = (s: SpellDefinition) => {
    setEditingId(null);
    setForm({
      name: `${s.name} Corrupto / Magistral`,
      kind: 'spell',
      rarity: s.level === 0 ? 'Poco común' : s.level <= 2 ? 'Raro' : 'Muy Raro',
      category: `Conjuro Nivel ${s.level} (${s.school})`,
      whoHasIt: 'Pergamino en la túnica del hechicero enemigo',
      whereFound: 'Cámara ritual secreta',
      description: s.description,
      properties: `Tiempo: ${s.castingTime} • Alcance: ${s.range} • Duración: ${s.duration} • Componentes: ${s.components}.`,
      dmSecrets: 'Consume el alma de una pequeña flor al ser pronunciado.',
      folder: selectedFolder !== 'all' ? selectedFolder : 'General',
    });
    setActiveSubTab('custom');
    setShowItemModal(true);
  };

  // Give generic weapon directly to player
  const handleGiveWeaponToPlayer = (w: WeaponDefinition) => {
    if (!onGiveItemToPlayer) return;
    const invItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: w.name,
      quantity: 1,
      weight: w.weight,
      category: 'Arma',
      rarity: 'Común',
      description: `Arma ${w.category.toLowerCase()} (${w.rangeType.toLowerCase()}). Daño: ${w.damage} ${w.damageType}. Propiedades: ${w.properties.join(', ') || 'Ninguna'}.`,
      equipped: false,
    };
    onGiveItemToPlayer(invItem);
    showToast(`¡"${w.name}" entregada a la hoja del personaje activo!`);
  };

  // Give generic armor directly to player
  const handleGiveArmorToPlayer = (a: ArmorDefinition) => {
    if (!onGiveItemToPlayer) return;
    const invItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: a.name,
      quantity: 1,
      weight: a.weight,
      category: 'Armadura',
      rarity: 'Común',
      description: `Armadura ${a.category.toLowerCase()}. CA: ${a.ac}. Peso: ${a.weight} lb.${a.strengthReq ? ` FUE mínima ${a.strengthReq}.` : ''}${a.stealthDisadvantage ? ' Desventaja en Sigilo.' : ''}`,
      equipped: false,
    };
    onGiveItemToPlayer(invItem);
    showToast(`¡"${a.name}" entregada a la hoja del personaje activo!`);
  };

  // Give custom item to player
  const handleGiveCustomToPlayer = (entry: DMCustomItemOrSpell) => {
    if (!onGiveItemToPlayer) return;
    const invItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: entry.name,
      quantity: 1,
      weight: entry.kind === 'spell' ? 0.5 : 3,
      category: entry.kind === 'spell' ? 'Mágico' : 'Arma',
      rarity: entry.rarity,
      description: `${entry.description}\n\nPropiedades: ${entry.properties || 'Sin propiedades'}${entry.whoHasIt ? `\nProcedencia: ${entry.whoHasIt}` : ''}`,
      equipped: false,
    };
    onGiveItemToPlayer(invItem);
    showToast(`¡"${entry.name}" asignado a la hoja del personaje activo!`);
  };

  // Move item to different folder
  const handleMoveFolder = (item: DMCustomItemOrSpell, targetFolder: string) => {
    const updated = customItemsAndSpells.map((i) =>
      i.id === item.id ? { ...i, folder: targetFolder } : i
    );
    onUpdateItemsAndSpells(updated);
    setMovingItem(null);
    showToast(`"${item.name}" movido a "${targetFolder}".`);
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {feedbackToast && (
        <div className="p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-600/70 text-xs text-emerald-200 flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#181920] border border-stone-800 rounded-xl p-3 shadow">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveSubTab('custom')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold transition whitespace-nowrap ${
              activeSubTab === 'custom'
                ? 'bg-amber-600 text-white shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Objetos & Conjuros Únicos DM ({customItemsAndSpells.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('srd_weapons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition whitespace-nowrap ${
              activeSubTab === 'srd_weapons'
                ? 'bg-amber-950 text-amber-300 border border-amber-600'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <Sword className="w-3.5 h-3.5" />
            <span>Armas SRD ({SRD_WEAPONS.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('srd_armors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition whitespace-nowrap ${
              activeSubTab === 'srd_armors'
                ? 'bg-amber-950 text-amber-300 border border-amber-600'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Armaduras SRD ({SRD_ARMORS.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('srd_spells')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition whitespace-nowrap ${
              activeSubTab === 'srd_spells'
                ? 'bg-purple-950 text-purple-300 border border-purple-600'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Conjuros SRD ({SRD_COMMON_SPELLS.length})</span>
          </button>
        </div>

        {/* Action Button */}
        {activeSubTab === 'custom' && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Objeto / Conjuro Único</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'custom'
                ? 'Buscar por nombre, portador, procedencia o propiedades...'
                : 'Buscar en el manual genérico SRD...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181920] border border-stone-800 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
          />
        </div>

        {activeSubTab === 'custom' && (
          <div className="flex items-center gap-1 bg-[#181920] p-1 rounded-xl border border-stone-800 shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                filterType === 'all' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('item')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                filterType === 'item' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Objetos
            </button>
            <button
              onClick={() => setFilterType('spell')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                filterType === 'spell' ? 'bg-purple-700 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Conjuros
            </button>
          </div>
        )}
      </div>

      {/* 1. VIEW: Custom DM Items & Spells */}
      {activeSubTab === 'custom' && (
        <div className="space-y-3">
          {filteredCustom.length === 0 ? (
            <div className="text-center py-12 bg-[#181920] border border-stone-800 rounded-xl text-stone-400 text-sm">
              <Sparkles className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
              <p className="font-cinzel font-bold text-amber-300 mb-1">
                No hay objetos o conjuros registrados en esta carpeta.
              </p>
              <p className="text-xs text-stone-500 max-w-md mx-auto mb-4">
                Crea tus propios artefactos y hechizos legendarios, o clona uno de los cientos de elementos de las pestañas del manual SRD (Armas, Armaduras y Conjuros).
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow"
              >
                + Crear el Primero
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCustom.map((item) => (
                <div
                  key={item.id}
                  className={`bg-[#181920] border rounded-xl p-4 flex flex-col justify-between shadow transition ${
                    item.kind === 'spell'
                      ? 'border-purple-900/60 hover:border-purple-600/70'
                      : 'border-amber-900/60 hover:border-amber-600/70'
                  }`}
                >
                  <div>
                    {/* Header: Title, Kind, Rarity */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                            item.kind === 'spell'
                              ? 'bg-purple-950/80 border-purple-600 text-purple-300'
                              : 'bg-amber-950/80 border-amber-600 text-amber-300'
                          }`}
                        >
                          {item.kind === 'spell' ? <Wand2 className="w-4 h-4" /> : <Sword className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-cinzel font-bold text-stone-100 text-sm">{item.name}</h4>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {item.category} • {item.kind === 'spell' ? 'Conjuro Único' : 'Objeto Único'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          item.rarity === 'Legendario' || item.rarity === 'Artefacto'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                            : item.rarity === 'Muy Raro'
                            ? 'bg-purple-950 text-purple-300 border-purple-700'
                            : item.rarity === 'Raro'
                            ? 'bg-blue-950 text-blue-300 border-blue-700'
                            : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}
                      >
                        {item.rarity}
                      </span>
                    </div>

                    {/* Who has it & Where found (Explicitly requested by user) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 text-xs bg-[#121316] p-2.5 rounded-lg border border-stone-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-400 block">
                          Quién lo tenía / Portador:
                        </span>
                        <span className="text-stone-200">{item.whoHasIt || 'Desconocido'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-400 block">
                          Dónde se consigue / Ubicación:
                        </span>
                        <span className="text-stone-200">{item.whereFound || 'Por descubrir'}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-stone-300 leading-relaxed mb-2.5">
                      {item.description || 'Sin descripción detallada.'}
                    </p>

                    {/* Mechanical properties */}
                    {item.properties && (
                      <div className="p-2 rounded bg-[#13141b] border border-stone-800 text-xs text-stone-200 mb-2">
                        <strong className="text-amber-300 block mb-0.5">Propiedades Mecánicas & Reglas:</strong>
                        <p className="font-mono text-[11px] leading-relaxed">{item.properties}</p>
                      </div>
                    )}

                    {/* Secret DM notes / curses */}
                    {item.dmSecrets && (
                      <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200/90 mb-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 mb-0.5">
                          <Lock className="w-3 h-3" />
                          <span>Secretos y Maldiciones del DM (Privado):</span>
                        </div>
                        <p className="italic leading-relaxed">{item.dmSecrets}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-2 mt-2 border-t border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
                      <Folder className="w-3 h-3 text-amber-500" />
                      {item.folder}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          fetchVaultSheets();
                          setTransferTarget({ kind: item.kind, title: item.name, customObj: item });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-[11px] font-cinzel font-bold flex items-center gap-1 shadow transition"
                        title="Selecciona el personaje en mesa al que deseas entregar este elemento"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Entregar / Compartir</span>
                      </button>

                      <button
                        onClick={() => setMovingItem(item)}
                        className="p-1 text-stone-400 hover:text-amber-300 rounded hover:bg-stone-800"
                        title="Mover a otra carpeta"
                      >
                        <Folder className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 text-stone-400 hover:text-amber-300 rounded hover:bg-stone-800"
                        title="Editar detalles"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 text-stone-500 hover:text-red-400 rounded hover:bg-stone-800"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. VIEW: SRD Weapons */}
      {activeSubTab === 'srd_weapons' && (
        <div className="space-y-3">
          <div className="text-xs text-stone-400 bg-[#14151c] p-3 rounded-xl border border-stone-800">
            <strong>Manual de Armas Oficiales 5E:</strong> Puedes clonar cualquier arma para personalizarla como objeto único de tu campaña (añadiendo quién la tenía, dónde se encuentra y propiedades legendarias), o entregarla directamente a un jugador.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSrdWeapons.map((w, idx) => (
              <div key={idx} className="bg-[#181920] border border-stone-800 rounded-xl p-3 flex flex-col justify-between shadow">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-cinzel font-bold text-stone-200 text-sm">{w.name}</h5>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-mono">
                      {w.damage} {w.damageType}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400 mb-1">
                    Arma {w.category} • {w.rangeType} • {w.weight} lb
                  </div>
                  <div className="text-xs text-stone-300 mb-3">
                    Propiedades: {w.properties.join(', ') || 'Ninguna'}
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCloneFromWeapon(w)}
                    className="flex-1 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-cinzel font-bold flex items-center justify-center gap-1 transition"
                    title="Clonar como base para crear un arma única legendaria"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Clonar como Único</span>
                  </button>

                  {onGiveItemToPlayer && (
                    <button
                      onClick={() => handleGiveWeaponToPlayer(w)}
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold flex items-center gap-1 transition"
                      title="Dar al jugador activo"
                    >
                      <Send className="w-3 h-3" />
                      <span>Dar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VIEW: SRD Armors & Shields */}
      {activeSubTab === 'srd_armors' && (
        <div className="space-y-3">
          <div className="text-xs text-stone-400 bg-[#14151c] p-3 rounded-xl border border-stone-800">
            <strong>Manual de Armaduras y Escudos Oficiales 5E:</strong> Clona cualquier armadura para otorgarle encantamientos o entrégala de inmediato a la hoja del personaje.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSrdArmors.map((a, idx) => (
              <div key={idx} className="bg-[#181920] border border-stone-800 rounded-xl p-3 flex flex-col justify-between shadow">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-cinzel font-bold text-stone-200 text-sm">{a.name}</h5>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-mono font-bold">
                      {a.ac}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400 mb-1">
                    Categoría: {a.category} • Peso: {a.weight} lb • Coste: {a.cost}
                  </div>
                  <div className="text-xs text-stone-300 mb-3">
                    {a.strengthReq ? `Fuerza requerida: ${a.strengthReq}. ` : ''}
                    {a.stealthDisadvantage ? 'Desventaja en pruebas de Sigilo.' : 'Sin penalizador de sigilo.'}
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCloneFromArmor(a)}
                    className="flex-1 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-cinzel font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Clonar como Único</span>
                  </button>

                  {onGiveItemToPlayer && (
                    <button
                      onClick={() => handleGiveArmorToPlayer(a)}
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Send className="w-3 h-3" />
                      <span>Dar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. VIEW: SRD Spells */}
      {activeSubTab === 'srd_spells' && (
        <div className="space-y-3">
          <div className="text-xs text-stone-400 bg-[#14151c] p-3 rounded-xl border border-stone-800">
            <strong>Grimorio de Conjuros Oficiales SRD:</strong> Úsalos de referencia rápida para tus combates, o clónalos para crear hechizos prohibidos o pergaminos legendarios del DM.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSrdSpells.map((s, idx) => (
              <div key={idx} className="bg-[#181920] border border-stone-800 rounded-xl p-3 flex flex-col justify-between shadow">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-cinzel font-bold text-stone-200 text-sm">{s.name}</h5>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-mono font-bold">
                      {s.level === 0 ? 'Truco' : `Nivel ${s.level}`} • {s.school}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400 mb-2">
                    {s.castingTime} • Alcance: {s.range} • {s.duration}
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed mb-3">{s.description}</p>
                </div>

                <div className="pt-2 border-t border-stone-800/80 flex justify-end">
                  <button
                    onClick={() => handleCloneFromSpell(s)}
                    className="py-1 px-3 rounded bg-purple-950 hover:bg-purple-900 border border-purple-700 text-purple-200 text-[11px] font-cinzel font-bold flex items-center gap-1 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Personalizar Hechizo para DM</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT UNIQUE CUSTOM ITEM OR SPELL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#181920] border-2 border-amber-800/80 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 text-stone-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-cinzel font-bold text-amber-300">
                  {editingId ? 'Editar Objeto o Conjuro Único' : 'Nuevo Objeto o Conjuro Único del DM'}
                </h3>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1 text-stone-400 hover:text-stone-100 rounded hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Type and Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-stone-400 mb-1">Nombre del Objeto o Conjuro:</label>
                  <input
                    type="text"
                    placeholder="Ej. Anillo de las Sombras Gemelas"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Tipo:</label>
                  <select
                    value={form.kind || 'item'}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as any })}
                    className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                  >
                    <option value="item">Objeto / Artefacto</option>
                    <option value="spell">Conjuro Mágico</option>
                  </select>
                </div>
              </div>

              {/* Rarity, Category, Folder */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Rareza:</label>
                  <select
                    value={form.rarity || 'Raro'}
                    onChange={(e) => setForm({ ...form, rarity: e.target.value as any })}
                    className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                  >
                    <option value="Común">Común</option>
                    <option value="Poco común">Poco común</option>
                    <option value="Raro">Raro</option>
                    <option value="Muy Raro">Muy Raro</option>
                    <option value="Legendario">Legendario</option>
                    <option value="Artefacto">Artefacto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Categoría / Subtipo:</label>
                  <input
                    type="text"
                    placeholder="Ej. Espada, Anillo, Conjuro Nivel 3..."
                    value={form.category || ''}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Carpeta de Destino:</label>
                  <select
                    value={form.folder || 'General'}
                    onChange={(e) => setForm({ ...form, folder: e.target.value })}
                    className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                  >
                    <option value="General">General</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* WHO HAS IT & WHERE FOUND (User requirement) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#121316] border border-stone-800">
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    ¿Quién lo tenía / Portador actual?
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Guardado por el archimago Vael / Capitán de la guardia"
                    value={form.whoHasIt || ''}
                    onChange={(e) => setForm({ ...form, whoHasIt: e.target.value })}
                    className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    ¿Dónde se consigue / Ubicación o Botín?
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. En el cofre con candado de la cripta sumergida"
                    value={form.whereFound || ''}
                    onChange={(e) => setForm({ ...form, whereFound: e.target.value })}
                    className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] text-stone-400 mb-1">Descripción y Apariencia:</label>
                <textarea
                  rows={2}
                  placeholder="Detalles visuales, brillo, runas o aura para describir a los jugadores..."
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 leading-relaxed"
                />
              </div>

              {/* Mechanical Properties */}
              <div>
                <label className="block text-[11px] text-stone-400 mb-1">
                  Propiedades Mecánicas (Daño, Bonos, Salvaciones, Usos):
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. +1 al ataque y daño. Inflige 1d8 fuego. 3 cargas para lanzar Escudo..."
                  value={form.properties || ''}
                  onChange={(e) => setForm({ ...form, properties: e.target.value })}
                  className="w-full bg-[#121316] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono"
                />
              </div>

              {/* DM Secret / Curse */}
              <div>
                <label className="block text-[11px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Secretos del DM o Maldiciones Ocultas:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Si mata a un inocente, su hoja se tiñe de sangre y no puede desenvainarse por 1 día..."
                  value={form.dmSecrets || ''}
                  onChange={(e) => setForm({ ...form, dmSecrets: e.target.value })}
                  className="w-full bg-[#121316] border border-amber-900/60 rounded-lg px-3 py-2 text-xs text-amber-200 italic"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-stone-800">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveItem}
                disabled={!form.name?.trim()}
                className="px-5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-cinzel font-bold text-xs rounded-lg shadow"
              >
                Guardar Objeto/Conjuro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK MOVE FOLDER */}
      {movingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181920] border-2 border-stone-700 rounded-xl max-w-sm w-full p-5 text-stone-200 shadow-2xl">
            <h4 className="font-cinzel font-bold text-sm text-amber-300 mb-2 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-amber-400" />
              Mover "{movingItem.name}"
            </h4>
            <p className="text-xs text-stone-400 mb-3">
              Selecciona la carpeta o subcarpeta a la que deseas mover este elemento:
            </p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 mb-4">
              <button
                onClick={() => handleMoveFolder(movingItem, 'General')}
                className={`w-full text-left p-2 rounded text-xs transition ${
                  movingItem.folder === 'General'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-[#121316] text-stone-300 hover:bg-stone-800'
                }`}
              >
                📁 General (Sin carpeta específica)
              </button>
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => handleMoveFolder(movingItem, f)}
                  className={`w-full text-left p-2 rounded text-xs transition ${
                    movingItem.folder === f
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-[#121316] text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  📁 {f}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setMovingItem(null)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DM Transfer Modal */}
      {transferTarget && (
        <DMTransferModal
          isOpen={Boolean(transferTarget)}
          onClose={() => setTransferTarget(null)}
          entity={transferTarget}
          vaultSheets={vaultSheets}
          onSuccessMessage={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
};
