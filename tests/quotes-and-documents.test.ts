import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, setDatabaseInstance } from '../src/lib/db';
import { authenticateUser, PermissionError } from '../src/lib/auth/rbac';
import { createQuoteRequest, getQuoteRequestById, listQuoteRequests } from '../src/lib/services/requestService';
import {
  addBusinessDays,
  createQuoteRevision,
  updateDraftQuoteRevision,
  markQuoteRevisionAsPresented,
} from '../src/lib/services/quoteService';
import {
  uploadExpedienteDocument,
  listExpedienteDocuments,
} from '../src/lib/services/documentService';

describe('Entrega 2 — Cotizaciones (Modalidad A y B), Revisiones Inmutables y Gestión Documental', () => {
  beforeEach(() => {
    const db = createTestDatabase();
    setDatabaseInstance(db);
  });

  it('calcula correctamente 3 días hábiles saltando fines de semana', () => {
    // Viernes 2026-11-13 + 3 días hábiles -> Miércoles 2026-11-18
    expect(addBusinessDays('2026-11-13', 3)).toBe('2026-11-18');
    // Lunes 2026-11-16 + 3 días hábiles -> Jueves 2026-11-19
    expect(addBusinessDays('2026-11-16', 3)).toBe('2026-11-19');
  });

  it('registra Cotización Modalidad A (interna con conceptos), calcula subtotal/IVA/total y genera Rev. 00', async () => {
    const editor = (await authenticateUser('ING-0001', 'EditorISL2026!'))!;
    const req = await createQuoteRequest(editor, {
      origin_type: 'DIRECTA_VW',
      project_name: 'Maquinado de Soportes Especiales Nave 4',
      description: 'Fabricación en acero 1045',
      received_date: '2026-11-13',
      deadline_date: '2026-11-20',
      responsible_user_id: editor.id,
      vw_department: 'Nave 4 - Prensas',
      vw_requester_name: 'Ing. Omar Sánchez Minutti',
      contact_info: 'omar.sanchez@vw.com.mx',
      reception_channel: 'Correo Electrónico',
    });

    const rev00 = await createQuoteRevision(editor, {
      request_id: req.id,
      modality: 'INTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-13',
      tax_rate: 16,
      observations: 'Incluye material certificado y entrega en planta VWM',
      items: [
        {
          concept: 'Maquinado CNC de soporte principal según plano',
          unit: 'PZA',
          quantity: 4,
          unit_price: 12500.5,
        },
        {
          concept: 'Tratamiento térmico y rectificado de precisión',
          unit: 'SERV',
          quantity: 1,
          unit_price: 15000,
        },
      ],
    });

    expect(rev00.revision_code).toBe('Rev. 00');
    expect(rev00.subtotal).toBe(65002); // (4 * 12500.50) + 15000 = 50002 + 15000 = 65002
    expect(rev00.tax_amount).toBe(10400.32); // 16% de 65002
    expect(rev00.total).toBe(75402.32);
    expect(rev00.is_immutable).toBe(0);
    expect(rev00.items).toHaveLength(2);
  });

  it('registra Cotización Modalidad B (elaborada externamente en Excel) sin exigir conceptos y vincula documento', async () => {
    const editor = (await authenticateUser('ING-0002', 'EditorISL2026!'))!;
    const req = await createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Licitación Anual Mantenimiento Transportadores',
      description: 'Según LASTENHEFT y estructura económica VWM',
      received_date: '2026-11-13',
      deadline_date: '2026-11-25',
      responsible_user_id: editor.id,
      vw_tender_number: 'LIC-VWM-2026-7710',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
      has_lastenheft: true,
      has_economic_excel: true,
    });

    const docExcel = await uploadExpedienteDocument(editor, {
      request_id: req.id,
      category: 'COTIZACION',
      original_name: 'Estructura_Economica_VWM_7710.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content_base64: Buffer.from('Excel Contenido Simulado').toString('base64'),
    });

    const rev00 = await createQuoteRevision(editor, {
      request_id: req.id,
      modality: 'EXTERNAL',
      currency: 'USD',
      issue_date: '2026-11-13',
      subtotal: 148500.0,
      tax_rate: 16,
      observations: 'Estructura económica llenada en plantilla oficial de compras VWM',
      associated_document_id: docExcel.id,
    });

    expect(rev00.revision_code).toBe('Rev. 00');
    expect(rev00.modality).toBe('EXTERNAL');
    expect(rev00.currency).toBe('USD');
    expect(rev00.subtotal).toBe(148500);
    expect(rev00.total).toBe(172260);
    expect(rev00.items).toHaveLength(0);

    const docs = await listExpedienteDocuments(req.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].revision_id).toBe(rev00.id);
    expect(docs[0].drive_folder_path).toContain(req.folio);
  });

  it('marca una revisión como PRESENTADA, la vuelve inmutable, propone seguimiento a 3 días hábiles y permite crear Rev. 01 sin sobrescribir Rev. 00 ni duplicar importes', async () => {
    const editor = (await authenticateUser('ING-0001', 'EditorISL2026!'))!;
    const req = await createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Adecuación de Tolvas Nave 21',
      description: 'Suministro e instalación',
      received_date: '2026-11-13',
      deadline_date: '2026-11-28',
      responsible_user_id: editor.id,
      vw_tender_number: 'LIC-2026-501',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
    });

    const rev00 = await createQuoteRevision(editor, {
      request_id: req.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-13',
      subtotal: 250000,
      tax_rate: 16,
      observations: 'Oferta inicial Rev. 00',
    });

    // Marcar Rev. 00 como presentada el viernes 2026-11-13
    const presentationResult = await markQuoteRevisionAsPresented(editor, {
      revision_id: rev00.id,
      presentation_date: '2026-11-13',
      presentation_channel: 'Plataforma Volkswagen',
      follow_up_business_days: 3,
      notes: 'Cargada en portal B2B de Volkswagen con acuse #9912',
    });

    expect(presentationResult.revision.status).toBe('PRESENTADA');
    expect(presentationResult.revision.is_immutable).toBe(1);
    expect(presentationResult.proposedFollowUpDate).toBe('2026-11-18');

    // Verificar que el expediente pasó a PRESENTADA
    const updatedDetail = (await getQuoteRequestById(req.id))!;
    expect(updatedDetail.request.status).toBe('PRESENTADA');
    expect(updatedDetail.request.next_activity_date).toBe('2026-11-18');

    // Intentar modificar Rev. 00 presentada debe fallar por inmutabilidad
    await expect(
      updateDraftQuoteRevision(editor, rev00.id, {
        currency: 'MXN',
        issue_date: '2026-11-14',
        subtotal: 190000,
        tax_rate: 16,
        observations: 'Intento de sobrescribir oferta presentada',
      })
    ).rejects.toThrow(/inmutable/i);

    // Crear nueva revisión Rev. 01 con ajuste económico
    const rev01 = await createQuoteRevision(editor, {
      request_id: req.id,
      modality: 'EXTERNAL',
      currency: 'MXN',
      issue_date: '2026-11-15',
      subtotal: 235000,
      tax_rate: 16,
      observations: 'Rev. 01 con descuento comercial tras negociación',
    });

    expect(rev01.revision_code).toBe('Rev. 01');
    expect(rev01.subtotal).toBe(235000);

    // Presentar Rev. 01
    await markQuoteRevisionAsPresented(editor, {
      revision_id: rev01.id,
      presentation_date: '2026-11-16',
      presentation_channel: 'Correo electrónico',
      follow_up_business_days: 3,
    });

    // Verificar que existen ambas revisiones (Rev. 00 intacta con 250,000 y Rev. 01 con 235,000)
    // y que el importe ofertado vigente del expediente es 235,000 (NO la suma 485,000)
    const afterRev01 = (await getQuoteRequestById(req.id))!;
    expect(afterRev01.revisions).toHaveLength(2);

    const listed = await listQuoteRequests({ search: req.folio });
    expect(listed[0].latest_offered_amount).toBe(235000);
    expect(listed[0].latest_revision_code).toBe('Rev. 01');
  });

  it('impide que un usuario con rol CONSULTA cree cotizaciones o suba documentos', async () => {
    const editor = (await authenticateUser('ING-0001', 'EditorISL2026!'))!;
    const viewer = (await authenticateUser('CON-0001', 'ConsultaISL2026!'))!;

    const req = await createQuoteRequest(editor, {
      origin_type: 'OTRO_CLIENTE',
      customer_id: 'cust-audi',
      project_name: 'Reparación de husillo',
      description: 'Rectificado de precisión',
      received_date: '2026-11-13',
      responsible_user_id: editor.id,
      contact_name: 'Ing. Carlos Mendoza',
      reception_channel: 'Correo Electrónico',
    });

    await expect(
      createQuoteRevision(viewer, {
        request_id: req.id,
        modality: 'EXTERNAL',
        currency: 'MXN',
        issue_date: '2026-11-13',
        subtotal: 50000,
        tax_rate: 16,
      })
    ).rejects.toThrow(PermissionError);

    await expect(
      uploadExpedienteDocument(viewer, {
        request_id: req.id,
        category: 'SOLICITUD',
        original_name: 'Plano.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('PDF').toString('base64'),
      })
    ).rejects.toThrow(PermissionError);
  });
});
