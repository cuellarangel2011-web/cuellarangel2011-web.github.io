import React, { useState } from 'react';
import { User, Shield, KeyRound, Lock, AlertCircle, Sparkles, Check, ChevronRight, Mail, UserPlus, LogIn, Clock, ArrowLeft, Crown } from 'lucide-react';
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
  // Default mode is directly 'login' as requested
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'adminPassword'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('moderator');

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
  const [rejectedNotice, setRejectedNotice] = useState<{ message: string; customMessage?: string } | null>(null);

  if (!isOpen) return null;

  const handleDirectPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    setRejectedNotice(null);

    const expected = (moderatorPasswordExpected || 'admin').trim();
    if (enteredPassword.trim() === expected) {
      onSelectRole('moderator', {
        id: 'usr-admin-master',
        email: 'admin@weroll.app',
        displayName: 'Administrador Supremo',
        role: 'moderator',
        status: 'approved',
      });
    } else {
      setErrorMessage('Contraseña de Administrador incorrecta.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPendingNotice('');
    setRejectedNotice(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('Por favor ingresa tu correo electrónico y contraseña.');
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
        if (data.status === 'pending') {
          setPendingNotice(
            data.error || 'Tu cuenta está en estado PENDIENTE de aprobación por el Administrador. No puedes ingresar hasta que sea aprobada.'
          );
        } else if (data.status === 'rejected') {
          setRejectedNotice({
            message: data.error || 'Tu solicitud de acceso ha sido rechazada por el Administrador.',
            customMessage:
              data.customMessage ||
              'Lo lamentamos, por el momento no puedes acceder a WeRoll. Manda mensaje a soporte@weroll.app si quieres una revisión manual de tu caso.',
          });
        } else {
          setErrorMessage(data.error || 'Error al iniciar sesión.');
        }
        return;
      }

      onSelectRole(data.user.role, data.user);
    } catch (err: any) {
      setErrorMessage('No se pudo conectar con el servidor para verificar las credenciales. Intenta de nuevo.');
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
        '¡Solicitud enviada con éxito! Tu cuenta está en estado PENDIENTE. El Administrador debe aprobarla antes de que puedas acceder a las mesas.'
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
      <div className="relative w-full max-w-lg bg-[#181920] border-2 border-amber-900/80 rounded-3xl shadow-2xl p-6 sm:p-8 text-stone-200 flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-950 border border-amber-500 shadow-lg text-amber-200 mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="font-cinzel font-black text-2xl text-amber-300 tracking-wider">
            WeRoll 5E
          </h2>
          <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-cinzel">
            {authMode === 'register'
              ? 'Crear Cuenta y Seleccionar Perfil'
              : authMode === 'adminPassword'
              ? 'Acceso con Clave Maestra'
              : 'Iniciar Sesión en tu Cuenta'}
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

        {rejectedNotice && (
          <div className="mb-4 p-4 rounded-xl bg-red-950/90 border border-red-600/80 text-xs text-red-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed w-full">
              <strong className="block font-cinzel font-bold text-red-300 mb-1 text-sm">
                Solicitud de Acceso Rechazada
              </strong>
              <p className="text-red-200/90">{rejectedNotice.message}</p>
              {rejectedNotice.customMessage && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#121318] border border-red-900/60 text-stone-300 font-sans leading-relaxed">
                  {rejectedNotice.customMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. LOGIN FORM (FIRST OPTION PRESENTED TO USERS)                     */}
        {/* =================================================================== */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoFocus
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            {/* Link to Register */}
            <div className="pt-3 text-center border-t border-stone-800/80 space-y-2">
              <p className="text-xs text-stone-400">
                ¿No tienes una cuenta registrada todavía?
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setRejectedNotice(null);
                  setAuthMode('register');
                }}
                className="px-4 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 text-amber-300 font-cinzel font-bold text-xs transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Registrar Nueva Cuenta
              </button>
            </div>

            {/* Direct Admin Master Password Access Option */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setAuthMode('adminPassword');
                }}
                className="text-[11px] text-stone-500 hover:text-blue-400 font-mono transition flex items-center justify-center gap-1 mx-auto"
              >
                <KeyRound className="w-3 h-3" />
                Acceso directo con Clave Maestra de Administrador
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* 2. REGISTER FORM (WITH REQUIRED ROLE PROFILES)                      */}
        {/* =================================================================== */}
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
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-stone-400 mb-1">
                Nombre para Mostrar en Mesa / Apodo
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="ej. Sir Gareth o El Brujo Gris"
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm outline-none transition"
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
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
              />
            </div>

            {/* Profile Selection: Player, Dungeon Master, Player & Dungeon Master */}
            <div>
              <label className="block text-xs font-cinzel font-bold uppercase text-amber-300 mb-1.5">
                Selecciona tu Perfil de Acceso
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Jugador / Aventurero */}
                <button
                  type="button"
                  onClick={() => setRegRole('player')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'player'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-md ring-1 ring-amber-500'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <User className="w-5 h-5 mb-1 text-amber-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Jugador / Aventurero
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Hojas de personaje y dados
                  </span>
                </button>

                {/* 2. Dungeon Master */}
                <button
                  type="button"
                  onClick={() => setRegRole('dm')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'dm'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Crown className="w-5 h-5 mb-1 text-purple-400" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Dungeon Master
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    World Sheets y mesas
                  </span>
                </button>

                {/* 3. Jugador y Dungeon Master */}
                <button
                  type="button"
                  onClick={() => setRegRole('both')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col items-center sm:items-start text-center sm:text-left ${
                    regRole === 'both'
                      ? 'bg-gradient-to-br from-amber-950 to-purple-950 border-amber-400 text-amber-100 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#121316] border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <Sparkles className="w-5 h-5 mb-1 text-amber-300" />
                  <span className="font-cinzel font-bold text-xs text-stone-200 block">
                    Jugador y Dungeon Master
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Acceso dual completo
                  </span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#121316] border border-amber-900/40 text-[11px] text-stone-300 leading-relaxed">
              ℹ️ <strong>Revisión del Administrador:</strong> Al registrarte, tu cuenta quedará en estado de preaprobación. Una vez aprobada por el Administrador, podrás crear y guardar tus fichas o World Sheets.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-cinzel font-bold text-sm shadow-xl transition transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {isLoading ? 'Registrando cuenta...' : 'Crear Cuenta y Solicitar Aprobación'}
            </button>

            <div className="pt-2 text-center border-t border-stone-800/80">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPendingNotice('');
                  setRejectedNotice(null);
                  setAuthMode('login');
                }}
                className="text-xs text-stone-400 hover:text-amber-300 transition flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ¿Ya tienes una cuenta registrada? <strong className="underline text-amber-400 ml-1">Inicia Sesión</strong>
              </button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* 3. DIRECT ADMIN MASTER PASSWORD MODAL                               */}
        {/* =================================================================== */}
        {authMode === 'adminPassword' && (
          <form onSubmit={handleDirectPasswordSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#121316] border border-blue-900/50">
              <div className="flex items-center gap-2.5 mb-2">
                <Lock className="w-5 h-5 text-blue-400" />
                <h3 className="font-cinzel font-bold text-base text-stone-200">
                  Acceso de Administrador Maestro
                </h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Introduce la contraseña maestra de moderador/administrador configurada en el servidor para acceder inmediatamente con permisos de gestión, bóveda y ajustes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-cinzel font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Contraseña Maestra de Administrador
              </label>
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
                className="w-full bg-[#121316] border border-stone-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm font-mono outline-none transition"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Iniciar Sesión
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl font-cinzel font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-lg transition"
              >
                Verificar & Acceder
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
