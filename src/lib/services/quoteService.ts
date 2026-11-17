import crypto from 'node:crypto';
import { getDb, nowMexicoISO } from '../db';
import { assertPermission } from '../auth/rbac';
import type { SafeUser } from '../db/types';

export interface QuoteItemInput {
  concept: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteItemRecord extends QuoteItemInput {
  id: string;
  revision_id: string;
  amount: number;
  sort_order: number;
}

export interface QuoteRevisionRecord {
  id: string;
  request_id: string;
  revision_code: string;
  revision_number: number;
  modality: 'INTERNAL' | 'EXTERNAL';
  currency: 'MXN' | 'USD' | 'EUR';
  issue_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: 'BORRADOR' | 'PRESENTADA' | 'HISTORICA';
  is_immutable: number;
  presented_at: string | null;
  presentation_channel: string | null;
  presented_by: string | null;
  presented_by_name?: string | null;
  observations: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  items: QuoteItemRecord[];
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula una fecha sumando N días hábiles (saltando sábados y domingos).
 */
export function addBusinessDays(startDateStr: string, businessDays: number = 3): string {
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  let remaining = Math.max(1, businessDays);

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dayOfWeek = date.getUTCDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  return date.toISOString().slice(0, 10);
}

export function listQuoteRevisions(requestId: string): QuoteRevisionRecord[] {
  const db = getDb();
  const revisions = db
    .prepare(
      `SELECT
        qr.*,
        u.name AS created_by_name,
        up.name AS presented_by_name
       FROM quote_revisions qr
       JOIN users u ON u.id = qr.created_by
       LEFT JOIN users up ON up.id = qr.presented_by
       WHERE qr.request_id = ?
       ORDER BY qr.revision_number DESC`
    )
    .all(requestId) as unknown as Omit<QuoteRevisionRecord, 'items'>[];

  return revisions.map((rev) => {
    const items = (
      db
        .prepare('SELECT * FROM quote_items WHERE revision_id = ? ORDER BY sort_order ASC')
        .all(rev.id) as unknown as QuoteItemRecord[]
    ).map((it) => ({ ...it }));
    return {
      ...rev,
      items,
    };
  });
}

export function getQuoteRevisionById(revisionId: string): QuoteRevisionRecord | null {
  const db = getDb();
  const rev = db
    .prepare(
      `SELECT
        qr.*,
        u.name AS created_by_name,
        up.name AS presented_by_name
       FROM quote_revisions qr
       JOIN users u ON u.id = qr.created_by
       LEFT JOIN users up ON up.id = qr.presented_by
       WHERE qr.id = ?`
    )
    .get(revisionId) as unknown as Omit<QuoteRevisionRecord, 'items'> | undefined;

  if (!rev) return null;

  const items = (
    db
      .prepare('SELECT * FROM quote_items WHERE revision_id = ? ORDER BY sort_order ASC')
      .all(rev.id) as unknown as QuoteItemRecord[]
  ).map((it) => ({ ...it }));

  return {
    ...rev,
    items,
  };
}

export function createQuoteRevision(
  actor: SafeUser,
  input: {
    request_id: string;
    modality: 'INTERNAL' | 'EXTERNAL';
    currency: 'MXN' | 'USD' | 'EUR';
    issue_date: string;
    tax_rate?: number;
    subtotal?: number;
    observations?: string | null;
    items?: QuoteItemInput[];
    associated_document_id?: string | null;
  }
): QuoteRevisionRecord {
  assertPermission(actor, 'MANAGE_QUOTES');
  const db = getDb();
  const now = nowMexicoISO();

  const reqRow = db
    .prepare('SELECT id, folio, status FROM quote_requests WHERE id = ?')
    .get(input.request_id) as { id: string; folio: string; status: string } | undefined;

  if (!reqRow) {
    throw new Error('El expediente de solicitud no existe.');
  }

  // Determinar siguiente número de revisión: Rev. 00, Rev. 01, Rev. 02...
  const maxRow = db
    .prepare('SELECT MAX(revision_number) as max_rev, COUNT(*) as count FROM quote_revisions WHERE request_id = ?')
    .get(input.request_id) as { max_rev: number | null; count: number };

  const nextRevNumber = maxRow.count === 0 ? 0 : (maxRow.max_rev ?? 0) + 1;
  const revisionCode = `Rev. ${String(nextRevNumber).padStart(2, '0')}`;
  const id = `qrev-${crypto.randomUUID().slice(0, 8)}`;

  const taxRate = input.tax_rate !== undefined ? Number(input.tax_rate) : 16;
  let subtotal = 0;

  const validItems: Array<QuoteItemInput & { amount: number }> = [];
  if (input.modality === 'INTERNAL') {
    if (!input.items || input.items.length === 0) {
      throw new Error('En la Modalidad A (Captura interna) debe registrar al menos un concepto.');
    }
    for (const item of input.items) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      if (!item.concept?.trim() || qty <= 0 || price < 0) {
        throw new Error('Todos los conceptos deben tener descripción, cantidad mayor a 0 y precio unitario válido.');
      }
      const amount = roundMoney(qty * price);
      subtotal = roundMoney(subtotal + amount);
      validItems.push({
        concept: item.concept.trim(),
        unit: item.unit?.trim() || 'PZA',
        quantity: qty,
        unit_price: price,
        amount,
      });
    }
  } else {
    subtotal = roundMoney(Number(input.subtotal ?? 0));
    if (subtotal <= 0) {
      throw new Error('En la Modalidad B (Externa) debe indicar un importe ofertado antes de impuestos mayor a 0.');
    }
  }

  const taxAmount = roundMoney(subtotal * (taxRate / 100));
  const total = roundMoney(subtotal + taxAmount);

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare(
      `INSERT INTO quote_revisions (
        id, request_id, revision_code, revision_number, modality, currency,
        issue_date, subtotal, tax_rate, tax_amount, total,
        status, is_immutable, observations, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BORRADOR', 0, ?, ?, ?)`
    ).run(
      id,
      input.request_id,
      revisionCode,
      nextRevNumber,
      input.modality,
      input.currency,
      input.issue_date,
      subtotal,
      taxRate,
      taxAmount,
      total,
      input.observations || null,
      actor.id,
      now
    );

    if (input.modality === 'INTERNAL') {
      const insertItem = db.prepare(
        `INSERT INTO quote_items (id, revision_id, concept, unit, quantity, unit_price, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      validItems.forEach((it, idx) => {
        insertItem.run(
          `qitm-${crypto.randomUUID().slice(0, 8)}`,
          id,
          it.concept,
          it.unit,
          it.quantity,
          it.unit_price,
          it.amount,
          idx + 1
        );
      });
    }

    if (input.associated_document_id) {
      db.prepare('UPDATE documents SET revision_id = ? WHERE id = ? AND request_id = ?').run(
        id,
        input.associated_document_id,
        input.request_id
      );
    }

    // Si la solicitud estaba en RECIBIDA, pasarla automáticamente a EN_ELABORACION;
    // si ya estaba PRESENTADA y se crea una nueva revisión, pasarla a EN_NEGOCIACION
    if (reqRow.status === 'RECIBIDA') {
      db.prepare('UPDATE quote_requests SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
        'EN_ELABORACION',
        actor.id,
        now,
        input.request_id
      );
    } else if (reqRow.status === 'PRESENTADA' && nextRevNumber > 0) {
      db.prepare('UPDATE quote_requests SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
        'EN_NEGOCIACION',
        actor.id,
        now,
        input.request_id
      );
    }

    db.prepare(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
       VALUES (?, 'QUOTE_REQUEST', ?, 'COTIZACION_REVISION_CREADA', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      input.request_id,
      actor.id,
      JSON.stringify({
        revision_code: revisionCode,
        modality: input.modality,
        currency: input.currency,
        subtotal,
        total,
      }),
      now
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getQuoteRevisionById(id)!;
}

export function updateDraftQuoteRevision(
  actor: SafeUser,
  revisionId: string,
  input: {
    currency: 'MXN' | 'USD' | 'EUR';
    issue_date: string;
    tax_rate?: number;
    subtotal?: number;
    observations?: string | null;
    items?: QuoteItemInput[];
  }
): QuoteRevisionRecord {
  assertPermission(actor, 'MANAGE_QUOTES');
  const db = getDb();
  const existing = getQuoteRevisionById(revisionId);
  if (!existing) {
    throw new Error('La revisión de cotización no existe.');
  }

  if (existing.is_immutable === 1 || existing.status === 'PRESENTADA') {
    throw new Error(
      `La revisión ${existing.revision_code} ya fue presentada formalmente al cliente y es inmutable. Para modificar la oferta debe crear una nueva revisión.`
    );
  }

  const taxRate = input.tax_rate !== undefined ? Number(input.tax_rate) : existing.tax_rate;
  let subtotal = 0;
  const validItems: Array<QuoteItemInput & { amount: number }> = [];

  if (existing.modality === 'INTERNAL') {
    if (!input.items || input.items.length === 0) {
      throw new Error('Debe mantener al menos un concepto en la cotización.');
    }
    for (const item of input.items) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const amount = roundMoney(qty * price);
      subtotal = roundMoney(subtotal + amount);
      validItems.push({
        concept: item.concept.trim(),
        unit: item.unit?.trim() || 'PZA',
        quantity: qty,
        unit_price: price,
        amount,
      });
    }
  } else {
    subtotal = roundMoney(Number(input.subtotal ?? existing.subtotal));
  }

  const taxAmount = roundMoney(subtotal * (taxRate / 100));
  const total = roundMoney(subtotal + taxAmount);

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare(
      `UPDATE quote_revisions
       SET currency = ?, issue_date = ?, subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?, observations = ?
       WHERE id = ?`
    ).run(
      input.currency,
      input.issue_date,
      subtotal,
      taxRate,
      taxAmount,
      total,
      input.observations ?? existing.observations,
      revisionId
    );

    if (existing.modality === 'INTERNAL') {
      db.prepare('DELETE FROM quote_items WHERE revision_id = ?').run(revisionId);
      const insertItem = db.prepare(
        `INSERT INTO quote_items (id, revision_id, concept, unit, quantity, unit_price, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      validItems.forEach((it, idx) => {
        insertItem.run(
          `qitm-${crypto.randomUUID().slice(0, 8)}`,
          revisionId,
          it.concept,
          it.unit,
          it.quantity,
          it.unit_price,
          it.amount,
          idx + 1
        );
      });
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getQuoteRevisionById(revisionId)!;
}

export function markQuoteRevisionAsPresented(
  actor: SafeUser,
  input: {
    revision_id: string;
    presentation_date: string;
    presentation_channel: string;
    follow_up_business_days?: number;
    custom_follow_up_date?: string | null;
    evidence_document_id?: string | null;
    notes?: string | null;
  }
): {
  revision: QuoteRevisionRecord;
  proposedFollowUpDate: string;
} {
  assertPermission(actor, 'MANAGE_QUOTES');
  const db = getDb();
  const rev = getQuoteRevisionById(input.revision_id);
  if (!rev) {
    throw new Error('Revisión de cotización no encontrada.');
  }

  const now = nowMexicoISO();
  const proposedFollowUpDate =
    input.custom_follow_up_date && input.custom_follow_up_date.trim().length > 0
      ? input.custom_follow_up_date
      : addBusinessDays(input.presentation_date, input.follow_up_business_days ?? 3);

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    // 1. Marcar revisiones anteriores presentadas como HISTORICA (conservando su inmutabilidad)
    db.prepare(
      `UPDATE quote_revisions
       SET status = 'HISTORICA'
       WHERE request_id = ? AND status = 'PRESENTADA' AND id != ?`
    ).run(rev.request_id, rev.id);

    // 2. Marcar esta revisión como PRESENTADA e INMUTABLE
    db.prepare(
      `UPDATE quote_revisions
       SET status = 'PRESENTADA',
           is_immutable = 1,
           presented_at = ?,
           presentation_channel = ?,
           presented_by = ?,
           observations = COALESCE(?, observations)
       WHERE id = ?`
    ).run(
      input.presentation_date,
      input.presentation_channel,
      actor.id,
      input.notes || null,
      rev.id
    );

    if (input.evidence_document_id) {
      db.prepare('UPDATE documents SET revision_id = ? WHERE id = ? AND request_id = ?').run(
        rev.id,
        input.evidence_document_id,
        rev.request_id
      );
    }

    // 3. Actualizar el estado del expediente a PRESENTADA
    db.prepare(
      `UPDATE quote_requests
       SET status = 'PRESENTADA', updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(actor.id, now, rev.request_id);

    // 4. Programar automáticamente la actividad de seguimiento comercial
    db.prepare(
      `INSERT INTO follow_up_activities (
        id, request_id, activity_type, activity_date, responsible_user_id,
        description, next_activity_date, next_activity_description,
        is_completed, reminder_cancelled, created_by, created_at
      ) VALUES (?, ?, 'SEGUIMIENTO', ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    ).run(
      `act-${crypto.randomUUID().slice(0, 8)}`,
      rev.request_id,
      input.presentation_date,
      actor.id,
      `Oferta ${rev.revision_code} presentada vía ${input.presentation_channel} por $${rev.subtotal.toLocaleString('es-MX')} ${rev.currency}.`,
      proposedFollowUpDate,
      `Seguimiento programado a oferta ${rev.revision_code} (${input.presentation_channel})`,
      actor.id,
      now
    );

    // 5. Registrar en bitácora de auditoría
    db.prepare(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
       VALUES (?, 'QUOTE_REQUEST', ?, 'COTIZACION_PRESENTADA', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      rev.request_id,
      actor.id,
      JSON.stringify({
        revision_code: rev.revision_code,
        presentation_date: input.presentation_date,
        presentation_channel: input.presentation_channel,
        subtotal: rev.subtotal,
        currency: rev.currency,
        proposed_follow_up_date: proposedFollowUpDate,
      }),
      now
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    revision: getQuoteRevisionById(rev.id)!,
    proposedFollowUpDate,
  };
}

export function deleteQuoteRevision(actor: SafeUser, revisionId: string): void {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar revisiones de cotización.');
  }
  const db = getDb();
  const existing = getQuoteRevisionById(revisionId);
  if (!existing) {
    throw new Error('Revisión de cotización no encontrada.');
  }

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    db.prepare('UPDATE documents SET revision_id = NULL WHERE revision_id = ?').run(revisionId);
    db.prepare(
      'UPDATE commercial_closures SET awarded_revision_id = NULL WHERE awarded_revision_id = ?'
    ).run(revisionId);
    db.prepare('DELETE FROM quote_items WHERE revision_id = ?').run(revisionId);
    db.prepare('DELETE FROM quote_revisions WHERE id = ?').run(revisionId);

    db.prepare(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
       VALUES (?, 'QUOTE_REQUEST', ?, 'REVISION_COTIZACION_ELIMINADA', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      existing.request_id,
      actor.id,
      JSON.stringify({
        revision_id: revisionId,
        revision_code: existing.revision_code,
        subtotal: existing.subtotal,
      }),
      nowMexicoISO()
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
