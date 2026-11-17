import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { listCustomerContacts, listCustomers, listUsers } from '@/lib/services/catalogService';
import { AppShell } from '@/components/layout/AppShell';
import { CatalogsClient } from '@/components/catalogs/CatalogsClient';

export const dynamic = 'force-dynamic';

export default async function CatalogosPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const customers = listCustomers();
  const contacts = listCustomerContacts();
  const users = listUsers();

  return (
    <AppShell user={user}>
      <CatalogsClient
        initialCustomers={customers}
        initialContacts={contacts}
        initialUsers={users}
        currentUser={user}
      />
    </AppShell>
  );
}
