import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, types, type PoolClient } from 'pg';
import { seedAsyncDatabaseIfNeeded, seedDatabaseIfNeeded } from './seed';

// Asegurar que PostgreSQL devuelva NUMERIC / REAL / BIGINT como números JavaScript
types.setTypeParser(1700, (val) => parseFloat(val));
types.setTypeParser(700, (val) => parseFloat(val));
types.setTypeParser(701, (val) => parseFloat(val));
types.setTypeParser(20, (val) => parseInt(val, 10));

export interface AsyncDb {
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  run(sql: string, ...params: unknown[]): Promise<void>;
  transaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T>;
}

let globalDb: DatabaseSync | null = null;
let globalPgPool: Pool | null = null;
let pgInitPromise: Promise<void> | null = null;

export const SHARED_DDL = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'CONSULTA')),
    department TEXT NOT NULL DEFAULT 'Comercial / Ingeniería',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    rfc TEXT,
    plant_or_location TEXT,
    address TEXT,
    is_vw INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_contacts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    contact_type TEXT NOT NULL DEFAULT 'CONTACTO_EXTERNO'
        CHECK (contact_type IN ('COMPRADOR_VW', 'SOLICITANTE_VW', 'CONTACTO_EXTERNO')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folio_sequences (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    folio TEXT UNIQUE NOT NULL,
    origin_type TEXT NOT NULL CHECK (origin_type IN ('LICITACION_VW', 'DIRECTA_VW', 'OTRO_CLIENTE')),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    project_name TEXT NOT NULL,
    description TEXT NOT NULL,
    received_date TEXT NOT NULL,
    deadline_date TEXT,
    responsible_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'RECIBIDA'
        CHECK (status IN ('RECIBIDA', 'EN_ELABORACION', 'PRESENTADA', 'EN_NEGOCIACION', 'CERRADA')),
    observations TEXT,

    vw_tender_number TEXT,
    vw_buyer_name TEXT,
    has_lastenheft INTEGER NOT NULL DEFAULT 0,
    has_economic_excel INTEGER NOT NULL DEFAULT 0,

    vw_department TEXT,
    vw_requester_name TEXT,

    contact_id TEXT REFERENCES customer_contacts(id),
    contact_name TEXT,
    contact_info TEXT,
    reception_channel TEXT,

    drive_folder_id TEXT,
    drive_folder_path TEXT,

    created_by TEXT NOT NULL REFERENCES users(id),
    updated_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_revisions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    revision_code TEXT NOT NULL,
    revision_number INTEGER NOT NULL DEFAULT 0,
    modality TEXT NOT NULL CHECK (modality IN ('INTERNAL', 'EXTERNAL')),
    currency TEXT NOT NULL DEFAULT 'MXN' CHECK (currency IN ('MXN', 'USD', 'EUR')),
    issue_date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.00,
    tax_rate REAL NOT NULL DEFAULT 16.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total REAL NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'BORRADOR'
        CHECK (status IN ('BORRADOR', 'PRESENTADA', 'HISTORICA')),
    is_immutable INTEGER NOT NULL DEFAULT 0,
    presented_at TEXT,
    presentation_channel TEXT,
    presented_by TEXT REFERENCES users(id),
    observations TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE (request_id, revision_code)
);

CREATE TABLE IF NOT EXISTS quote_items (
    id TEXT PRIMARY KEY,
    revision_id TEXT NOT NULL REFERENCES quote_revisions(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0.00,
    amount REAL NOT NULL DEFAULT 0.00,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    revision_id TEXT REFERENCES quote_revisions(id) ON DELETE SET NULL,
    activity_id TEXT,
    closure_id TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'SOLICITUD',
        'LASTENHEFT',
        'ESTRUCTURA_ECONOMICA',
        'COTIZACION',
        'EVIDENCIA_ENTREGA',
        'SEGUIMIENTO',
        'EVIDENCIA_ADJUDICACION',
        'ORDEN_COMPRA',
        'OTRO'
    )),
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    drive_file_id TEXT,
    drive_folder_path TEXT,
    file_data TEXT,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_up_activities (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'LLAMADA', 'CORREO', 'REUNION', 'ACLARACION', 'NOTA', 'SEGUIMIENTO', 'OTRO'
    )),
    activity_date TEXT NOT NULL,
    responsible_user_id TEXT NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    next_activity_date TEXT,
    next_activity_description TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    reminder_cancelled INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_closures (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    result TEXT NOT NULL CHECK (result IN (
        'ADJUDICADA_TOTAL',
        'ADJUDICADA_PARCIAL',
        'NO_ADJUDICADA',
        'CANCELADA',
        'NO_PARTICIPAMOS'
    )),
    closure_date TEXT NOT NULL,
    awarded_revision_id TEXT REFERENCES quote_revisions(id),
    awarded_amount REAL,
    currency TEXT DEFAULT 'MXN',
    purchase_order_ref TEXT,
    comments TEXT NOT NULL,
    evidence_document_id TEXT REFERENCES documents(id),
    closed_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    details_json TEXT,
    created_at TEXT NOT NULL
);
`;

export const SCHEMA_DDL = `PRAGMA foreign_keys = ON;\n${SHARED_DDL}`;

function toPgSql(sql: string): string {
  let index = 0;
  let inSingleQuote = false;
  let result = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && sql[i - 1] !== '\\') {
      inSingleQuote = !inSingleQuote;
      result += ch;
    } else if (ch === '?' && !inSingleQuote) {
      index += 1;
      result += `$${index}`;
    } else {
      result += ch;
    }
  }
  return result;
}

function wrapSqlite(db: DatabaseSync): AsyncDb {
  const adapter: AsyncDb = {
    async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const rows = db.prepare(sql).all(...(params as (string | number | null | Uint8Array)[])) as Record<
        string,
        unknown
      >[];
      return rows.map((r) => ({ ...r })) as T[];
    },
    async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      const row = db.prepare(sql).get(...(params as (string | number | null | Uint8Array)[])) as
        | Record<string, unknown>
        | undefined;
      return row ? ({ ...row } as T) : undefined;
    },
    async run(sql: string, ...params: unknown[]): Promise<void> {
      db.prepare(sql).run(...(params as (string | number | null | Uint8Array)[]));
    },
    async transaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      db.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        const res = await fn(adapter);
        db.exec('COMMIT');
        return res;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
  return adapter;
}

function wrapPgRunner(runner: Pool | PoolClient): AsyncDb {
  return {
    async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const res = await runner.query(toPgSql(sql), params);
      return res.rows.map((r) => ({ ...r })) as T[];
    },
    async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      const res = await runner.query(toPgSql(sql), params);
      return res.rows[0] ? ({ ...res.rows[0] } as T) : undefined;
    },
    async run(sql: string, ...params: unknown[]): Promise<void> {
      await runner.query(toPgSql(sql), params);
    },
    async transaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      if (!('release' in runner)) {
        const client = await (runner as Pool).connect();
        try {
          await client.query('BEGIN');
          const res = await fn(wrapPgRunner(client));
          await client.query('COMMIT');
          return res;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
      return fn(wrapPgRunner(runner));
    },
  };
}

function getPgPool(): Pool {
  if (!globalPgPool) {
    globalPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return globalPgPool;
}

export async function getAsyncDb(): Promise<AsyncDb> {
  // En pruebas locales (globalDb inyectado por Vitest) o sin DATABASE_URL, usar SQLite
  if (globalDb || !process.env.DATABASE_URL) {
    return wrapSqlite(getDb());
  }

  const pool = getPgPool();
  const adapter = wrapPgRunner(pool);

  if (!pgInitPromise) {
    pgInitPromise = (async () => {
      const statements = SHARED_DDL.split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await pool.query(stmt);
      }
      await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data TEXT');
      await seedAsyncDatabaseIfNeeded(adapter);
    })();
  }
  await pgInitPromise;

  return adapter;
}

export function createTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_DDL);
  seedDatabaseIfNeeded(db);
  return db;
}

export function setDatabaseInstance(db: DatabaseSync | null): void {
  globalDb = db;
}

export function getDb(): DatabaseSync {
  if (globalDb) {
    return globalDb;
  }

  const dbPathEnv =
    process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'isl_cotizaciones.sqlite');
  if (dbPathEnv !== ':memory:') {
    const dir = path.dirname(dbPathEnv);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  globalDb = new DatabaseSync(dbPathEnv);
  globalDb.exec(SCHEMA_DDL);
  try {
    globalDb.exec('ALTER TABLE documents ADD COLUMN file_data TEXT');
  } catch {
    // La columna file_data ya existe en la tabla local
  }
  seedDatabaseIfNeeded(globalDb);
  return globalDb;
}

export function nowMexicoISO(): string {
  return new Date().toISOString();
}

export function todayMexicoDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}
