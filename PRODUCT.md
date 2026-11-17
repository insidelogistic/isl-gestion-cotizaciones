# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) con React 19, TypeScript, Tailwind CSS v4, PostgreSQL (vía Supabase en nube) + motor SQLite relacional local (`better-sqlite3`) para desarrollo/pruebas determinísticas, Google Drive API (Server-side) y servicio de correo transaccional.

## Users

Personal administrativo, operativo (ingenieros de costos/cotizadores) y directivo de **IN SIDE LOGISTIC S.A. de C.V.**, empresa mexicana dedicada al mantenimiento industrial, fabricación, maquinado y servicios técnicos (principalmente para Volkswagen de México y clientes industriales).

Roles del sistema:
- **Administrador**: administra usuarios, consulta todos los expedientes, registra/modifica solicitudes, administra cotizaciones, consulta indicadores generales y configura parámetros/recordatorios.
- **Editor**: registra solicitudes, elabora cotizaciones, adjunta documentos, registra seguimientos y actualiza estados/resultados de expedientes autorizados.
- **Consulta**: visualiza expedientes y reportes permitidos sin permisos de modificación.

## Product Purpose

**IN SIDE LOGISTIC | Gestión de Cotizaciones** es una aplicación web empresarial enfocada en administrar las solicitudes de cotización que recibe la empresa (Licitaciones Volkswagen, Solicitudes Directas Volkswagen y Otros Clientes), controlar las revisiones de ofertas económicas (internas o elaboradas en Excel/LASTENHEFT), gestionar su documentación técnica/comercial en Google Drive, programar seguimientos comerciales y registrar cierres/adjudicaciones con evidencia obligatoria.

## Positioning

Herramienta comercial-técnica B2B hecha a la medida de la operación de proveedores industriales de Volkswagen de México: soporta nativamente licitaciones con `LASTENHEFT` y estructuras económicas en Excel sin obligar a recapturar partidas, mantiene revisiones inmutables (`Rev. 00`, `Rev. 01`), garantiza no duplicar importes históricos en el Dashboard y exige evidencia documental auditable antes de declarar una adjudicación total o parcial.

## Operating Context

- Uso diario en oficinas administrativas, área de ingeniería/costos y dirección de IN SIDE LOGISTIC en Puebla, México (`America/Mexico_City`).
- Interacción constante con portales y departamentos de Volkswagen de México (Complejo Puebla) y otras plantas automotrices/industriales.
- Manejo de importes monetarios explícitos (`MXN`, `USD`, `EUR`) con precisión decimal exacta.

## Capabilities and Constraints

- **Principio fundamental: SIMPLICIDAD.** No es un ERP, CRM complejo ni sistema contable.
- Independiente del ERP de IN SIDE LOGISTIC (`ERP TRANS`).
- Sin registro público de usuarios; acceso exclusivo a usuarios autorizados.
- Revisiones formalmente presentadas son inmutables.
- Prohibido cerrar una adjudicación (total o parcial) sin adjuntar evidencia documental válida.
- Prohibido enviar correos automáticos a compradores o clientes externos (las notificaciones son únicamente para los responsables internos).

## Brand Commitments

- Nombre oficial: **IN SIDE LOGISTIC | Gestión de Cotizaciones**
- Colores corporativos obligatorios:
  - Azul marino: `#0F2747` (encabezados, barra lateral de navegación, textos de marca).
  - Rojo corporativo: `#C72106` (botones de acción primaria, acentos de alerta/énfasis).
  - Blanco (`#FFFFFF`) como superficie principal de tarjetas/paneles y gris claro (`#F5F7FA` / `#E5E7EB`) para fondo de aplicación, tablas y separadores.
- Tipografías obligatorias:
  - `Barlow` para títulos y encabezados.
  - `Poppins` para textos, botones, tablas y formularios.
- Logotipo: usar exclusivamente el logotipo original de IN SIDE LOGISTIC (disponible en el ecosistema `ERP TRANS` en `public/images/logo.png`) con respaldo tipográfico limpio si el archivo no estuviera disponible.
- Referencia visual directa: **Proyecto `ERP TRANS`** (barra superior de ancho completo con identidad y planta VWM, riel lateral azul marino `#0F2747` con cajón de navegación acoplable, tarjetas blancas con bordes definidos, alta densidad informativa, formularios a dos columnas limpios y modales ágiles).

## Evidence on Hand

- Logotipo oficial de IN SIDE LOGISTIC (`logo.png`, `logo-icon-white.png`, `logo_volkswagen.png`) proveniente del proyecto hermano `C:\Users\jagg2\OneDrive\Desktop\ERP TRANS\public\images`.
- Especificación funcional íntegra en el Prompt Maestro MVP V1.0 (Secciones 1 a 19).

## Product Principles

1. **Simplicidad operativa sin fricción**: capturar una solicitud o cotización externa (Excel VW) toma segundos, mostrando únicamente los campos que corresponden al origen.
2. **Integridad comercial e inmutabilidad**: ninguna oferta presentada se sobrescribe (`Rev. 00` → `Rev. 01`), ningún importe se duplica en indicadores y ninguna adjudicación existe sin documento probatorio.
3. **Claridad visual estilo `ERP TRANS`**: jerarquía industrial limpia en azul marino `#0F2747` y rojo `#C72106`, estados comerciales inequívocos y semáforos de vencimiento visibles de un vistazo.

## Accessibility & Inclusion

- Contraste mínimo WCAG AA (≥ 4.5:1 en textos de tabla y formulario).
- Navegación por teclado completa, etiquetas visibles en todos los campos de formulario y diseño responsivo adaptable a computadora, tableta y teléfono.
