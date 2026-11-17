import crypto from 'node:crypto';
import { getDb, nowMexicoISO } from '../db';
import { hashPassword } from '../db/seed';
import { assertPermission, toSafeUser } from '../auth/rbac';
import { CreateContactSchema, CreateCustomerSchema, CreateUserSchema } from '../validation/schemas';
import type {
  CustomerContactRecord,
  CustomerRecord,
  SafeUser,
  UserRecord,
} from '../db/types';

export function listCustomers(): CustomerRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM customers ORDER BY is_vw DESC, name ASC')
    .all() as unknown as CustomerRecord[];
  return rows.map((r) => ({ ...r }));
}

export function getVwCustomer(): CustomerRecord {
  const db = getDb();
  const vw = db.prepare('SELECT * FROM customers WHERE is_vw = 1 LIMIT 1').get() as CustomerRecord | undefined;
  if (!vw) {
    throw new Error('Cliente Volkswagen de México no encontrado en catálogo.');
  }
  return { ...vw };
}

export function createCustomer(
  actor: SafeUser,
  rawInput: unknown
): CustomerRecord & { initialContact?: CustomerContactRecord } {
  assertPermission(actor, 'MANAGE_CATALOGS');
  const parsed = CreateCustomerSchema.parse(rawInput);
  const db = getDb();
  const now = nowMexicoISO();
  const id = `cust-${crypto.randomUUID().slice(0, 8)}`;

  const shortName =
    parsed.short_name && parsed.short_name.trim().length > 0
      ? parsed.short_name.trim().toUpperCase()
      : parsed.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(' ')
          .toUpperCase()
          .slice(0, 14);

  db.prepare(
    `INSERT INTO customers (id, name, short_name, rfc, plant_or_location, address, is_vw, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(
    id,
    parsed.name,
    shortName,
    parsed.rfc || null,
    parsed.plant_or_location || null,
    parsed.address || null,
    actor.id,
    now,
    now
  );

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CUSTOMER', ?, 'CLIENTE_REGISTRADO', ?, ?, ?)`
  ).run(crypto.randomUUID(), id, actor.id, JSON.stringify({ name: parsed.name, short_name: shortName }), now);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as unknown as CustomerRecord;

  let initialContact: CustomerContactRecord | undefined;
  if (parsed.contact_name && parsed.contact_name.trim().length >= 2) {
    initialContact = createCustomerContact(actor, {
      customer_id: id,
      name: parsed.contact_name,
      position: parsed.contact_position || null,
      email: parsed.contact_email || null,
      phone: parsed.contact_phone || null,
      contact_type: 'CONTACTO_EXTERNO',
    });
  }

  return { ...customer, initialContact };
}

export function listCustomerContacts(customerId?: string): CustomerContactRecord[] {
  const db = getDb();
  if (customerId) {
    const rows = db
      .prepare(
        `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
         FROM customer_contacts cc
         JOIN customers c ON c.id = cc.customer_id
         WHERE cc.customer_id = ?
         ORDER BY cc.name ASC`
      )
      .all(customerId) as unknown as CustomerContactRecord[];
    return rows.map((r) => ({ ...r }));
  }
  const rows = db
    .prepare(
      `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
       FROM customer_contacts cc
       JOIN customers c ON c.id = cc.customer_id
       ORDER BY c.is_vw DESC, cc.name ASC`
    )
    .all() as unknown as CustomerContactRecord[];
  return rows.map((r) => ({ ...r }));
}

export function createCustomerContact(actor: SafeUser, rawInput: unknown): CustomerContactRecord {
  assertPermission(actor, 'MANAGE_CATALOGS');
  const parsed = CreateContactSchema.parse(rawInput);
  const db = getDb();
  const now = nowMexicoISO();
  const id = `cnt-${crypto.randomUUID().slice(0, 8)}`;

  db.prepare(
    `INSERT INTO customer_contacts (id, customer_id, name, position, department, email, phone, contact_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parsed.customer_id,
    parsed.name,
    parsed.position || null,
    parsed.department || null,
    parsed.email || null,
    parsed.phone || null,
    parsed.contact_type || 'CONTACTO_EXTERNO',
    now,
    now
  );

  return db
    .prepare(
      `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
       FROM customer_contacts cc
       JOIN customers c ON c.id = cc.customer_id
       WHERE cc.id = ?`
    )
    .get(id) as unknown as CustomerContactRecord;
}

export function listUsers(): SafeUser[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM users ORDER BY role ASC, name ASC')
    .all() as unknown as UserRecord[];
  return rows.map(toSafeUser);
}

export function createUser(actor: SafeUser, rawInput: unknown): SafeUser {
  assertPermission(actor, 'MANAGE_USERS');
  const parsed = CreateUserSchema.parse(rawInput);
  const db = getDb();
  const now = nowMexicoISO();
  const id = `usr-${crypto.randomUUID().slice(0, 8)}`;

  db.prepare(
    `INSERT INTO users (id, employee_code, name, email, password_hash, role, department, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    id,
    parsed.employee_code.toUpperCase(),
    parsed.name,
    parsed.email.toLowerCase(),
    hashPassword(parsed.password),
    parsed.role,
    parsed.department,
    now,
    now
  );

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'USER', ?, 'USUARIO_CREADO', ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    id,
    actor.id,
    JSON.stringify({ employee_code: parsed.employee_code, email: parsed.email, role: parsed.role }),
    now
  );

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRecord;
  return toSafeUser(created);
}

export function deleteCustomer(actor: SafeUser, customerId: string): void {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar clientes.');
  }
  const db = getDb();
  const existing = db
    .prepare('SELECT id, name, short_name FROM customers WHERE id = ?')
    .get(customerId) as { id: string; name: string; short_name: string } | undefined;

  if (!existing) {
    throw new Error('Cliente no encontrado.');
  }

  const linkedCount = db
    .prepare('SELECT COUNT(*) as cnt FROM quote_requests WHERE customer_id = ?')
    .get(customerId) as { cnt: number };

  if (linkedCount.cnt > 0) {
    throw new Error(
      `No se puede eliminar al cliente "${existing.short_name}" porque tiene ${linkedCount.cnt} solicitud(es)/cotización(es) asociada(s). Elimine primero sus cotizaciones.`
    );
  }

  db.prepare('DELETE FROM customer_contacts WHERE customer_id = ?').run(customerId);
  db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CUSTOMER', ?, 'CLIENTE_ELIMINADO', ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    customerId,
    actor.id,
    JSON.stringify({ name: existing.name, short_name: existing.short_name }),
    nowMexicoISO()
  );
}

export function deleteCustomerContact(actor: SafeUser, contactId: string): void {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar contactos.');
  }
  const db = getDb();
  const existing = db
    .prepare('SELECT id, name FROM customer_contacts WHERE id = ?')
    .get(contactId) as { id: string; name: string } | undefined;

  if (!existing) {
    throw new Error('Contacto no encontrado.');
  }

  db.prepare('UPDATE quote_requests SET contact_id = NULL WHERE contact_id = ?').run(contactId);
  db.prepare('DELETE FROM customer_contacts WHERE id = ?').run(contactId);

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CONTACT', ?, 'CONTACTO_ELIMINADO', ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    contactId,
    actor.id,
    JSON.stringify({ name: existing.name }),
    nowMexicoISO()
  );
}

export function deleteUser(actor: SafeUser, userId: string): void {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar usuarios.');
  }
  if (actor.id === userId) {
    throw new Error('No puedes eliminar tu propio usuario Administrador con sesión activa.');
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, employee_code, name, email FROM users WHERE id = ?')
    .get(userId) as { id: string; employee_code: string; name: string; email: string } | undefined;

  if (!existing) {
    throw new Error('Usuario no encontrado.');
  }

  // Reasignar referencias de auditoría/solicitudes al administrador actual antes de borrar para respetar llaves foráneas
  db.prepare('UPDATE quote_requests SET responsible_user_id = ? WHERE responsible_user_id = ?').run(
    actor.id,
    userId
  );
  db.prepare('UPDATE quote_requests SET created_by = ? WHERE created_by = ?').run(actor.id, userId);
  db.prepare('UPDATE quote_requests SET updated_by = ? WHERE updated_by = ?').run(actor.id, userId);
  db.prepare('UPDATE quote_revisions SET created_by = ? WHERE created_by = ?').run(actor.id, userId);
  db.prepare('UPDATE quote_revisions SET presented_by = ? WHERE presented_by = ?').run(
    actor.id,
    userId
  );
  db.prepare('UPDATE documents SET uploaded_by = ? WHERE uploaded_by = ?').run(actor.id, userId);
  db.prepare(
    'UPDATE follow_up_activities SET responsible_user_id = ? WHERE responsible_user_id = ?'
  ).run(actor.id, userId);
  db.prepare('UPDATE follow_up_activities SET created_by = ? WHERE created_by = ?').run(
    actor.id,
    userId
  );
  db.prepare('UPDATE commercial_closures SET closed_by = ? WHERE closed_by = ?').run(
    actor.id,
    userId
  );
  db.prepare('UPDATE audit_logs SET actor_user_id = ? WHERE actor_user_id = ?').run(
    actor.id,
    userId
  );

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'USER', ?, 'USUARIO_ELIMINADO', ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    userId,
    actor.id,
    JSON.stringify({
      employee_code: existing.employee_code,
      name: existing.name,
      email: existing.email,
    }),
    nowMexicoISO()
  );
}
