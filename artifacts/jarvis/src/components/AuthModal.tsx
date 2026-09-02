import React, { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, User, LogIn, UserPlus, X, KeyRound, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, demoUsers, switchDemoUser, login, register, logout } = useAuth();
  const [tab, setTab] = useState<'demo' | 'login' | 'register'>('demo');

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSwitchDemo = async (id: number, userName: string) => {
    try {
      setLoading(true);
      await switchDemoUser(id);
      toast.success(`Espacio cambiado a ${userName}`);
      onClose();
    } catch {
      toast.error('Error al cambiar de usuario demo');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Por favor ingresa correo y contraseña');
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      toast.success('Sesión iniciada con éxito');
      onClose();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password) {
      toast.error('Por favor llena todos los campos');
      return;
    }
    try {
      setLoading(true);
      await register(nombre, email, password);
      toast.success(`¡Bienvenido/a, ${nombre}! Tu espacio personal ha sido creado.`);
      onClose();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="cosmos-card relative w-full max-w-md overflow-hidden p-6 sm:p-7 shadow-2xl border border-white/15">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <div className="cosmos-eyebrow mb-1">sistema multi-usuario & demo</div>
          <h2 className="cosmos-title text-2xl font-bold">Espacios Personales</h2>
          <p className="mt-1 text-xs text-white/50">
            Cada persona tiene su propio registro aislado de finanzas, ahorros, hábitos y rutina.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 flex rounded-2xl bg-white/5 p-1">
          <button
            onClick={() => setTab('demo')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${tab === 'demo' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            <Sparkles size={14} /> Modo Demo (1-Click)
          </button>
          <button
            onClick={() => setTab('login')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${tab === 'login' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            <LogIn size={14} /> Entrar
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${tab === 'register' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            <UserPlus size={14} /> Registro
          </button>
        </div>

        {/* TAB 1: DEMO USERS (1-CLICK SWITCH) */}
        {tab === 'demo' && (
          <div className="space-y-3">
            <p className="text-xs text-white/60">
              Selecciona un perfil de prueba para probar el sistema de inmediato:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {demoUsers.map((u) => {
                const isCurrent = user?.id === u.id;
                return (
                  <button
                    key={u.id}
                    disabled={loading}
                    onClick={() => handleSwitchDemo(u.id, u.nombre)}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                      isCurrent
                        ? 'border-[#5de8c4] bg-[#5de8c4]/15 shadow-sm'
                        : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-2xl">{u.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">{u.nombre}</div>
                      <div className="text-[10px] text-white/45 truncate">
                        {isCurrent ? '● Activo ahora' : u.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {user && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-white/45">Conectado como <strong className="text-white">{user.nombre}</strong></span>
                <button
                  onClick={() => { logout(); toast.info('Sesión cerrada'); onClose(); }}
                  className="text-xs font-semibold text-red-400 hover:underline"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LOGIN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="cosmos-field-label">Correo electrónico</label>
              <div className="relative mt-1">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@personal.io"
                  className="cosmos-input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="cosmos-field-label">Contraseña</label>
              <div className="relative mt-1">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cosmos-input pl-10"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cosmos-button-primary w-full justify-center !py-3 font-bold"
            >
              {loading ? 'Entrando...' : 'Iniciar Sesión'} <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* TAB 3: REGISTER */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="cosmos-field-label">Tu Nombre</label>
              <div className="relative mt-1">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Sofía, Carlos..."
                  className="cosmos-input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="cosmos-field-label">Correo electrónico</label>
              <div className="relative mt-1">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="cosmos-input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="cosmos-field-label">Contraseña</label>
              <div className="relative mt-1">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crea una contraseña segura"
                  className="cosmos-input pl-10"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cosmos-button-primary w-full justify-center !py-3 font-bold"
            >
              {loading ? 'Creando cuenta...' : 'Crear Espacio Personal'} <Sparkles size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
