# Plan de Implementación — ENTREGA 3: Seguimiento Comercial y Cierre Comercial

## 1. Objetivo de la Entrega 3
Implementar el control operativo de seguimiento comercial, recordatorios configurables (predeterminado 3 días hábiles), notificaciones internas por correo electrónico y el cierre comercial con validación obligatoria de evidencia documental en adjudicaciones totales o parciales.

## 2. Reglas de Negocio a Implementar y Verificar (TDD)
1. **Línea de tiempo de seguimiento comercial (`followUpService.ts`)**:
   - Registro de actividades (`LLAMADA`, `CORREO`, `REUNION`, `ACLARACION`, `NOTA`, `SEGUIMIENTO`, `OTRO`) con fecha, responsable, descripción, próxima actividad, fecha de próxima actividad y documento adjunto opcional.
   - Acciones sobre compromisos programados:
     - **Completar seguimiento**: marca `is_completed = 1` y permite encadenar opcionalmente el siguiente compromiso.
     - **Reprogramar seguimiento**: actualiza `next_activity_date` y registra en bitácora.
     - **Cancelar recordatorio**: marca `reminder_cancelled = 1`.
2. **Alertas y Notificaciones Internas por Correo (`notificationService.ts`)**:
   - Identificación automática de:
     - Cotizaciones por vencer (fecha límite en ≤ 3 días).
     - Seguimientos programados para hoy.
     - Seguimientos vencidos (fecha de próxima actividad < hoy, no completados ni cancelados).
   - Envío de notificaciones **exclusivamente internas** al personal de IN SIDE LOGISTIC (vía proveedor transaccional Resend/SMTP en servidor + bitácora verificable de correos internos despachados). **Jamás envía correos automáticos al cliente**.
3. **Cierre Comercial con Regla Obligatoria de Evidencia (`closureService.ts`)**:
   - Resultados disponibles:
     - `GANADA`
     - `ADJUDICADA_PARCIALMENTE`
     - `PERDIDA`
     - `CANCELADA`
     - `SIN_RESPUESTA`
   - **Regla obligatoria**: Si el resultado es `GANADA` o `ADJUDICADA_PARCIALMENTE`, el servidor exige:
     - Importe adjudicado mayor a 0 (`awarded_amount > 0`).
     - Al menos un documento de evidencia asociado (`ORDEN_COMPRA` o `EVIDENCIA_ADJUDICACION` en el expediente o vinculado al cierre). Si no existe evidencia documental, lanza un error de validación y **no permite guardar el cierre**.
   - Si el resultado es `PERDIDA` o `CANCELADA`, exige motivo de pérdida o cancelación (`loss_reason`).
   - Al confirmar el cierre:
     - Actualiza el estado del expediente a `CERRADA`.
     - Cancela los recordatorios pendientes del expediente (`reminder_cancelled = 1`).
     - Registra el evento en `audit_logs`.
