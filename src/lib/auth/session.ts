import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getUserByEmployeeCodeOrId } from './rbac';
import type { SafeUser } from '../db/types';

export const SESSION_COOKIE_NAME = 'isl_cot_session';

function getSecret(): string {
  return process.env.SESSION_SECRET || 'isl-cotizaciones-secret-key-change-in-production-2026';
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const base64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(base64).digest('base64url');
  return `${base64}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(base64).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(base64, 'base64url').toString('utf8')) as { userId?: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const userId = verifySessionToken(token);
      if (userId) {
        const user = getUserByEmployeeCodeOrId(userId);
        if (user) return user;
      }
    }
  } catch {
    // Fallback para contextos fuera de request o inicialización
  }
  return null;
}
