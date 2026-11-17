import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`isl_salt_${plain}`).digest('hex');
}

export function seedDatabaseIfNeeded(db: DatabaseSync): void {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  const now = '2026-11-01T08:00:00.000Z';

  // 1. Usuarios autorizados para los 3 roles oficiales: ADMIN, EDITOR, CONSULTA
  const insertUser = db.prepare(`
    INSERT INTO users (id, employee_code, name, email, password_hash, role, department, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  insertUser.run(
    'usr-admin-01',
    'DIR-0001',
    'Lic. Roberto Sánchez (Administrador)',
    'direccion@insidelogistic.com.mx',
    hashPassword('AdminISL2026!'),
    'ADMIN',
    'Dirección Comercial',
    now,
    now
  );

  insertUser.run(
    'usr-editor-01',
    'ING-0001',
    'Ing. Fernando Morales (Proyectos & Costos)',
    'cotizaciones@insidelogistic.com.mx',
    hashPassword('EditorISL2026!'),
    'EDITOR',
    'Ingeniería y Presupuestos',
    now,
    now
  );

  insertUser.run(
    'usr-editor-02',
    'ING-0002',
    'Ing. Alejandro Silva (Licitaciones VWM)',
    'licitaciones.vw@insidelogistic.com.mx',
    hashPassword('EditorISL2026!'),
    'EDITOR',
    'Atención Planta VWM',
    now,
    now
  );

  insertUser.run(
    'usr-consulta-01',
    'CON-0001',
    'C.P. Laura Méndez (Consulta / Auditoría)',
    'consulta@insidelogistic.com.mx',
    hashPassword('ConsultaISL2026!'),
    'CONSULTA',
    'Administración y Control',
    now,
    now
  );

  // 2. Clientes reales del entorno industrial de IN SIDE LOGISTIC
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, short_name, rfc, plant_or_location, address, is_vw, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'usr-admin-01', ?, ?)
  `);

  insertCustomer.run(
    'cust-vwm',
    'Volkswagen de México S.A. de C.V.',
    'VWM',
    'VME640815HF6',
    'Complejo Industrial Puebla',
    'Km 116 Autopista México-Puebla, Cuautlancingo, Pue.',
    1,
    now,
    now
  );

  insertCustomer.run(
    'cust-audi',
    'Audi México S.A. de C.V.',
    'AUDI',
    'AME120905ABC',
    'Planta San José Chiapa',
    'Blvd. Q5 No. 1, San José Chiapa, Pue.',
    0,
    now,
    now
  );

  insertCustomer.run(
    'cust-gestamp',
    'Gestamp Puebla S.A. de C.V.',
    'GESTAMP',
    'GPU980412KL9',
    'Parque Industrial FINSA',
    'Parque Industrial FINSA, Puebla, Pue.',
    0,
    now,
    now
  );

  insertCustomer.run(
    'cust-luk',
    'Schaeffler México (LuK Puebla)',
    'SCHAEFFLER',
    'SME010520P81',
    'Planta Puebla',
    'Corredor Industrial Quetzalcóatl, Huejotzingo, Pue.',
    0,
    now,
    now
  );

  // 3. Contactos y Compradores iniciales
  const insertContact = db.prepare(`
    INSERT INTO customer_contacts (id, customer_id, name, position, department, email, phone, contact_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertContact.run(
    'cnt-vw-01',
    'cust-vwm',
    'Lic. Claudia Von Der Meden',
    'Compradora Senior Servicios Técnicos',
    'Compras Generales VWM (B-MP)',
    'claudia.vondermeden@vw.com.mx',
    '222 230 8110',
    'COMPRADOR_VW',
    now,
    now
  );

  insertContact.run(
    'cnt-vw-02',
    'cust-vwm',
    'Ing. Omar Sánchez Minutti',
    'Especialista Mantenimiento Transmisiones',
    'Nave 4 - Prensas y Carrocerías',
    'omar.sanchez@vw.com.mx',
    '222 230 9420',
    'SOLICITANTE_VW',
    now,
    now
  );

  insertContact.run(
    'cnt-vw-03',
    'cust-vwm',
    'Ing. Markus Weber',
    'Coordinador Ingeniería de Planta',
    'Nave 21 - Pintura',
    'markus.weber@vw.com.mx',
    '222 230 7715',
    'SOLICITANTE_VW',
    now,
    now
  );

  insertContact.run(
    'cnt-audi-01',
    'cust-audi',
    'Ing. Carlos Mendoza Ruiz',
    'Líder de Mantenimiento e Instalaciones',
    'Montaje Final',
    'carlos.mendoza@audi.mx',
    '222 145 3090',
    'CONTACTO_EXTERNO',
    now,
    now
  );

  insertContact.run(
    'cnt-gestamp-01',
    'cust-gestamp',
    'Ing. Patricia Herrera',
    'Jefe de Compras MRO y Maquinados',
    'Abastecimiento Planta FINSA',
    'pherrera@gestamp.com',
    '222 289 4410',
    'CONTACTO_EXTERNO',
    now,
    now
  );
}
