import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import { updateQuoteRequestStatus } from '@/lib/services/requestService';
import type { RequestStatus } from '@/lib/db/types';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status: RequestStatus; comment?: string };
    const updated = updateQuoteRequestStatus(user, id, body.status, body.comment);
    return NextResponse.json({ success: true, request: updated });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Error al actualizar estado.' },
      { status: 500 }
    );
  }
}
