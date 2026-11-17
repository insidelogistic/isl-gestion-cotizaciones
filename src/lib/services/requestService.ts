import crypto from 'node:crypto';
import { getAsyncDb, nowMexicoISO, todayMexicoDate } from '../db';
import { assertPermission } from '../auth/rbac';
import { generateNextFolio } from './folioService';
import { getVwCustomer } from './catalogService';
import { listQuoteRevisions } from './quoteService';
import { listExpedienteDocuments } from './documentService';
import { getCommercialClosureByRequestId } from './closureService';
import { CreateQuoteRequestSchema } from '../validation/schemas';
import type {
  AuditLogRecord,
  EnrichedQuoteRequest,
  RequestStatus,
  SafeUser,
} from '../db/types';

export interface RequestFilterOptions {
  search?: string;
  status?: RequestStatus | 'ALL';
  customerId?: string;
  responsibleUserId?: string;
  originType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'received_date' | 'deadline_date' | 'folio' | 'project_name';
  sortDir?: 'ASC' | 'DESC';
}

export function computeDeadlineSemaphore(
  deadlineDate: string | null,
  status: RequestStatus,
  referenceDateStr?: string
): { semaphore: EnrichedQuoteRequest['deadline_semaphore']; daysUntil: number | null } {
  if (status === 'CERRADA') {
    return { semaphore: 'CERRADA', daysUntil: null };
  }
  if (!deadlineDate) {
    return { semaphore: 'SIN_FECHA', daysUntil: null };
  }

  const refStr = referenceDateStr ?? todayMexicoDate();
  const refTime = new Date(`${refStr}T00:00:00Z`).getTime();
  const deadTime = new Date(`${deadlineDate}T00:00:00Z`).getTime();
  const diffDays = Math.round((deadTime - refTime) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { semaphore: 'VENCIDA', daysUntil: diffDays };
  }
  if (diffDays <= 3) {
    return { semaphore: 'POR_VENCER', daysUntil: diffDays };
  }
  return { semaphore: 'EN_TIEMPO', daysUntil: diffDays };
}

export async function createQuoteRequest(
  actor: SafeUser,
  rawInput: unknown
): Promise<EnrichedQuoteRequest> {
  assertPermission(actor, 'CREATE_REQUEST');
  const parsed = CreateQuoteRequestSchema.parse(rawInput);
  const db = await getAsyncDb();
  const now = nowMexicoISO();

  const receivedYear = Number(parsed.received_date.slice(0, 4)) || 2026;
  const id = `req-${crypto.randomUUID().slice(0, 8)}`;

  let customerId = '';
  let customerName = '';
  if (parsed.origin_type === 'LICITACION_VW' || parsed.origin_type === 'DIRECTA_VW') {
    const vw = await getVwCustomer();
    customerId = vw.id;
    customerName = vw.name;
  } else {
    customerId = parsed.customer_id;
    const custRow = await db.get<{ name: string }>(
      'SELECT name FROM customers WHERE id = ?',
      customerId
    );
    if (!custRow) {
      throw new Error('Cliente seleccionado no encontrado en el catálogo.');
    }
    customerName = custRow.name;
  }

  const folio = await generateNextFolio(receivedYear, customerName);
  const driveFolderPath = `IN SIDE LOGISTIC / COTIZACIONES / ${receivedYear} / ${folio}`;

  await db.run(
    `INSERT INTO quote_requests (
      id, folio, origin_type, customer_id, project_name, description,
      received_date, deadline_date, responsible_user_id, status, observations,
      vw_tender_number, vw_buyer_name, has_lastenheft, has_economic_excel,
      vw_department, vw_requester_name,
      contact_id, contact_name, contact_info, reception_channel,
      drive_folder_id, drive_folder_path,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'RECIBIDA', ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      NULL, ?,
      ?, ?, ?, ?
    )`,
    id,
    folio,
    parsed.origin_type,
    customerId,
    parsed.project_name,
    parsed.description,
    parsed.received_date,
    parsed.deadline_date || null,
    parsed.responsible_user_id,
    parsed.observations || null,
    parsed.origin_type === 'LICITACION_VW' ? parsed.vw_tender_number : null,
    parsed.origin_type === 'LICITACION_VW' ? parsed.vw_buyer_name : null,
    parsed.origin_type === 'LICITACION_VW' && parsed.has_lastenheft ? 1 : 0,
    parsed.origin_type === 'LICITACION_VW' && parsed.has_economic_excel ? 1 : 0,
    parsed.origin_type === 'DIRECTA_VW' ? parsed.vw_department : null,
    parsed.origin_type === 'DIRECTA_VW' ? parsed.vw_requester_name : null,
    parsed.origin_type === 'OTRO_CLIENTE' ? parsed.contact_id || null : null,
    parsed.origin_type === 'OTRO_CLIENTE'
      ? parsed.contact_name
      : parsed.origin_type === 'DIRECTA_VW'
      ? parsed.vw_requester_name
      : parsed.vw_buyer_name,
    parsed.origin_type === 'DIRECTA_VW' || parsed.origin_type === 'OTRO_CLIENTE'
      ? parsed.contact_info || null
      : null,
    parsed.origin_type === 'DIRECTA_VW' || parsed.origin_type === 'OTRO_CLIENTE'
      ? parsed.reception_channel
      : 'Plataforma Volkswagen',
    driveFolderPath,
    actor.id,
    actor.id,
    now,
    now
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'SOLICITUD_CREADA', ?, ?, ?)`,
    crypto.randomUUID(),
    id,
    actor.id,
    JSON.stringify({
      folio,
      origin_type: parsed.origin_type,
      project_name: parsed.project_name,
      status: 'RECIBIDA',
    }),
    now
  );

  const all = await listQuoteRequests({});
  const enriched = all.find((r) => r.id === id);
  if (!enriched) {
    throw new Error('Error al recuperar la solicitud recién registrada.');
  }
  return enriched;
}

export async function listQuoteRequests(
  filters: RequestFilterOptions = {}
): Promise<EnrichedQuoteRequest[]> {
  const db = await getAsyncDb();
  const whereClauses: string[] = ['1 = 1'];
  const params: (string | number)[] = [];

  if (filters.status && filters.status !== 'ALL') {
    whereClauses.push('qr.status = ?');
    params.push(filters.status);
  }

  if (filters.customerId && filters.customerId !== 'ALL') {
    whereClauses.push('qr.customer_id = ?');
    params.push(filters.customerId);
  }

  if (filters.responsibleUserId && filters.responsibleUserId !== 'ALL') {
    whereClauses.push('qr.responsible_user_id = ?');
    params.push(filters.responsibleUserId);
  }

  if (filters.originType && filters.originType !== 'ALL') {
    whereClauses.push('qr.origin_type = ?');
    params.push(filters.originType);
  }

  if (filters.dateFrom) {
    whereClauses.push('qr.received_date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    whereClauses.push('qr.received_date <= ?');
    params.push(filters.dateTo);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    whereClauses.push(
      `(LOWER(qr.folio) LIKE ? OR LOWER(qr.project_name) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.short_name) LIKE ? OR LOWER(COALESCE(qr.vw_tender_number, '')) LIKE ?)`
    );
    params.push(q, q, q, q, q);
  }

  const allowedSorts: Record<string, string> = {
    received_date: 'qr.received_date',
    deadline_date: "COALESCE(qr.deadline_date, '9999-12-31')",
    folio: 'qr.folio',
    project_name: 'qr.project_name',
  };
  const sortCol = allowedSorts[filters.sortBy ?? 'folio'] || 'qr.folio';
  const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT
      qr.*,
      c.name AS customer_name,
      c.short_name AS customer_short_name,
      u.name AS responsible_name,
      u.employee_code AS responsible_code,
      (
        SELECT qrev.subtotal
        FROM quote_revisions qrev
        WHERE qrev.request_id = qr.id
        ORDER BY
          CASE WHEN qrev.status = 'PRESENTADA' THEN 0 ELSE 1 END,
          qrev.revision_number DESC
        LIMIT 1
      ) AS latest_offered_amount,
      (
        SELECT qrev.currency
        FROM quote_revisions qrev
        WHERE qrev.request_id = qr.id
        ORDER BY
          CASE WHEN qrev.status = 'PRESENTADA' THEN 0 ELSE 1 END,
          qrev.revision_number DESC
        LIMIT 1
      ) AS latest_offered_currency,
      (
        SELECT qrev.revision_code
        FROM quote_revisions qrev
        WHERE qrev.request_id = qr.id
        ORDER BY
          CASE WHEN qrev.status = 'PRESENTADA' THEN 0 ELSE 1 END,
          qrev.revision_number DESC
        LIMIT 1
      ) AS latest_revision_code,
      (
        SELECT fa.next_activity_date
        FROM follow_up_activities fa
        WHERE fa.request_id = qr.id
          AND fa.is_completed = 0
          AND fa.reminder_cancelled = 0
          AND fa.next_activity_date IS NOT NULL
        ORDER BY fa.next_activity_date ASC
        LIMIT 1
      ) AS next_activity_date,
      (
        SELECT COALESCE(fa.next_activity_description, fa.description)
        FROM follow_up_activities fa
        WHERE fa.request_id = qr.id
          AND fa.is_completed = 0
          AND fa.reminder_cancelled = 0
        ORDER BY COALESCE(fa.next_activity_date, fa.activity_date) ASC
        LIMIT 1
      ) AS next_activity_description,
      (
        SELECT fa.activity_type
        FROM follow_up_activities fa
        WHERE fa.request_id = qr.id
          AND fa.is_completed = 0
          AND fa.reminder_cancelled = 0
        ORDER BY COALESCE(fa.next_activity_date, fa.activity_date) ASC
        LIMIT 1
      ) AS next_activity_type
    FROM quote_requests qr
    JOIN customers c ON c.id = qr.customer_id
    JOIN users u ON u.id = qr.responsible_user_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${sortCol} ${sortDir}, qr.created_at DESC
  `;

  const rows = await db.all<
    Omit<EnrichedQuoteRequest, 'deadline_semaphore' | 'days_until_deadline'>
  >(sql, ...params);

  return rows.map((r) => {
    const { semaphore, daysUntil } = computeDeadlineSemaphore(r.deadline_date, r.status);
    return {
      ...r,
      deadline_semaphore: semaphore,
      days_until_deadline: daysUntil,
    };
  });
}

export async function updateQuoteRequestStatus(
  actor: SafeUser,
  requestId: string,
  newStatus: RequestStatus,
  comment?: string
): Promise<EnrichedQuoteRequest> {
  assertPermission(actor, 'UPDATE_REQUEST');
  const db = await getAsyncDb();
  const existing = await db.get<{ id: string; folio: string; status: RequestStatus }>(
    'SELECT id, folio, status FROM quote_requests WHERE id = ?',
    requestId
  );

  if (!existing) {
    throw new Error('Solicitud de cotización no encontrada.');
  }

  const now = nowMexicoISO();
  await db.run(
    'UPDATE quote_requests SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?',
    newStatus,
    actor.id,
    now,
    requestId
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'CAMBIO_ESTADO_ASISTIDO', ?, ?, ?)`,
    crypto.randomUUID(),
    requestId,
    actor.id,
    JSON.stringify({
      folio: existing.folio,
      previous_status: existing.status,
      new_status: newStatus,
      comment: comment || null,
    }),
    now
  );

  const updated = (await listQuoteRequests({})).find((r) => r.id === requestId);
  if (!updated) {
    throw new Error('No fue posible cargar la solicitud actualizada.');
  }
  return updated;
}

export async function registerQuickFollowUp(
  actor: SafeUser,
  requestId: string,
  payload: {
    activity_type: 'LLAMADA' | 'CORREO' | 'REUNION' | 'ACLARACION' | 'NOTA' | 'SEGUIMIENTO' | 'OTRO';
    activity_date: string;
    description: string;
    next_activity_date?: string | null;
    next_activity_description?: string | null;
  }
): Promise<string> {
  assertPermission(actor, 'MANAGE_FOLLOWUPS');
  const db = await getAsyncDb();
  const now = nowMexicoISO();
  const id = `act-${crypto.randomUUID().slice(0, 8)}`;

  await db.run(
    `INSERT INTO follow_up_activities (
      id, request_id, activity_type, activity_date, responsible_user_id,
      description, next_activity_date, next_activity_description,
      is_completed, reminder_cancelled, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    id,
    requestId,
    payload.activity_type,
    payload.activity_date,
    actor.id,
    payload.description,
    payload.next_activity_date || null,
    payload.next_activity_description || null,
    actor.id,
    now
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'SEGUIMIENTO_REGISTRADO', ?, ?, ?)`,
    crypto.randomUUID(),
    requestId,
    actor.id,
    JSON.stringify({
      activity_type: payload.activity_type,
      description: payload.description,
      next_activity_date: payload.next_activity_date || null,
    }),
    now
  );

  return id;
}

export async function updateQuoteRequestDetails(
  actor: SafeUser,
  requestId: string,
  payload: {
    project_name?: string;
    description?: string;
    deadline_date?: string | null;
    responsible_user_id?: string;
    observations?: string | null;
    vw_tender_number?: string | null;
    vw_buyer_name?: string | null;
    vw_department?: string | null;
    vw_requester_name?: string | null;
    contact_name?: string | null;
    contact_info?: string | null;
    reception_channel?: string | null;
    has_lastenheft?: boolean;
    has_economic_excel?: boolean;
  }
): Promise<EnrichedQuoteRequest> {
  assertPermission(actor, 'UPDATE_REQUEST');
  const db = await getAsyncDb();
  const existing = await db.get<Record<string, unknown>>(
    'SELECT * FROM quote_requests WHERE id = ?',
    requestId
  );

  if (!existing) {
    throw new Error('Solicitud de cotización no encontrada.');
  }

  const now = nowMexicoISO();
  const projectName = payload.project_name?.trim() || String(existing.project_name);
  const description = payload.description?.trim() || String(existing.description);
  const deadlineDate =
    payload.deadline_date !== undefined
      ? payload.deadline_date || null
      : (existing.deadline_date as string | null);
  const responsibleUserId =
    payload.responsible_user_id || String(existing.responsible_user_id);
  const observations =
    payload.observations !== undefined
      ? payload.observations || null
      : (existing.observations as string | null);

  const vwTender =
    payload.vw_tender_number !== undefined
      ? payload.vw_tender_number
      : (existing.vw_tender_number as string | null);
  const vwBuyer =
    payload.vw_buyer_name !== undefined
      ? payload.vw_buyer_name
      : (existing.vw_buyer_name as string | null);
  const vwDept =
    payload.vw_department !== undefined
      ? payload.vw_department
      : (existing.vw_department as string | null);
  const vwReq =
    payload.vw_requester_name !== undefined
      ? payload.vw_requester_name
      : (existing.vw_requester_name as string | null);
  const contactName =
    payload.contact_name !== undefined
      ? payload.contact_name
      : (existing.contact_name as string | null);
  const contactInfo =
    payload.contact_info !== undefined
      ? payload.contact_info
      : (existing.contact_info as string | null);
  const receptionChannel =
    payload.reception_channel !== undefined
      ? payload.reception_channel
      : (existing.reception_channel as string | null);
  const hasLastenheft =
    payload.has_lastenheft !== undefined
      ? payload.has_lastenheft
        ? 1
        : 0
      : Number(existing.has_lastenheft);
  const hasEconomicExcel =
    payload.has_economic_excel !== undefined
      ? payload.has_economic_excel
        ? 1
        : 0
      : Number(existing.has_economic_excel);

  await db.run(
    `UPDATE quote_requests
     SET project_name = ?,
         description = ?,
         deadline_date = ?,
         responsible_user_id = ?,
         observations = ?,
         vw_tender_number = ?,
         vw_buyer_name = ?,
         vw_department = ?,
         vw_requester_name = ?,
         contact_name = ?,
         contact_info = ?,
         reception_channel = ?,
         has_lastenheft = ?,
         has_economic_excel = ?,
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`,
    projectName,
    description,
    deadlineDate,
    responsibleUserId,
    observations,
    vwTender,
    vwBuyer,
    vwDept,
    vwReq,
    contactName,
    contactInfo,
    receptionChannel,
    hasLastenheft,
    hasEconomicExcel,
    actor.id,
    now,
    requestId
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'EXPEDIENTE_ACTUALIZADO', ?, ?, ?)`,
    crypto.randomUUID(),
    requestId,
    actor.id,
    JSON.stringify({
      folio: existing.folio,
      project_name: projectName,
      deadline_date: deadlineDate,
      responsible_user_id: responsibleUserId,
    }),
    now
  );

  const updated = (await listQuoteRequests({})).find((r) => r.id === requestId);
  if (!updated) {
    throw new Error('No fue posible cargar el expediente actualizado.');
  }
  return updated;
}

export async function getQuoteRequestById(requestIdOrFolio: string) {
  const db = await getAsyncDb();
  const all = await listQuoteRequests({});
  const request = all.find(
    (r) => r.id === requestIdOrFolio || r.folio.toUpperCase() === requestIdOrFolio.toUpperCase()
  );
  if (!request) return null;

  const revisions = await listQuoteRevisions(request.id);

  const activities = await db.all<Record<string, unknown>>(
    `SELECT fa.*, u.name as responsible_name
     FROM follow_up_activities fa
     JOIN users u ON u.id = fa.responsible_user_id
     WHERE fa.request_id = ?
     ORDER BY fa.activity_date DESC, fa.created_at DESC`,
    request.id
  );

  const documents = await listExpedienteDocuments(request.id);

  const closure = (await getCommercialClosureByRequestId(request.id)) || undefined;

  const auditLogs = await db.all<AuditLogRecord>(
    `SELECT al.*, u.name as actor_name
     FROM audit_logs al
     JOIN users u ON u.id = al.actor_user_id
     WHERE al.entity_id = ?
     ORDER BY al.created_at DESC`,
    request.id
  );

  return {
    request,
    revisions,
    activities,
    documents,
    closure,
    auditLogs,
  };
}

export async function deleteQuoteRequest(actor: SafeUser, requestId: string): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error(
      'Acceso denegado: Solo el Administrador puede eliminar solicitudes o cotizaciones.'
    );
  }
  const db = await getAsyncDb();
  const existing = await db.get<{ id: string; folio: string; project_name: string }>(
    'SELECT id, folio, project_name FROM quote_requests WHERE id = ?',
    requestId
  );

  if (!existing) {
    throw new Error('Expediente o cotización no encontrado.');
  }

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM commercial_closures WHERE request_id = ?', requestId);
    await tx.run('DELETE FROM follow_up_activities WHERE request_id = ?', requestId);
    await tx.run('DELETE FROM documents WHERE request_id = ?', requestId);
    await tx.run(
      'DELETE FROM quote_items WHERE revision_id IN (SELECT id FROM quote_revisions WHERE request_id = ?)',
      requestId
    );
    await tx.run('DELETE FROM quote_revisions WHERE request_id = ?', requestId);
    await tx.run('DELETE FROM quote_requests WHERE id = ?', requestId);

    await tx.run(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
       VALUES (?, 'QUOTE_REQUEST', ?, 'EXPEDIENTE_ELIMINADO', ?, ?, ?)`,
      crypto.randomUUID(),
      requestId,
      actor.id,
      JSON.stringify({ folio: existing.folio, project_name: existing.project_name }),
      nowMexicoISO()
    );
  });
}
