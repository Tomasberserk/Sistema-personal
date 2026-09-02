import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { Sparkles, Activity, Lock, Mail, User, ArrowRight, UserPlus, LogIn, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, demoUsers, login, register, switchDemoUser } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<'demo' | 'login' | 'register'>('demo');

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('tomas@personal.io');
  const [password, setPassword] = useState('demo');
  const [avatar, setAvatar] = useState('🚀');
  const [loading, setLoading] = useState(false);

  // If already logged in, can redirect to dashboard
  const handleSuccess = () => {
    setLocation('/');
  };

  const handleSwitchDemo = async (id: number, userName: string) => {
    try {
      setLoading(true);
      await switchDemoUser(id);
      toast.success(`¡Bienvenido/a, ${userName}! Espacio personal activado.`);
      handleSuccess();
    } catch {
      toast.error('Error al conectar con el usuario demo');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Ingresa tu correo y contraseña');
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      toast.success('Sesión iniciada con éxito');
      handleSuccess();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    try {
      setLoading(true);
      await register(nombre, email, password, avatar);
      toast.success(`¡Cuenta creada con éxito! Bienvenido/a a Jarvis, ${nombre}.`);
      handleSuccess();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-center items-center px-4 py-12 bg-[#07070a] text-white selection:bg-[#5de8c4] selection:text-black">
      {/* Background glowing orbs */}
      <div className="absolute left-1/4 top-1/4 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5de8c4]/10 blur-[120px] pointer-events-none" />
      <div className="absolute right-1/4 bottom-1/4 h-[350px] w-[350px] translate-x-1/2 translate-y-1/2 rounded-full bg-[#5d8ae8]/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[460px]">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-black shadow-2xl shadow-white/20 mb-4 transition transform hover:scale-105">
            <Activity size={26} strokeWidth={2.8} />
          </div>
          <div className="cosmos-eyebrow text-[#5de8c4] tracking-widest font-semibold uppercase text-xs mb-1">
            Sistema Operativo Personal
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Jarvis OS
          </h1>
          <p className="mt-2 text-sm text-white/50 max-w-sm mx-auto">
            Finanzas, ahorros, hábitos, rutina diaria, moto y recordatorios en un solo lugar.
          </p>
        </div>

        {/* Card */}
        <div className="cosmos-card p-6 sm:p-8 rounded-[28px] border border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl">
          {/* Navigation Tabs */}
          <div className="mb-6 flex rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setTab('demo')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'demo' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles size={14} /> Modo Demo (1-Click)
            </button>
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'login' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              <LogIn size={14} /> Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'register' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              <UserPlus size={14} /> Registrarse
            </button>
          </div>

          {/* TAB 1: DEMO USERS (1-CLICK) */}
          {tab === 'demo' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#5de8c4]/20 bg-[#5de8c4]/5 p-3.5 text-xs text-[#5de8c4] flex items-start gap-2.5">
                <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Cuentas Demo Listas para Probar</strong>
                  Haz clic en cualquiera de estos perfiles para entrar al instante con sus datos aislados:
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {demoUsers.map((u) => {
                  const isCurrent = user?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSwitchDemo(u.id, u.nombre)}
                      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                        isCurrent
                          ? 'border-[#5de8c4] bg-[#5de8c4]/15 ring-1 ring-[#5de8c4]'
                          : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8 hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-3xl">{u.avatar}</span>
                        {isCurrent ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5de8c4] bg-[#5de8c4]/20 px-2 py-0.5 rounded-full">
                            Activo
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">{u.rol}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{u.nombre}</div>
                        <div className="text-[11px] text-white/45 truncate mt-0.5">{u.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                <span>Contraseña demo: <code className="bg-white/10 text-white/80 px-1.5 py-0.5 rounded font-mono">demo</code></span>
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-[#5de8c4] hover:underline font-semibold"
                >
                  Entrar con contraseña →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL / PASSWORD LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="cosmos-field-label">Correo electrónico</label>
                <div className="relative mt-1">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tomas@personal.io"
                    className="cosmos-input pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="cosmos-field-label">Contraseña</label>
                  <span className="text-[11px] text-white/40">Por defecto: demo</span>
                </div>
                <div className="relative mt-1">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
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
                className="cosmos-button-primary w-full justify-center !py-3 text-sm font-bold mt-2"
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'} <ArrowRight size={16} />
              </button>

              <div className="pt-2 text-center text-xs text-white/40">
                ¿Quieres probar rápido?{' '}
                <button
                  type="button"
                  onClick={() => setTab('demo')}
                  className="text-[#5de8c4] hover:underline font-bold"
                >
                  Usa el Modo Demo 1-Click
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="cosmos-field-label">Tu Nombre</label>
                <div className="relative mt-1">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Carlos, Sofía..."
                    className="cosmos-input pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="cosmos-field-label">Avatar / Emoji</label>
                <div className="flex gap-2 mt-1">
                  {['🚀', '💖', '👨', '👩', '⚡', '🌟', '💼', '🧘'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setAvatar(em)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition ${
                        avatar === em ? 'bg-white/20 ring-2 ring-[#5de8c4]' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="cosmos-field-label">Correo electrónico</label>
                <div className="relative mt-1">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
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
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Elige una contraseña"
                    className="cosmos-input pl-10"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cosmos-button-primary w-full justify-center !py-3 text-sm font-bold mt-2"
              >
                {loading ? 'Creando espacio...' : 'Crear Espacio Personal'} <Sparkles size={16} />
              </button>
            </form>
          )}
        </div>

        {/* Footer credentials reminder */}
        <div className="mt-8 text-center text-xs text-white/40 space-y-1">
          <p>Tu cuenta principal de Administrador:</p>
          <p className="text-white/70 font-mono">
            <strong>tomas@personal.io</strong> · Clave: <strong>demo</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
