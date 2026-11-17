# Especificación Técnica SDD — IN SIDE LOGISTIC | Gestión de Cotizaciones (MVP V1.0)

## 1. Propósito y Alcance
Sistema web empresarial para **IN SIDE LOGISTIC S.A. de C.V.** destinado a registrar solicitudes de cotización, controlar ofertas económicas y sus revisiones, administrar su expediente documental en Google Drive, dar seguimiento comercial con alertas y registrar cierres comerciales con evidencia documental obligatoria.

### No-Objetivos (Excluidos en MVP V1.0)
- No es un ERP, CRM complejo, facturación, nómina, contabilidad ni inventarios.
- Sin integración con el ERP de mantenimiento ni con la plataforma interna de Volkswagen.
- Sin autorizaciones multinivel ni IA para interpretar LASTENHEFT.
- Sin envío automático de correos a clientes o compradores externos.

---

## 2. Arquitectura Tecnológica Recomendada

| Capa | Tecnología | Justificación Técnica |
|---|---|---|
| **Frontend & SSR** | **Next.js 15 (App Router) + React 19 + TypeScript** | Arquitectura full-stack modular, tipado estático de extremo a extremo, rutas API integradas y excelente rendimiento en escritorio, tableta y móvil. |
| **Estilos & UI** | **Tailwind CSS v4 + Tipografías Google (`Barlow` y `Poppins`) + Lucide Icons** | Fidelidad exacta a la identidad corporativa (`#0F2747`, `#C72106`) y homologación visual directa con `ERP TRANS`. |
| **Base de Datos Relacional** | **PostgreSQL (Supabase) + Motor Relacional Local SQLite (`better-sqlite3`)** | En producción se despliega sobre PostgreSQL en Supabase (`supabase/migrations/001_initial_schema.sql`). Para desarrollo local y pruebas automatizadas determinísticas incluye un adaptador relacional SQL local idéntico sin depender de llaves externas en la Entrega 1. |
| **Autenticación y Permisos** | **Sesiones firmadas HTTP-Only + RBAC en Servidor (compatible con Supabase Auth)** | Tres roles estrictos (`ADMIN`, `EDITOR`, `CONSULTA`), sin registro público, con validación en cada endpoint y trazabilidad en bitácora (`audit_logs`). |
| **Gestión Documental** | **Google Drive API v3 (Server-side Service Account / OAuth2)** *(Entrega 2)* | Estructura automática `IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO`, credenciales protegidas en servidor, sin enlaces públicos. |
| **Notificaciones** | **Servicio Transaccional SMTP / Resend (Server-side)** *(Entrega 3)* | Avisos internos a responsables por vencimiento de actividades o fechas límite (nunca a clientes). |
| **Pruebas (QA / TDD)** | **Vitest + Testing Library** | Pruebas automatizadas de reglas de negocio, generación de folios, RBAC, filtros, revisiones e integridad de importes. |

---

## 3. Modelo de Datos Relacional Completo (Entregas 1 a 4)

### 3.1. `users` (Usuarios y Roles)
- `id` (UUID / TEXT PK)
- `employee_code` (TEXT UNIQUE, ej. `ADM-0001`, `ING-0001`, `DIR-0001`)
- `name` (TEXT NOT NULL)
- `email` (TEXT UNIQUE NOT NULL)
- `password_hash` (TEXT NOT NULL)
- `role` (TEXT CHECK IN `('ADMIN', 'EDITOR', 'CONSULTA')` NOT NULL)
- `department` (TEXT)
- `is_active` (BOOLEAN DEFAULT TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.2. `customers` (Clientes)
- `id` (TEXT PK)
- `name` (TEXT NOT NULL) — ej. `Volkswagen de México S.A. de C.V.`
- `short_name` (TEXT NOT NULL) — ej. `VWM`
- `rfc` (TEXT)
- `plant_or_location` (TEXT) — ej. `Complejo Industrial Puebla`
- `address` (TEXT)
- `is_vw` (BOOLEAN DEFAULT FALSE)
- `created_by` (TEXT FK -> `users.id`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.3. `customer_contacts` (Contactos / Compradores / Solicitantes)
- `id` (TEXT PK)
- `customer_id` (TEXT FK -> `customers.id` ON DELETE CASCADE)
- `name` (TEXT NOT NULL)
- `position` (TEXT) — ej. `Comprador Técnico`, `Ingeniero de Planta`
- `department` (TEXT) — ej. `Nave 4 - Pintura`, `Compras Generales`
- `email` (TEXT)
- `phone` (TEXT)
- `contact_type` (TEXT CHECK IN `('COMPRADOR_VW', 'SOLICITANTE_VW', 'CONTACTO_EXTERNO')`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.4. `folio_sequences` (Control Atómico de Folios)
- `year` (INTEGER PK)
- `last_number` (INTEGER NOT NULL DEFAULT 0)
- Genera folios únicos con formato `COT-YYYY-NNNN` (ej. `COT-2026-0001`).

### 3.5. `quote_requests` (Solicitudes de Cotización / Expedientes)
- `id` (TEXT PK)
- `folio` (TEXT UNIQUE NOT NULL) — `COT-YYYY-NNNN`
- `origin_type` (TEXT CHECK IN `('LICITACION_VW', 'DIRECTA_VW', 'OTRO_CLIENTE')` NOT NULL)
- `customer_id` (TEXT FK -> `customers.id` NOT NULL)
- `project_name` (TEXT NOT NULL)
- `description` (TEXT NOT NULL)
- `received_date` (TEXT / DATE NOT NULL) — Zona horaria México
- `deadline_date` (TEXT / DATE NULL)
- `responsible_user_id` (TEXT FK -> `users.id` NOT NULL)
- `status` (TEXT CHECK IN `('RECIBIDA', 'EN_ELABORACION', 'PRESENTADA', 'EN_NEGOCIACION', 'CERRADA')` NOT NULL DEFAULT `'RECIBIDA'`)
- `observations` (TEXT)
- **Campos específicos Origen A (`LICITACION_VW`)**:
  - `vw_tender_number` (TEXT NULL) — Número o referencia de licitación
  - `vw_buyer_name` (TEXT NULL) — Comprador responsable
  - `has_lastenheft` (BOOLEAN DEFAULT FALSE)
  - `has_economic_excel` (BOOLEAN DEFAULT FALSE)
- **Campos específicos Origen B (`DIRECTA_VW`)**:
  - `vw_department` (TEXT NULL) — Departamento solicitante
  - `vw_requester_name` (TEXT NULL) — Nombre del solicitante
  - `vw_Creation_contact_info` / `contact_info` (TEXT NULL) — Correo o teléfono
  - `reception_channel` (TEXT NULL) — Medio por el que se recibió (`Correo Electrónico`, `Teléfono / WhatsApp`, `Visita en Planta`, `Plataforma VWM`, `Otro`)
- **Campos específicos Origen C (`OTRO_CLIENTE`)**:
  - `contact_id` (TEXT FK -> `customer_contacts.id` NULL)
  - `contact_name` (TEXT NULL)
  - *(Reutiliza `contact_info` y `reception_channel`)*
- **Referencias Google Drive**:
  - `drive_folder_id` (TEXT NULL)
  - `drive_folder_path` (TEXT NULL) — `IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO`
- **Trazabilidad**:
  - `created_by` (TEXT FK -> `users.id` NOT NULL)
  - `updated_by` (TEXT FK -> `users.id` NULL)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

### 3.6. `quotes` y `quote_revisions` / `quote_items` (Preparado en esquema para Entrega 2)
- `quote_revisions`: `id`, `request_id`, `revision_code` (`Rev. 00`, `Rev. 01`...), `modality` (`INTERNAL`, `EXTERNAL`), `currency` (`MXN`, `USD`, `EUR`), `subtotal` (NUMERIC(15,2)), `tax_rate` (NUMERIC(5,2)), `tax_amount` (NUMERIC(15,2)), `total` (NUMERIC(15,2)), `status` (`BORRADOR`, `PRESENTADA`, `REEMPLAZADA`), `is_immutable` (BOOLEAN), `presented_at`, `presentation_channel`, `notes`, `created_by`, `created_at`.
- `quote_items`: `id`, `revision_id`, `concept`, `unit`, `quantity`, `unit_price`, `amount`, `sort_order`.

### 3.7. `follow_up_activities` y `commercial_closures` (Preparado en esquema para Entrega 3)
- `follow_up_activities`: `id`, `request_id`, `activity_type` (`LLAMADA`, `CORREO`, `REUNION`, `ACLARACION`, `NOTA`, `SEGUIMIENTO`, `OTRO`), `activity_date`, `responsible_user_id`, `description`, `next_activity_date`, `next_activity_description`, `is_completed`, `completed_at`, `reminder_stopped`, `created_by`, `created_at`.
- `commercial_closures`: `id`, `request_id` (UNIQUE), `result` (`ADJUDICADA_TOTAL`, `ADJUDICADA_PARCIAL`, `NO_ADJUDICADA`, `CANCELADA`, `NO_PARTICIPAMOS`), `closure_date`, `awarded_revision_id`, `awarded_amount` (NUMERIC(15,2)), `currency`, `purchase_order_ref`, `comments`, `evidence_document_id` (obligatorio en adjudicación total o parcial), `closed_by`, `created_at`.

### 3.8. `documents` y `audit_logs`
- `documents`: `id`, `request_id`, `revision_id`, `activity_id`, `closure_id`, `category` (`SOLICITUD`, `LASTENHEFT`, `ESTRUCTURA_ECONOMICA`, `COTIZACION`, `EVIDENCIA_ENTREGA`, `SEGUIMIENTO`, `EVIDENCIA_ADJUDICACION`, `ORDEN_COMPRA`, `OTRO`), `original_name`, `mime_type`, `size_bytes`, `drive_file_id`, `storage_path`, `uploaded_by`, `created_at`.
- `audit_logs`: `id`, `entity_type`, `entity_id`, `action`, `actor_user_id`, `previous_values_json`, `new_values_json`, `created_at`.

---

## 4. Pantallas y Rutas de la Aplicación

Las 7 pantallas principales están conectadas mediante navegación funcional:

1. **Dashboard** (`/`): Indicadores ejecutivos reales, gráfica por etapa, próximos compromisos y filtros por periodo, cliente y responsable.
2. **Solicitudes y Cotizaciones** (`/solicitudes`):
   - **Vista 1: Tabla (Predeterminada)** con 10 columnas, buscador por folio/cliente/proyecto, filtros (estado, responsable, cliente, fechas), ordenamiento, semáforo de vencimiento y acciones rápidas (Abrir expediente, Registrar seguimiento, Actualizar estado).
   - **Vista 2: Kanban** con 5 columnas (`Recibida`, `En elaboración`, `Presentada`, `En negociación`, `Cerrada`), tarjetas con folio, proyecto, cliente, responsable, fecha relevante, acceso al expediente y cambio asistido de estado.
3. **Nueva Solicitud** (`/solicitudes/nueva`): Formulario dinámico por origen (`Licitación Volkswagen`, `Solicitud directa Volkswagen`, `Otro cliente`), alta rápida de clientes y contactos en modal, generación automática de folio y estado inicial `Recibida`.
4. **Expediente de Solicitud** (`/solicitudes/[id]`): Encabezado resumen (Folio, Cliente, Proyecto, Origen, Estado, Fecha límite, Responsable) y 5 pestañas:
   - Pestaña 1: *Datos generales*
   - Pestaña 2: *Documentos*
   - Pestaña 3: *Cotizaciones*
   - Pestaña 4: *Seguimiento*
   - Pestaña 5: *Resultado comercial*
5. **Cotización** (`/cotizaciones` y `/solicitudes/[id]?tab=cotizaciones`): Vista dedicada y pestaña de expediente para gestión de ofertas Modalidad A y B, revisiones `Rev. 00+` y presentación.
6. **Seguimiento** (`/seguimiento` y `/solicitudes/[id]?tab=seguimiento`): Agenda y línea de tiempo de actividades comerciales, alertas y recordatorios.
7. **Cierre Comercial** (`/cierres` y `/solicitudes/[id]?tab=cierre`): Registro y consulta de resultados comerciales (`Adjudicada totalmente`, `Adjudicada parcialmente`, `No adjudicada`, `Cancelada`, `No participamos`) con validación de evidencia obligatoria.
- **Pantallas de soporte a Entrega 1**:
  - `/login`: Inicio de sesión seguro para usuarios autorizados + selector rápido de rol para validación.
  - `/catalogos`: Gestión de Clientes, Contactos y Usuarios (según permisos de rol).
