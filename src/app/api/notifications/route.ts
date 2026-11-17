import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  getOperationalAlertsSummary,
  dispatchInternalAlertEmails,
} from '@/lib/services/notificationService';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const summary = await getOperationalAlertsSummary();
  return NextResponse.json({ success: true, summary });
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
    }

    const result = await dispatchInternalAlertEmails(user);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al despachar avisos internos.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
