import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { AsyncDb } from './index';

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`isl_salt_${plain}`).digest('hex');
}

const INITIAL_USERS = [
  {
    id: 'usr-admin-01',
    employee_code: 'DIR-0001',
    name: 'Lic. Roberto Sánchez (Administrador)',
    email: 'direccion@insidelogistic.com.mx',
    password_hash: hashPassword('AdminISL2026!'),
    role: 'ADMIN',
    department: 'Dirección Comercial',
  },
  {
    id: 'usr-editor-01',
    employee_code: 'ING-0001',
    name: 'Ing. Fernando Morales (Proyectos & Costos)',
    email: 'cotizaciones@insidelogistic.com.mx',
    password_hash: hashPassword('EditorISL2026!'),
    role: 'EDITOR',
    department: 'Ingeniería y Presupuestos',
  },
  {
    id: 'usr-editor-02',
    employee_code: 'ING-0002',
    name: 'Ing. Alejandro Silva (Licitaciones VWM)',
    email: 'licitaciones.vw@insidelogistic.com.mx',
    password_hash: hashPassword('EditorISL2026!'),
    role: 'EDITOR',
    department: 'Atención Planta VWM',
  },
  {
    id: 'usr-consulta-01',
    employee_code: 'CON-0001',
    name: 'C.P. Laura Méndez (Consulta / Auditoría)',
    email: 'consulta@insidelogistic.com.mx',
    password_hash: hashPassword('ConsultaISL2026!'),
    role: 'CONSULTA',
    department: 'Administración y Control',
  },
];

const INITIAL_CUSTOMERS = [
  {
    id: 'cust-vwm',
    name: 'Volkswagen de México S.A. de C.V.',
    short_name: 'VWM',
    rfc: 'VME640815HF6',
    plant_or_location: 'Complejo Industrial Puebla',
    address: 'Km 116 Autopista México-Puebla, Cuautlancingo, Pue.',
    is_vw: 1,
  },
  {
    id: 'cust-audi',
    name: 'Audi México S.A. de C.V.',
    short_name: 'AUDI',
    rfc: 'AME120905ABC',
    plant_or_location: 'Planta San José Chiapa',
    address: 'Blvd. Q5 No. 1, San José Chiapa, Pue.',
    is_vw: 0,
  },
  {
    id: 'cust-gestamp',
    name: 'Gestamp Puebla S.A. de C.V.',
    short_name: 'GESTAMP',
    rfc: 'GPU980412KL9',
    plant_or_location: 'Parque Industrial FINSA',
    address: 'Parque Industrial FINSA, Puebla, Pue.',
    is_vw: 0,
  },
  {
    id: 'cust-luk',
    name: 'Schaeffler México (LuK Puebla)',
    short_name: 'SCHAEFFLER',
    rfc: 'SME010520P81',
    plant_or_location: 'Planta Puebla',
    address: 'Corredor Industrial Quetzalcóatl, Huejotzingo, Pue.',
    is_vw: 0,
  },
];

const INITIAL_CONTACTS = [
  {
    id: 'cnt-vw-01',
    customer_id: 'cust-vwm',
    name: 'Lic. Claudia Von Der Meden',
    position: 'Compradora Senior Servicios Técnicos',
    department: 'Compras Generales VWM (B-MP)',
    email: 'claudia.vondermeden@vw.com.mx',
    phone: '222 230 8110',
    contact_type: 'COMPRADOR_VW',
  },
  {
    id: 'cnt-vw-02',
    customer_id: 'cust-vwm',
    name: 'Ing. Omar Sánchez Minutti',
    position: 'Especialista Mantenimiento Transmisiones',
    department: 'Nave 4 - Prensas y Carrocerías',
    email: 'omar.sanchez@vw.com.mx',
    phone: '222 230 9420',
    contact_type: 'SOLICITANTE_VW',
  },
  {
    id: 'cnt-vw-03',
    customer_id: 'cust-vwm',
    name: 'Ing. Markus Weber',
    position: 'Coordinador Ingeniería de Planta',
    department: 'Nave 21 - Pintura',
    email: 'markus.weber@vw.com.mx',
    phone: '222 230 7715',
    contact_type: 'SOLICITANTE_VW',
  },
  {
    id: 'cnt-audi-01',
    customer_id: 'cust-audi',
    name: 'Ing. Carlos Mendoza Ruiz',
    position: 'Líder de Mantenimiento e Instalaciones',
    department: 'Montaje Final',
    email: 'carlos.mendoza@audi.mx',
    phone: '222 145 3090',
    contact_type: 'CONTACTO_EXTERNO',
  },
  {
    id: 'cnt-gestamp-01',
    customer_id: 'cust-gestamp',
    name: 'Ing. Patricia Herrera',
    position: 'Jefe de Compras MRO y Maquinados',
    department: 'Abastecimiento Planta FINSA',
    email: 'pherrera@gestamp.com',
    phone: '222 289 4410',
    contact_type: 'CONTACTO_EXTERNO',
  },
];

export function seedDatabaseIfNeeded(db: DatabaseSync): void {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  const now = '2026-11-01T08:00:00.000Z';

  const insertUser = db.prepare(`
    INSERT INTO users (id, employee_code, name, email, password_hash, role, department, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const u of INITIAL_USERS) {
    insertUser.run(
      u.id,
      u.employee_code,
      u.name,
      u.email,
      u.password_hash,
      u.role,
      u.department,
      now,
      now
    );
  }

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, short_name, rfc, plant_or_location, address, is_vw, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'usr-admin-01', ?, ?)
  `);
  for (const c of INITIAL_CUSTOMERS) {
    insertCustomer.run(c.id, c.name, c.short_name, c.rfc, c.plant_or_location, c.address, c.is_vw, now, now);
  }

  const insertContact = db.prepare(`
    INSERT INTO customer_contacts (id, customer_id, name, position, department, email, phone, contact_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const cnt of INITIAL_CONTACTS) {
    insertContact.run(
      cnt.id,
      cnt.customer_id,
      cnt.name,
      cnt.position,
      cnt.department,
      cnt.email,
      cnt.phone,
      cnt.contact_type,
      now,
      now
    );
  }
}

export async function seedAsyncDatabaseIfNeeded(db: AsyncDb): Promise<void> {
  const existingUsers = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (existingUsers && Number(existingUsers.count) > 0) {
    return;
  }

  const now = '2026-11-01T08:00:00.000Z';

  for (const u of INITIAL_USERS) {
    await db.run(
      `INSERT INTO users (id, employee_code, name, email, password_hash, role, department, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      u.id,
      u.employee_code,
      u.name,
      u.email,
      u.password_hash,
      u.role,
      u.department,
      now,
      now
    );
  }

  for (const c of INITIAL_CUSTOMERS) {
    await db.run(
      `INSERT INTO customers (id, name, short_name, rfc, plant_or_location, address, is_vw, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'usr-admin-01', ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      c.id,
      c.name,
      c.short_name,
      c.rfc,
      c.plant_or_location,
      c.address,
      c.is_vw,
      now,
      now
    );
  }

  for (const cnt of INITIAL_CONTACTS) {
    await db.run(
      `INSERT INTO customer_contacts (id, customer_id, name, position, department, email, phone, contact_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      cnt.id,
      cnt.customer_id,
      cnt.name,
      cnt.position,
      cnt.department,
      cnt.email,
      cnt.phone,
      cnt.contact_type,
      now,
      now
    );
  }
}
