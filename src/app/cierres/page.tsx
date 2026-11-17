import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, Download, CheckCircle2 } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { listQuoteRequests } from '@/lib/services/requestService';
import {
  listCommercialClosures,
  formatClosureResultLabel,
} from '@/lib/services/closureService';
import { AppShell } from '@/components/layout/AppShell';
import { StatusBadge, formatMoney } from '@/components/ui/Badges';

export const dynamic = 'force-dynamic';

export default async function CierresPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const requests = listQuoteRequests({});
  const closures = listCommercialClosures();
  const closureByRequestId = new Map(closures.map((c) => [c.request_id, c]));

  const urgentCount = requests.filter(
    (r) => r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA'
  ).length;

  return (
    <AppShell user={user} urgentCount={urgentCount}>
      <div className="space-y-4">
        <div className="isl-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase text-[#C72106] font-titulos">
              7. Resultados y Adjudicaciones Comerciales
            </span>
            <h1 className="text-xl font-black text-[#0F2747] uppercase font-titulos">
              Cierre Comercial (Con Evidencia Documental Obligatoria)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de adjudicaciones totales, adjudicaciones parciales, ofertas perdidas y canceladas.
            </p>
          </div>
        </div>

        <div className="isl-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Resultado Comercial</th>
                  <th className="py-3 px-4 text-right">Importe Ofertado</th>
                  <th className="py-3 px-4 text-right">Importe Adjudicado</th>
                  <th className="py-3 px-4">Evidencia / OC</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Sin expedientes registrados.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => {
                    const cls = closureByRequestId.get(r.id);
                    const evDoc = cls?.evidence_documents?.[0];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-[#0F2747] whitespace-nowrap">
                          {r.folio}
                        </td>
                        <td className="py-3 px-4 font-semibold">{r.customer_short_name}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{r.project_name}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {cls ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                                cls.result.includes('ADJUDICADA') || cls.result === 'GANADA'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{formatClosureResultLabel(cls.result)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">En proceso comercial</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {formatMoney(r.latest_offered_amount, r.latest_offered_currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                          {cls?.awarded_amount
                            ? formatMoney(cls.awarded_amount, cls.currency || 'MXN')
                            : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {evDoc ? (
                            <a
                              href={`/api/documents/${evDoc.id}/download`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[11px] hover:bg-emerald-100"
                            >
                              <Download className="w-3 h-3" />
                              <span>{cls?.purchase_order_ref || evDoc.original_name}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/solicitudes/${r.id}?tab=cierre`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C72106] hover:bg-[#A31B05] text-white font-semibold text-[11px] transition"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>{cls ? 'Ver Cierre' : 'Registrar Cierre'}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
