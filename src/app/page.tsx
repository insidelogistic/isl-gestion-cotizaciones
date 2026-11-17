import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { getDashboardMetrics } from '@/lib/services/dashboardService';
import { listCustomers, listUsers } from '@/lib/services/catalogService';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
    responsibleUserId?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const sp = await searchParams;
  const metrics = getDashboardMetrics({
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    customerId: sp.customerId,
    responsibleUserId: sp.responsibleUserId,
  });

  const customers = listCustomers();
  const users = listUsers();

  return (
    <AppShell
      user={user}
      urgentCount={metrics.expiringQuotesCount + metrics.overdueFollowUpsCount}
    >
      <DashboardClient
        metrics={metrics}
        customers={customers}
        users={users}
        initialFilters={{
          dateFrom: sp.dateFrom || '',
          dateTo: sp.dateTo || '',
          customerId: sp.customerId || 'ALL',
          responsibleUserId: sp.responsibleUserId || 'ALL',
        }}
        currentUser={user}
      />
    </AppShell>
  );
}
