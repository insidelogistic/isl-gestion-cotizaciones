import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import {
  createCustomerContact,
  deleteCustomerContact,
  listCustomerContacts,
} from '@/lib/services/catalogService';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customer_id') || undefined;
  return NextResponse.json({ success: true, contacts: await listCustomerContacts(customerId) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const contact = await createCustomerContact(user, body);
    return NextResponse.json({ success: true, contact }, { status: 201 });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 403 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: err.issues.map((i) => i.message).join(' ') },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Error al crear contacto.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID de contacto requerido.' }, { status: 400 });
    }
    await deleteCustomerContact(user, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar contacto.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
