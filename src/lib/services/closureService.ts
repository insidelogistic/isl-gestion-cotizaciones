import crypto from 'node:crypto';
import { getAsyncDb, nowMexicoISO } from '../db';
import { assertPermission } from '../auth/rbac';
import type { SafeUser } from '../db/types';

export type CommercialClosureResult =
  | 'GANADA'
  | 'ADJUDICADA_PARCIALMENTE'
  | 'PERDIDA'
  | 'CANCELADA'
  | 'SIN_RESPUESTA'
  | 'ADJUDICADA_TOTAL'
  | 'ADJUDICADA_PARCIAL'
  | 'NO_ADJUDICADA'
  | 'NO_PARTICIPAMOS';

export interface CommercialClosureRecord {
  id: string;
  request_id: string;
  folio?: string;
  project_name?: string;
  customer_name?: string;
  customer_short_name?: string;
  result: string;
  closure_date: string;
  awarded_revision_id: string | null;
  awarded_amount: number | null;
  currency: 'MXN' | 'USD' | 'EUR' | null;
  awarded_currency?: 'MXN' | 'USD' | 'EUR' | null;
  purchase_order_ref: string | null;
  purchase_order_number?: string | null;
  loss_reason?: string | null;
  comments: string;
  evidence_document_id: string | null;
  closed_by: string;
  closed_by_name?: string;
  created_at: string;
  evidence_documents?: Array<{
    id: string;
    original_name: string;
    category: string;
  }>;
}

function mapToDbResult(res: CommercialClosureResult): string {
  switch (res) {
    case 'GANADA':
    case 'ADJUDICADA_TOTAL':
      return 'ADJUDICADA_TOTAL';
    case 'ADJUDICADA_PARCIALMENTE':
    case 'ADJUDICADA_PARCIAL':
      return 'ADJUDICADA_PARCIAL';
    case 'PERDIDA':
    case 'NO_ADJUDICADA':
      return 'NO_ADJUDICADA';
    case 'CANCELADA':
      return 'CANCELADA';
    case 'SIN_RESPUESTA':
    case 'NO_PARTICIPAMOS':
      return 'NO_PARTICIPAMOS';
  }
}

export function formatClosureResultLabel(res: string): string {
  switch (res) {
    case 'ADJUDICADA_TOTAL':
    case 'GANADA':
      return 'Adjudicada Total (Ganada)';
    case 'ADJUDICADA_PARCIAL':
    case 'ADJUDICADA_PARCIALMENTE':
      return 'Adjudicada Parcialmente';
    case 'NO_ADJUDICADA':
    case 'PERDIDA':
      return 'No Adjudicada (Perdida)';
    case 'CANCELADA':
      return 'Cancelada por el Cliente';
    case 'NO_PARTICIPAMOS':
    case 'SIN_RESPUESTA':
      return 'No Participamos / Sin Respuesta';
    default:
      return res;
  }
}

export async function registerCommercialClosure(
  actor: SafeUser,
  input: {
    request_id: string;
    result: CommercialClosureResult;
    closure_date: string;
    awarded_revision_id?: string | null;
    awarded_amount?: number | null;
    awarded_currency?: 'MXN' | 'USD' | 'EUR' | null;
    currency?: 'MXN' | 'USD' | 'EUR' | null;
    purchase_order_number?: string | null;
    purchase_order_ref?: string | null;
    loss_reason?: string | null;
    comments?: string | null;
    evidence_document_id?: string | null;
  }
): Promise<CommercialClosureRecord> {
  assertPermission(actor, 'CLOSE_QUOTE');
  const db = await getAsyncDb();
  const now = nowMexicoISO();

  const reqRow = await db.get<{ id: string; folio: string; status: string }>(
    'SELECT id, folio, status FROM quote_requests WHERE id = ?',
    input.request_id
  );

  if (!reqRow) {
    throw new Error('Expediente de solicitud no encontrado.');
  }

  const dbResult = mapToDbResult(input.result);
  const isAward = dbResult === 'ADJUDICADA_TOTAL' || dbResult === 'ADJUDICADA_PARCIAL';

  let resolvedEvidenceDocId: string | null = input.evidence_document_id || null;

  if (isAward) {
    const awardedAmt = Number(input.awarded_amount ?? 0);
    if (!awardedAmt || awardedAmt <= 0) {
      throw new Error(
        'Para adjudicaciones totales o parciales es obligatorio registrar el importe efectivamente adjudicado mayor a 0.'
      );
    }

    const existingEvidenceDocs = await db.all<{
      id: string;
      original_name: string;
      category: string;
    }>(
      `SELECT id, original_name, category
       FROM documents
       WHERE request_id = ?
         AND (category IN ('ORDEN_COMPRA', 'EVIDENCIA_ADJUDICACION') OR id = ?)`,
      input.request_id,
      input.evidence_document_id || ''
    );

    if (existingEvidenceDocs.length === 0) {
      throw new Error(
        'Regla obligatoria de Cierre Comercial: Cuando el resultado sea «Adjudicada total» o «Adjudicada parcial», es obligatorio adjuntar al menos una evidencia documental (Orden de compra, correo de adjudicación, contrato o confirmación en plataforma).'
      );
    }

    if (!resolvedEvidenceDocId) {
      resolvedEvidenceDocId = existingEvidenceDocs[0].id;
    }
  }

  if (dbResult === 'NO_ADJUDICADA' || dbResult === 'CANCELADA') {
    const reasonText = (input.loss_reason || input.comments || '').trim();
    if (reasonText.length < 3) {
      throw new Error(
        'Cuando el resultado es «No adjudicada» o «Cancelada», es obligatorio especificar el motivo de pérdida o cancelación.'
      );
    }
  }

  const closureId = `cls-${crypto.randomUUID().slice(0, 8)}`;
  const currency = input.awarded_currency || input.currency || 'MXN';
  const poRef = input.purchase_order_number || input.purchase_order_ref || null;
  const combinedComments =
    [input.loss_reason?.trim(), input.comments?.trim()].filter(Boolean).join(' — ') ||
    'Cierre comercial registrado.';

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM commercial_closures WHERE request_id = ?', input.request_id);

    await tx.run(
      `INSERT INTO commercial_closures (
        id, request_id, result, closure_date,
        awarded_revision_id, awarded_amount, currency,
        purchase_order_ref, comments, evidence_document_id,
        closed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      closureId,
      input.request_id,
      dbResult,
      input.closure_date,
      input.awarded_revision_id || null,
      isAward ? Number(input.awarded_amount) : null,
      isAward ? currency : null,
      poRef,
      combinedComments,
      resolvedEvidenceDocId,
      actor.id,
      now
    );

    if (resolvedEvidenceDocId) {
      await tx.run(
        'UPDATE documents SET closure_id = ? WHERE id = ? AND request_id = ?',
        closureId,
        resolvedEvidenceDocId,
        input.request_id
      );
    }

    await tx.run(
      `UPDATE quote_requests
       SET status = 'CERRADA', updated_by = ?, updated_at = ?
       WHERE id = ?`,
      actor.id,
      now,
      input.request_id
    );

    await tx.run(
      `UPDATE follow_up_activities
       SET reminder_cancelled = 1
       WHERE request_id = ? AND is_completed = 0`,
      input.request_id
    );

    await tx.run(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
       VALUES (?, 'QUOTE_REQUEST', ?, 'CIERRE_COMERCIAL_REGISTRADO', ?, ?, ?)`,
      crypto.randomUUID(),
      input.request_id,
      actor.id,
      JSON.stringify({
        closure_id: closureId,
        folio: reqRow.folio,
        result: input.result,
        db_result: dbResult,
        awarded_amount: isAward ? Number(input.awarded_amount) : null,
        currency: isAward ? currency : null,
        purchase_order_ref: poRef,
      }),
      now
    );
  });

  const saved = (await getCommercialClosureByRequestId(input.request_id))!;
  return {
    ...saved,
    result: input.result,
  };
}

export async function getCommercialClosureByRequestId(
  requestId: string
): Promise<CommercialClosureRecord | null> {
  const db = await getAsyncDb();
  const row = await db.get<CommercialClosureRecord>(
    `SELECT
      cc.*,
      qr.folio,
      qr.project_name,
      c.name AS customer_name,
      c.short_name AS customer_short_name,
      u.name AS closed_by_name
     FROM commercial_closures cc
     JOIN quote_requests qr ON qr.id = cc.request_id
     JOIN customers c ON c.id = qr.customer_id
     JOIN users u ON u.id = cc.closed_by
     WHERE cc.request_id = ?`,
    requestId
  );

  if (!row) return null;

  const docs = await db.all<{ id: string; original_name: string; category: string }>(
    `SELECT id, original_name, category
     FROM documents
     WHERE request_id = ?
       AND (closure_id = ? OR id = ? OR category IN ('ORDEN_COMPRA', 'EVIDENCIA_ADJUDICACION'))
     ORDER BY created_at DESC`,
    requestId,
    row.id,
    row.evidence_document_id || ''
  );

  return {
    ...row,
    awarded_currency: row.currency,
    purchase_order_number: row.purchase_order_ref,
    evidence_documents: docs,
  };
}

export async function listCommercialClosures(): Promise<CommercialClosureRecord[]> {
  const db = await getAsyncDb();
  const rows = await db.all<CommercialClosureRecord>(
    `SELECT
      cc.*,
      qr.folio,
      qr.project_name,
      c.name AS customer_name,
      c.short_name AS customer_short_name,
      u.name AS closed_by_name
     FROM commercial_closures cc
     JOIN quote_requests qr ON qr.id = cc.request_id
     JOIN customers c ON c.id = qr.customer_id
     JOIN users u ON u.id = cc.closed_by
     ORDER BY cc.closure_date DESC, cc.created_at DESC`
  );

  const out: CommercialClosureRecord[] = [];
  for (const r of rows) {
    const docs = await db.all<{ id: string; original_name: string; category: string }>(
      `SELECT id, original_name, category
       FROM documents
       WHERE request_id = ?
         AND (closure_id = ? OR id = ? OR category IN ('ORDEN_COMPRA', 'EVIDENCIA_ADJUDICACION'))
       ORDER BY created_at DESC`,
      r.request_id,
      r.id,
      r.evidence_document_id || ''
    );
    out.push({
      ...r,
      awarded_currency: r.currency,
      purchase_order_number: r.purchase_order_ref,
      evidence_documents: docs,
    });
  }
  return out;
}
