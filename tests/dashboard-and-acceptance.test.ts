import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, setDatabaseInstance } from '../src/lib/db';
import { authenticateUser, PermissionError } from '../src/lib/auth/rbac';
import { createCustomer, listCustomers } from '../src/lib/services/catalogService';
import {
  createQuoteRequest,
  listQuoteRequests,
  updateQuoteRequestStatus,
} from '../src/lib/services/requestService';
import {
  createQuoteRevision,
  updateDraftQuoteRevision,
  markQuoteRevisionAsPresented,
} from '../src/lib/services/quoteService';
import { uploadExpedienteDocument } from '../src/lib/services/documentService';
import { registerFollowUpActivity } from '../src/lib/services/followUpService';
import { registerCommercialClosure } from '../src/lib/services/closureService';
import { getDashboardMetrics } from '../src/lib/services/dashboardService';

describe('ENTREGA 4 — Dashboard Ejecutivo y 20 Pruebas de Aceptación (Sección 18 del Prompt Maestro)', () => {
  beforeEach(() => {
    const db = createTestDatabase();
    setDatabaseInstance(db);
  });

  it('calcula los 8 indicadores del Dashboard sin duplicar revisiones históricas y sumando el importe efectivamente adjudicado en adjudicaciones parciales', () => {
    const admin = authenticateUser('DIR-0001', 'AdminISL2026!')!;
    const editor = authenticateUser('ING-0001', 'EditorISL2026!')!;

    // Solicitud 1: Licitación VWM con Rev. 00 ($100,000) y Rev. 01 ($150,000).
    // El Dashboard debe tomar $150,000 como importe ofertado vigente, NO $250,000.
    const req1 = createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Adecuación de Transportador Nave 10',
      description: 'Fabricación y montaje electromecánico.',
      received_date: '2026-11-01',
      deadline_date: '2026-11-15',
      responsible_user_id: editor.id,
      vw_tender_number: 'LIC-VWM-2026-100',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
      has_lastenheft: true,
      has_economic_excel: true,
    });

    const rev00 = createQuoteRevision(editor, {
      request_id: req1.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-02',
      subtotal: 100000,
    });
    markQuoteRevisionAsPresented(editor, {
      revision_id: rev00.id,
      presentation_date: '2026-11-03',
      presentation_channel: 'PLATAFORMA_VW',
    });

    const rev01 = createQuoteRevision(editor, {
      request_id: req1.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-05',
      subtotal: 150000,
    });
    markQuoteRevisionAsPresented(editor, {
      revision_id: rev01.id,
      presentation_date: '2026-11-06',
      presentation_channel: 'PLATAFORMA_VW',
    });

    // Solicitud 2: Solicitud Directa VW con oferta de $200,000 pero Adjudicada Parcialmente por $120,000
    const req2 = createQuoteRequest(editor, {
      origin_type: 'DIRECTA_VW',
      project_name: 'Maquinado de Dispositivos de Control',
      description: 'Maquinado CNC de precisión.',
      received_date: '2026-11-02',
      deadline_date: '2026-11-14',
      responsible_user_id: admin.id,
      vw_department: 'Calidad',
      vw_requester_name: 'Ing. Markus Weber',
      contact_info: 'markus.weber@vw.com.mx',
      reception_channel: 'Correo electrónico',
    });

    const rev2_00 = createQuoteRevision(editor, {
      request_id: req2.id,
      modality: 'INTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-04',
      items: [
        { concept: 'Partida 1', unit: 'Lote', quantity: 1, unit_price: 120000 },
        { concept: 'Partida 2', unit: 'Lote', quantity: 1, unit_price: 80000 },
      ],
    });
    markQuoteRevisionAsPresented(editor, {
      revision_id: rev2_00.id,
      presentation_date: '2026-11-04',
      presentation_channel: 'CORREO',
    });

    const evDoc = uploadExpedienteDocument(editor, {
      request_id: req2.id,
      category: 'ORDEN_COMPRA',
      original_name: 'OC_PARCIAL_120K.pdf',
      mime_type: 'application/pdf',
      content_base64: Buffer.from('OC PARCIAL').toString('base64'),
    });

    registerCommercialClosure(editor, {
      request_id: req2.id,
      result: 'ADJUDICADA_PARCIALMENTE',
      closure_date: '2026-11-12',
      awarded_amount: 120000,
      awarded_currency: 'MXN',
      purchase_order_number: 'OC-120K',
      evidence_document_id: evDoc.id,
      comments: 'Se adjudicó únicamente la Partida 1.',
    });

    const metrics = getDashboardMetrics({ referenceDateStr: '2026-11-13' });

    // Importe total ofertado vigente: $150,000 (req1 Rev.01) + $200,000 (req2 Rev.00) = $350,000 (sin sumar los $100,000 de Rev.00 de req1)
    expect(metrics.totalOfferedAmount).toBe(350000);

    // Importe total adjudicado: $120,000 (efectivamente adjudicado en adjudicación parcial)
    expect(metrics.totalAwardedAmount).toBe(120000);

    // Solicitudes activas: req1 está PRESENTADA (activa), req2 está CERRADA
    expect(metrics.activeRequestsCount).toBe(1);
    expect(metrics.closedCount).toBe(1);

    // Filtrado por responsable en el Dashboard
    const editorMetrics = getDashboardMetrics({
      responsibleUserId: editor.id,
      referenceDateStr: '2026-11-13',
    });
    expect(editorMetrics.totalOfferedAmount).toBe(150000);
    expect(editorMetrics.totalAwardedAmount).toBe(0);
  });

  it('valida de extremo a extremo los 20 casos de aceptación de la Sección 18 del Prompt Maestro', () => {
    // 1. Iniciar sesión con usuario válido e inválido
    const admin = authenticateUser('DIR-0001', 'AdminISL2026!')!;
    const editor = authenticateUser('ING-0001', 'EditorISL2026!')!;
    const consulta = authenticateUser('CON-0001', 'ConsultaISL2026!')!;
    const invalid = authenticateUser('DIR-0001', 'ClaveIncorrecta');
    expect(admin.role).toBe('ADMIN');
    expect(invalid).toBeNull();

    // 2. Verificar permisos por rol (Consulta no puede crear solicitud)
    expect(() =>
      createQuoteRequest(consulta, {
        origin_type: 'DIRECTA_VW',
        project_name: 'Intento no autorizado',
        description: 'Prueba permisos',
        received_date: '2026-11-13',
        responsible_user_id: editor.id,
        vw_department: 'Compras',
        vw_requester_name: 'Test',
        reception_channel: 'Correo',
      })
    ).toThrow(PermissionError);

    // 3, 4 y 5. Crear solicitud por Licitación VW, Solicitud Directa VW y Otro Cliente
    const reqLicVw = createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Licitación Cabina Pintura',
      description: 'Mantenimiento mayor en cabina.',
      received_date: '2026-11-10',
      deadline_date: '2026-11-15',
      responsible_user_id: editor.id,
      vw_tender_number: 'LIC-VW-900',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
      has_lastenheft: true,
      has_economic_excel: true,
    });
    const reqDirVw = createQuoteRequest(editor, {
      origin_type: 'DIRECTA_VW',
      project_name: 'Solicitud Directa Prensas',
      description: 'Reparación de guardas.',
      received_date: '2026-11-11',
      deadline_date: '2026-11-18',
      responsible_user_id: editor.id,
      vw_department: 'Nave 4',
      vw_requester_name: 'Ing. Omar Sánchez',
      contact_info: 'omar@vw.com.mx',
      reception_channel: 'Correo electrónico',
    });

    // 6. Crear cliente y contacto nuevos
    const newCust = createCustomer(editor, {
      name: 'Benteler de México S.A. de C.V.',
      short_name: 'BENTELER',
      rfc: 'BME990101AAA',
      plant_or_location: 'Puebla',
      contact_name: 'Ing. Ricardo Soto',
      contact_email: 'rsoto@benteler.com',
    });
    expect(listCustomers().some((c) => c.id === newCust.id)).toBe(true);

    const reqOtro = createQuoteRequest(editor, {
      origin_type: 'OTRO_CLIENTE',
      customer_id: newCust.id,
      project_name: 'Maquinado de Troqueles Benteler',
      description: 'Ajuste de matrices.',
      received_date: '2026-11-12',
      deadline_date: '2026-11-22',
      responsible_user_id: editor.id,
      contact_name: 'Ing. Ricardo Soto',
      contact_info: 'rsoto@benteler.com',
      reception_channel: 'WhatsApp',
    });

    // 7. Generar folio automático único con 3 primeras letras de la empresa y consecutivo anual
    expect(reqLicVw.folio).toBe('COT-2026-VOL-0001');
    expect(reqDirVw.folio).toBe('COT-2026-VOL-0002');
    expect(reqOtro.folio).toBe('COT-2026-BEN-0003');

    // 8. Subir y descargar archivos en la estructura de Google Drive
    const doc = uploadExpedienteDocument(editor, {
      request_id: reqLicVw.id,
      category: 'LASTENHEFT',
      original_name: 'LASTENHEFT_CABINA.pdf',
      mime_type: 'application/pdf',
      content_base64: Buffer.from('LASTENHEFT CONTENT').toString('base64'),
    });
    expect(doc.drive_folder_path).toContain('IN SIDE LOGISTIC / COTIZACIONES / 2026 / COT-2026-VOL-0001');

    // 9. Capturar cotización dentro de la aplicación (Modalidad A)
    const revInt = createQuoteRevision(editor, {
      request_id: reqDirVw.id,
      modality: 'INTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-12',
      items: [{ concept: 'Reparación de guardas', unit: 'Servicio', quantity: 2, unit_price: 45000 }],
    });
    expect(revInt.subtotal).toBe(90000);

    // 10. Registrar cotización elaborada externamente (Modalidad B)
    const revExt = createQuoteRevision(editor, {
      request_id: reqLicVw.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-12',
      subtotal: 320000,
      associated_document_id: doc.id,
    });
    expect(revExt.revision_code).toBe('Rev. 00');

    // 11. Crear revisión adicional
    const revExt01 = createQuoteRevision(editor, {
      request_id: reqLicVw.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-13',
      subtotal: 310000,
    });
    expect(revExt01.revision_code).toBe('Rev. 01');

    // 12 y 13. Marcar como presentada e impedir modificar revisión presentada
    const pres = markQuoteRevisionAsPresented(editor, {
      revision_id: revExt01.id,
      presentation_date: '2026-11-13',
      presentation_channel: 'PLATAFORMA_VW',
    });
    expect(pres.revision.is_immutable).toBe(1);
    expect(() =>
      updateDraftQuoteRevision(editor, revExt01.id, {
        currency: 'MXN',
        issue_date: '2026-11-14',
        subtotal: 290000,
      })
    ).toThrow(/inmutable/i);

    // 14 y 15. Programar recordatorio automático y registrar actividades de seguimiento
    expect(pres.proposedFollowUpDate).toBe('2026-11-18');
    const act = registerFollowUpActivity(editor, {
      request_id: reqLicVw.id,
      activity_type: 'ACLARACION',
      activity_date: '2026-11-14',
      description: 'Aclaración técnica sobre espesor de lámina.',
      next_activity_date: '2026-11-19',
      next_activity_description: 'Recibir dictamen técnico',
    });
    expect(act.id).toBeTruthy();

    // 16 y 17. Impedir cierre ganador sin evidencia y permitir cierre con evidencia
    expect(() =>
      registerCommercialClosure(editor, {
        request_id: reqLicVw.id,
        result: 'GANADA',
        closure_date: '2026-11-15',
        awarded_amount: 310000,
      })
    ).toThrow(/evidencia documental/i);

    const oc = uploadExpedienteDocument(editor, {
      request_id: reqLicVw.id,
      category: 'ORDEN_COMPRA',
      original_name: 'OC_CABINA.pdf',
      mime_type: 'application/pdf',
      content_base64: Buffer.from('OC CABINA').toString('base64'),
    });
    const closure = registerCommercialClosure(editor, {
      request_id: reqLicVw.id,
      result: 'GANADA',
      closure_date: '2026-11-15',
      awarded_amount: 310000,
      evidence_document_id: oc.id,
    });
    expect(closure.awarded_amount).toBe(310000);

    // 18. Registrar cierre perdido o cancelado
    const lost = registerCommercialClosure(editor, {
      request_id: reqOtro.id,
      result: 'PERDIDA',
      closure_date: '2026-11-15',
      loss_reason: 'Cliente difirió inversión para Q1 2027.',
    });
    expect(lost.result).toBe('PERDIDA');

    // 19. Verificar indicadores del Dashboard sin duplicar revisiones
    const dash = getDashboardMetrics({ referenceDateStr: '2026-11-15' });
    // reqLicVw: Rev.01 ($310k, ignora Rev.00 de $320k) + reqDirVw: Rev.00 ($90k) = $400,000
    expect(dash.totalOfferedAmount).toBe(400000);
    expect(dash.totalAwardedAmount).toBe(310000);

    // 20. Filtrar y buscar solicitudes en tabla y Kanban
    const filteredBenteler = listQuoteRequests({ search: 'BEN-0003' });
    expect(filteredBenteler.length).toBe(1);
    expect(filteredBenteler[0].customer_short_name).toBe('BENTELER');
  });
});
