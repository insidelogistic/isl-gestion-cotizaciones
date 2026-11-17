import { getDb } from '../db';
import { hashPassword } from '../db/seed';
import type { SafeUser, UserRecord, UserRole } from '../db/types';

export type PermissionAction =
  | 'VIEW_REQUESTS'
  | 'CREATE_REQUEST'
  | 'UPDATE_REQUEST'
  | 'MANAGE_QUOTES'
  | 'MANAGE_FOLLOWUPS'
  | 'CLOSE_QUOTE'
  | 'MANAGE_CATALOGS'
  | 'MANAGE_USERS';

export class PermissionError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  ADMIN: [
    'VIEW_REQUESTS',
    'CREATE_REQUEST',
    'UPDATE_REQUEST',
    'MANAGE_QUOTES',
    'MANAGE_FOLLOWUPS',
    'CLOSE_QUOTE',
    'MANAGE_CATALOGS',
    'MANAGE_USERS',
  ],
  EDITOR: [
    'VIEW_REQUESTS',
    'CREATE_REQUEST',
    'UPDATE_REQUEST',
    'MANAGE_QUOTES',
    'MANAGE_FOLLOWUPS',
    'CLOSE_QUOTE',
    'MANAGE_CATALOGS',
  ],
  CONSULTA: ['VIEW_REQUESTS'],
};

export function toSafeUser(record: UserRecord): SafeUser {
  return {
    id: record.id,
    employee_code: record.employee_code,
    name: record.name,
    email: record.email,
    role: record.role,
    department: record.department,
    is_active: Boolean(record.is_active),
  };
}

export function authenticateUser(loginOrEmail: string, passwordPlain: string): SafeUser | null {
  const db = getDb();
  const normalized = loginOrEmail.trim();
  const row = db
    .prepare(
      `SELECT * FROM users WHERE (LOWER(email) = LOWER(?) OR UPPER(employee_code) = UPPER(?)) AND is_active = 1`
    )
    .get(normalized, normalized) as UserRecord | undefined;

  if (!row) {
    return null;
  }

  const expectedHash = hashPassword(passwordPlain);
  if (row.password_hash !== expectedHash) {
    return null;
  }

  return toSafeUser(row);
}

export function getUserByEmployeeCodeOrId(codeOrId: string): SafeUser | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM users WHERE (id = ? OR UPPER(employee_code) = UPPER(?)) AND is_active = 1`)
    .get(codeOrId, codeOrId) as UserRecord | undefined;

  return row ? toSafeUser(row) : null;
}

export function hasPermission(user: SafeUser | null | undefined, action: PermissionAction): boolean {
  if (!user || !user.is_active) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(action) ?? false;
}

export function assertPermission(user: SafeUser | null | undefined, action: PermissionAction): void {
  if (!user) {
    throw new PermissionError('Sesión no válida o usuario no autenticado.');
  }
  if (!hasPermission(user, action)) {
    throw new PermissionError(
      `El rol "${user.role}" (${user.name}) no tiene permisos para ejecutar la acción: ${action}.`
    );
  }
}
