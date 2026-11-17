import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { listFollowUpCommitments } from '@/lib/services/followUpService';
import { getOperationalAlertsSummary } from '@/lib/services/notificationService';
import { AppShell } from '@/components/layout/AppShell';
import { SeguimientoClient } from '@/components/followups/SeguimientoClient';

export const dynamic = 'force-dynamic';

export default async function SeguimientoPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const commitments = listFollowUpCommitments({});
  const alerts = getOperationalAlertsSummary();

  return (
    <AppShell user={user} urgentCount={alerts.totalUrgentCount}>
      <SeguimientoClient
        commitments={commitments}
        expiringCount={alerts.expiringRequests.length}
        dueTodayCount={alerts.dueTodayFollowUps.length}
        overdueCount={alerts.overdueFollowUps.length}
        currentUser={user}
      />
    </AppShell>
  );
}
