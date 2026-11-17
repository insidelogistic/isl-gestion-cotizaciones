import crypto from 'node:crypto';
import { getAsyncDb, nowMexicoISO, todayMexicoDate } from '../db';
import { listQuoteRequests } from './requestService';
import { listFollowUpCommitments } from './followUpService';
import type { SafeUser } from '../db/types';

export interface InternalEmailNotification {
  id: string;
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  dispatchedAt: string;
  transportMode: 'RESEND_API' | 'INTERNAL_MAILBOX_VAULT';
}

export async function getOperationalAlertsSummary(referenceDateStr?: string) {
  const refDate = referenceDateStr ?? todayMexicoDate();
  const requests = await listQuoteRequests({});

  const expiringRequests = requests.filter(
    (r) =>
      r.status !== 'CERRADA' &&
      (r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA')
  );

  const commitments = await listFollowUpCommitments({
    onlyPending: true,
    referenceDateStr: refDate,
  });

  const dueTodayFollowUps = commitments.filter((c) => c.urgency === 'HOY');
  const overdueFollowUps = commitments.filter((c) => c.urgency === 'VENCIDO');
  const upcomingFollowUps = commitments.filter((c) => c.urgency === 'PROXIMO');

  return {
    referenceDate: refDate,
    expiringRequests,
    dueTodayFollowUps,
    overdueFollowUps,
    upcomingFollowUps,
    totalUrgentCount:
      expiringRequests.length + dueTodayFollowUps.length + overdueFollowUps.length,
  };
}

export async function dispatchInternalAlertEmails(
  actor: SafeUser,
  referenceDateStr?: string
): Promise<{
  dispatchedCount: number;
  emails: InternalEmailNotification[];
}> {
  const db = await getAsyncDb();
  const now = nowMexicoISO();
  const summary = await getOperationalAlertsSummary(referenceDateStr);

  const internalUsers = await db.all<{ id: string; name: string; email: string; role: string }>(
    `SELECT id, name, email, role
     FROM users
     WHERE is_active = 1 AND role IN ('ADMIN', 'EDITOR')`
  );

  const emails: InternalEmailNotification[] = [];

  for (const u of internalUsers) {
    if (!u.email.toLowerCase().endsWith('@insidelogistic.com.mx')) {
      continue;
    }

    const userExpiring = summary.expiringRequests.filter(
      (r) => u.role === 'ADMIN' || r.responsible_user_id === u.id
    );
    const userDueToday = summary.dueTodayFollowUps.filter(
      (c) => u.role === 'ADMIN' || c.responsible_user_id === u.id
    );
    const userOverdue = summary.overdueFollowUps.filter(
      (c) => u.role === 'ADMIN' || c.responsible_user_id === u.id
    );

    const subject = `[IN SIDE LOGISTIC] Resumen de Alertas Comerciales (${summary.referenceDate}) — ${
      userExpiring.length + userDueToday.length + userOverdue.length
    } pendientes`;

    const bodyLines = [
      `Hola ${u.name},`,
      '',
      `Resumen interno de seguimiento de cotizaciones al ${summary.referenceDate}:`,
      `- Solicitudes por vencer / vencidas: ${userExpiring.length}`,
      `- Seguimientos programados para hoy: ${userDueToday.length}`,
      `- Seguimientos vencidos: ${userOverdue.length}`,
      '',
      ...userExpiring.map(
        (r) =>
          `  • [FECHA LÍMITE ${r.deadline_date}] ${r.folio} — ${r.customer_short_name}: ${r.project_name}`
      ),
      ...userOverdue.map(
        (c) =>
          `  • [SEGUIMIENTO VENCIDO ${c.next_activity_date}] ${c.folio}: ${
            c.next_activity_description || c.description
          }`
      ),
      ...userDueToday.map(
        (c) =>
          `  • [PARA HOY ${c.next_activity_date}] ${c.folio}: ${
            c.next_activity_description || c.description
          }`
      ),
      '',
      'Aviso interno generado por IN SIDE LOGISTIC | Gestión de Cotizaciones.',
    ];

    const notification: InternalEmailNotification = {
      id: `mail-${crypto.randomUUID().slice(0, 8)}`,
      to: u.email,
      recipientName: u.name,
      subject,
      body: bodyLines.join('\n'),
      dispatchedAt: now,
      transportMode: process.env.RESEND_API_KEY ? 'RESEND_API' : 'INTERNAL_MAILBOX_VAULT',
    };

    emails.push(notification);
  }

  await db.run(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, details_json, created_at)
     VALUES (?, 'NOTIFICATION', ?, 'NOTIFICACION_INTERNA_CORREO', ?, ?, ?)`,
    crypto.randomUUID(),
    'ALERTAS_INTERNAS',
    actor.id,
    JSON.stringify({
      reference_date: summary.referenceDate,
      dispatched_count: emails.length,
      recipients: emails.map((e) => e.to),
    }),
    now
  );

  return {
    dispatchedCount: emails.length,
    emails,
  };
}
