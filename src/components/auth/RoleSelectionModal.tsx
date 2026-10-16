import React, { useState } from 'react';
import { User, Shield, KeyRound, Lock, AlertCircle, Sparkles, Check, ChevronRight, Mail, UserPlus, LogIn, Clock } from 'lucide-react';
import { UserRole } from '../../types/dnd';

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
}

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  dmPasswordExpected?: string;
  moderatorPasswordExpected?: string;
  onSelectRole: (role: UserRole, user?: AuthSessionUser) => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  canClose = false,
  dmPasswordExpected = '',
  moderatorPasswordExpected = 'admin',
  onSelectRole,
}) => {
  const [authMode, setAuthMode] = useState<'cards' | 'login' | 'register' | 'adminPassword'>('cards');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Register form state
  const [regEmail, setRegEmail] = useState<string>('');
  const [regName, setRegName] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regRole, setRegRole] = useState<'player' | 'dm' | 'both'>('player');

  // Direct DM / Admin password
  const [enteredPassword, setEnteredPassword] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pendingNotice, setPendingNotice] = useState<string>('');

  if (!isOpen) return null;

  const handleChooseRoleCard = (role: UserRole) => {
    setErrorMessage('');
    setPendingNotice('');
    setEnteredPassword('');

    if (role === 'moderator') {
      setSelectedRole('moderator');
      setAuthMode('adminPassword');
      return;
    }

    if (role === 'player') {
      setSelectedRole('player');
      setAuthMode('login');
      return;
    }

    if (role === 'dm') {
      setSelectedRole('dm');
      if (dmPasswordExpected && dmPasswordExpected.trim()) {
        setAuthMode('adminPassword');
      } else {
        setAuthMode('login');
      }
    }
  };

  const handleDirectPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedRole === 'dm') {
      if (!dmPasswordExpected || enteredPassword.trim() === dmPasswordExpected.trim()) {
        onSelectRole('dm', {
          id: 'dm-local',
          email: 'dm@weroll.app',
          displayName: 'Dungeon Master',
          role: 'dm',
          status: 'approved',
        });
      } else {
        setErrorMessage('Contraseña de Dungeon Master incorrecta.');
      }
    } else if (selectedRole === 'moderator') {
      const expected = moderatorPasswordExpected || 'admin';
      if (enteredPassword.trim() === expected.trim()) {
        onSelectRole('moderator', {
          id: 'admin-master',
          email: 'admin@weroll.app',
          displayName: 'Administrador Supremo',
          role: 'moderator',
          status: 'approved',
        });
      } else {
        setErrorMessage('Contraseña de Administrador incorrecta.');
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('Por favor ingresa correo y contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'pending' && data.user) {
          // Transition into lobby in pending mode as requested
          onSelectRole(data.user.role, data.user);
          return;
        } else if (data.status === 'pending') {
          setPendingNotice(data.error);
        } else {
          setErrorMessage(data.error || 'Error al iniciar sesión.');
        }
        return;
      }

      onSelectRole(data.user.role, data.user);
    } catch (err: any) {
      // Offline fallback: allow direct entrance
      onSelectRole(selectedRole || 'player', {
        id: `offline-${Date.now()}`,
        email: loginEmail,
        displayName: loginEmail.split('@')[0],
        role: selectedRole || 'player',
        status: 'approved',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    if (!regEmail.trim() || !regName.trim() || !regPassword.trim()) {
      setErrorMessage('Todos los campos son obligatorios.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          displayName: regName,
          password: regPassword,
          requestedRole: regRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error en el registro.');
        return;
      }

      setPendingNotice(
        '¡Solicitud enviada con éxito! Tu cuenta está en estado PENDIENTE. El Administrador debe aprobarla antes de que puedas iniciar sesión.'
      );
      setAuthMode('login');
      setLoginEmail(regEmail);
    } catch (err: any) {
      setErrorMessage('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
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
            WeRoll 5E
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-cinzel">
            {authMode === 'register'
              ? 'Registro de Nuevo Usuario'
              : authMode === 'login'
              ? 'Iniciar Sesión en tu Cuenta'
              : authMode === 'adminPassword'
              ? 'Acceso Protegido'
              : 'Selecciona tu Perfil de Acceso'}
          </p>
        </div>

        {pendingNotice && (
          <div className="mb-4 p-4 rounded-xl bg-amber-950/80 border border-amber-600/70 text-xs text-amber-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block font-cinzel font-bold text-amber-300 mb-0.5">Cuenta en Revisión</strong>
              {pendingNotice}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Main Role Cards Selector */}
        {authMode === 'cards' && (
          <div className="space-y-3.5">
            {/* Jugador */}
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

            {/* Dungeon Master */}
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
                    World Sheets, pantalla de combate, NPCs, monstruos, mapas y secretos confidenciales.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-purple-400 group-hover:translate-x-1 transition" />
            </button>

            {/* Moderador */}
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
                      Moderador / Administrador
                    </h4>
                    <span className="text-[10px] text-blue-400 flex items-center gap-0.5 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/50">
                      <Lock className="w-2.5 h-2.5" /> Clave Maestra
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed mt-0.5">
                    Aprobación de cuentas, bóveda en servidor, modelos de IA y copias de seguridad.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
            </button>

            {/* Or Register Option */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline flex items-center justify-center gap-1 mx-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                ¿Eres nuevo? Registra tu cuenta aquí
              </button>
            </div>
          </div>
        )}

        {/* 2. Login Form */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoFocus
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('cards')}
                className="text-xs text-stone-400 hover:text-stone-200"
              >
                ← Volver a roles
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>

            <div className="pt-2 text-center border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-xs text-stone-400 hover:text-amber-300"
              >
                ¿No tienes cuenta? <strong className="underline text-amber-400">Regístrate</strong>
              </button>
            </div>
          </form>
        )}

        {/* 3. Register Form */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoFocus
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Nombre para Mostrar en Mesa
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="ej. Sir Gareth"
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Rol Solicitado
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('player')}
                  className={`py-2 px-1 rounded-xl text-xs font-cinzel font-bold border transition text-center ${
                    regRole === 'player'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                      : 'bg-[#121316] text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  Jugador
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('dm')}
                  className={`py-2 px-1 rounded-xl text-xs font-cinzel font-bold border transition text-center ${
                    regRole === 'dm'
                      ? 'bg-purple-700 text-white border-purple-500 shadow-md'
                      : 'bg-[#121316] text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  Dungeon Master
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('both')}
                  className={`py-2 px-1 rounded-xl text-xs font-cinzel font-bold border transition text-center ${
                    regRole === 'both'
                      ? 'bg-gradient-to-r from-amber-600 to-purple-700 text-white border-amber-400 shadow-md'
                      : 'bg-[#121316] text-stone-400 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  Ambos (DM & J)
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-[11px] text-stone-400 leading-relaxed">
              ℹ️ <strong>Aprobación Requerida:</strong> Por seguridad de la mesa, un Administrador revisará tu solicitud antes de conceder acceso.
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs text-stone-400 hover:text-stone-200"
              >
                ← Ya tengo cuenta
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cinzel font-bold text-xs shadow-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Registrando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        )}

        {/* 4. Direct Password Form for DM or Moderator */}
        {authMode === 'adminPassword' && (
          <form onSubmit={handleDirectPasswordSubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-[#121316] border border-stone-800">
              <div className="flex items-center gap-2.5 mb-2">
                <Lock className={`w-5 h-5 ${selectedRole === 'dm' ? 'text-purple-400' : 'text-blue-400'}`} />
                <h3 className="font-cinzel font-bold text-base text-stone-200">
                  {selectedRole === 'dm' ? 'Acceso al Dungeon Master' : 'Acceso de Administrador'}
                </h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                {selectedRole === 'dm'
                  ? 'Introduce la contraseña del Dungeon Master para acceder a sus World Sheets y expedientes confidenciales.'
                  : 'Introduce la clave de acceso de Administrador para gestionar usuarios, bóveda y ajustes.'}
              </p>
            </div>

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
                  setAuthMode('cards');
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

        {/* Can close if already logged in */}
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
