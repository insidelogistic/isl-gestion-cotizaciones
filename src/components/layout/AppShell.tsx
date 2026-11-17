'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  FilePlus2,
  FileSpreadsheet,
  CalendarClock,
  Award,
  BookOpen,
  Bell,
  Plus,
  Menu,
  Pin,
  X,
  LogOut,
  ChevronDown,
  Search,
  Building2,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { SafeUser } from '@/lib/db/types';

interface AppShellProps {
  user: SafeUser;
  urgentCount?: number;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<SafeUser['role'], string> = {
  ADMIN: 'Administrador',
  EDITOR: 'Editor Comercial',
  CONSULTA: 'Consulta',
};

export function AppShell({ user, urgentCount = 0, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const canCreate = user.role === 'ADMIN' || user.role === 'EDITOR';

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      router.push(`/solicitudes?search=${encodeURIComponent(quickSearch.trim())}`);
    } else {
      router.push('/solicitudes');
    }
  };

  const handleQuickSwitchRole = async (code: string) => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quickCode: code }),
    });
    setUserDropdown(false);
    router.refresh();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    {
      label: '1. Dashboard General',
      shortLabel: '1. Dashboard',
      href: '/',
      icon: LayoutGrid,
      match: (p: string) => p === '/',
      group: 'OPERACIÓN COMERCIAL',
    },
    {
      label: '2. Solicitudes y Cotizaciones',
      shortLabel: '2. Solicitudes / Kanban',
      href: '/solicitudes',
      icon: ClipboardList,
      match: (p: string) => p === '/solicitudes' || (p.startsWith('/solicitudes/') && p !== '/solicitudes/nueva'),
      group: 'OPERACIÓN COMERCIAL',
    },
    {
      label: '3. Nueva Solicitud',
      shortLabel: '3. Nueva Solicitud',
      href: '/solicitudes/nueva',
      icon: FilePlus2,
      match: (p: string) => p === '/solicitudes/nueva',
      group: 'OPERACIÓN COMERCIAL',
    },
    {
      label: '4. Cotizaciones y Revisiones',
      shortLabel: '4. Cotizaciones',
      href: '/cotizaciones',
      icon: FileSpreadsheet,
      match: (p: string) => p.startsWith('/cotizaciones'),
      group: 'SEGUIMIENTO Y OFERTAS',
    },
    {
      label: '5. Seguimiento Comercial',
      shortLabel: '5. Seguimiento',
      href: '/seguimiento',
      icon: CalendarClock,
      match: (p: string) => p.startsWith('/seguimiento'),
      group: 'SEGUIMIENTO Y OFERTAS',
    },
    {
      label: '6. Cierre Comercial',
      shortLabel: '6. Cierres y Adjudicaciones',
      href: '/cierres',
      icon: Award,
      match: (p: string) => p.startsWith('/cierres'),
      group: 'SEGUIMIENTO Y OFERTAS',
    },
    {
      label: '7. Catálogos y Usuarios',
      shortLabel: '7. Catálogos y Usuarios',
      href: '/catalogos',
      icon: BookOpen,
      match: (p: string) => p.startsWith('/catalogos'),
      group: 'ADMINISTRACIÓN',
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F5F7FA]">
      {/* ================================================================= */}
      {/* 1. BARRA SUPERIOR (HEADER 100%) — ESTÉTICA HOMOLOGADA CON ERP TRANS */}
      {/* ================================================================= */}
      <header className="w-full h-15 sm:h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 select-none shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
        {/* Lado Izquierdo: Toggle + Logo Oficial IN SIDE LOGISTIC + Subtítulo + Badge VWM + Buscador */}
        <div className="flex items-center gap-3 flex-1 max-w-4xl">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Abrir menú móvil"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="hidden md:inline-flex p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Expandir / Colapsar panel de navegación"
            aria-label="Expandir o colapsar panel de navegación"
            aria-expanded={sidebarExpanded}
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 pr-3 sm:border-r sm:border-slate-200"
            title="IN SIDE LOGISTIC | Gestión de Cotizaciones"
          >
            <BrandLogo variant="compact" heightClass="h-8" />
          </Link>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/80 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#0F2747]" />
            <span>Puebla · VWM & Industria</span>
          </div>

          <form onSubmit={handleGlobalSearch} className="relative w-full max-w-xs md:max-w-sm hidden sm:block">
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Buscar folio (COT-2026...), cliente, proyecto..."
              className="w-full bg-[#F5F7FA] hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-lg pl-3 pr-8 py-1.5 border border-slate-200/90 transition"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-2 text-slate-400 hover:text-[#0F2747] cursor-pointer"
              aria-label="Buscar"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Lado Derecho: Alertas + Botón Primario Rojo Corporativo #C72106 + Perfil y Selector Rol */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/seguimiento"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-[#C72106] hover:bg-red-100 border border-red-200 text-xs font-semibold transition"
            title="Seguimientos y fechas límite próximas"
          >
            <Bell className="w-3.5 h-3.5 text-[#C72106]" />
            <span className="hidden lg:inline font-titulos uppercase tracking-wider text-xs">
              Alertas
            </span>
            <span className="flex items-center justify-center px-1.5 h-4 rounded-full bg-[#C72106] text-white font-mono text-[11px] font-bold">
              {urgentCount}
            </span>
          </Link>

          {canCreate && (
            <Link
              href="/solicitudes/nueva"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-semibold shadow-industrial-red transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline font-titulos uppercase tracking-wider">
                Nueva Solicitud
              </span>
            </Link>
          )}

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Dropdown de Usuario y Cambio Rápido de Rol */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdown(!userDropdown)}
              aria-expanded={userDropdown}
              aria-haspopup="menu"
              aria-label="Menú de usuario y cambio de rol"
              className="flex items-center gap-2 p-1 pl-1.5 rounded-xl border border-slate-200/90 hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#0F2747] text-white flex items-center justify-center font-bold text-xs font-titulos">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left leading-tight pr-1">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                  {user.name.split('(')[0].trim()}
                </span>
                <span className="text-[11px] text-[#C72106] font-semibold">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{user.name}</div>
                  <div className="text-slate-500 text-[11px]">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0F2747] text-white">
                      {ROLE_LABELS[user.role]}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {user.employee_code}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between font-titulos">
                  <span>Cambiar Rol Autorizado</span>
                  <span className="text-[#C72106] font-mono">PRUEBAS RBAC</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickSwitchRole('DIR-0001')}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#0F2747]/10 text-[#0F2747] flex items-center justify-center text-[11px] font-bold">
                      AD
                    </span>
                    <span className="font-semibold">Administrador</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">DIR-0001</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSwitchRole('ING-0001')}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-amber-50 text-amber-800 flex items-center justify-center text-[11px] font-bold">
                      ED
                    </span>
                    <span className="font-semibold">Editor (Ing. Costos)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">ING-0001</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSwitchRole('CON-0001')}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-800 flex items-center justify-center text-[11px] font-bold">
                      CO
                    </span>
                    <span className="font-semibold">Consulta (Solo Lectura)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">CON-0001</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <div className="px-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-1.5 text-[#C72106] hover:bg-red-50 rounded-lg font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. CONTENEDOR INFERIOR: RIEL AZUL MARINO #0F2747 + DRAWER + MAIN  */}
      {/* ================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`hidden md:flex relative h-full shrink-0 z-20 transition-all duration-200 ${
            sidebarPinned && sidebarExpanded ? 'w-80' : 'w-16'
          }`}
        >
          {/* SLIM ICON RAIL (64px) — AZUL MARINO CORPORATIVO #0F2747 */}
          <aside className="flex flex-col items-center justify-between w-16 h-full bg-[#0F2747] border-r border-slate-900/40 py-3 shrink-0 relative z-20 select-none shadow-xl text-white">
            <div className="flex flex-col items-center gap-2.5 w-full px-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative cursor-pointer ${
                      active
                        ? 'bg-[#C72106] text-white shadow-lg ring-2 ring-red-400/70'
                        : 'bg-white/10 text-white/90 hover:bg-[#C72106] hover:text-white border border-white/10'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span className="absolute left-14 px-2.5 py-1.5 bg-[#0F2747] text-white text-xs font-bold rounded-lg shadow-2xl border border-blue-400/40 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C72106]" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-1.5 pb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Base de datos en línea" />
              <span className="text-[10px] font-mono text-white/70 tracking-wider">ISL V1</span>
            </div>
          </aside>

          {/* SUBMENU DRAWER PANEL (256px) */}
          {sidebarExpanded && (
            <aside className="absolute left-16 top-0 flex flex-col justify-between w-64 h-full bg-white border-r border-slate-200/90 py-4 px-3 shrink-0 z-30 select-none shadow-2xl overflow-y-auto azia-scrollbar">
              <div className="space-y-5">
                <div className="px-2 pt-1 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                      Módulos del Sistema
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5 font-titulos">
                      Gestión de Cotizaciones
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSidebarPinned(!sidebarPinned)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        sidebarPinned
                          ? 'bg-red-50 text-[#C72106] font-bold'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={sidebarPinned ? 'Desanclar menú' : 'Fijar menú lateral'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarExpanded(false);
                        setSidebarPinned(false);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Cerrar panel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {['OPERACIÓN COMERCIAL', 'SEGUIMIENTO Y OFERTAS', 'ADMINISTRACIÓN'].map((groupName) => (
                  <div key={groupName}>
                    <div className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-titulos">
                      {groupName}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      {navItems
                        .filter((i) => i.group === groupName)
                        .map((item) => {
                          const active = item.match(pathname);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => {
                                if (!sidebarPinned) setSidebarExpanded(false);
                              }}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition ${
                                active
                                  ? 'bg-red-50 text-[#C72106] font-semibold'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  active ? 'bg-[#C72106]' : 'bg-slate-300'
                                }`}
                              />
                              <span>{item.shortLabel}</span>
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                <div className="font-bold text-[#0F2747] font-titulos uppercase">
                  IN SIDE LOGISTIC S.A. DE C.V.
                </div>
                <div className="mt-0.5">Zona horaria: America/Mexico_City</div>
              </div>
            </aside>
          )}
        </div>

        {/* DRAWER MÓVIL */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative w-72 max-w-[85vw] bg-white h-full z-10 p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <BrandLogo variant="compact" heightClass="h-7" />
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-1 text-xs">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.match(pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition ${
                          active
                            ? 'bg-[#0F2747] text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
          </div>
        )}

        {/* ÁREA PRINCIPAL DE CONTENIDO */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 azia-scrollbar">
          <div className="max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
