import crypto from 'node:crypto';
import fs from 'node:fs';
import { getDb, nowMexicoISO } from '../db';
import { assertPermission } from '../auth/rbac';
import { storeDocumentInDriveStructure } from './googleDriveClient';
import type { SafeUser } from '../db/types';

export type DocumentCategory =
  | 'SOLICITUD'
  | 'LASTENHEFT'
  | 'ESTRUCTURA_ECONOMICA'
  | 'COTIZACION'
  | 'EVIDENCIA_ENTREGA'
  | 'SEGUIMIENTO'
  | 'EVIDENCIA_ADJUDICACION'
  | 'ORDEN_COMPRA'
  | 'OTRO';

export interface DocumentRecord {
  id: string;
  request_id: string;
  revision_id: string | null;
  activity_id: string | null;
  closure_id: string | null;
  category: DocumentCategory;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  drive_file_id: string | null;
  drive_folder_path: string | null;
  uploaded_by: string;
  uploaded_by_name?: string;
  revision_code?: string | null;
  created_at: string;
}

export function uploadExpedienteDocument(
  actor: SafeUser,
  input: {
    request_id: string;
    revision_id?: string | null;
    activity_id?: string | null;
    closure_id?: string | null;
    category: DocumentCategory;
    original_name: string;
    mime_type: string;
    content_base64: string;
  }
): DocumentRecord {
  assertPermission(actor, 'UPDATE_REQUEST');

  const db = getDb();
  const reqRow = db
    .prepare('SELECT id, folio, received_date FROM quote_requests WHERE id = ?')
    .get(input.request_id) as { id: string; folio: string; received_date: string } | undefined;

  if (!reqRow) {
    throw new Error('El expediente asociado al documento no existe.');
  }

  const cleanBase64 = input.content_base64.includes(',')
    ? input.content_base64.split(',')[1]
    : input.content_base64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  const year = reqRow.received_date.slice(0, 4) || '2026';

  const storage = storeDocumentInDriveStructure({
    year,
    folio: reqRow.folio,
    category: input.category,
    originalName: input.original_name,
    buffer,
  });

  const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
  const now = nowMexicoISO();

  // Guardamos tanto la ruta lógica de Drive como la ruta física interna separada por "::"
  const storedPathMeta = `${storage.driveFolderPath}::${storage.localVaultPath}`;

  db.prepare(
    `INSERT INTO documents (
      id, request_id, revision_id, activity_id, closure_id,
      category, original_name, mime_type, size_bytes,
      drive_file_id, drive_folder_path, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.request_id,
    input.revision_id || null,
    input.activity_id || null,
    input.closure_id || null,
    input.category,
    input.original_name,
    input.mime_type || 'application/octet-stream',
    buffer.byteLength,
    storage.driveFileId,
    storedPathMeta,
    actor.id,
    now
  );

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'DOCUMENTO_ADJUNTADO', ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    input.request_id,
    actor.id,
    JSON.stringify({
      document_id: id,
      original_name: input.original_name,
      category: input.category,
      drive_folder: storage.driveFolderPath,
    }),
    now
  );

  const list = listExpedienteDocuments(input.request_id);
  const created = list.find((d) => d.id === id);
  if (!created) {
    throw new Error('Error al recuperar el documento registrado.');
  }
  return created;
}

export function listExpedienteDocuments(requestId: string): DocumentRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        d.*,
        u.name AS uploaded_by_name,
        qr.revision_code AS revision_code
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       LEFT JOIN quote_revisions qr ON qr.id = d.revision_id
       WHERE d.request_id = ?
       ORDER BY d.created_at DESC`
    )
    .all(requestId) as unknown as DocumentRecord[];

  return rows.map((r) => ({
    ...r,
    drive_folder_path: r.drive_folder_path ? r.drive_folder_path.split('::')[0] : null,
  }));
}

export function getDocumentForDownload(actor: SafeUser, documentId: string): {
  record: DocumentRecord;
  buffer: Buffer;
} {
  assertPermission(actor, 'VIEW_REQUESTS');
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM documents WHERE id = ?')
    .get(documentId) as unknown as DocumentRecord | undefined;

  if (!row) {
    throw new Error('Documento no encontrado.');
  }

  const parts = (row.drive_folder_path || '').split('::');
  const localPath = parts[1];
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error('El archivo físico no se encuentra disponible en la bóveda documental.');
  }

  const buffer = fs.readFileSync(localPath);
  return {
    record: {
      ...row,
      drive_folder_path: parts[0],
    },
    buffer,
  };
}
