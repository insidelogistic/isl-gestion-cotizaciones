import crypto from 'node:crypto';
import fs from 'node:fs';
import { getAsyncDb, nowMexicoISO } from '../db';
import { assertPermission } from '../auth/rbac';
import {
  downloadFileFromGoogleDrive,
  isGoogleDriveCloudConfigured,
  storeDocumentInDriveStructure,
} from './googleDriveClient';
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

export async function uploadExpedienteDocument(
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
): Promise<DocumentRecord> {
  assertPermission(actor, 'UPDATE_REQUEST');

  const db = await getAsyncDb();
  const reqRow = await db.get<{ id: string; folio: string; received_date: string }>(
    'SELECT id, folio, received_date FROM quote_requests WHERE id = ?',
    input.request_id
  );

  if (!reqRow) {
    throw new Error('El expediente asociado al documento no existe.');
  }

  const cleanBase64 = input.content_base64.includes(',')
    ? input.content_base64.split(',')[1]
    : input.content_base64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  const year = reqRow.received_date.slice(0, 4) || '2026';

  const storage = await storeDocumentInDriveStructure({
    year,
    folio: reqRow.folio,
    category: input.category,
    originalName: input.original_name,
    mimeType: input.mime_type || 'application/octet-stream',
    buffer,
  });
  const driveFolderPath = storage.driveFolderPath;
  const driveFileId = storage.driveFileId;
  const storedPathMeta = storage.localVaultPath
    ? `${storage.driveFolderPath}::${storage.localVaultPath}`
    : storage.driveFolderPath;

  const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
  const now = nowMexicoISO();

  await db.run(
    `INSERT INTO documents (
      id, request_id, revision_id, activity_id, closure_id,
      category, original_name, mime_type, size_bytes,
      drive_file_id, drive_folder_path, file_data, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.request_id,
    input.revision_id || null,
    input.activity_id || null,
    input.closure_id || null,
    input.category,
    input.original_name,
    input.mime_type || 'application/octet-stream',
    buffer.byteLength,
    driveFileId,
    storedPathMeta,
    cleanBase64,
    actor.id,
    now
  );

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'QUOTE_REQUEST', ?, 'DOCUMENTO_ADJUNTADO', ?, ?, ?)`,
    crypto.randomUUID(),
    input.request_id,
    actor.id,
    JSON.stringify({
      document_id: id,
      original_name: input.original_name,
      category: input.category,
      drive_folder: driveFolderPath,
    }),
    now
  );

  const list = await listExpedienteDocuments(input.request_id);
  const created = list.find((d) => d.id === id);
  if (!created) {
    throw new Error('Error al recuperar el documento registrado.');
  }
  return created;
}

export async function listExpedienteDocuments(requestId: string): Promise<DocumentRecord[]> {
  const db = await getAsyncDb();
  const rows = await db.all<DocumentRecord>(
    `SELECT
      d.id, d.request_id, d.revision_id, d.activity_id, d.closure_id,
      d.category, d.original_name, d.mime_type, d.size_bytes,
      d.drive_file_id, d.drive_folder_path, d.uploaded_by, d.created_at,
      u.name AS uploaded_by_name,
      qr.revision_code AS revision_code
     FROM documents d
     JOIN users u ON u.id = d.uploaded_by
     LEFT JOIN quote_revisions qr ON qr.id = d.revision_id
     WHERE d.request_id = ?
     ORDER BY d.created_at DESC`,
    requestId
  );

  return rows.map((r) => ({
    ...r,
    drive_folder_path: r.drive_folder_path ? r.drive_folder_path.split('::')[0] : null,
  }));
}

export async function getDocumentForDownload(
  actor: SafeUser,
  documentId: string
): Promise<{
  record: DocumentRecord;
  buffer: Buffer;
}> {
  assertPermission(actor, 'VIEW_REQUESTS');
  const db = await getAsyncDb();
  const row = await db.get<DocumentRecord & { file_data?: string | null }>(
    'SELECT * FROM documents WHERE id = ?',
    documentId
  );

  if (!row) {
    throw new Error('Documento no encontrado.');
  }

  const parts = (row.drive_folder_path || '').split('::');
  const localPath = parts[1];

  let buffer: Buffer | null = null;
  if (localPath && fs.existsSync(localPath)) {
    buffer = fs.readFileSync(localPath);
  } else if (row.file_data) {
    buffer = Buffer.from(row.file_data, 'base64');
  } else if (
    row.drive_file_id &&
    !row.drive_file_id.startsWith('drv-') &&
    !row.drive_file_id.startsWith('gdrive-') &&
    isGoogleDriveCloudConfigured()
  ) {
    buffer = await downloadFileFromGoogleDrive(row.drive_file_id);
  }

  if (!buffer) {
    throw new Error('El archivo físico no se encuentra disponible en el almacenamiento.');
  }

  return {
    record: {
      id: row.id,
      request_id: row.request_id,
      revision_id: row.revision_id,
      activity_id: row.activity_id,
      closure_id: row.closure_id,
      category: row.category,
      original_name: row.original_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      drive_file_id: row.drive_file_id,
      drive_folder_path: parts[0],
      uploaded_by: row.uploaded_by,
      created_at: row.created_at,
    },
    buffer,
  };
}
