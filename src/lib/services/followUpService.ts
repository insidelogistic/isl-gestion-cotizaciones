import crypto from 'node:crypto';
import { getAsyncDb, nowMexicoISO, todayMexicoDate } from '../db';
import { assertPermission } from '../auth/rbac';
import type { SafeUser } from '../db/types';

export type FollowUpActivityType =
  | 'LLAMADA'
  | 'CORREO'
  | 'REUNION'
  | 'ACLARACION'
  | 'NOTA'
  | 'SEGUIMIENTO'
  | 'OTRO';

export interface FollowUpActivityRecord {
  id: string;
  request_id: string;
  folio?: string;
  project_name?: string;
  customer_short_name?: string;
  request_status?: string;
  activity_type: FollowUpActivityType;
  activity_date: string;
  responsible_user_id: string;
  responsible_name?: string;
  description: string;
  next_activity_date: string | null;
  next_activity_description: string | null;
  is_completed: number;
  reminder_cancelled: number;
  created_by: string;
  created_at: string;
  urgency?: 'VENCIDO' | 'HOY' | 'PROXIMO' | 'COMPLETADO' | 'CANCELADO' | 'SIN_FECHA';
}

export function computeCommitmentUrgency(
  nextDate: string | null,
  isCompleted: number,
  reminderCancelled: number,
  referenceDateStr?: string
): FollowUpActivityRecord['urgency'] {
  if (isCompleted === 1) return 'COMPLETADO';
  if (reminderCancelled === 1) return 'CANCELADO';
  if (!nextDate) return 'SIN_FECHA';

  const ref = referenceDateStr ?? todayMexicoDate();
  if (nextDate < ref) return 'VENCIDO';
  if (nextDate === ref) return 'HOY';
  return 'PROXIMO';
}

export async function registerFollowUpActivity(
  actor: SafeUser,
  input: {
    request_id: string;
    activity_type: FollowUpActivityType;
    activity_date: string;
    responsible_user_id?: string;
    description: string;
    next_activity_date?: string | null;
    next_activity_description?: string | null;
    associated_document_id?: string | null;
  }
): Promise<FollowUpActivityRecord> {
  assertPermission(actor, 'MANAGE_FOLLOWUPS');
  if (!input.description || input.description.trim().length < 3) {
    throw new Error('La descripción de la actividad de seguimiento es obligatoria.');
  }

  const db = await getAsyncDb();
  const reqRow = await db.get<{ id: string; folio: string; status: string }>(
    'SELECT id, folio, status FROM quote_requests WHERE id = ?',
    input.request_id
  );

  if (!reqRow) {
    throw new Error('Expediente de solicitud no encontrado.');
  }

  const id = `act-${crypto.randomUUID().slice(0, 8)}`;
  const now = nowMexicoISO();
  const responsibleId = input.responsible_user_id || actor.id;

  await db.run(
    `INSERT INTO follow_up_activities (
      id, request_id, activity_type, activity_date, responsible_user_id,
      description, next_activity_date, next_activity_description,
      is_completed, reminder_cancelled, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    id,
    input.request_id,
    input.activity_type,
    input.activity_date,
    responsibleId,
    input.description.trim(),
    input.next_activity_date || null,
    input.next_activity_description?.trim() || null,
    actor.id,
    now
  );

  if (input.associated_document_id) {
    await db.run(
      'UPDATE documents SET activity_id = ? WHERE id = ? AND request_id = ?',
      id,
      input.associated_document_id,
      input.request_id
    );
  }

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'SEGUIMIENTO_REGISTRADO', ?, ?, ?)`,
    crypto.randomUUID(),
    input.request_id,
    actor.id,
    JSON.stringify({
      activity_id: id,
      activity_type: input.activity_type,
      activity_date: input.activity_date,
      next_activity_date: input.next_activity_date || null,
    }),
    now
  );

  return (await getFollowUpActivityById(id))!;
}

export async function getFollowUpActivityById(
  activityId: string
): Promise<FollowUpActivityRecord | null> {
  const db = await getAsyncDb();
  const row = await db.get<FollowUpActivityRecord>(
    `SELECT
      fa.*,
      qr.folio,
      qr.project_name,
      qr.status AS request_status,
      c.short_name AS customer_short_name,
      u.name AS responsible_name
     FROM follow_up_activities fa
     JOIN quote_requests qr ON qr.id = fa.request_id
     JOIN customers c ON c.id = qr.customer_id
     JOIN users u ON u.id = fa.responsible_user_id
     WHERE fa.id = ?`,
    activityId
  );

  if (!row) return null;
  return {
    ...row,
    urgency: computeCommitmentUrgency(
      row.next_activity_date,
      row.is_completed,
      row.reminder_cancelled
    ),
  };
}

export async function completeFollowUpActivity(
  actor: SafeUser,
  activityId: string,
  resolutionComment?: string
): Promise<FollowUpActivityRecord> {
  assertPermission(actor, 'MANAGE_FOLLOWUPS');
  const db = await getAsyncDb();
  const existing = await getFollowUpActivityById(activityId);
  if (!existing) {
    throw new Error('Actividad de seguimiento no encontrada.');
  }

  const now = nowMexicoISO();
  const updatedDesc = resolutionComment
    ? `${existing.description} [Completado: ${resolutionComment.trim()}]`
    : existing.description;

  await db.run(
    `UPDATE follow_up_activities
     SET is_completed = 1, description = ?
     WHERE id = ?`,
    updatedDesc,
    activityId
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'SEGUIMIENTO_COMPLETADO', ?, ?, ?)`,
    crypto.randomUUID(),
    existing.request_id,
    actor.id,
    JSON.stringify({ activity_id: activityId, comment: resolutionComment || null }),
    now
  );

  return (await getFollowUpActivityById(activityId))!;
}

export async function rescheduleFollowUpActivity(
  actor: SafeUser,
  activityId: string,
  newNextActivityDate: string,
  newNextActivityDescription?: string
): Promise<FollowUpActivityRecord> {
  assertPermission(actor, 'MANAGE_FOLLOWUPS');
  const db = await getAsyncDb();
  const existing = await getFollowUpActivityById(activityId);
  if (!existing) {
    throw new Error('Actividad de seguimiento no encontrada.');
  }

  const now = nowMexicoISO();
  await db.run(
    `UPDATE follow_up_activities
     SET next_activity_date = ?,
         next_activity_description = COALESCE(?, next_activity_description),
         is_completed = 0,
         reminder_cancelled = 0
     WHERE id = ?`,
    newNextActivityDate,
    newNextActivityDescription?.trim() || null,
    activityId
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'RECORDATORIO_REPROGRAMADO', ?, ?, ?)`,
    crypto.randomUUID(),
    existing.request_id,
    actor.id,
    JSON.stringify({
      activity_id: activityId,
      previous_date: existing.next_activity_date,
      new_date: newNextActivityDate,
    }),
    now
  );

  return (await getFollowUpActivityById(activityId))!;
}

export async function cancelFollowUpReminder(
  actor: SafeUser,
  activityId: string
): Promise<FollowUpActivityRecord> {
  assertPermission(actor, 'MANAGE_FOLLOWUPS');
  const db = await getAsyncDb();
  const existing = await getFollowUpActivityById(activityId);
  if (!existing) {
    throw new Error('Actividad de seguimiento no encontrada.');
  }

  const now = nowMexicoISO();
  await db.run(
    `UPDATE follow_up_activities
     SET reminder_cancelled = 1
     WHERE id = ?`,
    activityId
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'RECORDATORIO_CANCELADO', ?, ?, ?)`,
    crypto.randomUUID(),
    existing.request_id,
    actor.id,
    JSON.stringify({ activity_id: activityId }),
    now
  );

  return (await getFollowUpActivityById(activityId))!;
}

export async function listFollowUpCommitments(options?: {
  requestId?: string;
  responsibleUserId?: string;
  onlyPending?: boolean;
  referenceDateStr?: string;
}): Promise<FollowUpActivityRecord[]> {
  const db = await getAsyncDb();
  const where: string[] = ['1 = 1'];
  const params: (string | number)[] = [];

  if (options?.requestId) {
    where.push('fa.request_id = ?');
    params.push(options.requestId);
  }
  if (options?.responsibleUserId && options.responsibleUserId !== 'ALL') {
    where.push('fa.responsible_user_id = ?');
    params.push(options.responsibleUserId);
  }
  if (options?.onlyPending) {
    where.push(
      'fa.is_completed = 0 AND fa.reminder_cancelled = 0 AND fa.next_activity_date IS NOT NULL'
    );
  }

  const rows = await db.all<FollowUpActivityRecord>(
    `SELECT
      fa.*,
      qr.folio,
      qr.project_name,
      qr.status AS request_status,
      c.short_name AS customer_short_name,
      u.name AS responsible_name
     FROM follow_up_activities fa
     JOIN quote_requests qr ON qr.id = fa.request_id
     JOIN customers c ON c.id = qr.customer_id
     JOIN users u ON u.id = fa.responsible_user_id
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(fa.next_activity_date, fa.activity_date) ASC, fa.created_at DESC`,
    ...params
  );

  return rows.map((r) => ({
    ...r,
    urgency: computeCommitmentUrgency(
      r.next_activity_date,
      r.is_completed,
      r.reminder_cancelled,
      options?.referenceDateStr
    ),
  }));
}
