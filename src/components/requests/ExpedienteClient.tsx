'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  Calculator,
  CalendarClock,
  Award,
  RefreshCw,
  Check,
  X,
  History,
  HardDrive,
  Upload,
  Download,
  Lock,
  Plus,
  Trash2,
  Send,
  Pencil,
  Save,
  FileSpreadsheet,
  Copy,
  Sparkles,
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
  AuditLogRecord,
  CurrencyCode,
  DocumentCategory,
  EnrichedQuoteRequest,
  PresentationChannel,
  QuoteModality,
  RequestStatus,
  SafeUser,
} from '@/lib/db/types';
import type { QuoteRevisionRecord } from '@/lib/services/quoteService';
import type { DocumentRecord } from '@/lib/services/documentService';

interface ExpedienteClientProps {
  request: EnrichedQuoteRequest;
  revisions: QuoteRevisionRecord[];
  activities: Array<Record<string, unknown>>;
  documents: DocumentRecord[];
  closure: Record<string, unknown> | undefined;
  auditLogs: AuditLogRecord[];
  users?: SafeUser[];
  currentUser: SafeUser;
  initialTab?: string;
}

const DOC_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  SOLICITUD: 'Solicitud / Requerimiento',
  LASTENHEFT: 'LASTENHEFT (Especificación Técnica VW)',
  ESTRUCTURA_ECONOMICA: 'Excel Estructura Económica',
  COTIZACION: 'Oferta / Cotización',
  EVIDENCIA_ENTREGA: 'Evidencia de Presentación',
  SEGUIMIENTO: 'Minuta / Aclaración / Seguimiento',
  EVIDENCIA_ADJUDICACION: 'Evidencia de Adjudicación',
  ORDEN_COMPRA: 'Orden de Compra / Contrato',
  OTRO: 'Otro Anexo Técnico / Comercial',
};

const UNIT_OPTIONS = ['Servicio', 'Pza', 'Lote', 'Juego', 'Jornada', 'Hora', 'Metro', 'Kg'];

function addBusinessDaysClient(dateStr: string, businessDays: number): string {
  const base = new Date(`${dateStr}T12:00:00Z`);
  let remaining = businessDays;
  const cursor = new Date(base.getTime());
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return cursor.toISOString().slice(0, 10);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

export function ExpedienteClient({
  request: initialRequest,
  revisions: initialRevisions,
  activities: initialActivities,
  documents: initialDocuments,
  closure,
  auditLogs: initialAuditLogs,
  users = [],
  currentUser,
  initialTab = 'datos',
}: ExpedienteClientProps) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [request, setRequest] = useState<EnrichedQuoteRequest>(initialRequest);
  const [revisions, setRevisions] = useState<QuoteRevisionRecord[]>(initialRevisions);
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>(initialActivities);
  const [auditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const canModify = currentUser.role === 'ADMIN' || currentUser.role === 'EDITOR';
  const isAdmin = currentUser.role === 'ADMIN';
  const [confirmDeleteExpOpen, setConfirmDeleteExpOpen] = useState(false);
  const [deletingExp, setDeletingExp] = useState(false);
  const [confirmDeleteRev, setConfirmDeleteRev] = useState<QuoteRevisionRecord | null>(null);
  const [deletingRev, setDeletingRev] = useState(false);
  const [rescheduleActId, setRescheduleActId] = useState<string | null>(null);
  const [rescheduleActDate, setRescheduleActDate] = useState<string>(
    addBusinessDaysClient(todayStr, 3)
  );
  const [savingRescheduleAct, setSavingRescheduleAct] = useState(false);

  const handleDeleteExpediente = () => setConfirmDeleteExpOpen(true);

  const executeDeleteExpediente = async () => {
    setDeletingExp(true);
    try {
      const res = await fetch(`/api/requests/${request.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo eliminar el expediente.');
      }
      setConfirmDeleteExpOpen(false);
      router.push('/solicitudes');
      router.refresh();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Error al eliminar el expediente.');
      setConfirmDeleteExpOpen(false);
    } finally {
      setDeletingExp(false);
    }
  };

  const handleDeleteRevision = (rev: QuoteRevisionRecord) => setConfirmDeleteRev(rev);

  const executeDeleteRevision = async () => {
    if (!confirmDeleteRev) return;
    setDeletingRev(true);
    try {
      const res = await fetch(`/api/quotes/${confirmDeleteRev.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo eliminar la revisión.');
      }
      const remaining = revisions.filter((r) => r.id !== confirmDeleteRev.id);
      setRevisions(remaining);
      setSelectedRevisionId(remaining[0]?.id || 'NEW');
      setCreatingNewRevision(remaining.length === 0);
      setConfirmDeleteRev(null);
      router.refresh();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Error al eliminar revisión.');
      setConfirmDeleteRev(null);
    } finally {
      setDeletingRev(false);
    }
  };

  // --- TAB 1: EDICIÓN DE DATOS GENERALES ---
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [genProjectName, setGenProjectName] = useState(request.project_name);
  const [genDescription, setGenDescription] = useState(request.description);
  const [genDeadline, setGenDeadline] = useState(request.deadline_date || '');
  const [genResponsible, setGenResponsible] = useState(request.responsible_user_id);
  const [genObservations, setGenObservations] = useState(request.observations || '');
  const [savingGeneral, setSavingGeneral] = useState(false);

  // --- MODAL CAMBIO DE ESTADO ASISTIDO ---
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<RequestStatus>(request.status);
  const [statusComment, setStatusComment] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // --- TAB 2: GESTIÓN DOCUMENTAL GOOGLE DRIVE ---
  const [docFilterCategory, setDocFilterCategory] = useState<DocumentCategory | 'ALL'>('ALL');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(
    request.origin_type === 'LICITACION_VW' ? 'LASTENHEFT' : 'SOLICITUD'
  );
  const [uploadRevisionId, setUploadRevisionId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<string | null>(null);

  // --- TAB 3: COTIZACIONES Y REVISIONES (MODALIDAD A Y B) ---
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    initialRevisions[0]?.id || 'NEW'
  );
  const [creatingNewRevision, setCreatingNewRevision] = useState<boolean>(
    initialRevisions.length === 0
  );

  // Estado del formulario de cotización (Nueva revisión o edición de borrador)
  // Predeterminado en EXTERNAL (Modalidad B: subir Word / PDF / Excel generado)
  const [quoteModality, setQuoteModality] = useState<QuoteModality>('EXTERNAL');
  const [quoteDate, setQuoteDate] = useState<string>(todayStr);
  const [quoteCurrency, setQuoteCurrency] = useState<CurrencyCode>('MXN');
  const [quoteTaxRate, setQuoteTaxRate] = useState<number>(16);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [quoteItems, setQuoteItems] = useState<
    Array<{ description: string; unit: string; quantity: number; unit_price: number }>
  >([
    {
      description: `Servicio técnico integral para ${request.project_name}`,
      unit: 'Servicio',
      quantity: 1,
      unit_price: 125000,
    },
  ]);

  // Modalidad B (Externa)
  const [extSubtotal, setExtSubtotal] = useState<number>(250000);
  const [extDocumentId, setExtDocumentId] = useState<string>('');
  const [extUploadFile, setExtUploadFile] = useState<File | null>(null);

  const [savingQuote, setSavingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const handleCopyPromptForChatGPT = async () => {
    const revLabel = creatingNewRevision
      ? nextRevisionLabel
      : selectedRevision?.revision_code || 'Rev. 00';
    const recipient =
      request.origin_type === 'LICITACION_VW'
        ? `${request.vw_buyer_name || 'Compras VWM'} (Licitación: ${request.vw_tender_number || 'N/D'})`
        : request.origin_type === 'DIRECTA_VW'
        ? `${request.vw_requester_name || 'Solicitante VWM'} — ${request.vw_department || 'Planta VWM'}`
        : `${request.contact_name || 'Contacto'} (${request.contact_info || ''})`;

    const promptText = [
      `Ayúdame a generar el documento de cotización en Word con el formato institucional de IN SIDE LOGISTIC S.A. de C.V. usando estos datos oficiales del expediente:`,
      ``,
      `• N° DE COTIZACIÓN (FOLIO): ${request.folio}`,
      `• REVISIÓN: ${revLabel}`,
      `• FECHA DE EMISIÓN: ${quoteDate || todayStr}`,
      `• CLIENTE: ${request.customer_name}`,
      `• ATENCIÓN / SOLICITANTE: ${recipient}`,
      `• PROYECTO: "${request.project_name.toUpperCase()}"`,
      `• DESCRIPCIÓN / ALCANCE BASE: ${request.description}`,
      request.observations ? `• OBSERVACIONES: ${request.observations}` : null,
      `• MONEDA: ${quoteCurrency}`,
      `• FIRMA: Jorge Andres Garcia Gordillo — Gerencia de Operaciones`,
      `• PIE DE PÁGINA: Calle Aldama #35 Nave 2, San Lorenzo Almecatla / 222 263 04 77 / www.insidelogistic.com.mx`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3500);
    } catch {
      alert('No se pudo copiar automáticamente. Folio: ' + request.folio);
    }
  };

  // --- MODAL «MARCAR COMO PRESENTADA» ---
  const [presentModalOpen, setPresentModalOpen] = useState<boolean>(false);
  const [presentRevId, setPresentRevId] = useState<string>('');
  const [presentDate, setPresentDate] = useState<string>(todayStr);
  const [presentChannel, setPresentChannel] = useState<PresentationChannel>(
    request.origin_type === 'LICITACION_VW' ? 'PLATAFORMA_VW' : 'CORREO'
  );
  const [presentFollowUpDays, setPresentFollowUpDays] = useState<number>(3);
  const [presentCustomFollowUpDate, setPresentCustomFollowUpDate] = useState<string>(
    addBusinessDaysClient(todayStr, 3)
  );
  const [presentNotes, setPresentNotes] = useState<string>('');
  const [presentEvidenceDocId, setPresentEvidenceDocId] = useState<string>('');
  const [presentEvidenceFile, setPresentEvidenceFile] = useState<File | null>(null);
  const [presentingSaving, setPresentingSaving] = useState<boolean>(false);

  // --- TAB 4: SEGUIMIENTO COMERCIAL Y COMPROMISOS ---
  const [actType, setActType] = useState<string>('SEGUIMIENTO');
  const [actDate, setActDate] = useState<string>(todayStr);
  const [actDesc, setActDesc] = useState<string>('');
  const [actNextDate, setActNextDate] = useState<string>(addBusinessDaysClient(todayStr, 3));
  const [actNextDesc, setActNextDesc] = useState<string>(
    'Confirmar estatus técnico/comercial con comprador o usuario'
  );
  const [actFile, setActFile] = useState<File | null>(null);
  const [savingActivity, setSavingActivity] = useState<boolean>(false);

  // --- TAB 5: RESULTADO Y CIERRE COMERCIAL ---
  const [closureState, setClosureState] = useState<Record<string, unknown> | undefined>(closure);
  const [closureResult, setClosureResult] = useState<string>('GANADA');
  const [closureDate, setClosureDate] = useState<string>(todayStr);
  const [closureAwardedAmt, setClosureAwardedAmt] = useState<number>(
    Number(initialRequest.latest_offered_amount || 0)
  );
  const [closureCurrency, setClosureCurrency] = useState<CurrencyCode>(
    (initialRequest.latest_offered_currency as CurrencyCode) || 'MXN'
  );
  const [closurePoNumber, setClosurePoNumber] = useState<string>('');
  const [closureLossReason, setClosureLossReason] = useState<string>('');
  const [closureComments, setClosureComments] = useState<string>('');
  const [closureEvidenceDocId, setClosureEvidenceDocId] = useState<string>('');
  const [closureEvidenceFile, setClosureEvidenceFile] = useState<File | null>(null);
  const [savingClosure, setSavingClosure] = useState<boolean>(false);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [closureSuccess, setClosureSuccess] = useState<string | null>(null);

  const selectedRevision = useMemo(
    () => revisions.find((r) => r.id === selectedRevisionId) || null,
    [revisions, selectedRevisionId]
  );

  // Cálculos automáticos en vivo para Modalidad A y Modalidad B
  const calculatedTotals = useMemo(() => {
    if (quoteModality === 'INTERNAL') {
      const subtotal = Number(
        quoteItems
          .reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.unit_price || 0), 0)
          .toFixed(2)
      );
      const taxAmount = Number(((subtotal * Number(quoteTaxRate || 0)) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));
      return { subtotal, taxAmount, total };
    } else {
      const subtotal = Number(Number(extSubtotal || 0).toFixed(2));
      const taxAmount = Number(((subtotal * Number(quoteTaxRate || 0)) / 100).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));
      return { subtotal, taxAmount, total };
    }
  }, [quoteModality, quoteItems, quoteTaxRate, extSubtotal]);

  const nextRevisionLabel = useMemo(() => {
    if (revisions.length === 0) return 'Rev. 00';
    const maxNum = Math.max(...revisions.map((r) => r.revision_number));
    return `Rev. ${String(maxNum + 1).padStart(2, '0')}`;
  }, [revisions]);

  // Pre-cargar datos al iniciar una nueva revisión o editar un borrador
  const startNewRevisionFromLatest = () => {
    setQuoteError(null);
    setQuoteSuccess(null);
    const latest = revisions[0];
    if (latest) {
      setQuoteModality(latest.modality);
      setQuoteCurrency(latest.currency);
      setQuoteTaxRate(latest.tax_rate);
      setQuoteDate(todayStr);
      setQuoteNotes(
        `Actualización técnica/económica sobre ${latest.revision_code}`
      );
      if (latest.modality === 'INTERNAL' && latest.items.length > 0) {
        setQuoteItems(
          latest.items.map((it) => ({
            description: it.concept,
            unit: it.unit,
            quantity: it.quantity,
            unit_price: it.unit_price,
          }))
        );
      } else {
        setExtSubtotal(latest.subtotal);
        setExtDocumentId('');
      }
    }
    setCreatingNewRevision(true);
    setSelectedRevisionId('NEW');
  };

  const loadDraftIntoEditor = (rev: QuoteRevisionRecord) => {
    setQuoteError(null);
    setQuoteSuccess(null);
    setSelectedRevisionId(rev.id);
    setCreatingNewRevision(false);
    setQuoteModality(rev.modality);
    setQuoteDate(rev.issue_date);
    setQuoteCurrency(rev.currency);
    setQuoteTaxRate(rev.tax_rate);
    setQuoteNotes(rev.observations || '');
    if (rev.modality === 'INTERNAL') {
      setQuoteItems(
        rev.items.map((it) => ({
          description: it.concept,
          unit: it.unit,
          quantity: it.quantity,
          unit_price: it.unit_price,
        }))
      );
    } else {
      setExtSubtotal(rev.subtotal);
      setExtDocumentId('');
    }
  };

  // --- HANDLER: ACTUALIZAR DATOS GENERALES ---
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: genProjectName,
          description: genDescription,
          deadline_date: genDeadline || null,
          responsible_user_id: genResponsible,
          observations: genObservations || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el expediente.');
      }
      setRequest(data.request);
      setEditingGeneral(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar cambios.');
    } finally {
      setSavingGeneral(false);
    }
  };

  // --- HANDLER: CAMBIO DE ESTADO ASISTIDO ---
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, comment: statusComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el estado.');
      }
      setRequest(data.request);
      setStatusModalOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado.');
    } finally {
      setSavingStatus(false);
    }
  };

  // --- HANDLER: SUBIR DOCUMENTO A GOOGLE DRIVE ---
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadingDoc(true);
    setDocFeedback(null);
    try {
      const contentBase64 = await fileToBase64(selectedFile);
      const res = await fetch(`/api/requests/${request.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: uploadCategory,
          revision_id: uploadRevisionId || null,
          file_name: selectedFile.name,
          mime_type: selectedFile.type || 'application/octet-stream',
          content_base64: contentBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al subir el documento.');
      }

      setDocuments((prev) => [data.document, ...prev]);
      setSelectedFile(null);
      setDocFeedback(
        `Archivo "${data.document.original_name}" sincronizado en ${request.drive_folder_path}`
      );
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir archivo.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // --- HANDLER: GUARDAR NUEVA REVISIÓN O ACTUALIZAR BORRADOR ---
  const handleSaveQuoteRevision = async (e: React.FormEvent, isUpdatingDraft = false) => {
    e.preventDefault();
    setSavingQuote(true);
    setQuoteError(null);
    setQuoteSuccess(null);

    try {
      let finalExternalDocId = extDocumentId || null;

      // Si estamos en Modalidad B y el usuario seleccionó un archivo directo para subir junto con la cotización:
      if (quoteModality === 'EXTERNAL' && extUploadFile) {
        const contentBase64 = await fileToBase64(extUploadFile);
        const docRes = await fetch(`/api/requests/${request.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'COTIZACION',
            file_name: extUploadFile.name,
            mime_type: extUploadFile.type || 'application/octet-stream',
            content_base64: contentBase64,
          }),
        });
        const docData = await docRes.json();
        if (!docRes.ok || !docData.success) {
          throw new Error(docData.message || 'No se pudo adjuntar el archivo externo.');
        }
        finalExternalDocId = docData.document.id;
        setDocuments((prev) => [docData.document, ...prev]);
        setExtDocumentId(docData.document.id);
        setExtUploadFile(null);
      }

      const payload =
        quoteModality === 'INTERNAL'
          ? {
              modality: 'INTERNAL',
              quote_date: quoteDate,
              currency: quoteCurrency,
              tax_rate: Number(quoteTaxRate),
              notes: quoteNotes || null,
              items: quoteItems.map((it) => ({
                description: it.description,
                unit: it.unit,
                quantity: Number(it.quantity),
                unit_price: Number(it.unit_price),
              })),
            }
          : {
              modality: 'EXTERNAL',
              quote_date: quoteDate,
              currency: quoteCurrency,
              subtotal: Number(extSubtotal),
              tax_rate: Number(quoteTaxRate),
              external_document_id: finalExternalDocId,
              notes: quoteNotes || null,
            };

      const url =
        isUpdatingDraft && selectedRevision
          ? `/api/quotes/${selectedRevision.id}`
          : `/api/requests/${request.id}/quotes`;
      const method = isUpdatingDraft && selectedRevision ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No fue posible guardar la revisión de cotización.');
      }

      const savedRev: QuoteRevisionRecord = data.revision;
      if (isUpdatingDraft) {
        setRevisions((prev) => prev.map((r) => (r.id === savedRev.id ? savedRev : r)));
        setQuoteSuccess(`${savedRev.revision_code} actualizada correctamente.`);
      } else {
        setRevisions((prev) => [savedRev, ...prev]);
        setSelectedRevisionId(savedRev.id);
        setCreatingNewRevision(false);
        setRequest((prev) => ({
          ...prev,
          status: prev.status === 'RECIBIDA' ? 'EN_ELABORACION' : prev.status,
          latest_offered_amount: savedRev.subtotal,
          latest_offered_currency: savedRev.currency,
          latest_revision_code: savedRev.revision_code,
        }));
        setQuoteSuccess(`${savedRev.revision_code} creada correctamente en estado Borrador.`);
      }
      router.refresh();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Error al guardar la cotización.');
    } finally {
      setSavingQuote(false);
    }
  };

  // --- HANDLER: MARCAR REVISIÓN COMO PRESENTADA ---
  const openPresentModal = (rev: QuoteRevisionRecord) => {
    setPresentRevId(rev.id);
    setPresentDate(todayStr);
    setPresentChannel(request.origin_type === 'LICITACION_VW' ? 'PLATAFORMA_VW' : 'CORREO');
    setPresentFollowUpDays(3);
    setPresentCustomFollowUpDate(addBusinessDaysClient(todayStr, 3));
    setPresentNotes(
      `Oferta ${rev.revision_code} entregada formalmente por importe antes de IVA de ${formatMoney(
        rev.subtotal,
        rev.currency
      )}.`
    );
    setPresentEvidenceDocId('');
    setPresentEvidenceFile(null);
    setPresentModalOpen(true);
  };

  const handleConfirmPresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentRevId) return;
    setPresentingSaving(true);

    try {
      let evidenceDocId = presentEvidenceDocId || null;
      if (presentEvidenceFile) {
        const contentBase64 = await fileToBase64(presentEvidenceFile);
        const docRes = await fetch(`/api/requests/${request.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'EVIDENCIA_ENTREGA',
            revision_id: presentRevId,
            file_name: presentEvidenceFile.name,
            mime_type: presentEvidenceFile.type || 'application/octet-stream',
            content_base64: contentBase64,
          }),
        });
        const docData = await docRes.json();
        if (docRes.ok && docData.success) {
          evidenceDocId = docData.document.id;
          setDocuments((prev) => [docData.document, ...prev]);
        }
      }

      const res = await fetch(`/api/quotes/${presentRevId}/present`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentation_date: presentDate,
          presentation_channel: presentChannel,
          evidence_document_id: evidenceDocId,
          follow_up_business_days: presentFollowUpDays,
          custom_follow_up_date: presentCustomFollowUpDate,
          notes: presentNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al presentar la revisión.');
      }

      const presentedRev: QuoteRevisionRecord = data.revision;
      setRevisions((prev) =>
        prev.map((r) => {
          if (r.id === presentedRev.id) return presentedRev;
          if (r.status === 'PRESENTADA') return { ...r, status: 'HISTORICA' };
          return r;
        })
      );
      setRequest((prev) => ({
        ...prev,
        status: 'PRESENTADA',
        latest_offered_amount: presentedRev.subtotal,
        latest_offered_currency: presentedRev.currency,
        latest_revision_code: presentedRev.revision_code,
        next_activity_date: data.followUpDate,
      }));
      setActivities((prev) => [
        {
          id: data.followUpActivityId,
          activity_type: 'SEGUIMIENTO',
          activity_date: presentDate,
          description: `Presentación formal de ${presentedRev.revision_code}`,
          next_activity_date: data.followUpDate,
          next_activity_description: `Confirmar recepción y revisión técnica/económica de ${presentedRev.revision_code}`,
          responsible_name: currentUser.name,
        },
        ...prev,
      ]);
      setPresentModalOpen(false);
      setQuoteSuccess(
        `${presentedRev.revision_code} marcada como PRESENTADA (Inmutable). Próximo seguimiento programado: ${data.followUpDate}.`
      );
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al presentar cotización.');
    } finally {
      setPresentingSaving(false);
    }
  };

  // --- HANDLER: REGISTRAR ACTIVIDAD DE SEGUIMIENTO COMERCIAL ---
  const handleRegisterFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actDesc.trim()) return;
    setSavingActivity(true);

    try {
      let associatedDocId: string | null = null;
      if (actFile) {
        const contentBase64 = await fileToBase64(actFile);
        const docRes = await fetch(`/api/requests/${request.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'SEGUIMIENTO',
            original_name: actFile.name,
            mime_type: actFile.type || 'application/octet-stream',
            content_base64: contentBase64,
          }),
        });
        const docData = await docRes.json();
        if (docRes.ok && docData.success) {
          associatedDocId = docData.document.id;
          setDocuments((prev) => [docData.document, ...prev]);
        }
      }

      const res = await fetch(`/api/requests/${request.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: actType,
          activity_date: actDate,
          description: actDesc,
          next_activity_date: actNextDate || null,
          next_activity_description: actNextDesc || null,
          associated_document_id: associatedDocId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo registrar el seguimiento.');
      }

      setActivities((prev) => [data.activity, ...prev]);
      setActDesc('');
      setActFile(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar seguimiento.');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleFollowUpAction = async (
    activityId: string,
    action: 'COMPLETE' | 'RESCHEDULE' | 'CANCEL',
    explicitDate?: string
  ) => {
    if (action === 'RESCHEDULE' && !explicitDate) {
      setRescheduleActId(activityId);
      return;
    }

    const payload: Record<string, unknown> =
      action === 'RESCHEDULE'
        ? { action, next_activity_date: explicitDate }
        : { action };

    try {
      const res = await fetch(`/api/followups/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el recordatorio.');
      }
      setActivities((prev) =>
        prev.map((a) => (String(a.id) === activityId ? data.activity : a))
      );
      router.refresh();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Error al actualizar recordatorio.');
    }
  };

  const handleConfirmRescheduleAct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleActId || !rescheduleActDate) return;
    setSavingRescheduleAct(true);
    await handleFollowUpAction(rescheduleActId, 'RESCHEDULE', rescheduleActDate);
    setSavingRescheduleAct(false);
    setRescheduleActId(null);
  };

  // --- HANDLER: REGISTRAR CIERRE COMERCIAL ---
  const handleRegisterClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClosure(true);
    setClosureError(null);
    setClosureSuccess(null);

    try {
      let evidenceDocId = closureEvidenceDocId || null;

      if (closureEvidenceFile) {
        const contentBase64 = await fileToBase64(closureEvidenceFile);
        const docRes = await fetch(`/api/requests/${request.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'ORDEN_COMPRA',
            original_name: closureEvidenceFile.name,
            mime_type: closureEvidenceFile.type || 'application/octet-stream',
            content_base64: contentBase64,
          }),
        });
        const docData = await docRes.json();
        if (!docRes.ok || !docData.success) {
          throw new Error(docData.message || 'No se pudo adjuntar la evidencia de adjudicación.');
        }
        evidenceDocId = docData.document.id;
        setDocuments((prev) => [docData.document, ...prev]);
        setClosureEvidenceFile(null);
      }

      const res = await fetch(`/api/requests/${request.id}/closure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: closureResult,
          closure_date: closureDate,
          awarded_amount:
            closureResult === 'GANADA' || closureResult === 'ADJUDICADA_PARCIALMENTE'
              ? Number(closureAwardedAmt)
              : null,
          awarded_currency: closureCurrency,
          purchase_order_number: closurePoNumber || null,
          loss_reason: closureLossReason || null,
          comments: closureComments || null,
          evidence_document_id: evidenceDocId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No fue posible registrar el cierre comercial.');
      }

      setClosureState(data.closure);
      setRequest((prev) => ({
        ...prev,
        status: 'CERRADA',
        deadline_semaphore: 'CERRADA',
      }));
      setClosureSuccess(
        `Cierre comercial registrado exitosamente (${closureResult}). El expediente ha pasado a estado CERRADA.`
      );
      router.refresh();
    } catch (err) {
      setClosureError(
        err instanceof Error ? err.message : 'Error al registrar el cierre comercial.'
      );
    } finally {
      setSavingClosure(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (docFilterCategory === 'ALL') return documents;
    return documents.filter((d) => d.category === docFilterCategory);
  }, [documents, docFilterCategory]);

  const tabs = [
    { id: 'datos', label: '1. Datos generales', icon: FileText },
    { id: 'documentos', label: `2. Documentos (${documents.length})`, icon: FolderKanban },
    { id: 'cotizaciones', label: `3. Cotizaciones (${revisions.length})`, icon: Calculator },
    { id: 'seguimiento', label: `4. Seguimiento (${activities.length})`, icon: CalendarClock },
    { id: 'cierre', label: '5. Resultado comercial', icon: Award },
  ];

  return (
    <div className="space-y-4">
      {/* ENCABEZADO DEL EXPEDIENTE DE SOLICITUD (SECCIÓN 8 DEL PROMPT MAESTRO) */}
      <div className="isl-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link
                href="/solicitudes"
                className="text-xs font-bold text-[#C72106] hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Solicitudes y Cotizaciones</span>
              </Link>
              <span className="text-slate-300">•</span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#0F2747] text-white">
                {request.folio}
              </span>
              <OriginBadge origin={request.origin_type} />
              <StatusBadge status={request.status} />
            </div>
            <h1 className="text-xl font-black text-[#0F2747] uppercase tracking-tight font-titulos">
              {request.project_name}
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canModify && (
              <button
                type="button"
                onClick={() => {
                  setTargetStatus(request.status);
                  setStatusComment('');
                  setStatusModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-bold uppercase tracking-wider font-titulos shadow-industrial-red flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualizar Estado</span>
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDeleteExpediente}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#C72106] text-xs font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                title="Eliminar expediente y sus cotizaciones (Solo Administrador)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Expediente</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen superior de los campos clave del expediente */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Folio Interno
            </span>
            <span className="font-mono font-bold text-[#0F2747] text-sm">{request.folio}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Cliente
            </span>
            <span className="font-bold text-slate-900 block truncate" title={request.customer_name}>
              {request.customer_short_name} — {request.customer_name}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Último Importe Vigente
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm block">
              {formatMoney(request.latest_offered_amount, request.latest_offered_currency)}
            </span>
            {request.latest_revision_code && (
              <span className="text-[10px] font-mono text-slate-500">
                ({request.latest_revision_code})
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Fecha Recepción
            </span>
            <span className="font-mono font-bold text-slate-800">{request.received_date}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Fecha Límite
            </span>
            <div className="mt-0.5">
              <DeadlineBadge
                deadlineDate={request.deadline_date}
                semaphore={request.deadline_semaphore}
                daysUntil={request.days_until_deadline}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
              Responsable
            </span>
            <span className="font-bold text-slate-900 block truncate">
              {request.responsible_name.split('(')[0].trim()}
            </span>
          </div>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN DEL EXPEDIENTE (5 SECCIONES) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer font-titulos uppercase tracking-wider ${
                  active
                    ? 'bg-[#0F2747] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑA ACTIVA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          {/* =========================================================
              PESTAÑA 1: DATOS GENERALES (CON EDICIÓN)
             ========================================================= */}
          {activeTab === 'datos' && (
            <div className="isl-card p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                  1. Datos Generales de la Solicitud
                </h2>
                {canModify && !editingGeneral && (
                  <button
                    type="button"
                    onClick={() => setEditingGeneral(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0F2747] hover:text-white text-slate-700 font-bold text-[11px] transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Datos</span>
                  </button>
                )}
              </div>

              {editingGeneral ? (
                <form onSubmit={handleSaveGeneral} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Nombre del Proyecto *
                      </label>
                      <input
                        type="text"
                        required
                        value={genProjectName}
                        onChange={(e) => setGenProjectName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Fecha Límite de Presentación
                      </label>
                      <input
                        type="date"
                        value={genDeadline}
                        onChange={(e) => setGenDeadline(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono"
                      />
                    </div>

                    {users.length > 0 && (
                      <div>
                        <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                          Responsable Interno
                        </label>
                        <select
                          value={genResponsible}
                          onChange={(e) => setGenResponsible(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-semibold"
                        >
                          {users
                            .filter((u) => u.role !== 'CONSULTA')
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.employee_code})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Descripción del Requerimiento *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={genDescription}
                        onChange={(e) => setGenDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Observaciones
                      </label>
                      <textarea
                        rows={2}
                        value={genObservations}
                        onChange={(e) => setGenObservations(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingGeneral(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingGeneral}
                      className="px-4 py-2 rounded-xl bg-[#C72106] text-white font-bold uppercase font-titulos flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingGeneral ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                        Nombre del Proyecto
                      </span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">
                        {request.project_name}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                        Cliente
                      </span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">
                        {request.customer_name}
                      </p>
                    </div>

                    {request.origin_type === 'LICITACION_VW' && (
                      <>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Número o Referencia de Licitación VWM
                          </span>
                          <p className="font-mono font-bold text-[#0F2747] mt-0.5">
                            {request.vw_tender_number || 'N/D'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Comprador Responsable VWM
                          </span>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {request.vw_buyer_name || 'N/D'}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Anexos de Licitación Declarados
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                request.has_lastenheft
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              LASTENHEFT: {request.has_lastenheft ? 'Sí' : 'No'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                request.has_economic_excel
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              Excel Económico: {request.has_economic_excel ? 'Sí' : 'No'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {request.origin_type === 'DIRECTA_VW' && (
                      <>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Departamento Solicitante VWM
                          </span>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {request.vw_department || 'N/D'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Nombre del Solicitante VWM
                          </span>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {request.vw_requester_name || 'N/D'}
                          </p>
                        </div>
                      </>
                    )}

                    {(request.origin_type === 'DIRECTA_VW' ||
                      request.origin_type === 'OTRO_CLIENTE') && (
                      <>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Contacto y Correo / Teléfono
                          </span>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {request.contact_name} ({request.contact_info || 'Sin correo/teléfono'})
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                            Medio de Recepción
                          </span>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {request.reception_channel || 'N/D'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                      Descripción del Requerimiento
                    </span>
                    <p className="mt-1 text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-line">
                      {request.description}
                    </p>
                  </div>

                  {request.observations && (
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 block font-titulos">
                        Observaciones
                      </span>
                      <p className="mt-1 text-slate-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200/70">
                        {request.observations}
                      </p>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-[#0F2747]" />
                      <div>
                        <span className="text-[11px] font-bold uppercase text-[#0F2747] block font-titulos">
                          Estructura de Carpeta en Google Drive
                        </span>
                        <span className="font-mono text-xs text-slate-600">
                          {request.drive_folder_path}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('documentos')}
                      className="px-3 py-1.5 rounded-lg bg-[#0F2747] text-white font-semibold text-[11px] cursor-pointer"
                    >
                      Gestionar Archivos ({documents.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* =========================================================
              PESTAÑA 2: GESTIÓN DOCUMENTAL E INTEGRACIÓN GOOGLE DRIVE
             ========================================================= */}
          {activeTab === 'documentos' && (
            <div className="isl-card p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    2. Documentos del Expediente (Google Drive)
                  </h2>
                  <p className="text-slate-500 mt-0.5">
                    Carpeta oficial:{' '}
                    <code className="font-mono font-bold text-[#0F2747] bg-slate-100 px-1.5 py-0.5 rounded">
                      {request.drive_folder_path}
                    </code>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] uppercase font-mono">
                  CONECTOR SERVIDOR ACTIVO
                </span>
              </div>

              {docFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  {docFeedback}
                </div>
              )}

              {/* Formulario de subida de archivos */}
              {canModify && (
                <form
                  onSubmit={handleUploadDocument}
                  className="p-4 rounded-xl bg-slate-50 border-2 border-blue-200 space-y-3"
                >
                  <div className="text-[11px] font-black text-[#0F2747] uppercase tracking-wider font-titulos flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#C72106]" />
                    <span>Subir Documento al Expediente en Google Drive</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
                        Categoría Documental *
                      </label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-xs"
                      >
                        {(Object.keys(DOC_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                          <option key={cat} value={cat}>
                            {DOC_CATEGORY_LABELS[cat]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
                        Vincular a Revisión (Opcional)
                      </label>
                      <select
                        value={uploadRevisionId}
                        onChange={(e) => setUploadRevisionId(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-xs"
                      >
                        <option value="">Expediente General</option>
                        {revisions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.revision_code} ({r.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1 font-titulos">
                        Seleccionar Archivo (PDF, Excel, Word, ZIP) *
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0F2747] file:text-white hover:file:bg-[#163866]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!selectedFile || uploadingDoc}
                      className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] disabled:opacity-50 text-white font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDoc ? 'Sincronizando con Google Drive...' : 'Subir al Expediente'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* Filtro por categoría */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDocFilterCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                    docFilterCategory === 'ALL'
                      ? 'bg-[#0F2747] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({documents.length})
                </button>
                {(Object.keys(DOC_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => {
                  const count = documents.filter((d) => d.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDocFilterCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        docFilterCategory === cat
                          ? 'bg-[#0F2747] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Lista de documentos */}
              {filteredDocuments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  No hay documentos registrados en esta categoría.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0F2747] border border-blue-200 font-bold text-[10px] uppercase font-titulos">
                            {DOC_CATEGORY_LABELS[doc.category] || doc.category}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {doc.original_name}
                          </span>
                          {doc.revision_code && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold">
                              {doc.revision_code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Drive: {doc.drive_folder_path} •{' '}
                          {(doc.size_bytes / 1024).toFixed(1)} KB • Subido por{' '}
                          {doc.uploaded_by_name?.split('(')[0].trim() || 'Sistema'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2747] hover:bg-[#163866] text-white font-bold text-[11px] transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              PESTAÑA 3: COTIZACIONES (MODALIDAD A / B, REVISIONES INMUTABLES Y PRESENTACIÓN)
             ========================================================= */}
          {activeTab === 'cotizaciones' && (
            <div className="isl-card p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    3. Cotizaciones y Control de Revisiones (Rev. 00, Rev. 01...)
                  </h2>
                  <p className="text-slate-500 mt-0.5">
                    Las revisiones presentadas son <strong>inmutables</strong>. Para modificar una oferta presentada se genera una nueva revisión.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyPromptForChatGPT}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer transition ${
                      copiedPrompt
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-100 hover:bg-[#0F2747] hover:text-white text-[#0F2747] border-slate-300'
                    }`}
                    title="Copia Folio, Revisión, Cliente, Proyecto y Alcance listos para pegar en ChatGPT y generar tu Word/PDF"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Ficha Copiada para ChatGPT!</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#C72106]" />
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Ficha para ChatGPT</span>
                      </>
                    )}
                  </button>

                  {canModify && !creatingNewRevision && (
                    <button
                      type="button"
                      onClick={startNewRevisionFromLatest}
                      className="px-3.5 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos shadow-industrial-red flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crear {nextRevisionLabel}</span>
                    </button>
                  )}
                </div>
              </div>

              {quoteError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {quoteError}
                </div>
              )}

              {quoteSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  {quoteSuccess}
                </div>
              )}

              {/* Selector de revisiones existentes */}
              {revisions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {revisions.map((rev) => {
                    const isSelected = !creatingNewRevision && selectedRevisionId === rev.id;
                    return (
                      <button
                        key={rev.id}
                        type="button"
                        onClick={() => {
                          setCreatingNewRevision(false);
                          setSelectedRevisionId(rev.id);
                          setQuoteError(null);
                          setQuoteSuccess(null);
                        }}
                        className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-[#0F2747] text-white border-[#0F2747]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                            <span>{rev.revision_code}</span>
                            {rev.is_immutable === 1 && <Lock className="w-3 h-3 text-amber-400" />}
                          </div>
                          <div className="text-[10px] opacity-85">
                            {formatMoney(rev.subtotal, rev.currency)} ({rev.status})
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {creatingNewRevision && (
                    <span className="px-3 py-2 rounded-xl bg-[#C72106] text-white font-bold font-mono text-xs">
                      + Capturando {nextRevisionLabel}
                    </span>
                  )}
                </div>
              )}

              {/* VISTA DE DETALLE DE REVISIÓN SELECCIONADA (CUANDO NO ESTAMOS CREANDO UNA NUEVA) */}
              {!creatingNewRevision && selectedRevision && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-[#0F2747]">
                          {selectedRevision.revision_code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase font-titulos ${
                            selectedRevision.status === 'PRESENTADA'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : selectedRevision.status === 'BORRADOR'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {selectedRevision.status}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-[10px]">
                          {selectedRevision.modality === 'INTERNAL'
                            ? 'Modalidad A: Captura en Aplicación'
                            : 'Modalidad B: Cotización Externa (Excel/PDF)'}
                        </span>
                        {selectedRevision.is_immutable === 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-mono">
                            <Lock className="w-3 h-3" />
                            <span>Inmutable</span>
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 mt-1">
                        Fecha de oferta: <strong>{selectedRevision.issue_date}</strong> • Moneda:{' '}
                        <strong>{selectedRevision.currency}</strong>
                        {selectedRevision.presented_at &&
                          ` • Presentada el ${selectedRevision.presented_at} vía ${selectedRevision.presentation_channel}`}
                      </p>
                    </div>

                    {canModify && (
                      <div className="flex items-center gap-2">
                        {selectedRevision.is_immutable === 0 && (
                          <button
                            type="button"
                            onClick={() => openPresentModal(selectedRevision)}
                            className="px-3.5 py-2 rounded-xl bg-[#0F2747] hover:bg-[#163866] text-white font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Marcar como Presentada</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRevision(selectedRevision)}
                            className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#C72106] font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                            title="Eliminar esta revisión de cotización (Solo Administrador)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar {selectedRevision.revision_code}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Si es Modalidad A, mostrar tabla de partidas */}
                  {selectedRevision.modality === 'INTERNAL' && (
                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 font-titulos">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Descripción del Concepto</th>
                            <th className="py-2 px-3">Unidad</th>
                            <th className="py-2 px-3 text-right">Cantidad</th>
                            <th className="py-2 px-3 text-right">P. Unitario</th>
                            <th className="py-2 px-3 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRevision.items.map((it) => (
                            <tr key={it.id}>
                              <td className="py-2 px-3 font-mono text-slate-400">{it.sort_order}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {it.concept}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{it.unit}</td>
                              <td className="py-2 px-3 text-right font-mono">{it.quantity}</td>
                              <td className="py-2 px-3 text-right font-mono">
                                {formatMoney(it.unit_price, selectedRevision.currency)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatMoney(it.amount, selectedRevision.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Si es Modalidad B, mostrar documento externo vinculado */}
                  {selectedRevision.modality === 'EXTERNAL' && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Oferta Económica Elaborada Externamente (Excel / PDF / Estructura VWM)
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            No exige recapturar conceptos individuales; conserva el importe antes de impuestos y su archivo soporte.
                          </span>
                        </div>
                      </div>
                      {documents.find((d) => d.revision_id === selectedRevision.id) && (
                        <a
                          href={`/api/documents/${
                            documents.find((d) => d.revision_id === selectedRevision.id)!.id
                          }/download`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2747] text-white font-bold text-[11px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar Oferta</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Resumen de importes de la revisión */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
                        Subtotal (Antes de Impuestos)
                      </span>
                      <span className="font-mono font-black text-base text-[#0F2747]">
                        {formatMoney(selectedRevision.subtotal, selectedRevision.currency)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
                        Impuestos ({selectedRevision.tax_rate}% IVA)
                      </span>
                      <span className="font-mono font-bold text-base text-slate-700">
                        {formatMoney(selectedRevision.tax_amount, selectedRevision.currency)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block font-titulos">
                        Total con Impuestos
                      </span>
                      <span className="font-mono font-black text-base text-emerald-800">
                        {formatMoney(selectedRevision.total, selectedRevision.currency)}
                      </span>
                    </div>
                  </div>

                  {selectedRevision.observations && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700">
                      <strong className="font-titulos uppercase text-[10px] text-slate-400 block">
                        Observaciones de la Revisión:
                      </strong>
                      {selectedRevision.observations}
                    </div>
                  )}

                  {/* Si la revisión está en BORRADOR (no inmutable), permitir cargarla en el editor */}
                  {canModify && selectedRevision.is_immutable === 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          loadDraftIntoEditor(selectedRevision);
                          setCreatingNewRevision(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar Conceptos de este Borrador</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FORMULARIO DE CAPTURA / EDICIÓN DE REVISIÓN (MODALIDAD A O MODALIDAD B) */}
              {canModify && creatingNewRevision && (
                <form
                  onSubmit={(e) =>
                    handleSaveQuoteRevision(
                      e,
                      selectedRevisionId !== 'NEW' &&
                        Boolean(selectedRevision && selectedRevision.is_immutable === 0)
                    )
                  }
                  className="p-4 rounded-xl bg-slate-50 border-2 border-blue-300 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#C72106] font-titulos">
                        {selectedRevisionId !== 'NEW'
                          ? `Editando Borrador ${selectedRevision?.revision_code}`
                          : `Registrando Nueva Revisión (${nextRevisionLabel})`}
                      </span>
                      <h3 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
                        Selecciona la Modalidad de Captura Económica
                      </h3>
                    </div>

                    {/* Conmutador Modalidad A vs Modalidad B */}
                    <div className="inline-flex rounded-xl bg-white p-1 border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setQuoteModality('INTERNAL')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
                          quoteModality === 'INTERNAL'
                            ? 'bg-[#0F2747] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Modalidad A: Captura Interna
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuoteModality('EXTERNAL')}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition ${
                          quoteModality === 'EXTERNAL'
                            ? 'bg-[#0F2747] text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Modalidad B: Externa (Excel / PDF)
                      </button>
                    </div>
                  </div>

                  {/* Campos generales de la revisión */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Fecha de Cotización *
                      </label>
                      <input
                        type="date"
                        required
                        value={quoteDate}
                        onChange={(e) => setQuoteDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Moneda *
                      </label>
                      <select
                        value={quoteCurrency}
                        onChange={(e) => setQuoteCurrency(e.target.value as CurrencyCode)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="MXN">MXN — Peso Mexicano</option>
                        <option value="USD">USD — Dólar Americano</option>
                        <option value="EUR">EUR — Euro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Tasa de Impuesto (IVA %)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={quoteTaxRate}
                        onChange={(e) => setQuoteTaxRate(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {/* CONTENIDO ESPECÍFICO DE MODALIDAD A (TABLA DE CONCEPTOS) */}
                  {quoteModality === 'INTERNAL' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-[#0F2747] font-titulos">
                          Partidas / Conceptos de la Cotización
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuoteItems((prev) => [
                              ...prev,
                              {
                                description: '',
                                unit: 'Servicio',
                                quantity: 1,
                                unit_price: 0,
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0F2747] text-white font-bold text-[11px] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar Concepto</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto bg-white rounded-xl border border-slate-300">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600 font-titulos">
                              <th className="py-2 px-2.5">Descripción del Concepto *</th>
                              <th className="py-2 px-2.5 w-28">Unidad</th>
                              <th className="py-2 px-2.5 w-24 text-right">Cantidad</th>
                              <th className="py-2 px-2.5 w-32 text-right">Precio Unitario</th>
                              <th className="py-2 px-2.5 w-32 text-right">Importe</th>
                              <th className="py-2 px-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {quoteItems.map((item, idx) => {
                              const lineTotal =
                                Number(item.quantity || 0) * Number(item.unit_price || 0);
                              return (
                                <tr key={idx}>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      required
                                      value={item.description}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setQuoteItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx ? { ...it, description: val } : it
                                          )
                                        );
                                      }}
                                      placeholder="Descripción técnica del alcance..."
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={item.unit}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setQuoteItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx ? { ...it, unit: val } : it
                                          )
                                        );
                                      }}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                                    >
                                      {UNIT_OPTIONS.map((u) => (
                                        <option key={u} value={u}>
                                          {u}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      required
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setQuoteItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx ? { ...it, quantity: val } : it
                                          )
                                        );
                                      }}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-right font-mono"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      required
                                      value={item.unit_price}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setQuoteItems((prev) =>
                                          prev.map((it, i) =>
                                            i === idx ? { ...it, unit_price: val } : it
                                          )
                                        );
                                      }}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-right font-mono"
                                    />
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                                    {formatMoney(lineTotal, quoteCurrency)}
                                  </td>
                                  <td className="p-2 text-center">
                                    {quoteItems.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setQuoteItems((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* CONTENIDO ESPECÍFICO DE MODALIDAD B (COTIZACIÓN EXTERNA EXCEL / WORD / PDF) */
                    <div className="p-4 rounded-xl bg-white border border-slate-300 space-y-3">
                      <div className="text-[11px] font-bold text-[#0F2747] uppercase font-titulos">
                        Modalidad B — Registro de Oferta Elaborada Externamente (Estructuras Económicas VWM / Excel / PDF)
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                            Importe Ofertado Antes de Impuestos (Subtotal) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={extSubtotal}
                            onChange={(e) => setExtSubtotal(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-mono font-bold text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                            Vincular Archivo Existente del Expediente
                          </label>
                          <select
                            value={extDocumentId}
                            onChange={(e) => setExtDocumentId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                          >
                            <option value="">-- O subir archivo nuevo abajo --</option>
                            {documents.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.original_name} ({d.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                            O Adjuntar Nuevo Documento Excel / Word / PDF de la Cotización
                          </label>
                          <input
                            type="file"
                            onChange={(e) => setExtUploadFile(e.target.files?.[0] || null)}
                            className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0F2747] file:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observaciones y Totales Calculados */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-7">
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Observaciones / Condiciones Comerciales de la Revisión
                      </label>
                      <textarea
                        rows={3}
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="Tiempo de entrega, vigencia de oferta, notas sobre estructura económica..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="sm:col-span-5 p-3.5 rounded-xl bg-[#0F2747] text-white space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Subtotal antes de IVA:</span>
                        <span className="font-mono font-bold">
                          {formatMoney(calculatedTotals.subtotal, quoteCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">IVA ({quoteTaxRate}%):</span>
                        <span className="font-mono">
                          {formatMoney(calculatedTotals.taxAmount, quoteCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-black border-t border-white/15 pt-1.5">
                        <span className="font-titulos uppercase">Total Oferta:</span>
                        <span className="font-mono text-emerald-300">
                          {formatMoney(calculatedTotals.total, quoteCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    {revisions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingNewRevision(false);
                          setSelectedRevisionId(revisions[0].id);
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingQuote}
                      className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos shadow-industrial-red flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {savingQuote
                          ? 'Guardando...'
                          : selectedRevisionId !== 'NEW'
                          ? `Guardar Cambios en ${selectedRevision?.revision_code}`
                          : `Guardar ${nextRevisionLabel}`}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =========================================================
              PESTAÑA 4: SEGUIMIENTO COMERCIAL
             ========================================================= */}
          {activeTab === 'seguimiento' && (
            <div className="isl-card p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    4. Línea de Tiempo de Seguimiento Comercial
                  </h2>
                  <p className="text-slate-500">
                    Registro cronológico de llamadas, correos, reuniones, aclaraciones técnicas y control de recordatorios.
                  </p>
                </div>
              </div>

              {canModify && request.status !== 'CERRADA' && (
                <form
                  onSubmit={handleRegisterFollowUp}
                  className="p-4 rounded-xl bg-slate-50 border-2 border-blue-200 space-y-3"
                >
                  <div className="text-[11px] font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    Registrar Nueva Actividad o Compromiso de Seguimiento
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Tipo de Actividad *
                      </label>
                      <select
                        value={actType}
                        onChange={(e) => setActType(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="SEGUIMIENTO">Seguimiento Comercial</option>
                        <option value="LLAMADA">Llamada Telefónica</option>
                        <option value="CORREO">Correo Electrónico</option>
                        <option value="REUNION">Reunión / Visita Técnica</option>
                        <option value="ACLARACION">Aclaración Técnica / Económica</option>
                        <option value="NOTA">Nota Interna</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Fecha de Actividad *
                      </label>
                      <input
                        type="date"
                        required
                        value={actDate}
                        onChange={(e) => setActDate(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#C72106] mb-1 font-titulos">
                        Fecha Próxima Actividad (Recordatorio)
                      </label>
                      <input
                        type="date"
                        value={actNextDate}
                        onChange={(e) => setActNextDate(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#0F2747]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Descripción de lo Realizado / Comentarios *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={actDesc}
                        onChange={(e) => setActDesc(e.target.value)}
                        placeholder="Detalle el resultado del contacto con el comprador o usuario solicitante..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Descripción de la Próxima Actividad Programada
                      </label>
                      <input
                        type="text"
                        value={actNextDesc}
                        onChange={(e) => setActNextDesc(e.target.value)}
                        placeholder="Ej. Confirmar liberación de tabla comparativa con compras..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Adjuntar Minuta / Evidencia (Opcional)
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setActFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0F2747] file:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingActivity}
                      className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{savingActivity ? 'Guardando...' : 'Registrar Seguimiento'}</span>
                    </button>
                  </div>
                </form>
              )}

              {activities.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No hay actividades de seguimiento registradas aún para este expediente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activities.map((act, idx) => {
                    const isCompleted = Number(act.is_completed) === 1;
                    const isCancelled = Number(act.reminder_cancelled) === 1;
                    return (
                      <div
                        key={String(act.id || idx)}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-[#0F2747] text-white font-bold text-[10px] uppercase font-titulos">
                              {String(act.activity_type)}
                            </span>
                            <span className="font-mono font-bold text-slate-700">
                              {String(act.activity_date)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">
                              • {String(act.responsible_name || '')}
                            </span>
                            {isCompleted && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                                Completado
                              </span>
                            )}
                            {isCancelled && !isCompleted && (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                Recordatorio Cancelado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-medium text-slate-900">
                            {String(act.description)}
                          </p>
                          {Boolean(act.next_activity_date) && !isCompleted && !isCancelled && (
                            <p className="mt-1 text-[11px] font-semibold text-[#C72106]">
                              Próxima actividad programada: {String(act.next_activity_date)} —{' '}
                              {String(act.next_activity_description || '')}
                            </p>
                          )}
                        </div>

                        {canModify &&
                          Boolean(act.next_activity_date) &&
                          !isCompleted &&
                          !isCancelled && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleFollowUpAction(String(act.id), 'COMPLETE')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase cursor-pointer"
                              >
                                Completar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFollowUpAction(String(act.id), 'RESCHEDULE')}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[10px] uppercase cursor-pointer"
                              >
                                Reprogramar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFollowUpAction(String(act.id), 'CANCEL')}
                                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] uppercase cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              PESTAÑA 5: RESULTADO Y CIERRE COMERCIAL (SECCIÓN 11 DEL PROMPT MAESTRO)
             ========================================================= */}
          {activeTab === 'cierre' && (
            <div className="isl-card p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    5. Resultado y Cierre Comercial
                  </h2>
                  <p className="text-slate-500">
                    En adjudicaciones totales o parciales es <strong>obligatorio</strong> adjuntar o seleccionar al menos una evidencia documental (Orden de Compra, correo de adjudicación, contrato o confirmación en plataforma).
                  </p>
                </div>
              </div>

              {closureError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {closureError}
                </div>
              )}

              {closureSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  {closureSuccess}
                </div>
              )}

              {closureState && (
                <div className="p-4 rounded-xl bg-emerald-50/80 border-2 border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white font-black text-xs uppercase font-titulos">
                      EXPEDIENTE CERRADO — {String(closureState.result)}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      Fecha cierre: {String(closureState.closure_date)}
                    </span>
                  </div>

                  {Boolean(closureState.awarded_amount) && (
                    <div className="text-sm font-black text-[#0F2747] font-mono">
                      Importe Efectivamente Adjudicado:{' '}
                      {formatMoney(
                        Number(closureState.awarded_amount),
                        String(closureState.awarded_currency || closureState.currency || 'MXN')
                      )}
                      {Boolean(
                        closureState.purchase_order_number || closureState.purchase_order_ref
                      ) && (
                        <span className="ml-3 text-xs text-emerald-900">
                          • OC / Contrato:{' '}
                          {String(
                            closureState.purchase_order_number || closureState.purchase_order_ref
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-slate-800 font-medium">{String(closureState.comments || '')}</p>
                </div>
              )}

              {canModify && (
                <form
                  onSubmit={handleRegisterClosure}
                  className="p-4 rounded-xl bg-slate-50 border-2 border-blue-200 space-y-4"
                >
                  <div className="text-[11px] font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                    {closureState
                      ? 'Actualizar Datos de Cierre Comercial'
                      : 'Registrar Cierre Comercial del Expediente'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Resultado Comercial *
                      </label>
                      <select
                        value={closureResult}
                        onChange={(e) => setClosureResult(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl font-bold text-[#0F2747]"
                      >
                        <option value="GANADA">Ganada (Adjudicada Total)</option>
                        <option value="ADJUDICADA_PARCIALMENTE">Adjudicada Parcialmente</option>
                        <option value="PERDIDA">Perdida (No Adjudicada)</option>
                        <option value="CANCELADA">Cancelada por el Cliente</option>
                        <option value="SIN_RESPUESTA">Sin Respuesta / No Participamos</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Fecha de Cierre *
                      </label>
                      <input
                        type="date"
                        required
                        value={closureDate}
                        onChange={(e) => setClosureDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                      />
                    </div>

                    {(closureResult === 'GANADA' ||
                      closureResult === 'ADJUDICADA_PARCIALMENTE') && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-1 font-titulos">
                            Importe Efectivamente Adjudicado (Antes de IVA) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={closureAwardedAmt}
                            onChange={(e) => setClosureAwardedAmt(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-xl font-mono font-bold text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                            Moneda Adjudicada *
                          </label>
                          <select
                            value={closureCurrency}
                            onChange={(e) => setClosureCurrency(e.target.value as CurrencyCode)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                          >
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                            Número de Orden de Compra / Contrato (Cuando exista)
                          </label>
                          <input
                            type="text"
                            value={closurePoNumber}
                            onChange={(e) => setClosurePoNumber(e.target.value)}
                            placeholder="Ej. OC-4500981234"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#C72106] mb-1 font-titulos">
                            Seleccionar Evidencia del Expediente (Obligatoria) *
                          </label>
                          <select
                            value={closureEvidenceDocId}
                            onChange={(e) => setClosureEvidenceDocId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                          >
                            <option value="">-- O adjuntar nuevo archivo abajo --</option>
                            {documents.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.original_name} ({d.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-300">
                          <label className="block text-[10px] font-bold uppercase text-amber-950 mb-1 font-titulos">
                            O Subir Nuevo Archivo de Evidencia de Adjudicación (Orden de Compra, Correo, Contrato) *
                          </label>
                          <input
                            type="file"
                            onChange={(e) => setClosureEvidenceFile(e.target.files?.[0] || null)}
                            className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0F2747] file:text-white"
                          />
                        </div>
                      </>
                    )}

                    {(closureResult === 'PERDIDA' || closureResult === 'CANCELADA') && (
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-red-700 mb-1 font-titulos">
                          Motivo de Pérdida o Cancelación (Obligatorio) *
                        </label>
                        <input
                          type="text"
                          required
                          value={closureLossReason}
                          onChange={(e) => setClosureLossReason(e.target.value)}
                          placeholder="Ej.Diferencia en precio objetivo, cancelación de presupuesto de planta..."
                          className="w-full px-3 py-2 bg-white border-2 border-red-300 rounded-xl"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Comentarios Finales de Cierre
                      </label>
                      <textarea
                        rows={2}
                        value={closureComments}
                        onChange={(e) => setClosureComments(e.target.value)}
                        placeholder="Observaciones adicionales del resultado comercial..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingClosure}
                      className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase tracking-wider font-titulos shadow-industrial-red flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        {savingClosure ? 'Validando y Cerrando...' : 'Confirmar Cierre Comercial'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* PANEL LATERAL DERECHO (4 COLS): BITÁCORA DE AUDITORÍA DEL EXPEDIENTE */}
        <div className="lg:col-span-4 space-y-4">
          <div className="isl-card overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#0F2747]" />
                <h3 className="text-xs font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                  Bitácora de Auditoría
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                TRAZABILIDAD
              </span>
            </div>

            <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto azia-scrollbar text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-[#C72106] pl-3 py-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-slate-700">
                      {log.actor_name?.split('(')[0].trim() || 'Usuario'}
                    </span>
                    <span className="font-mono">{log.created_at.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div className="font-bold text-[#0F2747] text-xs mt-0.5">
                    {log.action.replace(/_/g, ' ')}
                  </div>
                  {log.details_json && (
                    <div className="mt-1 p-1.5 rounded bg-slate-50 border border-slate-100 font-mono text-[10px] text-slate-600 break-all">
                      {log.details_json}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          MODAL «MARCAR COMO PRESENTADA» (SECCIÓN 9 DEL PROMPT MAESTRO)
         ========================================================= */}
      {presentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C72106] block font-titulos">
                  Presentación Formal de Oferta
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                  Marcar Revisión como Presentada — {request.folio}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPresentModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPresentation} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <strong>Aviso de Inmutabilidad:</strong> Al confirmar la presentación, esta revisión quedará bloqueada contra edición y el estado del expediente pasará a <strong>Presentada</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Fecha de Presentación *
                  </label>
                  <input
                    type="date"
                    required
                    value={presentDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setPresentDate(d);
                      if (d) {
                        setPresentCustomFollowUpDate(
                          addBusinessDaysClient(d, presentFollowUpDays)
                        );
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Medio de Presentación *
                  </label>
                  <select
                    value={presentChannel}
                    onChange={(e) => setPresentChannel(e.target.value as PresentationChannel)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="PLATAFORMA_VW">Plataforma Volkswagen</option>
                    <option value="CORREO">Correo electrónico</option>
                    <option value="ENTREGA_DIRECTA">Entrega directa</option>
                    <option value="OTRO">Otro medio</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Días Hábiles para Seguimiento
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={presentFollowUpDays}
                    onChange={(e) => {
                      const days = Number(e.target.value) || 3;
                      setPresentFollowUpDays(days);
                      if (presentDate) {
                        setPresentCustomFollowUpDate(addBusinessDaysClient(presentDate, days));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-[#C72106] mb-1 font-titulos">
                    Fecha de Seguimiento Propuesta *
                  </label>
                  <input
                    type="date"
                    required
                    value={presentCustomFollowUpDate}
                    onChange={(e) => setPresentCustomFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-red-50/40 border-2 border-[#C72106]/40 rounded-xl font-mono font-bold text-[#0F2747]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Evidencia o Acuse de Entrega (Opcional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setPresentEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0F2747] file:text-white"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Notas de Presentación
                </label>
                <textarea
                  rows={2}
                  value={presentNotes}
                  onChange={(e) => setPresentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPresentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={presentingSaving}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase font-titulos flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{presentingSaving ? 'Confirmando...' : 'Confirmar Presentación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO DE ESTADO */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                Actualizar Estado — {request.folio}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateStatus} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1.5 font-titulos">
                  Nuevo Estado Comercial
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as RequestStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold"
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
                  Comentario de Auditoría
                </label>
                <textarea
                  rows={3}
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-4 py-2 rounded-xl bg-[#C72106] text-white font-bold uppercase font-titulos flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REPROGRAMAR SEGUIMIENTO */}
      {rescheduleActId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exp-reschedule-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0F2747] text-white flex items-center justify-between">
              <h3 id="exp-reschedule-title" className="text-sm font-black uppercase font-titulos">
                Reprogramar Compromiso
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleActId(null)}
                aria-label="Cerrar"
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRescheduleAct} className="p-5 space-y-4 text-xs">
              <div>
                <label
                  htmlFor="exp-reschedule-date"
                  className="block font-bold uppercase text-slate-700 mb-1.5 font-titulos"
                >
                  Nueva Fecha Programada *
                </label>
                <input
                  id="exp-reschedule-date"
                  type="date"
                  required
                  value={rescheduleActDate}
                  onChange={(e) => setRescheduleActDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono font-bold text-[#0F2747]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleActId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRescheduleAct}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase font-titulos inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingRescheduleAct ? 'Guardando...' : 'Confirmar Fecha'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteExpOpen}
        title="Eliminar Expediente"
        message={`¿Seguro que deseas eliminar definitivamente este expediente (${request.folio} — ${request.project_name}) y todas sus cotizaciones?`}
        confirmLabel="Sí, Eliminar"
        loading={deletingExp}
        onConfirm={executeDeleteExpediente}
        onCancel={() => setConfirmDeleteExpOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteRev)}
        title="Eliminar Revisión"
        message={
          confirmDeleteRev
            ? `¿Seguro que deseas eliminar la revisión ${confirmDeleteRev.revision_code} (${formatMoney(
                confirmDeleteRev.subtotal,
                confirmDeleteRev.currency
              )})?`
            : ''
        }
        confirmLabel="Sí, Eliminar"
        loading={deletingRev}
        onConfirm={executeDeleteRevision}
        onCancel={() => setConfirmDeleteRev(null)}
      />
    </div>
  );
}
