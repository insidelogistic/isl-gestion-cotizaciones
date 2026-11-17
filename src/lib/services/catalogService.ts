import crypto from 'node:crypto';
import { getAsyncDb, nowMexicoISO } from '../db';
import { hashPassword } from '../db/seed';
import { assertPermission, toSafeUser } from '../auth/rbac';
import { CreateContactSchema, CreateCustomerSchema, CreateUserSchema } from '../validation/schemas';
import type {
  CustomerContactRecord,
  CustomerRecord,
  SafeUser,
  UserRecord,
} from '../db/types';

export async function listCustomers(): Promise<CustomerRecord[]> {
  const db = await getAsyncDb();
  return db.all<CustomerRecord>('SELECT * FROM customers ORDER BY is_vw DESC, name ASC');
}

export async function getVwCustomer(): Promise<CustomerRecord> {
  const db = await getAsyncDb();
  const vw = await db.get<CustomerRecord>('SELECT * FROM customers WHERE is_vw = 1 LIMIT 1');
  if (!vw) {
    throw new Error('Cliente Volkswagen de México no encontrado en catálogo.');
  }
  return vw;
}

export async function createCustomer(
  actor: SafeUser,
  rawInput: unknown
): Promise<CustomerRecord & { initialContact?: CustomerContactRecord }> {
  assertPermission(actor, 'MANAGE_CATALOGS');
  const parsed = CreateCustomerSchema.parse(rawInput);
  const db = await getAsyncDb();
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

  await db.run(
    `INSERT INTO customers (id, name, short_name, rfc, plant_or_location, address, is_vw, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
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

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CUSTOMER', ?, 'CLIENTE_REGISTRADO', ?, ?, ?)`,
    crypto.randomUUID(),
    id,
    actor.id,
    JSON.stringify({ name: parsed.name, short_name: shortName }),
    now
  );

  const customer = await db.get<CustomerRecord>('SELECT * FROM customers WHERE id = ?', id);
  if (!customer) {
    throw new Error('Error al recuperar el cliente registrado.');
  }

  let initialContact: CustomerContactRecord | undefined;
  if (parsed.contact_name && parsed.contact_name.trim().length >= 2) {
    initialContact = await createCustomerContact(actor, {
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

export async function listCustomerContacts(customerId?: string): Promise<CustomerContactRecord[]> {
  const db = await getAsyncDb();
  if (customerId) {
    return db.all<CustomerContactRecord>(
      `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
       FROM customer_contacts cc
       JOIN customers c ON c.id = cc.customer_id
       WHERE cc.customer_id = ?
       ORDER BY cc.name ASC`,
      customerId
    );
  }
  return db.all<CustomerContactRecord>(
    `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
     FROM customer_contacts cc
     JOIN customers c ON c.id = cc.customer_id
     ORDER BY c.is_vw DESC, cc.name ASC`
  );
}

export async function createCustomerContact(
  actor: SafeUser,
  rawInput: unknown
): Promise<CustomerContactRecord> {
  assertPermission(actor, 'MANAGE_CATALOGS');
  const parsed = CreateContactSchema.parse(rawInput);
  const db = await getAsyncDb();
  const now = nowMexicoISO();
  const id = `cnt-${crypto.randomUUID().slice(0, 8)}`;

  await db.run(
    `INSERT INTO customer_contacts (id, customer_id, name, position, department, email, phone, contact_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  const created = await db.get<CustomerContactRecord>(
    `SELECT cc.*, c.name as customer_name, c.short_name as customer_short_name
     FROM customer_contacts cc
     JOIN customers c ON c.id = cc.customer_id
     WHERE cc.id = ?`,
    id
  );
  if (!created) {
    throw new Error('Error al recuperar el contacto registrado.');
  }
  return created;
}

export async function listUsers(): Promise<SafeUser[]> {
  const db = await getAsyncDb();
  const rows = await db.all<UserRecord>('SELECT * FROM users ORDER BY role ASC, name ASC');
  return rows.map(toSafeUser);
}

export async function createUser(actor: SafeUser, rawInput: unknown): Promise<SafeUser> {
  assertPermission(actor, 'MANAGE_USERS');
  const parsed = CreateUserSchema.parse(rawInput);
  const db = await getAsyncDb();
  const now = nowMexicoISO();
  const id = `usr-${crypto.randomUUID().slice(0, 8)}`;

  await db.run(
    `INSERT INTO users (id, employee_code, name, email, password_hash, role, department, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
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

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'USER', ?, 'USUARIO_CREADO', ?, ?, ?)`,
    crypto.randomUUID(),
    id,
    actor.id,
    JSON.stringify({ employee_code: parsed.employee_code, email: parsed.email, role: parsed.role }),
    now
  );

  const created = await db.get<UserRecord>('SELECT * FROM users WHERE id = ?', id);
  if (!created) {
    throw new Error('Error al recuperar el usuario creado.');
  }
  return toSafeUser(created);
}

export async function deleteCustomer(actor: SafeUser, customerId: string): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar clientes.');
  }
  const db = await getAsyncDb();
  const existing = await db.get<{ id: string; name: string; short_name: string }>(
    'SELECT id, name, short_name FROM customers WHERE id = ?',
    customerId
  );

  if (!existing) {
    throw new Error('Cliente no encontrado.');
  }

  const linkedCount = await db.get<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM quote_requests WHERE customer_id = ?',
    customerId
  );

  if (linkedCount && Number(linkedCount.cnt) > 0) {
    throw new Error(
      `No se puede eliminar al cliente "${existing.short_name}" porque tiene ${linkedCount.cnt} solicitud(es)/cotización(es) asociada(s). Elimine primero sus cotizaciones.`
    );
  }

  await db.run('DELETE FROM customer_contacts WHERE customer_id = ?', customerId);
  await db.run('DELETE FROM customers WHERE id = ?', customerId);

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CUSTOMER', ?, 'CLIENTE_ELIMINADO', ?, ?, ?)`,
    crypto.randomUUID(),
    customerId,
    actor.id,
    JSON.stringify({ name: existing.name, short_name: existing.short_name }),
    nowMexicoISO()
  );
}

export async function deleteCustomerContact(actor: SafeUser, contactId: string): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar contactos.');
  }
  const db = await getAsyncDb();
  const existing = await db.get<{ id: string; name: string }>(
    'SELECT id, name FROM customer_contacts WHERE id = ?',
    contactId
  );

  if (!existing) {
    throw new Error('Contacto no encontrado.');
  }

  await db.run('UPDATE quote_requests SET contact_id = NULL WHERE contact_id = ?', contactId);
  await db.run('DELETE FROM customer_contacts WHERE id = ?', contactId);

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'CONTACT', ?, 'CONTACTO_ELIMINADO', ?, ?, ?)`,
    crypto.randomUUID(),
    contactId,
    actor.id,
    JSON.stringify({ name: existing.name }),
    nowMexicoISO()
  );
}

export async function deleteUser(actor: SafeUser, userId: string): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error('Acceso denegado: Solo el Administrador puede eliminar usuarios.');
  }
  if (actor.id === userId) {
    throw new Error('No puedes eliminar tu propio usuario Administrador con sesión activa.');
  }

  const db = await getAsyncDb();
  const existing = await db.get<{ id: string; employee_code: string; name: string; email: string }>(
    'SELECT id, employee_code, name, email FROM users WHERE id = ?',
    userId
  );

  if (!existing) {
    throw new Error('Usuario no encontrado.');
  }

  await db.run(
    'UPDATE quote_requests SET responsible_user_id = ? WHERE responsible_user_id = ?',
    actor.id,
    userId
  );
  await db.run('UPDATE quote_requests SET created_by = ? WHERE created_by = ?', actor.id, userId);
  await db.run('UPDATE quote_requests SET updated_by = ? WHERE updated_by = ?', actor.id, userId);
  await db.run('UPDATE quote_revisions SET created_by = ? WHERE created_by = ?', actor.id, userId);
  await db.run(
    'UPDATE quote_revisions SET presented_by = ? WHERE presented_by = ?',
    actor.id,
    userId
  );
  await db.run('UPDATE documents SET uploaded_by = ? WHERE uploaded_by = ?', actor.id, userId);
  await db.run(
    'UPDATE follow_up_activities SET responsible_user_id = ? WHERE responsible_user_id = ?',
    actor.id,
    userId
  );
  await db.run(
    'UPDATE follow_up_activities SET created_by = ? WHERE created_by = ?',
    actor.id,
    userId
  );
  await db.run('UPDATE commercial_closures SET closed_by = ? WHERE closed_by = ?', actor.id, userId);
  await db.run('UPDATE audit_logs SET actor_user_id = ? WHERE actor_user_id = ?', actor.id, userId);

  await db.run('DELETE FROM users WHERE id = ?', userId);

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'USER', ?, 'USUARIO_ELIMINADO', ?, ?, ?)`,
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
