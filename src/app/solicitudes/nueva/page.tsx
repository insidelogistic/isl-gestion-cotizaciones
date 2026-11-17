import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { todayMexicoDate } from '@/lib/db';
import { listCustomerContacts, listCustomers, listUsers } from '@/lib/services/catalogService';
import { listQuoteRequests } from '@/lib/services/requestService';
import { AppShell } from '@/components/layout/AppShell';
import { DynamicRequestForm } from '@/components/requests/DynamicRequestForm';

export const dynamic = 'force-dynamic';

export default async function NuevaSolicitudPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  if (user.role === 'CONSULTA') {
    redirect('/solicitudes');
  }

  const customers = await listCustomers();
  const contacts = await listCustomerContacts();
  const users = await listUsers();
  const requests = await listQuoteRequests({});
  const urgentCount = requests.filter(
    (r) => r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA'
  ).length;

  return (
    <AppShell user={user} urgentCount={urgentCount}>
      <DynamicRequestForm
        customers={customers}
        contacts={contacts}
        users={users}
        currentUser={user}
        defaultDate={todayMexicoDate()}
      />
    </AppShell>
  );
}
