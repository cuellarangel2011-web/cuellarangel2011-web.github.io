import React, { useState } from 'react';
import {
  X,
  Settings,
  Key,
  Bell,
  Sparkles,
  Shield,
  Save,
  Cpu,
  Layers,
  Palette,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  HelpCircle,
  Sword,
  BookOpen,
} from 'lucide-react';
import { HostSettings, ChangelogEntry } from '../../types/dnd';

interface HostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: HostSettings;
  onSaveSettings: (updated: HostSettings) => void;
}

export const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'app' | 'ai' | 'security' | 'changelog' | 'notice'>('app');

  // App & Branding
  const [headerTitle, setHeaderTitle] = useState<string>(settings.headerTitle || 'GRIMORIO 5E');
  const [headerSubtitle, setHeaderSubtitle] = useState<string>(
    settings.headerSubtitle || 'Companion & DM Suite v0.1'
  );
  const [headerLogoIcon, setHeaderLogoIcon] = useState<string>(settings.headerLogoIcon || 'shield');

  // AI & Models
  const [apiKey, setApiKey] = useState<string>(settings.apiKeyOverride || '');
  const [aiModel, setAiModel] = useState<string>(settings.aiModel || 'gemini-flash-lite-latest');
  const [oracleWelcome, setOracleWelcome] = useState<string>(
    settings.oracleWelcomeMessage ||
      'Saludos, viajero. Soy el Sabio Arcano, tu árbitro y custodio de las reglas de 5E. ¿Qué duda deseas resolver hoy?'
  );

  // Security & Passwords
  const [dmPassword, setDmPassword] = useState<string>(settings.dmPassword || '');
  const [moderatorPassword, setModeratorPassword] = useState<string>(settings.moderatorPassword || 'admin');
  const [roleSwitchingAllowed, setRoleSwitchingAllowed] = useState<'strict' | 'open'>(
    settings.roleSwitchingAllowed || 'strict'
  );

  // Developer Global Notice
  const [devNoticeEnabled, setDevNoticeEnabled] = useState<boolean>(settings.developerNotice?.enabled ?? true);
  const [devNoticeTitle, setDevNoticeTitle] = useState<string>(
    settings.developerNotice?.title || 'Grimorio 5E • Actualizaciones v0.1'
  );
  const [devNoticeContent, setDevNoticeContent] = useState<string>(
    settings.developerNotice?.content ||
      'Bienvenido a Grimorio 5E v0.1. Se ha implementado el sistema de roles protegidos (Jugador, DM, Moderador), carpetas jerárquicas hasta 3 niveles, objetos y conjuros para el DM con compendio genérico, mensaje en vivo del DM en la mesa y reinicio de combates.'
  );

  // Changelog List
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(() => settings.changelog || []);
  const [newVersionInput, setNewVersionInput] = useState<string>('');
  const [newVersionTitle, setNewVersionTitle] = useState<string>('');
  const [newVersionChanges, setNewVersionChanges] = useState<string>('');

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAddChangelogEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionInput.trim() || !newVersionTitle.trim()) return;

    const changesArray = newVersionChanges
      .split('\n')
      .map((c) => c.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean);

    const newEntry: ChangelogEntry = {
      version: newVersionInput.trim(),
      date: new Date().toISOString().split('T')[0],
      title: newVersionTitle.trim(),
      changes: changesArray.length > 0 ? changesArray : ['Actualizaciones menores del sistema.'],
    };

    setChangelog((prev) => [newEntry, ...prev]);
    setNewVersionInput('');
    setNewVersionTitle('');
    setNewVersionChanges('');
  };

  const handleRemoveChangelogEntry = (index: number) => {
    setChangelog((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    onSaveSettings({
      ...settings,
      headerTitle: headerTitle.trim() || 'GRIMORIO 5E',
      headerSubtitle: headerSubtitle.trim() || 'Companion & DM Suite v0.1',
      headerLogoIcon,
      apiKeyOverride: apiKey.trim(),
      aiModel,
      oracleWelcomeMessage: oracleWelcome.trim(),
      dmPassword: dmPassword.trim(),
      moderatorPassword: moderatorPassword.trim() || 'admin',
      developerNotice: {
        enabled: devNoticeEnabled,
        title: devNoticeTitle.trim(),
        content: devNoticeContent.trim(),
        version: headerSubtitle.match(/v\d+(\.\d+)*/i)?.[0] || '0.1',
      },
      changelog,
      roleSwitchingAllowed,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-[#181920] border-2 border-stone-700 rounded-2xl shadow-2xl p-6 text-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-600/50 flex items-center justify-center text-blue-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-cinzel font-bold text-lg text-amber-300">
                Ajustes Privados del Host & Creador
              </h3>
              <p className="text-[11px] text-stone-400">
                Configuración exclusiva del moderador: branding, IA, claves y blog de versiones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-stone-800 pb-3 mb-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'app'
                ? 'bg-amber-600 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Cabecera & Logo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'ai'
                ? 'bg-purple-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>IA & Claves API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'security'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Contraseñas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('changelog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'changelog'
                ? 'bg-blue-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Blog de Versiones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-semibold transition shrink-0 ${
              activeTab === 'notice'
                ? 'bg-rose-700 text-white shadow'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Aviso Global</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
          {/* TAB 1: APP & BRANDING */}
          {activeTab === 'app' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Título Principal del Encabezado
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Nombre principal de la aplicación que se muestra en la barra superior.
                </p>
                <input
                  type="text"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  placeholder="GRIMORIO 5E"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-cinzel font-bold tracking-wider"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Subtítulo de la Cabecera & Versión
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Texto secundario bajo el título. Puedes indicar la versión actual (ej. Companion & DM Suite v0.1).
                </p>
                <input
                  type="text"
                  value={headerSubtitle}
                  onChange={(e) => setHeaderSubtitle(e.target.value)}
                  placeholder="Companion & DM Suite v0.1"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1">
                  Icono / Logo de la Aplicación
                </label>
                <p className="text-[11px] text-stone-400 mb-3">
                  Selecciona el emblema que acompaña al título en el encabezado.
                </p>
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { id: 'shield', label: 'Escudo', icon: Shield },
                    { id: 'sword', label: 'Espada', icon: Sword },
                    { id: 'book', label: 'Grimorio', icon: BookOpen },
                    { id: 'sparkles', label: 'Magia', icon: Sparkles },
                  ].map((item) => {
                    const IconCmp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setHeaderLogoIcon(item.id)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                          headerLogoIcon === item.id
                            ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow'
                            : 'bg-[#181920] border-stone-700 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <IconCmp className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI & MODELS */}
          {activeTab === 'ai' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-400" />
                  Clave API de Gemini Personalizada (Opcional)
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Si deseas que la app use tu propia clave API personal de Gemini, ingrésala aquí. Se guardará localmente.
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Modelo de Inteligencia Artificial
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Selecciona el motor de Gemini para el Oráculo Arcano y los generadores del DM.
                </p>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono cursor-pointer"
                >
                  <option value="gemini-flash-lite-latest">Gemini Flash Lite Latest (Recomendado: Ultrarrápido y preciso)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Razonamiento profundo para tramas)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Compatible y ligero)</option>
                </select>
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Mensaje de Saludo del Sabio Arcano
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Mensaje inicial con el que el oráculo da la bienvenida a los jugadores al abrir el modal.
                </p>
                <textarea
                  value={oracleWelcome}
                  onChange={(e) => setOracleWelcome(e.target.value)}
                  rows={2}
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & PASSWORDS */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Contraseña del Dungeon Master
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Protege la pantalla del DM. Si está configurada, se requerirá al seleccionar el perfil de Dungeon Master.
                </p>
                <input
                  type="password"
                  value={dmPassword}
                  onChange={(e) => setDmPassword(e.target.value)}
                  placeholder="Dejar en blanco para acceso libre de DM"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-blue-400" />
                  Contraseña de Moderador / Creador
                </label>
                <p className="text-[11px] text-stone-400 mb-2">
                  Clave necesaria para acceder a esta ventana de Ajustes Privados del Host. (Por defecto: admin).
                </p>
                <input
                  type="password"
                  value={moderatorPassword}
                  onChange={(e) => setModeratorPassword(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-xs font-mono"
                />
              </div>

              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <label className="block text-xs font-cinzel font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Modo de Visualización de Roles (Jugador / DM)
                </label>
                <p className="text-[11px] text-stone-400 mb-3">
                  Determina si los usuarios ven únicamente su rol asignado o si se les permite alternar entre vista de Jugador y DM.
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-800 bg-[#181920] cursor-pointer hover:border-amber-600/50 transition">
                    <input
                      type="radio"
                      name="roleMode"
                      value="strict"
                      checked={roleSwitchingAllowed === 'strict'}
                      onChange={() => setRoleSwitchingAllowed('strict')}
                      className="mt-1 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-200">
                        Modo Estricto (Recomendado)
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Si un usuario inicia como Jugador, sólo ve la hoja y funciones de Jugador. Si inicia como DM, sólo ve la suite del DM. El Moderador siempre puede supervisar ambos.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-800 bg-[#181920] cursor-pointer hover:border-amber-600/50 transition">
                    <input
                      type="radio"
                      name="roleMode"
                      value="open"
                      checked={roleSwitchingAllowed === 'open'}
                      onChange={() => setRoleSwitchingAllowed('open')}
                      className="mt-1 text-amber-500 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-200">
                        Modo Abierto / Dual
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Muestra el conmutador de Jugador / Dungeon Master en la cabecera superior para que cualquier usuario pueda alternar entre ambas pantallas.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHANGELOG / UPDATES BLOG */}
          {activeTab === 'changelog' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Form to add a new version */}
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <h4 className="font-cinzel font-bold text-xs text-amber-300 mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Publicar Nueva Entrada en el Blog de Versiones
                </h4>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1">Número de Versión</label>
                      <input
                        type="text"
                        value={newVersionInput}
                        onChange={(e) => setNewVersionInput(e.target.value)}
                        placeholder="Ej. 0.2 o 1.0"
                        className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1">Título de la Actualización</label>
                      <input
                        type="text"
                        value={newVersionTitle}
                        onChange={(e) => setNewVersionTitle(e.target.value)}
                        placeholder="Ej. Nuevos Monstruos & Reglas"
                        className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-400 mb-1">
                      Novedades y Cambios (un cambio por línea)
                    </label>
                    <textarea
                      value={newVersionChanges}
                      onChange={(e) => setNewVersionChanges(e.target.value)}
                      rows={3}
                      placeholder="• Añadido soporte para dragones ancianos&#10;• Corrección en tiradas con ventaja&#10;• Nuevo compendio de pócimas"
                      className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 leading-relaxed font-sans"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddChangelogEntry}
                    disabled={!newVersionInput.trim() || !newVersionTitle.trim()}
                    className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-cinzel font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar al Historial de Versiones</span>
                  </button>
                </div>
              </div>

              {/* Current Changelog List */}
              <div className="space-y-2.5">
                <label className="block text-xs font-cinzel font-bold text-stone-300">
                  Historial de Actualizaciones ({changelog.length})
                </label>
                {changelog.map((entry, idx) => (
                  <div
                    key={idx}
                    className="bg-[#121316] border border-stone-800 rounded-xl p-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-600/40 text-amber-300">
                          v{entry.version}
                        </span>
                        <h5 className="font-cinzel font-bold text-xs text-stone-200">{entry.title}</h5>
                        <span className="text-[10px] text-stone-500">({entry.date})</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {entry.changes.map((c, cIdx) => (
                          <li key={cIdx} className="text-[11px] text-stone-400 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveChangelogEntry(idx)}
                      className="p-1 text-stone-500 hover:text-red-400 rounded hover:bg-stone-800 transition"
                      title="Eliminar esta versión"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: GLOBAL NOTICE */}
          {activeTab === 'notice' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#121316] border border-stone-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-cinzel font-bold text-rose-400 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-rose-400" />
                    Anuncio Público Emergente
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={devNoticeEnabled}
                      onChange={(e) => setDevNoticeEnabled(e.target.checked)}
                      className="rounded border-stone-700 text-rose-600 focus:ring-0"
                    />
                    <span>Mostrar al cargar la app</span>
                  </label>
                </div>
                <p className="text-[11px] text-stone-400 mb-2">
                  Este mensaje se mostrará a todos los usuarios cuando ingresen por primera vez a la sesión.
                </p>
                <input
                  type="text"
                  value={devNoticeTitle}
                  onChange={(e) => setDevNoticeTitle(e.target.value)}
                  placeholder="Título del anuncio..."
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 mb-2"
                />
                <textarea
                  value={devNoticeContent}
                  onChange={(e) => setDevNoticeContent(e.target.value)}
                  rows={3}
                  placeholder="Escribe el mensaje o novedades..."
                  className="w-full bg-[#181920] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 leading-relaxed font-sans"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-stone-800 mt-4 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            {savedSuccess && (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> ¡Ajustes guardados con éxito!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Todos los Ajustes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
