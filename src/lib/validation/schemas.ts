import { z } from 'zod';

const BaseRequestFields = {
  project_name: z.string().trim().min(2, 'El nombre del proyecto es obligatorio.'),
  description: z.string().trim().min(1, 'La descripción del requerimiento es obligatoria.'),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de recepción es obligatoria (YYYY-MM-DD).'),
  deadline_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha límite inválido.')
    .optional()
    .nullable()
    .or(z.literal('')),
  responsible_user_id: z.string().trim().min(1, 'Debe asignar un responsable interno.'),
  observations: z.string().optional().nullable(),
};

// Origen A: Licitación Volkswagen
export const LicitacionVwSchema = z.object({
  origin_type: z.literal('LICITACION_VW'),
  ...BaseRequestFields,
  customer_id: z.string().optional().nullable(),
  vw_tender_number: z.string().trim().min(1, 'El número o referencia de licitación es obligatorio.'),
  vw_buyer_name: z.string().trim().min(2, 'El comprador responsable es obligatorio.'),
  deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha límite de presentación es obligatoria en licitaciones VWM.'),
  has_lastenheft: z.boolean().optional().default(false),
  has_economic_excel: z.boolean().optional().default(false),
});

// Origen B: Solicitud directa Volkswagen
export const DirectaVwSchema = z.object({
  origin_type: z.literal('DIRECTA_VW'),
  ...BaseRequestFields,
  customer_id: z.string().optional().nullable(),
  vw_department: z.string().trim().min(1, 'El departamento solicitante de Volkswagen es obligatorio.'),
  vw_requester_name: z.string().trim().min(2, 'El nombre del solicitante es obligatorio.'),
  contact_info: z.string().trim().min(2, 'El correo o teléfono del solicitante es obligatorio.'),
  reception_channel: z.string().trim().min(2, 'El medio por el que se recibió la solicitud es obligatorio.'),
});

// Origen C: Otro cliente
export const OtroClienteSchema = z.object({
  origin_type: z.literal('OTRO_CLIENTE'),
  ...BaseRequestFields,
  customer_id: z.string().trim().min(1, 'Debe seleccionar el cliente.'),
  contact_id: z.string().optional().nullable(),
  contact_name: z.string().trim().min(1, 'El nombre de contacto del cliente es obligatorio.'),
  contact_info: z.string().optional().nullable(),
  reception_channel: z.string().trim().min(2, 'El medio de recepción es obligatorio.'),
});

export const CreateQuoteRequestSchema = z.discriminatedUnion('origin_type', [
  LicitacionVwSchema,
  DirectaVwSchema,
  OtroClienteSchema,
]);

export type CreateQuoteRequestInput = z.infer<typeof CreateQuoteRequestSchema>;

export function validateCreateRequestInput(input: unknown) {
  return CreateQuoteRequestSchema.safeParse(input);
}

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre o razón social del cliente es obligatorio.'),
  short_name: z.string().trim().optional(),
  rfc: z.string().trim().optional().nullable(),
  plant_or_location: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  contact_name: z.string().trim().optional(),
  contact_position: z.string().trim().optional(),
  contact_email: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
});

export const CreateContactSchema = z.object({
  customer_id: z.string().trim().min(1, 'El cliente asociado es obligatorio.'),
  name: z.string().trim().min(2, 'El nombre completo del contacto es obligatorio.'),
  position: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  contact_type: z.enum(['COMPRADOR_VW', 'SOLICITANTE_VW', 'CONTACTO_EXTERNO']).optional().default('CONTACTO_EXTERNO'),
});

export const CreateUserSchema = z.object({
  employee_code: z.string().trim().min(3, 'El código de colaborador es obligatorio.'),
  name: z.string().trim().min(3, 'El nombre completo es obligatorio.'),
  email: z.string().trim().email('Correo electrónico inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  role: z.enum(['ADMIN', 'EDITOR', 'CONSULTA']),
  department: z.string().trim().min(2, 'El departamento es obligatorio.'),
});
