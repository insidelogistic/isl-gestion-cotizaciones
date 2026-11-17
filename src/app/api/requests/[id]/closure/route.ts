import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  getCommercialClosureByRequestId,
  registerCommercialClosure,
} from '@/lib/services/closureService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const closure = await getCommercialClosureByRequestId(id);
  return NextResponse.json({ success: true, closure });
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
    const closure = await registerCommercialClosure(user, {
      request_id: id,
      result: body.result,
      closure_date: body.closure_date,
      awarded_revision_id: body.awarded_revision_id || null,
      awarded_amount: body.awarded_amount !== undefined ? Number(body.awarded_amount) : null,
      awarded_currency: body.awarded_currency || body.currency || 'MXN',
      purchase_order_number: body.purchase_order_number || body.purchase_order_ref || null,
      loss_reason: body.loss_reason || null,
      comments: body.comments || null,
      evidence_document_id: body.evidence_document_id || null,
    });

    return NextResponse.json({ success: true, closure }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar cierre comercial.';
    const status = message.includes('permisos') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
