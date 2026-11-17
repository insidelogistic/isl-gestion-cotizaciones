import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  completeFollowUpActivity,
  rescheduleFollowUpActivity,
  cancelFollowUpReminder,
} from '@/lib/services/followUpService';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ activityId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const { activityId } = await context.params;
    const body = await request.json();
    const action = body.action as 'COMPLETE' | 'RESCHEDULE' | 'CANCEL';

    let updated;
    if (action === 'COMPLETE') {
      updated = await completeFollowUpActivity(user, activityId, body.comment);
    } else if (action === 'RESCHEDULE') {
      updated = await rescheduleFollowUpActivity(
        user,
        activityId,
        body.next_activity_date,
        body.next_activity_description
      );
    } else if (action === 'CANCEL') {
      updated = await cancelFollowUpReminder(user, activityId);
    } else {
      return NextResponse.json(
        { success: false, message: 'Acción sobre recordatorio no reconocida.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, activity: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar seguimiento.';
    const status = message.includes('permisos') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
