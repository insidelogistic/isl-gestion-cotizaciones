# Guía de Despliegue en Producción, Seguridad y Respaldos
## IN SIDE LOGISTIC | Gestión de Cotizaciones (MVP V1.0)

---

### 1. Arquitectura de Producción Recomendada
- **Frontend & API Server**: Next.js 15 (App Router + Server Actions / Route Handlers) desplegado en **Vercel** (o contenedor Docker en Google Cloud Run / Railway).
- **Base de Datos Relacional**: **PostgreSQL** administrado en **Supabase** (código de migración listo en `supabase/migrations/001_initial_schema.sql`) o motor embebido transaccional `node:sqlite` para operación local autónoma.
- **Almacenamiento Documental**: **Google Drive API v3** mediante Cuenta de Servicio (`Service Account` JWT en servidor) sincronizada con la estructura jerárquica:
  ```text
  IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO
  ```
- **Notificaciones de Correo**: Servicio transaccional en servidor (**Resend** / SMTP corporativo) restringido exclusivamente a destinatarios `@insidelogistic.com.mx`.

---

### 2. Variables de Entorno para Producción (`.env.production`)

```env
# 1. Seguridad de Sesión (HMAC-SHA256)
AUTH_SECRET="cadena_aleatoria_segura_de_64_caracteres_inside_logistic_2026"

# 2. Base de Datos PostgreSQL (Supabase)
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.tu-proyecto.supabase.co:5432/postgres"

# 3. Integración Segura Google Drive API v3 (Solo Servidor)
GOOGLE_DRIVE_CLIENT_EMAIL="isl-cotizaciones-bot@tu-proyecto.iam.gserviceaccount.com"
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID="1AbCdEfGhIjKlMnOpQrStUvWxYz"

# 4. Correo Transaccional Interno (Opcional)
RESEND_API_KEY="re_..."
```

---

### 3. Controles de Seguridad Implementados (Sección 17 del Prompt Maestro)
1. **Sin registro público**: La aplicación bloquea cualquier alta abierta. Solo los usuarios creados por un `ADMIN` pueden iniciar sesión.
2. **Contraseñas cifradas**: Uso de `crypto.scryptSync` con sal criptográfica antes de almacenar en `users.password_hash`.
3. **Sesiones firmadas HTTP-Only**: Cookies `HttpOnly`, `SameSite=Lax` firmadas con HMAC-SHA256 en el servidor.
4. **Control de acceso basado en roles (RBAC)** en servidor (`src/lib/auth/rbac.ts`):
   - `ADMIN`: Control total, gestión de usuarios, catálogos, solicitudes, cotizaciones, seguimiento y cierres.
   - `EDITOR`: Creación y actualización de solicitudes, cotizaciones, documentos, seguimientos y cierres.
   - `CONSULTA`: Lectura de expedientes y dashboard sin permisos de escritura.
5. **Inmutabilidad de revisiones presentadas**: Las revisiones marcadas como `PRESENTADA` tienen `is_immutable = 1` y rechazan cualquier `PUT/PATCH` en el servidor (`409 Conflict`).
6. **Regla obligatoria de Cierre Comercial**: El servidor impide cerrar como `GANADA` o `ADJUDICADA_PARCIALMENTE` si no existe evidencia documental (`ORDEN_COMPRA` o `EVIDENCIA_ADJUDICACION`) vinculada al expediente.
7. **Protección de credenciales Google Drive**: Las llaves de Google Drive jamás se exponen en variables `NEXT_PUBLIC_*` ni se generan enlaces públicos abiertos.
8. **Bitácora de auditoría (`audit_logs`)**: Registro inmutable de quién creó solicitudes, quién presentó revisiones, quién modificó estados y quién cerró comercialmente cada expediente.

---

### 4. Estrategia de Respaldos y Recuperación de Datos
- **Base de Datos**:
  - En Supabase PostgreSQL: respaldos diarios automáticos Point-in-Time Recovery (PITR) y exportación `pg_dump`.
  - En modo autónomo local: respaldo directo del archivo `data/isl_cotizaciones.sqlite` y de la bóveda documental `data/drive_vault/`.
- **Documentos**:
  - Doble persistencia: estructura jerárquica en Google Drive corporativo de IN SIDE LOGISTIC + respaldo en bóveda del servidor.
