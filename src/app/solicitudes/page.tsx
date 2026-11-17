import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { listCustomers, listUsers } from '@/lib/services/catalogService';
import { listQuoteRequests } from '@/lib/services/requestService';
import { AppShell } from '@/components/layout/AppShell';
import { RequestsViewClient } from '@/components/requests/RequestsViewClient';

export const dynamic = 'force-dynamic';

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const sp = await searchParams;
  const requests = listQuoteRequests({});
  const customers = listCustomers();
  const users = listUsers();
  const urgentCount = requests.filter(
    (r) => r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA'
  ).length;

  return (
    <AppShell user={user} urgentCount={urgentCount}>
      <RequestsViewClient
        initialRequests={requests}
        customers={customers}
        users={users}
        currentUser={user}
        initialSearch={sp.search || ''}
      />
    </AppShell>
  );
}
