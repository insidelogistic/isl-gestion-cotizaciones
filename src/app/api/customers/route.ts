import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import { createCustomer, deleteCustomer, listCustomers } from '@/lib/services/catalogService';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  return NextResponse.json({ success: true, customers: await listCustomers() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const result = await createCustomer(user, body);
    return NextResponse.json({ success: true, customer: result }, { status: 201 });
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
      { success: false, message: err instanceof Error ? err.message : 'Error al crear cliente.' },
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
      return NextResponse.json({ success: false, message: 'ID de cliente requerido.' }, { status: 400 });
    }
    await deleteCustomer(user, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar cliente.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
