import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, setDatabaseInstance } from '../src/lib/db';
import { generateNextFolio } from '../src/lib/services/folioService';
import { authenticateUser, assertPermission, PermissionError } from '../src/lib/auth/rbac';
import { validateCreateRequestInput } from '../src/lib/validation/schemas';

describe('Entrega 1 — Folios Automáticos, Autenticación y Permisos (RBAC)', () => {
  beforeEach(() => {
    const db = createTestDatabase();
    setDatabaseInstance(db);
  });

  it('genera folios internos únicos secuenciales por año con las 3 primeras letras de la empresa (COT-YYYY-EMP-NNNN)', async () => {
    const f1 = await generateNextFolio(2026, 'Volkswagen de México S.A. de C.V.');
    const f2 = await generateNextFolio(2026, 'Audi México S.A. de C.V.');
    const f3 = await generateNextFolio(2027, 'Gestamp Puebla S.A. de C.V.');

    expect(f1).toBe('COT-2026-VOL-0001');
    expect(f2).toBe('COT-2026-AUD-0002');
    expect(f3).toBe('COT-2027-GES-0001');
  });

  it('autentica usuarios autorizados por correo o código de empleado y rechaza credenciales inválidas', async () => {
    const admin = await authenticateUser('DIR-0001', 'AdminISL2026!');
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('ADMIN');

    const editor = await authenticateUser('cotizaciones@insidelogistic.com.mx', 'EditorISL2026!');
    expect(editor).not.toBeNull();
    expect(editor?.role).toBe('EDITOR');

    const invalid = await authenticateUser('DIR-0001', 'WrongPass');
    expect(invalid).toBeNull();
  });

  it('restringe acciones según rol: CONSULTA no puede modificar datos y EDITOR no puede administrar usuarios', async () => {
    const admin = (await authenticateUser('DIR-0001', 'AdminISL2026!'))!;
    const editor = (await authenticateUser('ING-0001', 'EditorISL2026!'))!;
    const viewer = (await authenticateUser('CON-0001', 'ConsultaISL2026!'))!;

    expect(() => assertPermission(admin, 'MANAGE_USERS')).not.toThrow();
    expect(() => assertPermission(editor, 'CREATE_REQUEST')).not.toThrow();
    expect(() => assertPermission(editor, 'MANAGE_USERS')).toThrow(PermissionError);
    expect(() => assertPermission(viewer, 'CREATE_REQUEST')).toThrow(PermissionError);
    expect(() => assertPermission(viewer, 'UPDATE_REQUEST')).toThrow(PermissionError);
    expect(() => assertPermission(viewer, 'VIEW_REQUESTS')).not.toThrow();
  });

  it('valida los campos obligatorios específicos según el origen seleccionado (A, B o C)', () => {
    // Origen A: Licitación Volkswagen sin número de licitación debe fallar
    const invalidLicitacion = validateCreateRequestInput({
      origin_type: 'LICITACION_VW',
      project_name: 'Maquinado de dispositivos Nave 4',
      description: 'Fabricación según planos adjuntos',
      received_date: '2026-11-13',
      responsible_user_id: 'usr-editor-01',
    });
    expect(invalidLicitacion.success).toBe(false);

    // Origen A válido
    const validLicitacion = validateCreateRequestInput({
      origin_type: 'LICITACION_VW',
      vw_tender_number: 'LIC-VWM-2026-8841',
      vw_buyer_name: 'Lic. Claudia Von Der Meden',
      deadline_date: '2026-11-25',
      has_lastenheft: true,
      has_economic_excel: true,
      project_name: 'Maquinado de dispositivos Nave 4',
      description: 'Fabricación según LASTENHEFT VWM',
      received_date: '2026-11-13',
      responsible_user_id: 'usr-editor-01',
    });
    expect(validLicitacion.success).toBe(true);

    // Origen B: Solicitud directa Volkswagen sin departamento o solicitante debe fallar
    const invalidDirecta = validateCreateRequestInput({
      origin_type: 'DIRECTA_VW',
      project_name: 'Reparación urgente transportador',
      description: 'Cambio de rodillos y alineación',
      received_date: '2026-11-13',
      responsible_user_id: 'usr-editor-01',
    });
    expect(invalidDirecta.success).toBe(false);
  });
});
