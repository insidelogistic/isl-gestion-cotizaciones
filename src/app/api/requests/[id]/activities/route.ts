import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import { registerFollowUpActivity, listFollowUpCommitments } from '@/lib/services/followUpService';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const activities = listFollowUpCommitments({ requestId: id });
  return NextResponse.json({ success: true, activities });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const activity = registerFollowUpActivity(user, {
      request_id: id,
      activity_type: body.activity_type || 'SEGUIMIENTO',
      activity_date: body.activity_date,
      responsible_user_id: body.responsible_user_id || user.id,
      description: body.description,
      next_activity_date: body.next_activity_date || null,
      next_activity_description: body.next_activity_description || null,
      associated_document_id: body.associated_document_id || null,
    });
    return NextResponse.json(
      { success: true, activityId: activity.id, activity },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Error al registrar seguimiento.',
      },
      { status: 400 }
    );
  }
}
