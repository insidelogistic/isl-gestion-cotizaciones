import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileSpreadsheet, Lock, Plus, FolderOpen, CheckCircle2 } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { listQuoteRequests } from '@/lib/services/requestService';
import { listQuoteRevisions } from '@/lib/services/quoteService';
import {
  listCommercialClosures,
  formatClosureResultLabel,
} from '@/lib/services/closureService';
import { AppShell } from '@/components/layout/AppShell';
import {
  ORIGIN_LABELS,
  OriginBadge,
  STATUS_LABELS,
  StatusBadge,
  formatMoney,
} from '@/components/ui/Badges';
import { AdminDeleteRequestButton } from '@/components/requests/AdminDeleteRequestButton';
import {
  ExportQuotesPdfButton,
  type QuotePdfRow,
} from '@/components/quotes/ExportQuotesPdfButton';

export const dynamic = 'force-dynamic';

export default async function CotizacionesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const requests = await listQuoteRequests({});
  const closures = await listCommercialClosures();
  const closureByRequestId = new Map(closures.map((c) => [c.request_id, c]));

  const urgentCount = requests.filter(
    (r) => r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA'
  ).length;

  const rowsWithRevisions = await Promise.all(
    requests.map(async (req) => ({
      request: req,
      revisions: await listQuoteRevisions(req.id),
      closure: closureByRequestId.get(req.id),
    }))
  );

  const pdfRows: QuotePdfRow[] = rowsWithRevisions.map(({ request: r, revisions, closure }) => ({
    folio: r.folio,
    customerShortName: r.customer_short_name,
    customerName: r.customer_name,
    originLabel: ORIGIN_LABELS[r.origin_type],
    projectName: r.project_name,
    responsibleName: r.responsible_name,
    statusLabel: STATUS_LABELS[r.status],
    commercialStatusLabel: closure
      ? formatClosureResultLabel(closure.result)
      : 'En evaluación',
    revisionsSummary:
      revisions.length > 0
        ? revisions.map((rev) => `${rev.revision_code} (${rev.status})`).join(', ')
        : 'Sin revisiones',
    offeredAmountFormatted: formatMoney(r.latest_offered_amount, r.latest_offered_currency),
    awardedAmountFormatted: closure?.awarded_amount
      ? formatMoney(closure.awarded_amount, closure.currency || 'MXN')
      : '—',
    offeredAmountNum: Number(r.latest_offered_amount || 0),
    awardedAmountNum: Number(closure?.awarded_amount || 0),
  }));

  return (
    <AppShell user={user} urgentCount={urgentCount}>
      <div className="space-y-4">
        <div className="isl-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase text-[#C72106] font-titulos">
              5. Control de Ofertas y Revisiones
            </span>
            <h1 className="text-xl font-black text-[#0F2747] uppercase font-titulos">
              Cotizaciones (Modalidad A Interna y Modalidad B Excel / PDF)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta consolidada de revisiones por expediente (Rev. 00, Rev. 01...) con control de inmutabilidad y estatus comercial.
            </p>
          </div>
          <ExportQuotesPdfButton rows={pdfRows} generatedBy={user.name} />
        </div>

        <div className="isl-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Cliente / Origen</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Estatus Comercial</th>
                  <th className="py-3 px-4">Revisiones Registradas</th>
                  <th className="py-3 px-4 text-right">Último Importe Vigente</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rowsWithRevisions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Sin expedientes registrados.
                    </td>
                  </tr>
                ) : (
                  rowsWithRevisions.map(({ request: r, revisions, closure }) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#0F2747] whitespace-nowrap">
                        <Link
                          href={`/solicitudes/${r.id}?tab=cotizaciones`}
                          className="hover:underline"
                        >
                          {r.folio}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.customer_short_name}</div>
                        <div className="mt-0.5">
                          <OriginBadge origin={r.origin_type} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.project_name}</div>
                        <div className="text-[11px] text-slate-500">
                          Resp: {r.responsible_name.split('(')[0].trim()}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {closure ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                closure.result.includes('ADJUDICADA') ||
                                closure.result === 'GANADA'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : closure.result === 'NO_ADJUDICADA' ||
                                    closure.result === 'PERDIDA'
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : 'bg-slate-200 text-slate-700 border border-slate-300'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{formatClosureResultLabel(closure.result)}</span>
                            </span>
                            {closure.awarded_amount ? (
                              <div className="text-[10px] font-mono font-bold text-emerald-800 mt-0.5">
                                Adj: {formatMoney(closure.awarded_amount, closure.currency || 'MXN')}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0F2747] border border-blue-200 font-bold text-[10px] uppercase">
                            En evaluación
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {revisions.length === 0 ? (
                          <span className="text-slate-400 italic">Sin cotización aún</span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {revisions.map((rev) => (
                              <span
                                key={rev.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
                                  rev.status === 'PRESENTADA'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : rev.status === 'BORRADOR'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span>{rev.revision_code}</span>
                                <span className="text-[9px] uppercase opacity-75">
                                  ({rev.modality === 'INTERNAL' ? 'Int' : 'Ext'})
                                </span>
                                {rev.is_immutable === 1 && <Lock className="w-2.5 h-2.5" />}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <div className="text-slate-900">
                          {formatMoney(r.latest_offered_amount, r.latest_offered_currency)}
                        </div>
                        {r.latest_revision_code && (
                          <div className="text-[10px] text-slate-500">{r.latest_revision_code}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/solicitudes/${r.id}?tab=cotizaciones`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2747] hover:bg-[#163866] text-white font-semibold text-[11px] transition"
                          >
                            {revisions.length === 0 ? (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Capturar Rev. 00</span>
                              </>
                            ) : (
                              <>
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Gestionar Revisiones</span>
                              </>
                            )}
                          </Link>
                          <Link
                            href={`/solicitudes/${r.id}?tab=documentos`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition"
                            title="Abrir documentos del expediente en Google Drive"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Drive</span>
                          </Link>
                          {user.role === 'ADMIN' && (
                            <AdminDeleteRequestButton
                              requestId={r.id}
                              folio={r.folio}
                              projectName={r.project_name}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
