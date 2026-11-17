import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { markQuoteRevisionAsPresented } from '@/lib/services/quoteService';

export async function POST(
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
    const result = await markQuoteRevisionAsPresented(user, {
      revision_id: revisionId,
      presentation_date: body.presentation_date,
      presentation_channel: body.presentation_channel,
      follow_up_business_days: body.follow_up_business_days,
      custom_follow_up_date: body.custom_follow_up_date || null,
      evidence_document_id: body.evidence_document_id || null,
      notes: body.notes || null,
    });

    return NextResponse.json({
      success: true,
      revision: result.revision,
      followUpDate: result.proposedFollowUpDate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al marcar la cotización como presentada.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
