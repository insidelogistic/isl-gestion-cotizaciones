import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  deleteQuoteRevision,
  getQuoteRevisionById,
  updateDraftQuoteRevision,
} from '@/lib/services/quoteService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ revisionId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { revisionId } = await context.params;
  const revision = getQuoteRevisionById(revisionId);
  if (!revision) {
    return NextResponse.json({ success: false, message: 'Revisión no encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, revision });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ revisionId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { revisionId } = await context.params;
    const body = await request.json();
    const updated = updateDraftQuoteRevision(user, revisionId, {
      currency: body.currency || 'MXN',
      issue_date: body.issue_date || body.quote_date,
      tax_rate: body.tax_rate !== undefined ? Number(body.tax_rate) : 16,
      subtotal: body.subtotal !== undefined ? Number(body.subtotal) : undefined,
      observations: body.observations ?? body.notes ?? null,
      items: Array.isArray(body.items)
        ? body.items.map((it: Record<string, unknown>) => ({
            concept: String(it.concept || it.description || ''),
            unit: String(it.unit || 'Servicio'),
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
          }))
        : undefined,
    });
    return NextResponse.json({ success: true, revision: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar la revisión.';
    const status = message.includes('inmutable') ? 409 : message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ revisionId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { revisionId } = await context.params;
    deleteQuoteRevision(user, revisionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar la revisión.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
