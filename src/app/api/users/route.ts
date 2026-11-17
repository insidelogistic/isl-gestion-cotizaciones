import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import { createUser, deleteUser, listUsers } from '@/lib/services/catalogService';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  return NextResponse.json({ success: true, users: await listUsers() });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const created = await createUser(user, body);
    return NextResponse.json({ success: true, user: created }, { status: 201 });
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
      { success: false, message: err instanceof Error ? err.message : 'Error al registrar usuario.' },
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
      return NextResponse.json({ success: false, message: 'ID de usuario requerido.' }, { status: 400 });
    }
    await deleteUser(user, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar usuario.';
    const status = message.includes('Acceso denegado') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
