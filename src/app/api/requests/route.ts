import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { PermissionError } from '@/lib/auth/rbac';
import { createQuoteRequest, listQuoteRequests } from '@/lib/services/requestService';
import type { RequestStatus } from '@/lib/db/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requests = await listQuoteRequests({
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as RequestStatus | 'ALL') || 'ALL',
    customerId: searchParams.get('customer_id') || undefined,
    responsibleUserId: searchParams.get('responsible_id') || undefined,
    originType: searchParams.get('origin_type') || undefined,
    dateFrom: searchParams.get('date_from') || undefined,
    dateTo: searchParams.get('date_to') || undefined,
    sortBy: (searchParams.get('sort_by') as 'folio' | 'received_date' | 'deadline_date' | 'project_name') || 'folio',
    sortDir: (searchParams.get('sort_dir') as 'ASC' | 'DESC') || 'DESC',
  });

  return NextResponse.json({ success: true, requests });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const created = await createQuoteRequest(user, body);
    return NextResponse.json({ success: true, request: created }, { status: 201 });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 403 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: err.issues.map((i) => i.message).join(' '),
          issues: err.issues,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Error al registrar solicitud.' },
      { status: 500 }
    );
  }
}
