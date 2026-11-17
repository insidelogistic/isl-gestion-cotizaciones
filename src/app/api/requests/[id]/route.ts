import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  deleteQuoteRequest,
  getQuoteRequestById,
  updateQuoteRequestDetails,
} from '@/lib/services/requestService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const detail = getQuoteRequestById(id);
  if (!detail) {
    return NextResponse.json({ success: false, message: 'Expediente no encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...detail });
}

export async function PATCH(
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
    const updated = updateQuoteRequestDetails(user, id, body);
    return NextResponse.json({ success: true, request: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar el expediente.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { id } = await context.params;
    deleteQuoteRequest(user, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar el expediente.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
