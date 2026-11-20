import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface DriveStorageResult {
  driveFileId: string;
  driveFolderPath: string;
  localVaultPath: string;
  syncedWithCloud: boolean;
}

const SUBFOLDER_BY_CATEGORY: Record<string, string> = {
  SOLICITUD: '01_DOCUMENTOS_SOLICITUD',
  LASTENHEFT: '02_LASTENHEFT_Y_ANEXOS',
  ESTRUCTURA_ECONOMICA: '02_LASTENHEFT_Y_ANEXOS',
  COTIZACION: '03_COTIZACIONES_Y_REVISIONES',
  EVIDENCIA_ENTREGA: '03_COTIZACIONES_Y_REVISIONES',
  SEGUIMIENTO: '04_DOCUMENTOS_SEGUIMIENTO',
  EVIDENCIA_ADJUDICACION: '05_EVIDENCIAS_ADJUDICACION',
  ORDEN_COMPRA: '06_ORDENES_COMPRA_Y_CONTRATOS',
  OTRO: '07_OTROS_ANEXOS',
};

export function isGoogleDriveCloudConfigured(): boolean {
  const hasRoot = Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  const hasOAuthRefresh = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
  const hasServiceAccount = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY
  );
  return hasRoot && (hasOAuthRefresh || hasServiceAccount);
}

/**
 * Obtiene un access_token de Google OAuth2 en servidor:
 * 1) OAuth2 Refresh Token (ideal para cuentas @gmail.com / Google One de pago)
 * 2) Service Account JWT RS256 (para Google Workspace con Unidades Compartidas)
 */
async function getGoogleDriveAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Error OAuth2 Google Drive (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !rawPrivateKey) return null;

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const nowSec = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  ).toString('base64url');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claim}`)
    .sign(privateKey, 'base64url');

  const assertion = `${header}.${claim}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error de autenticación con Google Drive API (${response.status})`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function findOrCreateDriveFolder(
  token: string,
  folderName: string,
  parentId: string
): Promise<string> {
  const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `name = '${escapedName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!searchRes.ok) {
    throw new Error(`Error buscando carpeta en Google Drive (${searchRes.status})`);
  }

  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Error creando carpeta en Google Drive (${createRes.status}): ${errText}`);
  }

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function uploadFileToGoogleDrive(params: {
  year: string | number;
  folio: string;
  subfolder: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const token = await getGoogleDriveAccessToken();
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!token || !rootId) {
    throw new Error('Credenciales de Google Drive incompletas.');
  }

  const cotizacionesId = await findOrCreateDriveFolder(token, 'COTIZACIONES', rootId);
  const yearId = await findOrCreateDriveFolder(token, String(params.year), cotizacionesId);
  const folioId = await findOrCreateDriveFolder(token, params.folio, yearId);
  const categoryId = await findOrCreateDriveFolder(token, params.subfolder, folioId);

  const boundary = `isl_drive_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadataPart = JSON.stringify({
    name: params.originalName,
    parents: [categoryId],
  });

  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n` +
      `--${boundary}\r\nContent-Type: ${params.mimeType || 'application/octet-stream'}\r\n\r\n`,
    'utf8'
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipartBody = Buffer.concat([prefix, params.buffer, suffix]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipartBody.byteLength),
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Error subiendo archivo a Google Drive (${uploadRes.status}): ${errText}`);
  }

  const uploaded = (await uploadRes.json()) as { id: string };
  return uploaded.id;
}

export async function downloadFileFromGoogleDrive(fileId: string): Promise<Buffer> {
  const token = await getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('Credenciales de Google Drive no configuradas.');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Error descargando archivo de Google Drive (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Almacena el archivo conservando el original en la estructura jerárquica:
 * IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO DE SOLICITUD / CATEGORÍA
 * Si las credenciales de Google Cloud están configuradas, sincroniza con Google Drive API v3.
 */
export async function storeDocumentInDriveStructure(params: {
  year: string | number;
  folio: string;
  category: string;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<DriveStorageResult> {
  const subfolder = SUBFOLDER_BY_CATEGORY[params.category] || '07_OTROS_ANEXOS';
  const driveFolderPath = `IN SIDE LOGISTIC / COTIZACIONES / ${params.year} / ${params.folio} / ${subfolder}`;

  let localVaultPath = '';
  try {
    const vaultRoot =
      process.env.SQLITE_DB_PATH === ':memory:'
        ? path.join(process.cwd(), 'data', 'test_vault')
        : path.join(process.cwd(), 'data', 'drive_vault');

    const targetDir = path.join(
      vaultRoot,
      'IN SIDE LOGISTIC',
      'COTIZACIONES',
      String(params.year),
      params.folio,
      subfolder
    );

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}_${params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    localVaultPath = path.join(targetDir, safeFilename);
    fs.writeFileSync(localVaultPath, params.buffer);
  } catch {
    // En Vercel el sistema de archivos es de solo lectura; continúa hacia Google Drive y PostgreSQL.
  }

  let driveFileId = `gdrive-${crypto.randomUUID().slice(0, 12)}`;
  let syncedWithCloud = false;

  if (isGoogleDriveCloudConfigured()) {
    try {
      driveFileId = await uploadFileToGoogleDrive({
        year: params.year,
        folio: params.folio,
        subfolder,
        originalName: params.originalName,
        mimeType: params.mimeType || 'application/octet-stream',
        buffer: params.buffer,
      });
      syncedWithCloud = true;
    } catch (err) {
      console.error('Fallo sincronización con Google Drive:', err);
    }
  }

  return {
    driveFileId,
    driveFolderPath,
    localVaultPath,
    syncedWithCloud,
  };
}
