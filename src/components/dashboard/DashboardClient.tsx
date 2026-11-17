'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ClipboardList,
  FileCheck2,
  DollarSign,
  Award,
  AlertTriangle,
  Clock,
  ArrowRight,
  CalendarClock,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  DeadlineBadge,
  OriginBadge,
  StatusBadge,
  STATUS_LABELS,
  formatMoney,
} from '@/components/ui/Badges';
import type { CustomerRecord, RequestStatus, SafeUser } from '@/lib/db/types';
import type { DashboardMetrics } from '@/lib/services/dashboardService';

interface DashboardClientProps {
  metrics: DashboardMetrics;
  customers: CustomerRecord[];
  users: SafeUser[];
  initialFilters: {
    dateFrom: string;
    dateTo: string;
    customerId: string;
    responsibleUserId: string;
  };
  currentUser: SafeUser;
}

export function DashboardClient({
  metrics,
  customers,
  users,
  initialFilters,
  currentUser,
}: DashboardClientProps) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [customerId, setCustomerId] = useState(initialFilters.customerId);
  const [responsibleUserId, setResponsibleUserId] = useState(initialFilters.responsibleUserId);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (customerId && customerId !== 'ALL') params.set('customerId', customerId);
    if (responsibleUserId && responsibleUserId !== 'ALL') {
      params.set('responsibleUserId', responsibleUserId);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCustomerId('ALL');
    setResponsibleUserId('ALL');
    router.push('/');
  };

  const totalFilteredCount = metrics.filteredRequests.length;

  return (
    <div className="space-y-5">
      {/* CABECERA EJECUTIVA ESTILO ERP TRANS */}
      <div className="isl-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-[#C72106] border border-red-200 font-titulos uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C72106]" />
              Panel Ejecutivo Comercial
            </span>
            <span className="text-xs text-slate-500">
              IN SIDE LOGISTIC · Mantenimiento Industrial, Fabricación y Maquinado
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#0F2747] tracking-tight uppercase font-titulos">
            Dashboard de Gestión de Cotizaciones
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/solicitudes"
            className="px-3.5 py-2 bg-[#0F2747] hover:bg-[#16365F] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition font-titulos flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Ver Tabla y Kanban</span>
          </Link>
          {(currentUser.role === 'ADMIN' || currentUser.role === 'EDITOR') && (
            <Link
              href="/solicitudes/nueva"
              className="px-3.5 py-2 bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-industrial-red transition font-titulos flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nueva Solicitud</span>
            </Link>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS DEL DASHBOARD (PERIODO, CLIENTE, RESPONSABLE) — SECCIÓN 5 */}
      <form
        onSubmit={applyFilters}
        className="isl-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end text-xs"
      >
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
            Periodo Desde (Recepción)
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
            Periodo Hasta
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
            Cliente
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
          >
            <option value="ALL">Todos los clientes</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
            Responsable Interno
          </label>
          <select
            value={responsibleUserId}
            onChange={(e) => setResponsibleUserId(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
          >
            <option value="ALL">Todos los responsables</option>
            {users
              .filter((u) => u.role !== 'CONSULTA')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name.split('(')[0].trim()} ({u.employee_code})
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 px-3 py-2 rounded-xl bg-[#0F2747] hover:bg-[#163866] text-white font-bold uppercase font-titulos flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar</span>
          </button>
          <button
            type="button"
            onClick={clearFilters}
            title="Restablecer filtros"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* LOS 8 INDICADORES EJECUTIVOS DEL DASHBOARD (SECCIÓN 5 DEL PROMPT MAESTRO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Solicitudes activas */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-titulos">
              1. Solicitudes Activas
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#0F2747]/10 text-[#0F2747] flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#0F2747] font-titulos">
              {metrics.activeRequestsCount}
            </div>
            <span className="text-[11px] text-slate-500">
              De {totalFilteredCount} expedientes en el periodo
            </span>
          </div>
        </div>

        {/* 2. Cotizaciones presentadas */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-titulos">
              2. Cotizaciones Presentadas
            </span>
            <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 font-titulos">
              {metrics.presentedQuotesCount}
            </div>
            <span className="text-[11px] text-slate-500">Con oferta económica registrada</span>
          </div>
        </div>

        {/* 3. Importe total ofertado (sin duplicar revisiones) */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-titulos">
              3. Importe Total Ofertado
            </span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-[#0F2747] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-[#0F2747] font-mono">
              {formatMoney(metrics.totalOfferedAmount, 'MXN')}
            </div>
            <span className="text-[11px] text-slate-500">
              Última revisión vigente (sin duplicar histórico)
            </span>
          </div>
        </div>

        {/* 4. Importe total adjudicado */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider font-titulos">
              4. Importe Total Adjudicado
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-emerald-800 font-mono">
              {formatMoney(metrics.totalAwardedAmount, 'MXN')}
            </div>
            <span className="text-[11px] text-slate-500">
              Monto efectivamente adjudicado con evidencia
            </span>
          </div>
        </div>

        {/* 5. Cotizaciones por vencer */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider font-titulos">
              5. Cotizaciones Por Vencer
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-700 font-titulos">
              {metrics.expiringQuotesCount}
            </div>
            <span className="text-[11px] text-slate-500">Fecha límite próxima (≤ 3 días)</span>
          </div>
        </div>

        {/* 6. Seguimientos pendientes */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-titulos">
              6. Seguimientos Pendientes
            </span>
            <span className="w-7 h-7 rounded-lg bg-slate-100 text-[#0F2747] flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#0F2747] font-titulos">
              {metrics.pendingFollowUpsCount}
            </div>
            <span className="text-[11px] text-slate-500">Compromisos comerciales activos</span>
          </div>
        </div>

        {/* 7. Seguimientos vencidos */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#C72106] uppercase tracking-wider font-titulos">
              7. Seguimientos Vencidos
            </span>
            <span className="w-7 h-7 rounded-lg bg-red-50 text-[#C72106] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-[#C72106] font-titulos">
              {metrics.overdueFollowUpsCount}
            </div>
            <span className="text-[11px] text-slate-500">Requieren contacto inmediato</span>
          </div>
        </div>

        {/* 8. Cotizaciones por estado comercial (Cerradas / En Curso) */}
        <div className="isl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-titulos">
              8. Estado Comercial
            </span>
            <span className="px-2 py-0.5 rounded bg-[#0F2747] text-white font-mono text-[10px] font-bold">
              5 ETAPAS
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">En elaboración/negoc.</span>
              <strong className="font-mono text-sm text-[#0F2747]">
                {metrics.stageCounts.RECIBIDA +
                  metrics.stageCounts.EN_ELABORACION +
                  metrics.stageCounts.PRESENTADA +
                  metrics.stageCounts.EN_NEGOCIACION}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Cerradas</span>
              <strong className="font-mono text-sm text-emerald-800">
                {metrics.stageCounts.CERRADA}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* GRÁFICA DE COTIZACIONES POR ETAPA + SECCIÓN DE PRÓXIMOS COMPROMISOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Gráfica sencilla de cantidad de cotizaciones por etapa */}
        <div className="lg:col-span-5 isl-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
              Gráfica de Cotizaciones por Etapa
            </h2>
            <span className="font-mono text-xs font-bold text-slate-500">
              Total: {totalFilteredCount}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((st) => {
              const count = metrics.stageCounts[st];
              const pct =
                totalFilteredCount > 0 ? Math.round((count / totalFilteredCount) * 100) : 0;
              return (
                <div key={st} className="space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-700">{STATUS_LABELS[st]}</span>
                    <span className="font-mono font-bold text-[#0F2747]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        st === 'CERRADA'
                          ? 'bg-emerald-700'
                          : st === 'EN_NEGOCIACION'
                          ? 'bg-[#C72106]'
                          : 'bg-[#0F2747]'
                      }`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección de Próximos Compromisos (Fecha, Proyecto, Responsable y Actividad) */}
        <div className="lg:col-span-7 isl-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#C72106]" />
              <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
                Próximos Compromisos de Seguimiento Comercial
              </h2>
            </div>
            <Link
              href="/seguimiento"
              className="text-xs font-bold text-[#C72106] hover:underline inline-flex items-center gap-1"
            >
              <span>Ver agenda completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Proyecto / Folio</th>
                  <th className="py-2.5 px-4">Responsable</th>
                  <th className="py-2.5 px-4">Actividad Programada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.upcomingCommitments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No hay compromisos de seguimiento pendientes para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  metrics.upcomingCommitments.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            c.urgency === 'VENCIDO'
                              ? 'bg-red-100 text-red-800'
                              : c.urgency === 'HOY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-50 text-[#0F2747]'
                          }`}
                        >
                          {c.next_activity_date}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/solicitudes/${c.request_id}?tab=seguimiento`}
                          className="font-mono font-bold text-[#0F2747] hover:underline block"
                        >
                          {c.folio} ({c.customer_short_name})
                        </Link>
                        <span className="text-[11px] text-slate-600 line-clamp-1">
                          {c.project_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {c.responsible_name.split('(')[0].trim()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{c.activity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TABLA RESUMEN DE SOLICITUDES RECIENTES FILTRADAS */}
      <div className="isl-card overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#C72106]" />
            <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
              Expedientes de Solicitud y Cotización ({totalFilteredCount})
            </h2>
          </div>
          <Link
            href="/solicitudes"
            className="text-xs font-bold text-[#C72106] hover:underline inline-flex items-center gap-1"
          >
            <span>Abrir módulo Tabla / Kanban</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                <th className="py-2.5 px-4">Folio</th>
                <th className="py-2.5 px-4">Cliente & Proyecto</th>
                <th className="py-2.5 px-4">Origen</th>
                <th className="py-2.5 px-4">Fecha Límite</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4 text-right">Último Importe Vigente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Sin solicitudes en este filtro.
                  </td>
                </tr>
              ) : (
                metrics.filteredRequests.slice(0, 8).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#0F2747]">
                      <Link href={`/solicitudes/${req.id}`} className="hover:underline">
                        {req.folio}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{req.project_name}</div>
                      <div className="text-[11px] text-slate-500">{req.customer_name}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <OriginBadge origin={req.origin_type} />
                    </td>
                    <td className="py-2.5 px-4">
                      <DeadlineBadge
                        deadlineDate={req.deadline_date}
                        semaphore={req.deadline_semaphore}
                        daysUntil={req.days_until_deadline}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatMoney(req.latest_offered_amount, req.latest_offered_currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
