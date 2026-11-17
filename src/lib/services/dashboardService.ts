import { getAsyncDb, todayMexicoDate } from '../db';
import { listQuoteRequests, computeDeadlineSemaphore } from './requestService';
import { listFollowUpCommitments } from './followUpService';
import type { EnrichedQuoteRequest, RequestStatus } from '../db/types';

export interface DashboardFilterOptions {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  responsibleUserId?: string;
  referenceDateStr?: string;
}

export interface DashboardMetrics {
  activeRequestsCount: number;
  presentedQuotesCount: number;
  totalOfferedAmount: number;
  totalAwardedAmount: number;
  expiringQuotesCount: number;
  pendingFollowUpsCount: number;
  overdueFollowUpsCount: number;
  closedCount: number;
  stageCounts: Record<RequestStatus, number>;
  closureResultCounts: Record<string, number>;
  upcomingCommitments: Array<{
    id: string;
    request_id: string;
    folio: string;
    project_name: string;
    customer_short_name: string;
    responsible_name: string;
    next_activity_date: string;
    activity: string;
    urgency: string;
  }>;
  filteredRequests: EnrichedQuoteRequest[];
}

export async function getDashboardMetrics(
  filters: DashboardFilterOptions = {}
): Promise<DashboardMetrics> {
  const db = await getAsyncDb();
  const refDate = filters.referenceDateStr ?? todayMexicoDate();

  const rawRequests = await listQuoteRequests({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    customerId: filters.customerId,
    responsibleUserId: filters.responsibleUserId,
  });

  const requests = rawRequests.map((r) => {
    const { semaphore, daysUntil } = computeDeadlineSemaphore(r.deadline_date, r.status, refDate);
    return {
      ...r,
      deadline_semaphore: semaphore,
      days_until_deadline: daysUntil,
    };
  });

  const requestIds = new Set(requests.map((r) => r.id));

  const activeRequestsCount = requests.filter((r) => r.status !== 'CERRADA').length;

  const presentedQuotesCount = requests.filter(
    (r) =>
      r.status === 'PRESENTADA' ||
      r.status === 'EN_NEGOCIACION' ||
      (r.latest_offered_amount !== null && r.latest_offered_amount > 0)
  ).length;

  const totalOfferedAmount =
    Math.round(requests.reduce((acc, r) => acc + Number(r.latest_offered_amount || 0), 0) * 100) /
    100;

  const closuresRows = await db.all<{
    request_id: string;
    result: string;
    awarded_amount: number;
  }>(
    `SELECT request_id, result, COALESCE(awarded_amount, 0) AS awarded_amount
     FROM commercial_closures`
  );

  const filteredClosures = closuresRows.filter((c) => requestIds.has(c.request_id));
  const totalAwardedAmount =
    Math.round(
      filteredClosures
        .filter((c) => c.result === 'ADJUDICADA_TOTAL' || c.result === 'ADJUDICADA_PARCIAL')
        .reduce((acc, c) => acc + Number(c.awarded_amount || 0), 0) * 100
    ) / 100;

  const expiringQuotesCount = requests.filter(
    (r) =>
      r.status !== 'CERRADA' &&
      (r.deadline_semaphore === 'POR_VENCER' || r.deadline_semaphore === 'VENCIDA')
  ).length;

  const allPendingCommitments = (
    await listFollowUpCommitments({
      onlyPending: true,
      referenceDateStr: refDate,
    })
  ).filter((c) => requestIds.has(c.request_id));

  const pendingFollowUpsCount = allPendingCommitments.length;
  const overdueFollowUpsCount = allPendingCommitments.filter((c) => c.urgency === 'VENCIDO').length;

  const stageCounts: Record<RequestStatus, number> = {
    RECIBIDA: requests.filter((r) => r.status === 'RECIBIDA').length,
    EN_ELABORACION: requests.filter((r) => r.status === 'EN_ELABORACION').length,
    PRESENTADA: requests.filter((r) => r.status === 'PRESENTADA').length,
    EN_NEGOCIACION: requests.filter((r) => r.status === 'EN_NEGOCIACION').length,
    CERRADA: requests.filter((r) => r.status === 'CERRADA').length,
  };

  const closureResultCounts: Record<string, number> = {
    ADJUDICADA_TOTAL: filteredClosures.filter((c) => c.result === 'ADJUDICADA_TOTAL').length,
    ADJUDICADA_PARCIAL: filteredClosures.filter((c) => c.result === 'ADJUDICADA_PARCIAL').length,
    NO_ADJUDICADA: filteredClosures.filter((c) => c.result === 'NO_ADJUDICADA').length,
    CANCELADA: filteredClosures.filter((c) => c.result === 'CANCELADA').length,
    NO_PARTICIPAMOS: filteredClosures.filter((c) => c.result === 'NO_PARTICIPAMOS').length,
  };

  const upcomingCommitments = allPendingCommitments.slice(0, 8).map((c) => ({
    id: c.id,
    request_id: c.request_id,
    folio: c.folio || '',
    project_name: c.project_name || '',
    customer_short_name: c.customer_short_name || '',
    responsible_name: c.responsible_name || '',
    next_activity_date: c.next_activity_date || c.activity_date,
    activity: c.next_activity_description || c.description,
    urgency: c.urgency || 'PROXIMO',
  }));

  return {
    activeRequestsCount,
    presentedQuotesCount,
    totalOfferedAmount,
    totalAwardedAmount,
    expiringQuotesCount,
    pendingFollowUpsCount,
    overdueFollowUpsCount,
    closedCount: stageCounts.CERRADA,
    stageCounts,
    closureResultCounts,
    upcomingCommitments,
    filteredRequests: requests,
  };
}
