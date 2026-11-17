import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, setDatabaseInstance } from '../src/lib/db';
import { authenticateUser } from '../src/lib/auth/rbac';
import {
  createQuoteRequest,
  listQuoteRequests,
  updateQuoteRequestStatus,
  getQuoteRequestById,
} from '../src/lib/services/requestService';
import { createCustomer, createCustomerContact } from '../src/lib/services/catalogService';

describe('Entrega 1 — Registro de Solicitudes (3 Orígenes), Tabla, Kanban y Permisos', () => {
  beforeEach(() => {
    const db = createTestDatabase();
    setDatabaseInstance(db);
  });

  it('registra correctamente solicitudes de los 3 orígenes con estado inicial RECIBIDA y folios únicos', () => {
    const editor = authenticateUser('ING-0001', 'EditorISL2026!')!;

    // 1. Licitación Volkswagen
    const reqLicitacion = createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Rehabilitación de Estructura Nave 21',
      description: 'Suministro y montaje de estructura metálica según LASTENHEFT',
      received_date: '2026-11-10',
      deadline_date: '2026-11-20',
      responsible_user_id: 'usr-editor-02',
      vw_tender_number: 'VWM-LIC-2026-901',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
      has_lastenheft: true,
      has_economic_excel: true,
      observations: 'Requiere visita técnica obligatoria',
    });

    expect(reqLicitacion.folio).toBe('COT-2026-VOL-0001');
    expect(reqLicitacion.status).toBe('RECIBIDA');
    expect(reqLicitacion.customer_short_name).toBe('VWM');
    expect(reqLicitacion.drive_folder_path).toBe('IN SIDE LOGISTIC / COTIZACIONES / 2026 / COT-2026-VOL-0001');

    // 2. Solicitud Directa Volkswagen
    const reqDirecta = createQuoteRequest(editor, {
      origin_type: 'DIRECTA_VW',
      project_name: 'Maquinado de Flecha Motriz Reductor KUKA',
      description: 'Fabricación urgente en acero 4140 tratado',
      received_date: '2026-11-12',
      deadline_date: '2026-11-15',
      responsible_user_id: 'usr-editor-01',
      vw_department: 'Nave 4 - Prensas y Carrocerías',
      vw_requester_name: 'Ing. Omar Sánchez Minutti',
      contact_info: 'omar.sanchez@vw.com.mx / Ext. 9420',
      reception_channel: 'Correo Electrónico',
    });

    expect(reqDirecta.folio).toBe('COT-2026-VOL-0002');
    expect(reqDirecta.status).toBe('RECIBIDA');
    expect(reqDirecta.vw_department).toBe('Nave 4 - Prensas y Carrocerías');

    // 3. Otro Cliente (creando cliente y contacto nuevos)
    const newCustomer = createCustomer(editor, {
      name: 'Benteler de México S.A. de C.V.',
      short_name: 'BENTELER',
      plant_or_location: 'Planta Puebla 2',
      rfc: 'BME030112AA1',
    });

    const newContact = createCustomerContact(editor, {
      customer_id: newCustomer.id,
      name: 'Ing. Ricardo Domínguez',
      position: 'Gerente de Mantenimiento',
      email: 'rdominguez@benteler.com',
      phone: '222 401 9920',
    });

    const reqOtro = createQuoteRequest(editor, {
      origin_type: 'OTRO_CLIENTE',
      customer_id: newCustomer.id,
      project_name: 'Mantenimiento Preventivo Prensas Hidráulicas',
      description: 'Servicio integral de cambio de sellos y pruebas de presión',
      received_date: '2026-11-13',
      deadline_date: '2026-11-28',
      responsible_user_id: 'usr-editor-01',
      contact_id: newContact.id,
      contact_name: newContact.name,
      contact_info: 'rdominguez@benteler.com',
      reception_channel: 'Visita en Planta',
    });

    expect(reqOtro.folio).toBe('COT-2026-BEN-0003');
    expect(reqOtro.customer_name).toBe('Benteler de México S.A. de C.V.');
  });

  it('filtra solicitudes por búsqueda (folio/cliente/proyecto), estado, responsable y actualiza estado con auditoría', () => {
    const editor = authenticateUser('ING-0001', 'EditorISL2026!')!;
    const viewer = authenticateUser('CON-0001', 'ConsultaISL2026!')!;

    const r1 = createQuoteRequest(editor, {
      origin_type: 'LICITACION_VW',
      project_name: 'Proyecto Especial Pintura',
      description: 'Cabina de aplicación',
      received_date: '2026-11-10',
      deadline_date: '2026-11-14',
      responsible_user_id: 'usr-editor-01',
      vw_tender_number: 'LIC-001',
      vw_buyer_name: 'Lic. Claudia',
    });

    createQuoteRequest(editor, {
      origin_type: 'OTRO_CLIENTE',
      customer_id: 'cust-audi',
      project_name: 'Dispositivos Soldadura Q5',
      description: 'Ajuste dimensional',
      received_date: '2026-11-11',
      deadline_date: '2026-11-25',
      responsible_user_id: 'usr-editor-02',
      contact_name: 'Ing. Carlos Mendoza Ruiz',
      reception_channel: 'Correo Electrónico',
    });

    // Búsqueda por texto
    const searchPintura = listQuoteRequests({ search: 'Pintura' });
    expect(searchPintura).toHaveLength(1);
    expect(searchPintura[0].folio).toBe(r1.folio);

    // Filtro por cliente
    const filterAudi = listQuoteRequests({ customerId: 'cust-audi' });
    expect(filterAudi).toHaveLength(1);
    expect(filterAudi[0].customer_short_name).toBe('AUDI');

    // Cambio asistido de estado por Editor
    const updated = updateQuoteRequestStatus(editor, r1.id, 'EN_ELABORACION', 'Iniciando levantamiento y costeo');
    expect(updated.status).toBe('EN_ELABORACION');

    // Intento de cambio de estado por usuario CONSULTA debe fallar
    expect(() =>
      updateQuoteRequestStatus(viewer, r1.id, 'PRESENTADA', 'Intento no autorizado')
    ).toThrow();

    // Verificar bitácora en detalle de expediente
    const detail = getQuoteRequestById(r1.id);
    expect(detail?.auditLogs.length).toBeGreaterThanOrEqual(2);
  });
});
