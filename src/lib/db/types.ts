export type UserRole = 'ADMIN' | 'EDITOR' | 'CONSULTA';

export type OriginType = 'LICITACION_VW' | 'DIRECTA_VW' | 'OTRO_CLIENTE';

export type RequestStatus =
  | 'RECIBIDA'
  | 'EN_ELABORACION'
  | 'PRESENTADA'
  | 'EN_NEGOCIACION'
  | 'CERRADA';

export type ContactType = 'COMPRADOR_VW' | 'SOLICITANTE_VW' | 'CONTACTO_EXTERNO';

export type CurrencyCode = 'MXN' | 'USD' | 'EUR';

export type QuoteModality = 'INTERNAL' | 'EXTERNAL';

export type PresentationChannel = 'PLATAFORMA_VW' | 'CORREO' | 'ENTREGA_DIRECTA' | 'OTRO';

export type DocumentCategory =
  | 'SOLICITUD'
  | 'LASTENHEFT'
  | 'ESTRUCTURA_ECONOMICA'
  | 'COTIZACION'
  | 'EVIDENCIA_ENTREGA'
  | 'SEGUIMIENTO'
  | 'EVIDENCIA_ADJUDICACION'
  | 'ORDEN_COMPRA'
  | 'OTRO';

export interface UserRecord {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SafeUser {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  is_active: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  short_name: string;
  rfc: string | null;
  plant_or_location: string | null;
  address: string | null;
  is_vw: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContactRecord {
  id: string;
  customer_id: string;
  name: string;
  position: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  contact_type: ContactType;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_short_name?: string;
}

export interface QuoteRequestRecord {
  id: string;
  folio: string;
  origin_type: OriginType;
  customer_id: string;
  project_name: string;
  description: string;
  received_date: string;
  deadline_date: string | null;
  responsible_user_id: string;
  status: RequestStatus;
  observations: string | null;

  // Origen A: Licitación Volkswagen
  vw_tender_number: string | null;
  vw_buyer_name: string | null;
  has_lastenheft: number;
  has_economic_excel: number;

  // Origen B: Solicitud Directa Volkswagen
  vw_department: string | null;
  vw_requester_name: string | null;

  // Origen B y C: Contacto y Medio
  contact_id: string | null;
  contact_name: string | null;
  contact_info: string | null;
  reception_channel: string | null;

  // Google Drive
  drive_folder_id: string | null;
  drive_folder_path: string | null;

  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnrichedQuoteRequest extends QuoteRequestRecord {
  customer_name: string;
  customer_short_name: string;
  responsible_name: string;
  responsible_code: string;
  latest_offered_amount: number | null;
  latest_offered_currency: string | null;
  latest_revision_code: string | null;
  next_activity_date: string | null;
  next_activity_description: string | null;
  next_activity_type: string | null;
  deadline_semaphore: 'VENCIDA' | 'POR_VENCER' | 'EN_TIEMPO' | 'SIN_FECHA' | 'CERRADA';
  days_until_deadline: number | null;
}

export interface AuditLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string;
  actor_name?: string;
  details_json: string | null;
  created_at: string;
}
