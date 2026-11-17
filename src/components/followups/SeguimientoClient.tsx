'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  X,
  Check,
} from 'lucide-react';
import type { FollowUpActivityRecord } from '@/lib/services/followUpService';
import type { SafeUser } from '@/lib/db/types';

interface SeguimientoClientProps {
  commitments: FollowUpActivityRecord[];
  expiringCount: number;
  dueTodayCount: number;
  overdueCount: number;
  currentUser: SafeUser;
}

export function SeguimientoClient({
  commitments: initialCommitments,
  expiringCount,
  dueTodayCount,
  overdueCount,
  currentUser,
}: SeguimientoClientProps) {
  const router = useRouter();
  const [commitments, setCommitments] = useState<FollowUpActivityRecord[]>(initialCommitments);
  const [filterUrgency, setFilterUrgency] = useState<string>('ALL');
  const [dispatchingMail, setDispatchingMail] = useState<boolean>(false);
  const [mailResult, setMailResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() =>
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [savingReschedule, setSavingReschedule] = useState<boolean>(false);

  const canModify = currentUser.role === 'ADMIN' || currentUser.role === 'EDITOR';

  const handleDispatchInternalAlerts = async () => {
    setDispatchingMail(true);
    setMailResult(null);
    setActionError(null);
    try {
      const res = await fetch('/api/notifications', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo enviar el resumen interno.');
      }
      setMailResult(
        `Resumen de alertas despachado a ${data.dispatchedCount} correos internos (@insidelogistic.com.mx). Jamás se envían correos automáticos a clientes.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al enviar alertas internas.');
    } finally {
      setDispatchingMail(false);
    }
  };

  const handleAction = async (
    activityId: string,
    action: 'COMPLETE' | 'RESCHEDULE' | 'CANCEL',
    explicitDate?: string
  ) => {
    if (action === 'RESCHEDULE' && !explicitDate) {
      setRescheduleTargetId(activityId);
      return;
    }

    setActionError(null);
    const payload: Record<string, unknown> =
      action === 'RESCHEDULE'
        ? { action, next_activity_date: explicitDate }
        : { action };

    try {
      const res = await fetch(`/api/followups/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al actualizar el seguimiento.');
      }
      setCommitments((prev) =>
        prev.map((c) => (c.id === activityId ? data.activity : c))
      );
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al procesar seguimiento.');
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTargetId || !rescheduleDate) return;
    setSavingReschedule(true);
    await handleAction(rescheduleTargetId, 'RESCHEDULE', rescheduleDate);
    setSavingReschedule(false);
    setRescheduleTargetId(null);
  };

  const filtered = commitments.filter((c) => {
    if (filterUrgency === 'ALL') return true;
    return c.urgency === filterUrgency;
  });

  return (
    <div className="space-y-4">
      <div className="isl-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase text-[#C72106] font-titulos">
            6. Agenda y Alertas Comerciales Internas
          </span>
          <h1 className="text-xl font-black text-[#0F2747] uppercase font-titulos">
            Seguimiento Comercial, Recordatorios y Notificaciones
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de compromisos programados (por defecto a 3 días hábiles tras presentar oferta) y envío de avisos internos al equipo de IN SIDE LOGISTIC.
          </p>
        </div>

        {canModify && (
          <button
            type="button"
            onClick={handleDispatchInternalAlerts}
            disabled={dispatchingMail}
            className="px-4 py-2.5 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-bold uppercase tracking-wider font-titulos shadow-industrial-red flex items-center gap-2 cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>
              {dispatchingMail
                ? 'Enviando Avisos Internos...'
                : 'Enviar Resumen Interno por Correo'}
            </span>
          </button>
        )}
      </div>

      {mailResult && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
          {mailResult}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#C72106] text-xs font-semibold"
        >
          {actionError}
        </div>
      )}

      {/* Tarjetas de resumen de alertas operativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="isl-card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-red-700 font-titulos">
              Seguimientos Vencidos
            </span>
            <div className="text-2xl font-black text-red-700 font-mono mt-0.5">{overdueCount}</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-red-600/80" />
        </div>

        <div className="isl-card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-amber-700 font-titulos">
              Seguimientos Para Hoy
            </span>
            <div className="text-2xl font-black text-amber-700 font-mono mt-0.5">
              {dueTodayCount}
            </div>
          </div>
          <Clock className="w-8 h-8 text-amber-600/80" />
        </div>

        <div className="isl-card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-[#0F2747] font-titulos">
              Cotizaciones Por Vencer (≤ 3 días)
            </span>
            <div className="text-2xl font-black text-[#0F2747] font-mono mt-0.5">
              {expiringCount}
            </div>
          </div>
          <CalendarClock className="w-8 h-8 text-[#0F2747]/80" />
        </div>
      </div>

      {/* Filtros de compromisos */}
      <div className="isl-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'ALL', label: `Todos (${commitments.length})` },
            {
              id: 'VENCIDO',
              label: `Vencidos (${commitments.filter((c) => c.urgency === 'VENCIDO').length})`,
            },
            {
              id: 'HOY',
              label: `Para Hoy (${commitments.filter((c) => c.urgency === 'HOY').length})`,
            },
            {
              id: 'PROXIMO',
              label: `Próximos (${commitments.filter((c) => c.urgency === 'PROXIMO').length})`,
            },
            {
              id: 'COMPLETADO',
              label: `Completados (${commitments.filter((c) => c.urgency === 'COMPLETADO').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterUrgency(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase font-titulos cursor-pointer transition ${
                filterUrgency === tab.id
                  ? 'bg-[#0F2747] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                <th className="py-3 px-3">Folio</th>
                <th className="py-3 px-3">Cliente / Proyecto</th>
                <th className="py-3 px-3">Actividad Realizada</th>
                <th className="py-3 px-3">Próximo Compromiso</th>
                <th className="py-3 px-3">Responsable</th>
                <th className="py-3 px-3">Estado Recordatorio</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay actividades de seguimiento en este filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-[#0F2747] whitespace-nowrap">
                      <Link
                        href={`/solicitudes/${c.request_id}?tab=seguimiento`}
                        className="hover:underline"
                      >
                        {c.folio}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{c.project_name}</div>
                      <div className="text-[11px] text-slate-500">{c.customer_short_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-[#0F2747] font-bold text-[10px] uppercase font-titulos mr-1.5">
                        {c.activity_type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        ({c.activity_date})
                      </span>
                      <div className="mt-0.5 text-slate-800">{c.description}</div>
                    </td>
                    <td className="py-3 px-3">
                      {c.next_activity_date ? (
                        <div>
                          <span className="font-mono font-bold text-[#C72106] block">
                            {c.next_activity_date}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {c.next_activity_description}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sin recordatorio</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {c.responsible_name?.split('(')[0].trim()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {c.urgency === 'VENCIDO' && (
                        <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px] uppercase">
                          Vencido
                        </span>
                      )}
                      {c.urgency === 'HOY' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                          Para Hoy
                        </span>
                      )}
                      {c.urgency === 'PROXIMO' && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-[#0F2747] font-bold text-[10px] uppercase">
                          Programado
                        </span>
                      )}
                      {c.urgency === 'COMPLETADO' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Completado</span>
                        </span>
                      )}
                      {c.urgency === 'CANCELADO' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                          <XCircle className="w-3 h-3" />
                          <span>Cancelado</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canModify &&
                          c.is_completed === 0 &&
                          c.reminder_cancelled === 0 &&
                          c.next_activity_date && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAction(c.id, 'COMPLETE')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase cursor-pointer"
                              >
                                Completar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAction(c.id, 'RESCHEDULE')}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase cursor-pointer"
                              >
                                Reprogramar
                              </button>
                            </>
                          )}
                        <Link
                          href={`/solicitudes/${c.request_id}?tab=seguimiento`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0F2747] text-white font-semibold text-[10px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Expediente</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rescheduleTargetId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0F2747] text-white flex items-center justify-between">
              <h3 id="reschedule-title" className="text-sm font-black uppercase font-titulos">
                Reprogramar Seguimiento
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleTargetId(null)}
                aria-label="Cerrar"
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReschedule} className="p-5 space-y-4 text-xs">
              <div>
                <label
                  htmlFor="reschedule-date-input"
                  className="block font-bold uppercase text-slate-700 mb-1.5 font-titulos"
                >
                  Nueva Fecha de Seguimiento *
                </label>
                <input
                  id="reschedule-date-input"
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono font-bold text-[#0F2747]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleTargetId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReschedule}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase font-titulos inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingReschedule ? 'Guardando...' : 'Confirmar Fecha'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
