# Plan de Implementación — ENTREGA 2 (Cotizaciones, Revisiones, Expediente Completo y Google Drive)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Implementar la Entrega 2 de **IN SIDE LOGISTIC | Gestión de Cotizaciones** con captura económica en Modalidad A (interna con conceptos) y Modalidad B (externa Excel/Word/PDF), control de revisiones inmutables (`Rev. 00`, `Rev. 01`...), acción «Marcar como presentada» con cálculo de seguimiento a 3 días hábiles, y gestión documental con Google Drive API.

**Architecture:** Servicios de dominio en TypeScript (`quoteService.ts`, `documentService.ts`, `googleDriveClient.ts`) respaldados por transacciones SQLite/PostgreSQL y almacenamiento de archivos del lado del servidor sincronizado con Google Drive API v3 sin exponer credenciales en el cliente.

**Tech Stack:** Next.js 15 App Router, TypeScript, `node:sqlite` / Supabase PostgreSQL, Google Drive REST API v3 (JWT Service Account), Vitest.

---

### Task 1: Pruebas TDD de Cotizaciones (Modalidad A/B), Revisiones Inmutables, Días Hábiles y Documentos
- [ ] Crear `tests/quotes-and-documents.test.ts` verificando:
  1. Modalidad A calcula subtotal, IVA y total a partir de conceptos, y genera `Rev. 00`.
  2. Modalidad B registra oferta externa (Excel/PDF) sin exigir conceptos.
  3. «Marcar como presentada» vuelve inmutable a `Rev. 00`, cambia el expediente a `PRESENTADA` y propone seguimiento a 3 días hábiles (saltando sábado y domingo).
  4. Intentar modificar una revisión presentada lanza error de inmutabilidad.
  5. Crear una nueva revisión genera `Rev. 01` conservando intacta `Rev. 00` y sin duplicar el importe ofertado vigente del expediente.
  6. Asociar documentos al expediente y a la revisión valida permisos RBAC (`CONSULTA` no puede subir documentos).

### Task 2: Servicios de Cotizaciones (`quoteService.ts`) y Gestión Documental / Google Drive (`documentService.ts` + `googleDriveClient.ts`)
- [ ] Implementar cálculo de días hábiles en México (`addBusinessDays`), creación/edición de revisiones Modalidad A y B, clonación de revisiones (`Rev. 00` -> `Rev. 01`) y presentación formal.
- [ ] Implementar almacenamiento y descarga de archivos vinculados al expediente (`IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO`) y conector de servidor Google Drive API v3 + documentación en `docs/GOOGLE_DRIVE_SETUP.md`.

### Task 3: Rutas API de Servidor para Expediente, Cotizaciones y Documentos
- [ ] `PATCH /api/requests/[id]` (actualizar datos generales del expediente).
- [ ] `GET/POST /api/requests/[id]/quotes` (listar y crear revisiones Modalidad A o B o nueva revisión).
- [ ] `PUT /api/quotes/[revisionId]` (editar revisión en borrador).
- [ ] `POST /api/quotes/[revisionId]/present` (marcar revisión como presentada + seguimiento a 3 días hábiles).
- [ ] `GET/POST /api/requests/[id]/documents` y `GET /api/documents/[docId]/download` (subida multipart/base64 y descarga protegida).

### Task 4: Interfaz Completa de Expediente (`ExpedienteClient.tsx`) y Módulo de Cotizaciones (`/cotizaciones`)
- [ ] Actualizar `ExpedienteClient.tsx` con edición de Datos Generales, Gestor Documental interactivo (subida/descarga por categoría) y Capturador de Cotizaciones Modalidad A/B con control de revisiones (`Rev. 00`, `Rev. 01`) y modal «Marcar como presentada».
- [ ] Actualizar `/cotizaciones` con resumen de revisiones, filtro por modalidad/moneda y acceso directo a captura.
