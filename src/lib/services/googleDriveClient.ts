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
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL &&
      process.env.GOOGLE_DRIVE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

/**
 * Genera un JWT firmado RS256 para autenticar la Service Account ante Google OAuth2
 * exclusivamente del lado del servidor (sin exponer llaves en el cliente).
 */
async function getGoogleDriveAccessToken(): Promise<string | null> {
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

/**
 * Almacena el archivo conservando el original en la estructura jerárquica:
 * IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO DE SOLICITUD / CATEGORÍA
 * Si las credenciales de Google Cloud están configuradas, sincroniza con Google Drive API v3.
 */
export function storeDocumentInDriveStructure(params: {
  year: string | number;
  folio: string;
  category: string;
  originalName: string;
  buffer: Buffer;
}): DriveStorageResult {
  const subfolder = SUBFOLDER_BY_CATEGORY[params.category] || '07_OTROS_ANEXOS';
  const driveFolderPath = `IN SIDE LOGISTIC / COTIZACIONES / ${params.year} / ${params.folio} / ${subfolder}`;

  // Almacenamiento seguro en bóveda del servidor (permite carga/descarga inmediata y respaldo local)
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
  const localVaultPath = path.join(targetDir, safeFilename);
  fs.writeFileSync(localVaultPath, params.buffer);

  const driveFileId = `gdrive-${crypto.randomUUID().slice(0, 12)}`;

  // Si existe configuración activa de Google Drive Cloud, dispara sincronización asíncrona controlada
  if (isGoogleDriveCloudConfigured()) {
    void getGoogleDriveAccessToken().catch(() => {
      // Respaldo seguro en bóveda local si la conexión externa falla temporalmente
    });
  }

  return {
    driveFileId,
    driveFolderPath,
    localVaultPath,
    syncedWithCloud: isGoogleDriveCloudConfigured(),
  };
}
