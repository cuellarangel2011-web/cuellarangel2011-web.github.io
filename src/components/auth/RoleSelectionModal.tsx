import React, { useState } from 'react';
import { User, Shield, KeyRound, Lock, AlertCircle, Sparkles, Check, ChevronRight } from 'lucide-react';
import { UserRole } from '../../types/dnd';

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  dmPasswordExpected?: string;
  moderatorPasswordExpected?: string;
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  canClose = false,
  dmPasswordExpected = '',
  moderatorPasswordExpected = 'admin',
  onSelectRole,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleChooseRoleCard = (role: UserRole) => {
    setErrorMessage('');
    setEnteredPassword('');

    // If player, no password needed
    if (role === 'player') {
      onSelectRole('player');
      return;
    }

    // If DM and has no password configured, proceed directly
    if (role === 'dm' && (!dmPasswordExpected || !dmPasswordExpected.trim())) {
      onSelectRole('dm');
      return;
    }

    // Otherwise, open password entry for DM or Moderator
    setSelectedRole(role);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedRole === 'dm') {
      if (!dmPasswordExpected || enteredPassword.trim() === dmPasswordExpected.trim()) {
        onSelectRole('dm');
      } else {
        setErrorMessage('Contraseña de Dungeon Master incorrecta.');
      }
    } else if (selectedRole === 'moderator') {
      const expected = moderatorPasswordExpected || 'admin';
      if (enteredPassword.trim() === expected.trim()) {
        onSelectRole('moderator');
      } else {
        setErrorMessage('Contraseña de Moderador incorrecta.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl bg-[#181920] border-2 border-amber-900/80 rounded-2xl shadow-2xl p-6 sm:p-8 text-stone-200 flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500 shadow-lg text-amber-200 mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="font-cinzel font-black text-2xl text-amber-300 tracking-wider">
            GRIMORIO 5E
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-cinzel">
            Selecciona tu Perfil de Acceso
          </p>
        </div>

        {/* If no role is being prompted for password, show role cards */}
        {!selectedRole ? (
          <div className="space-y-3.5">
            {/* 1. Jugador */}
            <button
              type="button"
              onClick={() => handleChooseRoleCard('player')}
              className="w-full text-left p-4 rounded-xl bg-[#131418] hover:bg-[#1c1e27] border-2 border-stone-800 hover:border-amber-600 transition flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-950/70 border border-amber-600/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-cinzel font-bold text-sm text-stone-100 group-hover:text-amber-300 transition">
                    Jugador / Aventurero
                  </h4>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">
                    Ficha de personaje 5E, tiradas de dados en vivo y consulta de reglas.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
            </button>

            {/* 2. Dungeon Master */}
            <button
              type="button"
              onClick={() => handleChooseRoleCard('dm')}
              className="w-full text-left p-4 rounded-xl bg-[#131418] hover:bg-[#1e172a] border-2 border-stone-800 hover:border-purple-600 transition flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-purple-950/70 border border-purple-600/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-cinzel font-bold text-sm text-stone-100 group-hover:text-purple-300 transition">
                      Dungeon Master
                    </h4>
                    {dmPasswordExpected && (
                      <span className="text-[10px] text-purple-400 flex items-center gap-0.5 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
                        <Lock className="w-2.5 h-2.5" /> Protegido
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">
                    Pantalla de combate, iniciativa, NPCs, monstruos, mapas y secretos confidenciales.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
            </button>

            {/* 3. Moderador / Creador */}
            <button
              type="button"
              onClick={() => handleChooseRoleCard('moderator')}
              className="w-full text-left p-4 rounded-xl bg-[#131418] hover:bg-[#151f28] border-2 border-stone-800 hover:border-blue-600 transition flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-950/70 border border-blue-600/40 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-cinzel font-bold text-sm text-stone-100 group-hover:text-blue-300 transition">
                      Moderador / Desarrollador
                    </h4>
                    <span className="text-[10px] text-blue-400 flex items-center gap-0.5 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/50">
                      <Lock className="w-2.5 h-2.5" /> Clave Requerida
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">
                    Ajustes de API, modelos de IA, títulos de cabecera y blog de versiones.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
            </button>
          </div>
        ) : (
          /* Password Form for DM or Moderator */
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#121316] border border-stone-800">
              <div className="flex items-center gap-2.5 mb-2">
                <Lock className={`w-5 h-5 ${selectedRole === 'dm' ? 'text-purple-400' : 'text-blue-400'}`} />
                <h3 className="font-cinzel font-bold text-base text-stone-200">
                  {selectedRole === 'dm' ? 'Acceso al Dungeon Master' : 'Acceso de Moderador'}
                </h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                {selectedRole === 'dm'
                  ? 'Introduce la contraseña establecida por el Dungeon Master para acceder a sus expedientes confidenciales.'
                  : 'Introduce la clave de acceso de moderador para gestionar ajustes del host (por defecto "admin").'}
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setErrorMessage('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                ← Volver a roles
              </button>

              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-cinzel font-bold text-xs text-white shadow-lg transition ${
                  selectedRole === 'dm'
                    ? 'bg-purple-700 hover:bg-purple-600'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                Verificar & Entrar
              </button>
            </div>
          </form>
        )}

        {/* Can close if already logged in previously */}
        {canClose && onClose && (
          <div className="mt-6 pt-4 border-t border-stone-800/80 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-stone-500 hover:text-stone-300 transition"
            >
              Mantener sesión actual
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
