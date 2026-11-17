'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Table2,
  Columns3,
  Plus,
  FolderOpen,
  CalendarPlus,
  RefreshCw,
  ArrowUpDown,
  Filter,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import {
  DeadlineBadge,
  OriginBadge,
  StatusBadge,
  STATUS_LABELS,
  formatMoney,
} from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type {
  CustomerRecord,
  EnrichedQuoteRequest,
  RequestStatus,
  SafeUser,
} from '@/lib/db/types';

interface RequestsViewClientProps {
  initialRequests: EnrichedQuoteRequest[];
  customers: CustomerRecord[];
  users: SafeUser[];
  currentUser: SafeUser;
  initialSearch?: string;
}

const KANBAN_COLUMNS: { status: RequestStatus; title: string; accent: string }[] = [
  { status: 'RECIBIDA', title: '1. Recibida', accent: 'border-t-blue-600' },
  { status: 'EN_ELABORACION', title: '2. En elaboración', accent: 'border-t-amber-500' },
  { status: 'PRESENTADA', title: '3. Presentada', accent: 'border-t-sky-600' },
  { status: 'EN_NEGOCIACION', title: '4. En negociación', accent: 'border-t-purple-600' },
  { status: 'CERRADA', title: '5. Cerrada', accent: 'border-t-emerald-600' },
];

export function RequestsViewClient({
  initialRequests,
  customers,
  users,
  currentUser,
  initialSearch = '',
}: RequestsViewClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<EnrichedQuoteRequest[]>(initialRequests);
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('TABLE');

  // Filtros
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'folio' | 'received_date' | 'deadline_date' | 'project_name'>('folio');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  // Modal de Cambio Asistido de Estado
  const [statusModalReq, setStatusModalReq] = useState<EnrichedQuoteRequest | null>(null);
  const [targetStatus, setTargetStatus] = useState<RequestStatus>('EN_ELABORACION');
  const [statusComment, setStatusComment] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [actionError, setActionError] = useState('');

  // Modal de Registro Rápido de Seguimiento
  const [followModalReq, setFollowModalReq] = useState<EnrichedQuoteRequest | null>(null);
  const [activityType, setActivityType] = useState<'LLAMADA' | 'CORREO' | 'REUNION' | 'ACLARACION' | 'NOTA' | 'SEGUIMIENTO' | 'OTRO'>('SEGUIMIENTO');
  const [activityDate, setActivityDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [activityDesc, setActivityDesc] = useState('');
  const [nextActivityDate, setNextActivityDate] = useState('');
  const [nextActivityDesc, setNextActivityDesc] = useState('');
  const [savingFollow, setSavingFollow] = useState(false);

  const canModify = currentUser.role === 'ADMIN' || currentUser.role === 'EDITOR';
  const isAdmin = currentUser.role === 'ADMIN';
  const [deleteTargetReq, setDeleteTargetReq] = useState<EnrichedQuoteRequest | null>(null);
  const [deletingReq, setDeletingReq] = useState(false);

  const confirmDeleteRequest = async () => {
    if (!deleteTargetReq) return;
    setDeletingReq(true);
    setActionError('');
    try {
      const res = await fetch(`/api/requests/${deleteTargetReq.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo eliminar el expediente.');
      }
      setRequests((prev) => prev.filter((r) => r.id !== deleteTargetReq.id));
      setDeleteTargetReq(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar solicitud.');
      setDeleteTargetReq(null);
    } finally {
      setDeletingReq(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = requests.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (customerFilter !== 'ALL' && r.customer_id !== customerFilter) return false;
      if (responsibleFilter !== 'ALL' && r.responsible_user_id !== responsibleFilter) return false;
      if (dateFrom && r.received_date < dateFrom) return false;
      if (dateTo && r.received_date > dateTo) return false;
      if (q) {
        const match =
          r.folio.toLowerCase().includes(q) ||
          r.project_name.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_short_name.toLowerCase().includes(q) ||
          (r.vw_tender_number && r.vw_tender_number.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const va = (a[sortBy] || '9999-12-31').toString();
      const vb = (b[sortBy] || '9999-12-31').toString();
      return sortDir === 'ASC' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return list;
  }, [requests, search, statusFilter, customerFilter, responsibleFilter, dateFrom, dateTo, sortBy, sortDir]);

  const toggleSort = (col: 'folio' | 'received_date' | 'deadline_date' | 'project_name') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortDir('ASC');
    }
  };

  const openStatusModal = (req: EnrichedQuoteRequest) => {
    setActionError('');
    setStatusModalReq(req);
    setTargetStatus(req.status);
    setStatusComment('');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalReq) return;
    setSavingStatus(true);
    setActionError('');
    try {
      const res = await fetch(`/api/requests/${statusModalReq.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, comment: statusComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el estado.');
      }
      setRequests((prev) => prev.map((r) => (r.id === statusModalReq.id ? data.request : r)));
      setStatusModalReq(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al actualizar.');
    } finally {
      setSavingStatus(false);
    }
  };

  const openFollowModal = (req: EnrichedQuoteRequest) => {
    setActionError('');
    setFollowModalReq(req);
    setActivityDesc('');
    setNextActivityDate('');
    setNextActivityDesc('');
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followModalReq) return;
    setSavingFollow(true);
    setActionError('');
    try {
      const res = await fetch(`/api/requests/${followModalReq.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: activityType,
          activity_date: activityDate,
          description: activityDesc,
          next_activity_date: nextActivityDate || null,
          next_activity_description: nextActivityDesc || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al guardar seguimiento.');
      }
      // Recargar solicitudes actualizadas
      const listRes = await fetch('/api/requests');
      const listData = await listRes.json();
      if (listData.success) {
        setRequests(listData.requests);
      }
      setFollowModalReq(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al guardar seguimiento.');
    } finally {
      setSavingFollow(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* CABECERA COMPACTA ESTILO ERP TRANS */}
      <div className="isl-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-[#C72106] border border-red-200 font-titulos uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C72106]" />
              Control Comercial & Licitaciones
            </span>
            <span className="text-xs text-slate-500 font-medium">
              IN SIDE LOGISTIC · Trazabilidad de Ofertas
            </span>
          </div>
          <h1 className="text-xl font-black text-[#0F2747] tracking-tight uppercase font-titulos">
            Solicitudes y Cotizaciones
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Selector de Vista: Tabla vs Kanban */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-titulos uppercase ${
                viewMode === 'TABLE'
                  ? 'bg-[#0F2747] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Vista 1: Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-titulos uppercase ${
                viewMode === 'KANBAN'
                  ? 'bg-[#0F2747] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Vista 2: Kanban</span>
            </button>
          </div>

          {canModify && (
            <Link
              href="/solicitudes/nueva"
              className="px-3.5 py-2 bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-industrial-red transition flex items-center gap-1.5 font-titulos"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nueva Solicitud</span>
            </Link>
          )}
        </div>
      </div>

      {/* BARRA DE BUSCADOR Y FILTROS (ESTADO, RESPONSABLE, CLIENTE, FECHAS) */}
      <div className="isl-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 font-titulos flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#0F2747]" />
              Estado Rápido:
            </span>
            {(
              [
                ['ALL', 'Todas'],
                ['RECIBIDA', 'Recibida'],
                ['EN_ELABORACION', 'En elaboración'],
                ['PRESENTADA', 'Presentada'],
                ['EN_NEGOCIACION', 'En negociación'],
                ['CERRADA', 'Cerrada'],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setStatusFilter(code)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  statusFilter === code
                    ? 'bg-[#0F2747] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong className="text-[#0F2747]">{filteredRequests.length}</strong> de{' '}
            {requests.length} expedientes
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end text-xs">
          {/* Buscador por folio, cliente y proyecto */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1 font-titulos">
              Buscar por Folio, Cliente o Proyecto
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej. COT-2026-0001, VWM, Licitación, Nave 4..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium text-xs focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Filtro por Cliente */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1 font-titulos">
              Cliente
            </label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold text-xs focus:bg-white"
            >
              <option value="ALL">Todos los clientes</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_name} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Responsable */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1 font-titulos">
              Responsable
            </label>
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold text-xs focus:bg-white"
            >
              <option value="ALL">Todos los responsables</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de Fechas */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1 font-titulos">
              Recepción Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium text-xs focus:bg-white"
            />
          </div>

          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1 font-titulos">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium text-xs focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setCustomerFilter('ALL');
                setResponsibleFilter('ALL');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
              title="Restablecer filtros"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* VISTA 1: TABLA PREDETERMINADA CON LAS 10 COLUMNAS OFICIALES      */}
      {/* ================================================================= */}
      {viewMode === 'TABLE' ? (
        <div className="isl-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b-2 border-blue-200 font-titulos">
                  <th className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('folio')}
                      className="inline-flex items-center gap-1 hover:text-[#0F2747] cursor-pointer"
                    >
                      <span>1. Folio Interno</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">2. Cliente</th>
                  <th className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('project_name')}
                      className="inline-flex items-center gap-1 hover:text-[#0F2747] cursor-pointer"
                    >
                      <span>3. Nombre del Proyecto</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">4. Origen de Solicitud</th>
                  <th className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('received_date')}
                      className="inline-flex items-center gap-1 hover:text-[#0F2747] cursor-pointer"
                    >
                      <span>5. Recepción</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('deadline_date')}
                      className="inline-flex items-center gap-1 hover:text-[#0F2747] cursor-pointer"
                    >
                      <span>6. Fecha Límite</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3.5">7. Responsable</th>
                  <th className="py-3 px-3.5">8. Estado</th>
                  <th className="py-3 px-3.5 text-right">9. Último Importe Ofertado</th>
                  <th className="py-3 px-3.5">10. Próxima Actividad</th>
                  <th className="py-3 px-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <div className="font-bold text-[#0F2747] text-sm font-titulos uppercase">
                          Sin solicitudes que coincidan con la consulta
                        </div>
                        <p className="text-xs text-slate-400">
                          Registra una nueva solicitud (Licitación Volkswagen, Solicitud Directa VW u Otro Cliente) para iniciar el seguimiento.
                        </p>
                        {canModify && (
                          <div className="pt-2">
                            <Link
                              href="/solicitudes/nueva"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C72106] text-white text-xs font-bold uppercase font-titulos"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Registrar primera solicitud</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Folio interno */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <Link
                          href={`/solicitudes/${req.id}`}
                          className="font-bold text-[#0F2747] hover:text-[#C72106] font-mono text-xs block hover:underline"
                        >
                          {req.folio}
                        </Link>
                        {req.vw_tender_number && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono text-[10px] font-semibold">
                            Lic: {req.vw_tender_number}
                          </span>
                        )}
                      </td>

                      {/* 2. Cliente */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{req.customer_short_name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[160px]" title={req.customer_name}>
                          {req.customer_name}
                        </div>
                      </td>

                      {/* 3. Nombre del proyecto */}
                      <td className="py-3 px-3.5 max-w-[240px]">
                        <div className="font-semibold text-slate-900 line-clamp-1" title={req.project_name}>
                          {req.project_name}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {req.contact_name ? `Solicita: ${req.contact_name}` : req.description}
                        </div>
                      </td>

                      {/* 4. Origen de solicitud */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <OriginBadge origin={req.origin_type} />
                      </td>

                      {/* 5. Fecha de recepción */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 font-medium">
                        {req.received_date}
                      </td>

                      {/* 6. Fecha límite + Indicador visual de vencimiento */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <DeadlineBadge
                          deadlineDate={req.deadline_date}
                          semaphore={req.deadline_semaphore}
                          daysUntil={req.days_until_deadline}
                        />
                      </td>

                      {/* 7. Responsable */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-800">
                          {req.responsible_name.split('(')[0].trim()}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{req.responsible_code}</div>
                      </td>

                      {/* 8. Estado */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* 9. Último importe ofertado */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono">
                        {req.latest_offered_amount !== null ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              {formatMoney(req.latest_offered_amount, req.latest_offered_currency)}
                            </span>
                            {req.latest_revision_code && (
                              <span className="block text-[10px] text-slate-400">
                                {req.latest_revision_code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Por cotizar</span>
                        )}
                      </td>

                      {/* 10. Próxima actividad */}
                      <td className="py-3 px-3.5 max-w-[180px]">
                        {req.next_activity_date ? (
                          <div>
                            <span className="font-mono font-bold text-[#0F2747] block text-[11px]">
                              {req.next_activity_date}
                            </span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                              {req.next_activity_description}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin programar</span>
                        )}
                      </td>

                      {/* Acciones: Abrir expediente, Registrar seguimiento, Actualizar estado */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Link
                            href={`/solicitudes/${req.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0F2747] hover:bg-[#16365F] text-white text-[11px] font-semibold rounded-lg transition cursor-pointer"
                            title="Abrir expediente completo"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>Expediente</span>
                          </Link>

                          {canModify && (
                            <>
                              <button
                                type="button"
                                onClick={() => openFollowModal(req)}
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#0F2747] hover:bg-slate-100 transition cursor-pointer"
                                title="Registrar seguimiento rápido"
                                aria-label={`Registrar seguimiento rápido para ${req.folio}`}
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openStatusModal(req)}
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#C72106] hover:bg-red-50 transition cursor-pointer"
                                title="Actualizar estado comercial"
                                aria-label={`Actualizar estado comercial de ${req.folio}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetReq(req)}
                              className="p-2 rounded-lg border border-red-200 bg-red-50 text-[#C72106] hover:bg-red-100 transition cursor-pointer"
                              title="Eliminar solicitud / cotización (Solo Administrador)"
                              aria-label={`Eliminar expediente ${req.folio}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* VISTA 2: KANBAN EN 5 COLUMNAS CON CAMBIO ASISTIDO DE ESTADO       */
        /* ================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = filteredRequests.filter((r) => r.status === col.status);
            return (
              <div
                key={col.status}
                className={`isl-card border-t-4 ${col.accent} flex flex-col min-h-[460px] bg-slate-50/60`}
              >
                <div className="px-3.5 py-3 bg-white border-b border-blue-200 flex items-center justify-between rounded-t-xl">
                  <span className="text-xs font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    {col.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#0F2747] font-mono">
                    {colItems.length}
                  </span>
                </div>

                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[600px] azia-scrollbar">
                  {colItems.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 italic">
                      Sin tarjetas en esta etapa
                    </div>
                  ) : (
                    colItems.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs hover:border-[#0F2747] transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/solicitudes/${req.id}`}
                            className="font-mono font-bold text-xs text-[#0F2747] hover:text-[#C72106] hover:underline"
                          >
                            {req.folio}
                          </Link>
                          <OriginBadge origin={req.origin_type} />
                        </div>

                        <div>
                          <Link
                            href={`/solicitudes/${req.id}`}
                            className="font-bold text-slate-900 text-xs hover:text-[#0F2747] block line-clamp-2"
                          >
                            {req.project_name}
                          </Link>
                          <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                            {req.customer_short_name} · {req.customer_name}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Responsable:</span>
                            <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                              {req.responsible_name.split('(')[0].trim()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Fecha límite:</span>
                            <span className="font-mono font-semibold">
                              {req.deadline_date || req.received_date}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <Link
                            href={`/solicitudes/${req.id}`}
                            className="px-2.5 py-1 rounded-lg bg-[#0F2747] hover:bg-[#16365F] text-white text-[11px] font-semibold transition"
                          >
                            Abrir expediente
                          </Link>
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => openStatusModal(req)}
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:border-[#C72106] text-slate-700 hover:text-[#C72106] text-[11px] font-semibold transition cursor-pointer"
                            >
                              Cambiar estado
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CAMBIO ASISTIDO DE ESTADO */}
      {statusModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                  Actualizar Estado Comercial
                </h3>
                <p className="text-xs text-slate-300 font-mono">{statusModalReq.folio}</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalReq(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="p-5 space-y-4 text-xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#C72106] font-semibold">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1.5 font-titulos">
                  Seleccione el nuevo estado
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as RequestStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1.5 font-titulos">
                  Observación o motivo del cambio
                </label>
                <textarea
                  rows={3}
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Ej. Se concluyó levantamiento en planta, pasa a elaboración de presupuesto..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalReq(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingStatus ? 'Guardando...' : 'Confirmar Estado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO RÁPIDO DE SEGUIMIENTO */}
      {followModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                  Registrar Actividad de Seguimiento
                </h3>
                <p className="text-xs text-slate-300 font-mono">
                  {followModalReq.folio} — {followModalReq.project_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowModalReq(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#C72106] font-semibold">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Tipo de Actividad *
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as typeof activityType)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="SEGUIMIENTO">Seguimiento</option>
                    <option value="LLAMADA">Llamada</option>
                    <option value="CORREO">Correo</option>
                    <option value="REUNION">Reunión</option>
                    <option value="ACLARACION">Aclaración técnica</option>
                    <option value="NOTA">Nota interna</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Fecha de Actividad *
                  </label>
                  <input
                    type="date"
                    required
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Descripción de la Actividad *
                </label>
                <textarea
                  rows={3}
                  required
                  value={activityDesc}
                  onChange={(e) => setActivityDesc(e.target.value)}
                  placeholder="Detalle de la llamada, visita técnica o comentario recibido..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="font-bold text-[#0F2747] uppercase font-titulos block">
                  Programar Próximo Compromiso (Opcional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Fecha próxima actividad
                    </label>
                    <input
                      type="date"
                      value={nextActivityDate}
                      onChange={(e) => setNextActivityDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Compromiso programado
                    </label>
                    <input
                      type="text"
                      value={nextActivityDesc}
                      onChange={(e) => setNextActivityDesc(e.target.value)}
                      placeholder="Ej. Confirmar recepción de oferta..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFollowModalReq(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingFollow}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingFollow ? 'Guardando...' : 'Guardar Seguimiento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTargetReq)}
        title="Eliminar Expediente"
        message={
          deleteTargetReq
            ? `¿Seguro que deseas eliminar definitivamente el expediente y sus cotizaciones "${deleteTargetReq.folio} — ${deleteTargetReq.project_name}"?`
            : ''
        }
        confirmLabel="Sí, Eliminar"
        loading={deletingReq}
        onConfirm={confirmDeleteRequest}
        onCancel={() => setDeleteTargetReq(null)}
      />
    </div>
  );
}
