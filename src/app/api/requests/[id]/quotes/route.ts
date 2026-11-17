import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createQuoteRevision, listQuoteRevisions } from '@/lib/services/quoteService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const revisions = listQuoteRevisions(id);
  return NextResponse.json({ success: true, revisions });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const created = createQuoteRevision(user, {
      request_id: id,
      modality: body.modality,
      currency: body.currency || 'MXN',
      issue_date: body.issue_date || body.quote_date,
      tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 16,
      subtotal: body.subtotal !== undefined ? Number(body.subtotal) : undefined,
      observations: body.observations ?? body.notes ?? null,
      associated_document_id: body.associated_document_id ?? body.external_document_id ?? null,
      items: Array.isArray(body.items)
        ? body.items.map((it: Record<string, unknown>) => ({
            concept: String(it.concept || it.description || ''),
            unit: String(it.unit || 'Servicio'),
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
          }))
        : undefined,
    });

    return NextResponse.json({ success: true, revision: created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear la revisión de cotización.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
