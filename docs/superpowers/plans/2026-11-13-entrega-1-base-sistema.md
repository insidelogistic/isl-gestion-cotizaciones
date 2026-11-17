# Plan Arquitectónico e Implementación — ENTREGA 1 (Base del Sistema)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la Entrega 1 funcional y verificada de **IN SIDE LOGISTIC | Gestión de Cotizaciones** respetando la identidad visual corporativa (`#0F2747`, `#C72106`, `Barlow`, `Poppins`, logo original) y el diseño operativo de `ERP TRANS`.

**Architecture:** Aplicación web modular full-stack con Next.js (App Router), React 19 y TypeScript; capa de datos relacional con migración SQL oficial para PostgreSQL/Supabase (`supabase/migrations/001_initial_schema.sql`) y motor relacional SQLite (`better-sqlite3`) integrado para ejecución y pruebas locales inmediatas; autenticación basada en sesiones HTTP-only firmadas con control de acceso por rol (`ADMIN`, `EDITOR`, `CONSULTA`) en servidor.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, `better-sqlite3` + SQL para Supabase PostgreSQL, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-isl-cotizaciones-design.md`

## Global Constraints
- Colores obligatorios: Azul marino `#0F2747`, Rojo corporativo `#C72106`, fondo blanco `#FFFFFF` y gris claro `#F5F7FA`.
- Tipografías obligatorias: `Barlow` para títulos y encabezados; `Poppins` para textos, botones, tablas y formularios.
- Logotipo: usar exclusivamente el logotipo original de IN SIDE LOGISTIC (`public/images/logo.png`) con texto provisional de respaldo.
- Zona horaria: `America/Mexico_City`.
- Sin registro público de usuarios; 3 roles (`ADMIN`, `EDITOR`, `CONSULTA`).
- Los folios internos deben ser únicos (`COT-YYYY-NNNN`).

## Review Focus
- Intento de modificar o crear solicitudes/clientes con rol `CONSULTA` -> debe ser rechazado en el servidor con HTTP 403.
- Creación de `LICITACION_VW` sin número de licitación, comprador responsable o fecha límite -> debe ser rechazado con error de validación.
- Creación de `DIRECTA_VW` sin departamento solicitante, nombre del solicitante o medio de recepción -> debe ser rechazado con error de validación.
- Generación concurrente o secuencial de folios -> nunca debe duplicar un folio existente.
- Cambio asistido de estado en Tabla/Kanban -> debe registrar quién realizó el cambio y cuándo en `audit_logs`.

---

### Task 1: Inicialización de Proyecto Next.js + Activos Visuales `ERP TRANS`
- [ ] Crear `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`.
- [ ] Copiar activos originales (`logo.png`, `logo-icon-white.png`, `logo_volkswagen.png`) desde `ERP TRANS/public/images` hacia `public/images`.
- [ ] Configurar `src/app/globals.css` con `@import 'tailwindcss'`, variables `--isl-azul: #0F2747`, `--isl-rojo: #C72106`, `--fuente-titulos: 'Barlow'`, `--fuente-textos: 'Poppins'`, y estilos homologados con `ERP TRANS`.

### Task 2: Esquema Relacional (Supabase PostgreSQL + SQLite Local) y Semilla
- [ ] Crear `supabase/migrations/001_initial_schema.sql` con las tablas relacionales completas.
- [ ] Implementar `src/lib/db/index.ts` y `src/lib/db/seed.ts` con clientes reales (Volkswagen de México S.A. de C.V., Audi México, ThyssenKrupp, etc.), contactos/compradores y usuarios autorizados para los 3 roles (`ADMIN`, `EDITOR`, `CONSULTA`).

### Task 3: Autenticación, RBAC, Folios y Validaciones (Ciclo TDD)
- [ ] Escribir pruebas fallidas en `tests/folio-and-rbac.test.ts` para generación de folios únicos (`COT-2026-0001`), permisos por rol (`ADMIN`, `EDITOR`, `CONSULTA`) y validaciones Zod por origen (`LICITACION_VW`, `DIRECTA_VW`, `OTRO_CLIENTE`).
- [ ] Ejecutar `npm test` y confirmar fallo (RED).
- [ ] Implementar `src/lib/auth/rbac.ts`, `src/lib/auth/session.ts`, `src/lib/services/folioService.ts` y `src/lib/validation/schemas.ts`.
- [ ] Ejecutar `npm test` y confirmar paso (GREEN).

### Task 4: Servicios de Solicitudes, Clientes, Contactos, Filtros y Estados (Ciclo TDD)
- [ ] Escribir pruebas fallidas en `tests/requests-and-filters.test.ts` para creación de solicitudes en los 3 orígenes (`LICITACION_VW`, `DIRECTA_VW`, `OTRO_CLIENTE`), estado inicial `RECIBIDA`, filtrado por folio/cliente/responsable/estado/fechas, semáforo de vencimiento y cambio asistido de estado con bitácora.
- [ ] Ejecutar `npm test` y confirmar fallo (RED).
- [ ] Implementar `src/lib/services/catalogService.ts` y `src/lib/services/requestService.ts`.
- [ ] Ejecutar `npm test` y confirmar paso (GREEN).

### Task 5: Endpoints API del Servidor y Autenticación
- [ ] Implementar rutas API en `src/app/api/auth/*`, `src/app/api/customers/route.ts`, `src/app/api/contacts/route.ts`, `src/app/api/users/route.ts`, `src/app/api/requests/route.ts`, `src/app/api/requests/[id]/route.ts`, `src/app/api/requests/[id]/status/route.ts` y `src/app/api/requests/[id]/activities/route.ts`.

### Task 6: Interfaz de Usuario (`ERP TRANS` Design System) y las 7 Pantallas Conectadas
- [ ] Implementar `AppShell.tsx` (Header superior 100%, Slim Icon Rail `#0F2747` + Submenu Drawer acoplable, selector de rol activo, alertas) y `BrandLogo.tsx`.
- [ ] Implementar `/login` (Acceso exclusivo para usuarios autorizados + demostración rápida por rol).
- [ ] Implementar `/solicitudes` (**Vista 1: Tabla** con las 10 columnas, buscador, filtros, ordenamiento, semáforo de vencimiento y acciones rápidas + **Vista 2: Kanban** con las 5 columnas y cambio asistido de estado).
- [ ] Implementar `/solicitudes/nueva` (Formulario dinámico A: Licitación Volkswagen, B: Solicitud directa Volkswagen, C: Otro cliente + modales de alta rápida de Cliente y Contacto).
- [ ] Implementar `/solicitudes/[id]` (Expediente de solicitud con encabezado resumen y las 5 pestañas conectadas a base de datos).
- [ ] Implementar `/` (Dashboard principal), `/cotizaciones`, `/seguimiento`, `/cierres` y `/catalogos` (Clientes, Contactos y Usuarios con protección RBAC).
