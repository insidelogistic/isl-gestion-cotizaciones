import React from 'react';
import type { EnrichedQuoteRequest, OriginType, RequestStatus } from '@/lib/db/types';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  RECIBIDA: 'Recibida',
  EN_ELABORACION: 'En elaboración',
  PRESENTADA: 'Presentada',
  EN_NEGOCIACION: 'En negociación',
  CERRADA: 'Cerrada',
};

export const ORIGIN_LABELS: Record<OriginType, string> = {
  LICITACION_VW: 'Licitación Volkswagen',
  DIRECTA_VW: 'Solicitud directa VW',
  OTRO_CLIENTE: 'Otro cliente',
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const styles: Record<RequestStatus, string> = {
    RECIBIDA: 'bg-blue-50 text-blue-800 border-blue-200',
    EN_ELABORACION: 'bg-amber-50 text-amber-800 border-amber-200',
    PRESENTADA: 'bg-sky-50 text-sky-800 border-sky-200',
    EN_NEGOCIACION: 'bg-purple-50 text-purple-800 border-purple-200',
    CERRADA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };

  const dots: Record<RequestStatus, string> = {
    RECIBIDA: 'bg-blue-600',
    EN_ELABORACION: 'bg-amber-500',
    PRESENTADA: 'bg-sky-600',
    EN_NEGOCIACION: 'bg-purple-600',
    CERRADA: 'bg-emerald-600',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: OriginType }) {
  const styles: Record<OriginType, string> = {
    LICITACION_VW: 'bg-[#0F2747]/10 text-[#0F2747] border-[#0F2747]/20',
    DIRECTA_VW: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    OTRO_CLIENTE: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${styles[origin]}`}>
      {ORIGIN_LABELS[origin]}
    </span>
  );
}

export function DeadlineBadge({
  deadlineDate,
  semaphore,
  daysUntil,
}: {
  deadlineDate: string | null;
  semaphore: EnrichedQuoteRequest['deadline_semaphore'];
  daysUntil: number | null;
}) {
  if (!deadlineDate) {
    return <span className="text-xs text-slate-400 italic">Sin fecha límite</span>;
  }

  const mapStyle = {
    VENCIDA: 'bg-red-50 text-[#C72106] border-red-200 font-bold',
    POR_VENCER: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
    EN_TIEMPO: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
    CERRADA: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    SIN_FECHA: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  let label = deadlineDate;
  if (semaphore === 'VENCIDA' && daysUntil !== null) {
    label = `${deadlineDate} (Vencida ${Math.abs(daysUntil)}d)`;
  } else if (semaphore === 'POR_VENCER' && daysUntil !== null) {
    label = daysUntil === 0 ? `${deadlineDate} (Vence hoy)` : `${deadlineDate} (En ${daysUntil}d)`;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border font-mono ${mapStyle[semaphore]}`}>
      {semaphore === 'VENCIDA' && <span className="w-1.5 h-1.5 rounded-full bg-[#C72106] animate-pulse" />}
      {semaphore === 'POR_VENCER' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
      {label}
    </span>
  );
}

export function formatMoney(amount: number | null | undefined, currency: string | null = 'MXN'): string {
  if (amount === null || amount === undefined) {
    return 'Sin oferta aún';
  }
  const cur = currency || 'MXN';
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$${formatted} ${cur}`;
}
