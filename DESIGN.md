# Sistema de Diseño — IN SIDE LOGISTIC | Gestión de Cotizaciones

Basado en las directrices del Prompt Maestro (Sección 2) y homologado con el aspecto visual de **`ERP TRANS`**.

## 1. Paleta de Colores Corporativos y Semánticos

| Token | Valor Hex | Uso en la Interfaz |
|---|---|---|
| `--isl-azul` | `#0F2747` | Riel lateral de navegación, encabezados principales, badges institucionales, cabeceras de acceso |
| `--isl-azul-hover` | `#16365F` | Estado hover en controles y botones secundarios azul marino |
| `--isl-rojo` | `#C72106` | Botones de acción primaria (`+ Nueva Solicitud`, `Guardar`, `Marcar como Presentada`), indicadores activos |
| `--isl-rojo-hover` | `#A31B05` | Estado hover en botones de acción primaria |
| `--isl-blanco` | `#FFFFFF` | Fondo predominante de tarjetas, tablas, paneles de expediente y encabezado superior |
| `--isl-fondo-app` | `#F5F7FA` | Fondo base del área de trabajo (canvas) |
| `--isl-borde-tarjeta` | `#60A5FA` / `#E2E8F0` | Trazo definido de paneles y contenedores siguiendo la estética `ERP TRANS` |
| `--estado-recibida` | `#1D4ED8` (Fondo `#EFF6FF`) | Solicitud recién registrada |
| `--estado-elaboracion` | `#B45309` (Fondo `#FEF3C7`) | En costeo o elaboración técnica/económica |
| `--estado-presentada` | `#0369A1` (Fondo `#E0F2FE`) | Cotización enviada formalmente al cliente |
| `--estado-negociacion` | `#6D28D9` (Fondo `#F3E8FF`) | En aclaraciones técnicas/comerciales o nueva revisión |
| `--estado-adjudicada` | `#15803D` (Fondo `#DCFCE7`) | Cierre exitoso (Total o Parcial) con evidencia |
| `--estado-no-adjudicada` | `#B91C1C` (Fondo `#FEE2E2`) | Perdida, Cancelada o No Participamos |

## 2. Tipografía

- **Títulos y Encabezados (`--font-heading`)**: `Barlow` (pesos 600, 700, 800, 900), tracking compacto y uso de mayúsculas en subtítulos de sección y encabezados de tabla, idéntico a `ERP TRANS`.
- **Textos, Botones, Tablas y Formularios (`--font-sans`)**: `Poppins` (pesos 400, 500, 600, 700), garantizando legibilidad empresarial en controles, celdas e inputs.
- **Folios, Importes y Fechas (`--font-mono` / `tabular-nums`)**: Números tabulares alineados para folios (`COT-2026-0001`), revisiones (`Rev. 00`) y montos monetarios (`$1,250,000.00 MXN`).

## 3. Arquitectura de Layout (Referencia `ERP TRANS`)

1. **Header Superior Fijo (100% ancho, `h-16`, fondo blanco)**:
   - Izquierda: Botón colapsar/expandir menú, Logotipo original **IN SIDE LOGISTIC** (`public/images/logo.png` con fallback a texto corporativo), subtítulo `GESTIÓN COMERCIAL · Cotizaciones & Licitaciones`, badge operativo `Planta Puebla · VWM & Clientes`, y buscador rápido por folio/cliente/proyecto.
   - Derecha: Indicador de alertas/seguimientos por vencer, botón primario en rojo corporativo `#C72106` (`+ Nueva Solicitud`), y menú de perfil de usuario con rol activo (`Administrador`, `Editor`, `Consulta`) y cambio rápido en entorno de pruebas.
2. **Navegación Lateral Dual (Debajo del Header)**:
   - **Slim Icon Rail (`w-16`, fondo `#0F2747`)**: Iconos directos a las vistas principales con tooltips flotantes y estado activo resaltado.
   - **Submenu Drawer (`w-64`, fondo blanco, fijable/anclable)**: Navegación estructurada por módulos (*Operación Comercial*, *Vistas Rápidas*, *Catálogos y Usuarios*).
3. ** Tarjetas, Tablas y Formularios**:
   - Tarjetas de indicadores limpias con bordes definidos y micro-barras de estado estilo `ERP TRANS`.
   - Tablas de alta densidad con filtros superiores rápidos (Periodo, Estado, Cliente, Responsable), buscador instantáneo, semáforos de fecha límite y acciones directas por fila.
   - Formularios en tarjetas blancas con estructura a 2 columnas, campos dinámicos según origen y modales integrados para alta rápida de Clientes y Contactos sin perder los datos capturados.
