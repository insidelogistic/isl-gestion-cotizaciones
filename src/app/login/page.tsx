'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/layout/BrandLogo';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Credenciales inválidas.');
      }
      router.push('/solicitudes');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border-2 border-blue-400 overflow-hidden">
        {/* CABECERA AZUL MARINO #0F2747 CON BORDE ROJO CORPORATIVO #C72106 (ESTILO ERP TRANS) */}
        <div className="bg-[#0F2747] p-6 text-center border-b-4 border-[#C72106]">
          <div className="inline-block bg-white px-5 py-2.5 rounded-xl shadow-md mb-3">
            <BrandLogo variant="full" heightClass="h-11" />
          </div>
          <h1 className="text-white text-base font-black tracking-wider uppercase font-titulos">
            IN SIDE LOGISTIC | Gestión de Cotizaciones
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Control Comercial, Licitaciones VWM y Seguimiento de Ofertas
          </p>
        </div>

        <div className="p-6 sm:p-7">
          {error && (
            <div
              role="alert"
              className="mb-4 bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-[#C72106] font-semibold"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-bold uppercase text-slate-700 mb-1 font-titulos"
              >
                ID de Colaborador o Correo Corporativo
              </label>
              <input
                id="login-identifier"
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ej. DIR-0001, ING-0001 o correo@insidelogistic.com.mx"
                className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 font-semibold text-xs focus:bg-white transition"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold uppercase text-slate-700 mb-1 font-titulos"
              >
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 font-semibold text-xs focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#C72106] hover:bg-[#A31B05] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-industrial-red transition cursor-pointer font-titulos disabled:opacity-50"
            >
              {loading ? 'Verificando acceso...' : 'Ingresar al Sistema'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-5 pt-4 border-t border-slate-200">
            Acceso exclusivo para personal autorizado de IN SIDE LOGISTIC. Registro público deshabilitado.
          </p>
        </div>
      </div>
    </div>
  );
}
