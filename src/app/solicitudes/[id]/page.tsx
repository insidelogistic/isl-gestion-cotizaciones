import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { getQuoteRequestById, listQuoteRequests } from '@/lib/services/requestService';
import { listUsers } from '@/lib/services/catalogService';
import { AppShell } from '@/components/layout/AppShell';
import { ExpedienteClient } from '@/components/requests/ExpedienteClient';

export const dynamic = 'force-dynamic';

export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const sp = await searchParams;
  const detail = getQuoteRequestById(id);
  if (!detail) {
    notFound();
  }

  const requests = listQuoteRequests({});
  const users = listUsers();
  const urgentCount = requests.filter(
    (r) => r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA'
  ).length;

  return (
    <AppShell user={user} urgentCount={urgentCount}>
      <ExpedienteClient
        request={detail.request}
        revisions={detail.revisions}
        activities={detail.activities as Array<Record<string, unknown>>}
        documents={detail.documents}
        closure={detail.closure as Record<string, unknown> | undefined}
        auditLogs={detail.auditLogs}
        users={users}
        currentUser={user}
        initialTab={sp.tab || 'datos'}
      />
    </AppShell>
  );
}
