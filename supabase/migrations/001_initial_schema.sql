-- ============================================================================
-- IN SIDE LOGISTIC | Gestión de Cotizaciones — MVP V1.0
-- Esquema Relacional PostgreSQL (Compatible con Supabase)
-- Zona Horaria: America/Mexico_City
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USUARIOS Y ROLES (Administrador, Editor, Consulta)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'CONSULTA')),
    department TEXT NOT NULL DEFAULT 'Comercial / Ingeniería',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    rfc TEXT,
    plant_or_location TEXT,
    address TEXT,
    is_vw BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CONTACTOS / COMPRADORES / SOLICITANTES
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SECUENCIAS DE FOLIOS INTERNOS ÚNICOS (COT-YYYY-NNNN)
CREATE TABLE IF NOT EXISTS folio_sequences (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
);

-- 5. SOLICITUDES DE COTIZACIÓN (EXPEDIENTES)
CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    folio TEXT UNIQUE NOT NULL,
    origin_type TEXT NOT NULL CHECK (origin_type IN ('LICITACION_VW', 'DIRECTA_VW', 'OTRO_CLIENTE')),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    project_name TEXT NOT NULL,
    description TEXT NOT NULL,
    received_date DATE NOT NULL,
    deadline_date DATE,
    responsible_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'RECIBIDA'
        CHECK (status IN ('RECIBIDA', 'EN_ELABORACION', 'PRESENTADA', 'EN_NEGOCIACION', 'CERRADA')),
    observations TEXT,

    -- Campos Origen A: Licitación Volkswagen
    vw_tender_number TEXT,
    vw_buyer_name TEXT,
    has_lastenheft BOOLEAN NOT NULL DEFAULT FALSE,
    has_economic_excel BOOLEAN NOT NULL DEFAULT FALSE,

    -- Campos Origen B: Solicitud Directa Volkswagen
    vw_department TEXT,
    vw_requester_name TEXT,

    -- Campos Origen B y C: Contacto y Medio de Recepción
    contact_id TEXT REFERENCES customer_contacts(id),
    contact_name TEXT,
    contact_info TEXT,
    reception_channel TEXT,

    -- Integración Google Drive
    drive_folder_id TEXT,
    drive_folder_path TEXT,

    -- Trazabilidad
    created_by TEXT NOT NULL REFERENCES users(id),
    updated_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. REVISIONES DE COTIZACIÓN (Rev. 00, Rev. 01...)
CREATE TABLE IF NOT EXISTS quote_revisions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    revision_code TEXT NOT NULL, -- 'Rev. 00', 'Rev. 01', etc.
    revision_number INTEGER NOT NULL DEFAULT 0,
    modality TEXT NOT NULL CHECK (modality IN ('INTERNAL', 'EXTERNAL')),
    currency TEXT NOT NULL DEFAULT 'MXN' CHECK (currency IN ('MXN', 'USD', 'EUR')),
    issue_date DATE NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'BORRADOR'
        CHECK (status IN ('BORRADOR', 'PRESENTADA', 'HISTORICA')),
    is_immutable BOOLEAN NOT NULL DEFAULT FALSE,
    presented_at TIMESTAMPTZ,
    presentation_channel TEXT,
    presented_by TEXT REFERENCES users(id),
    observations TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (request_id, revision_code)
);

-- 7. PARTIDAS DE COTIZACIÓN (Modalidad A: Captura interna)
CREATE TABLE IF NOT EXISTS quote_items (
    id TEXT PRIMARY KEY,
    revision_id TEXT NOT NULL REFERENCES quote_revisions(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 8. DOCUMENTOS ASOCIADOS AL EXPEDIENTE (Google Drive + Metadatos)
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
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ACTIVIDADES DE SEGUIMIENTO COMERCIAL
CREATE TABLE IF NOT EXISTS follow_up_activities (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'LLAMADA', 'CORREO', 'REUNION', 'ACLARACION', 'NOTA', 'SEGUIMIENTO', 'OTRO'
    )),
    activity_date DATE NOT NULL,
    responsible_user_id TEXT NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    next_activity_date DATE,
    next_activity_description TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    reminder_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CIERRE COMERCIAL (Con regla obligatoria de evidencia en adjudicaciones)
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
    closure_date DATE NOT NULL,
    awarded_revision_id TEXT REFERENCES quote_revisions(id),
    awarded_amount NUMERIC(15, 2),
    currency TEXT DEFAULT 'MXN',
    purchase_order_ref TEXT,
    comments TEXT NOT NULL,
    evidence_document_id TEXT REFERENCES documents(id),
    closed_by TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. BITÁCORA DE AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    details_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer ON quote_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_responsible ON quote_requests(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_deadline ON quote_requests(deadline_date);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_request ON quote_revisions(request_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_request ON follow_up_activities(request_id);
