import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/rbac';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
    };

    const user =
      body.login && body.password
        ? await authenticateUser(body.login, body.password)
        : null;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Credenciales inválidas o usuario no autorizado en IN SIDE LOGISTIC.',
        },
        { status: 401 }
      );
    }

    const token = createSessionToken(user.id);
    const response = NextResponse.json({
      success: true,
      user,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Error al iniciar sesión.',
      },
      { status: 500 }
    );
  }
}
