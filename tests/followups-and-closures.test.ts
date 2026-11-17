import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, setDatabaseInstance } from '../src/lib/db';
import { listUsers } from '../src/lib/services/catalogService';
import { createQuoteRequest, getQuoteRequestById } from '../src/lib/services/requestService';
import { createQuoteRevision, markQuoteRevisionAsPresented } from '../src/lib/services/quoteService';
import { uploadExpedienteDocument } from '../src/lib/services/documentService';
import {
  registerFollowUpActivity,
  completeFollowUpActivity,
  rescheduleFollowUpActivity,
  cancelFollowUpReminder,
  listFollowUpCommitments,
} from '../src/lib/services/followUpService';
import {
  registerCommercialClosure,
  listCommercialClosures,
} from '../src/lib/services/closureService';
import {
  getOperationalAlertsSummary,
  dispatchInternalAlertEmails,
} from '../src/lib/services/notificationService';

describe('ENTREGA 3 — Seguimiento Comercial, Recordatorios, Notificaciones Internas y Cierre Comercial', () => {
  beforeEach(() => {
    const db = createTestDatabase();
    setDatabaseInstance(db);
  });

  it('1. Registra actividades en la línea de tiempo y permite reprogramar, completar o cancelar recordatorios', async () => {
    const users = await listUsers();
    const editor = users.find((u) => u.role === 'EDITOR')!;

    const req = await createQuoteRequest(editor, {
      origin_type: 'DIRECTA_VW',
      project_name: 'Mantenimiento Preventivo Polipastos Nave 4',
      description: 'Inspección y reemplazo de baleros y contactores.',
      received_date: '2026-11-10',
      deadline_date: '2026-11-20',
      responsible_user_id: editor.id,
      vw_department: 'Mantenimiento',
      vw_requester_name: 'Ing. Roberto Nava',
      contact_info: 'roberto.nava@vw.com.mx',
      reception_channel: 'Correo electrónico',
    });

    const act1 = await registerFollowUpActivity(editor, {
      request_id: req.id,
      activity_type: 'LLAMADA',
      activity_date: '2026-11-11',
      description: 'Llamada para confirmar ventana de paro de planta.',
      next_activity_date: '2026-11-14',
      next_activity_description: 'Enviar propuesta técnica preliminar',
    });

    expect(act1.id).toBeTruthy();
    expect(act1.next_activity_date).toBe('2026-11-14');
    expect(act1.is_completed).toBe(0);

    // Reprogramar compromiso
    const rescheduled = await rescheduleFollowUpActivity(
      editor,
      act1.id,
      '2026-11-17',
      'Ajuste por visita técnica en planta'
    );
    expect(rescheduled.next_activity_date).toBe('2026-11-17');

    // Completar compromiso
    const completed = await completeFollowUpActivity(editor, act1.id, 'Propuesta revisada con usuario');
    expect(completed.is_completed).toBe(1);

    // Crear otro recordatorio y cancelarlo
    const act2 = await registerFollowUpActivity(editor, {
      request_id: req.id,
      activity_type: 'CORREO',
      activity_date: '2026-11-12',
      description: 'Envío de ficha técnica de motores.',
      next_activity_date: '2026-11-18',
      next_activity_description: 'Confirmar visto bueno técnico',
    });

    const cancelled = await cancelFollowUpReminder(editor, act2.id);
    expect(cancelled.reminder_cancelled).toBe(1);

    const pendingCommitments = await listFollowUpCommitments({ onlyPending: true });
    expect(pendingCommitments.some((c) => c.id === act1.id)).toBe(false);
    expect(pendingCommitments.some((c) => c.id === act2.id)).toBe(false);
  });

  it('2. Impide guardar un cierre GANADA o ADJUDICADA_PARCIALMENTE sin evidencia documental y lo permite al adjuntar Orden de Compra o Evidencia', async () => {
    const users = await listUsers();
    const editor = users.find((u) => u.role === 'EDITOR')!;

    const req = await createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Fabricación de Carros Portaherramientas Nave 12',
      description: 'Lote de 15 carros estructurales con ruedas de poliuretano.',
      received_date: '2026-11-05',
      deadline_date: '2026-11-18',
      responsible_user_id: editor.id,
      vw_tender_number: 'LIC-VWM-2026-7710',
      vw_buyer_name: 'Lic. Claudia Morales',
      has_lastenheft: true,
      has_economic_excel: true,
    });

    const rev00 = await createQuoteRevision(editor, {
      request_id: req.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-08',
      subtotal: 480000,
      tax_rate: 16,
      observations: 'Oferta en estructura económica VWM.',
    });

    await markQuoteRevisionAsPresented(editor, {
      revision_id: rev00.id,
      presentation_date: '2026-11-09',
      presentation_channel: 'PLATAFORMA_VW',
    });

    // Intentar cerrar como GANADA sin evidencia documental -> DEBE FALLAR
    await expect(
      registerCommercialClosure(editor, {
        request_id: req.id,
        result: 'GANADA',
        closure_date: '2026-11-13',
        awarded_amount: 480000,
        awarded_currency: 'MXN',
        purchase_order_number: '4500991122',
        comments: 'Adjudicación confirmada en portal VWM.',
      })
    ).rejects.toThrow(/evidencia documental/i);

    // Adjuntar Orden de Compra / Evidencia de adjudicación
    const ocDoc = await uploadExpedienteDocument(editor, {
      request_id: req.id,
      category: 'ORDEN_COMPRA',
      original_name: 'OC_4500991122_VWM.pdf',
      mime_type: 'application/pdf',
      content_base64: Buffer.from('PDF ORDEN DE COMPRA VWM 4500991122').toString('base64'),
    });

    // Ahora sí debe permitir registrar el cierre comercial GANADA
    const closure = await registerCommercialClosure(editor, {
      request_id: req.id,
      result: 'GANADA',
      closure_date: '2026-11-13',
      awarded_amount: 480000,
      awarded_currency: 'MXN',
      purchase_order_number: '4500991122',
      evidence_document_id: ocDoc.id,
      comments: 'Adjudicación total con OC liberada.',
    });

    expect(closure.result).toBe('GANADA');
    expect(closure.awarded_amount).toBe(480000);

    const detail = (await getQuoteRequestById(req.id))!;
    expect(detail.request.status).toBe('CERRADA');

    const closuresList = await listCommercialClosures();
    expect(
      closuresList.some(
        (c) =>
          c.request_id === req.id &&
          (c.result === 'GANADA' || c.result === 'ADJUDICADA_TOTAL')
      )
    ).toBe(true);
  });

  it('3. Exige motivo de pérdida o cancelación cuando el resultado es PERDIDA o CANCELADA', async () => {
    const users = await listUsers();
    const editor = users.find((u) => u.role === 'EDITOR')!;

    const req = await createQuoteRequest(editor, {
      origin_type: 'OTRO_CLIENTE',
      customer_id: 'cust-audi',
      project_name: 'Maquinado de Bridas Especiales',
      description: 'Maquinado CNC en acero inoxidable 316.',
      received_date: '2026-11-01',
      deadline_date: '2026-11-12',
      responsible_user_id: editor.id,
      contact_name: 'Ing. Sofía Vega',
      contact_info: 'sofia.vega@audi.mx',
      reception_channel: 'Correo electrónico',
    });

    await expect(
      registerCommercialClosure(editor, {
        request_id: req.id,
        result: 'PERDIDA',
        closure_date: '2026-11-13',
        loss_reason: '',
      })
    ).rejects.toThrow(/motivo/i);

    const closedLost = await registerCommercialClosure(editor, {
      request_id: req.id,
      result: 'PERDIDA',
      closure_date: '2026-11-13',
      loss_reason: 'Precio objetivo del comprador 15% inferior por proveedor extranjero.',
      comments: 'Se conserva historial para siguiente licitación.',
    });

    expect(closedLost.result).toBe('PERDIDA');
    expect((await getQuoteRequestById(req.id))!.request.status).toBe('CERRADA');
  });

  it('4. Calcula alertas operativas (por vencer, para hoy, vencidas) y despacha notificaciones exclusivamente a correos internos de IN SIDE LOGISTIC', async () => {
    const users = await listUsers();
    const admin = users.find((u) => u.role === 'ADMIN')!;

    const alerts = await getOperationalAlertsSummary('2026-11-13');
    expect(alerts).toHaveProperty('expiringRequests');
    expect(alerts).toHaveProperty('dueTodayFollowUps');
    expect(alerts).toHaveProperty('overdueFollowUps');

    const dispatchResult = await dispatchInternalAlertEmails(admin, '2026-11-13');
    expect(dispatchResult.dispatchedCount).toBeGreaterThanOrEqual(1);
    for (const mail of dispatchResult.emails) {
      expect(mail.to.endsWith('@insidelogistic.com.mx')).toBe(true);
    }
  });
});
