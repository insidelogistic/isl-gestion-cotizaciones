# Guía de Configuración Google Drive API — IN SIDE LOGISTIC

Para cumplir con la **Sección 12 (Gestión Documental con Google Drive)** de forma segura del lado del servidor:

## 1. Estructura Automática de Carpetas
El sistema organiza todos los archivos en la jerarquía oficial:
```text
IN SIDE LOGISTIC / COTIZACIONES / AÑO / FOLIO DE SOLICITUD
├── 01_DOCUMENTOS_SOLICITUD
├── 02_LASTENHEFT_Y_ANEXOS
├── 03_COTIZACIONES_Y_REVISIONES
├── 04_DOCUMENTOS_SEGUIMIENTO
├── 05_EVIDENCIAS_ADJUDICACION
└── 06_ORDENES_COMPRA_Y_CONTRATOS
```

## 2. Pasos en Google Cloud Console (Cuenta Autorizada)
1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/) con la cuenta corporativa de **IN SIDE LOGISTIC**.
2. Crea un proyecto llamado `ISL-Gestion-Cotizaciones` y habilita la API **Google Drive API**.
3. Ve a **IAM y administración > Cuentas de servicio** y crea una cuenta de servicio (ej. `isl-drive-service@isl-gestion-cotizaciones.iam.gserviceaccount.com`).
4. En la pestaña **Claves** de esa cuenta de servicio, selecciona **Agregar clave > Crear clave nueva > JSON** y descarga el archivo.
5. En tu Google Drive corporativo, crea la carpeta raíz `IN SIDE LOGISTIC` y compártela como **Editor** únicamente con el correo `client_email` de la cuenta de servicio (sin activar enlaces públicos).
6. Copia el ID de la carpeta de la barra de direcciones de Google Drive y configura las 3 variables en tu archivo `.env` del servidor:
   ```env
   GOOGLE_DRIVE_CLIENT_EMAIL="isl-drive-service@..."
   GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_DRIVE_ROOT_FOLDER_ID="1AbCdEfGhIjKlMnOpQrStUvWxYz"
   ```

> **Nota operativa:** Mientras las variables de Google Cloud están vacías en desarrollo local, el conector [`googleDriveClient.ts`](file:///c:/Users/jagg2/OneDrive/Desktop/SEGUIMIENTO%20COTIZACIONES/src/lib/services/googleDriveClient.ts) almacena y sirve todos los documentos reales en la bóveda local del servidor (`data/drive_vault/IN SIDE LOGISTIC/COTIZACIONES/...`) respetando exactamente la misma jerarquía y control de permisos por rol.
