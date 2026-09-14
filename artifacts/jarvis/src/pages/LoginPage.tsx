import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { Activity, Lock, Mail, User, ArrowRight, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('🚀');
  const [loading, setLoading] = useState(false);

  const handleSuccess = () => {
    setLocation('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Ingresa tu correo y contraseña');
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
      toast.success('Sesión iniciada con éxito');
      handleSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timed out') || msg.includes('responder')) {
        toast.error('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
      } else {
        toast.error(msg.replace(/^HTTP \d+ [^:]+: /, '') || 'Correo o contraseña incorrectos');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    try {
      setLoading(true);
      await register(nombre.trim(), email.trim(), password, avatar);
      toast.success(`¡Cuenta creada con éxito! Bienvenido/a a Jarvis, ${nombre}.`);
      handleSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '';
      if (msg.includes('Ya existe un usuario')) {
        toast.error('Ya existe una cuenta con este correo. Por favor inicia sesión.');
        setTab('login');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timed out') || msg.includes('responder')) {
        toast.error('No se pudo conectar con el servidor. Verifica que el backend esté activo.');
      } else {
        toast.error(msg.replace(/^HTTP \d+ [^:]+: /, '') || 'No se pudo crear la cuenta');
      }
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
      <div className="relative z-10 w-full max-w-[440px]">
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

          {/* TAB 1: EMAIL / PASSWORD LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="cosmos-field-label">Correo electrónico</label>
                <div className="relative mt-1">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
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
                    name="password"
                    autoComplete="current-password"
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
                {loading ? 'Verificando...' : 'Entrar a Jarvis'} <ArrowRight size={16} />
              </button>

              <div className="pt-2 text-center text-xs text-white/40">
                ¿No tienes una cuenta aún?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-[#5de8c4] hover:underline font-bold"
                >
                  Regístrate aquí
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="cosmos-field-label">Tu Nombre</label>
                <div className="relative mt-1">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
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
                    name="email"
                    autoComplete="email"
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
                    name="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Elige una contraseña segura"
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
                {loading ? 'Creando cuenta...' : 'Crear Espacio Personal'} <Sparkles size={16} />
              </button>

              <div className="pt-2 text-center text-xs text-white/40">
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-[#5de8c4] hover:underline font-bold"
                >
                  Inicia sesión
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
