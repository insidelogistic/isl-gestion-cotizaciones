'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Building2,
  FileSpreadsheet,
  UserCheck,
  Plus,
  X,
  Info,
} from 'lucide-react';
import type {
  CustomerContactRecord,
  CustomerRecord,
  OriginType,
  SafeUser,
} from '@/lib/db/types';

interface DynamicRequestFormProps {
  customers: CustomerRecord[];
  contacts: CustomerContactRecord[];
  users: SafeUser[];
  currentUser: SafeUser;
  defaultDate: string;
}

const RECEPTION_CHANNELS = [
  'Correo Electrónico',
  'Teléfono / WhatsApp',
  'Visita en Planta',
  'Plataforma Volkswagen',
  'Entrega Directa',
  'Otro',
];

export function DynamicRequestForm({
  customers: initialCustomers,
  contacts: initialContacts,
  users,
  currentUser,
  defaultDate,
}: DynamicRequestFormProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers);
  const [contacts, setContacts] = useState<CustomerContactRecord[]>(initialContacts);

  // Origen dinámico (A: LICITACION_VW, B: DIRECTA_VW, C: OTRO_CLIENTE)
  const [originType, setOriginType] = useState<OriginType>('LICITACION_VW');

  // Campos comunes
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [receivedDate, setReceivedDate] = useState(defaultDate);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState(currentUser.id);
  const [observations, setObservations] = useState('');

  // Campos Origen A: Licitación Volkswagen
  const [vwTenderNumber, setVwTenderNumber] = useState('');
  const [vwBuyerName, setVwBuyerName] = useState('Lic. Claudia Von Der Meden');
  const [hasLastenheft, setHasLastenheft] = useState(true);
  const [hasEconomicExcel, setHasEconomicExcel] = useState(true);

  // Campos Origen B: Solicitud directa Volkswagen
  const [vwDepartment, setVwDepartment] = useState('Nave 4 - Prensas y Carrocerías');
  const [vwRequesterName, setVwRequesterName] = useState('Ing. Omar Sánchez Minutti');
  const [contactInfo, setContactInfo] = useState('omar.sanchez@vw.com.mx');
  const [receptionChannel, setReceptionChannel] = useState('Correo Electrónico');

  // Campos Origen C: Otro cliente
  const nonVwCustomers = customers.filter((c) => !c.is_vw);
  const [customerId, setCustomerId] = useState(nonVwCustomers[0]?.id || customers[0]?.id || '');
  const [contactName, setContactName] = useState('');

  // Estados de envío y error
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Nuevo Cliente
  const [newCustomerModal, setNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustShort, setNewCustShort] = useState('');
  const [newCustPlant, setNewCustPlant] = useState('');
  const [newCustRfc, setNewCustRfc] = useState('');
  const [newCustContactName, setNewCustContactName] = useState('');
  const [newCustContactEmail, setNewCustContactEmail] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Modal Nuevo Contacto / Solicitante
  const [newContactModal, setNewContactModal] = useState(false);
  const [newCntName, setNewCntName] = useState('');
  const [newCntPosition, setNewCntPosition] = useState('');
  const [newCntDept, setNewCntDept] = useState('');
  const [newCntEmail, setNewCntEmail] = useState('');
  const [newCntPhone, setNewCntPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const vwContacts = contacts.filter((c) => c.customer_short_name === 'VWM');
  const selectedCustomerContacts = contacts.filter((c) => c.customer_id === customerId);
  const selectedCustomerObj =
    originType === 'OTRO_CLIENTE'
      ? customers.find((c) => c.id === customerId)
      : customers.find((c) => c.is_vw === 1);
  const previewPrefix = (selectedCustomerObj?.name || 'VOL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  const previewYear = receivedDate.slice(0, 4) || '2026';

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload =
        originType === 'LICITACION_VW'
          ? {
              origin_type: 'LICITACION_VW' as const,
              project_name: projectName,
              description,
              received_date: receivedDate,
              deadline_date: deadlineDate,
              responsible_user_id: responsibleUserId,
              observations,
              vw_tender_number: vwTenderNumber,
              vw_buyer_name: vwBuyerName,
              has_lastenheft: hasLastenheft,
              has_economic_excel: hasEconomicExcel,
            }
          : originType === 'DIRECTA_VW'
          ? {
              origin_type: 'DIRECTA_VW' as const,
              project_name: projectName,
              description,
              received_date: receivedDate,
              deadline_date: deadlineDate || null,
              responsible_user_id: responsibleUserId,
              observations,
              vw_department: vwDepartment,
              vw_requester_name: vwRequesterName,
              contact_info: contactInfo,
              reception_channel: receptionChannel,
            }
          : {
              origin_type: 'OTRO_CLIENTE' as const,
              customer_id: customerId,
              project_name: projectName,
              description,
              received_date: receivedDate,
              deadline_date: deadlineDate || null,
              responsible_user_id: responsibleUserId,
              observations,
              contact_name: contactName,
              contact_info: contactInfo,
              reception_channel: receptionChannel,
            };

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al registrar la solicitud.');
      }

      router.push(`/solicitudes/${data.request.id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar.';
      setFormError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustName,
          short_name: newCustShort,
          plant_or_location: newCustPlant,
          rfc: newCustRfc,
          contact_name: newCustContactName,
          contact_email: newCustContactEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo crear el cliente.');
      }
      setCustomers((prev) => [...prev, data.customer]);
      setCustomerId(data.customer.id);
      if (data.customer.initialContact) {
        setContacts((prev) => [...prev, data.customer.initialContact]);
        setContactName(data.customer.initialContact.name);
        setContactInfo(data.customer.initialContact.email || '');
      }
      setNewCustomerModal(false);
      setNewCustName('');
      setNewCustShort('');
      setNewCustPlant('');
      setNewCustRfc('');
      setNewCustContactName('');
      setNewCustContactEmail('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear cliente');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSaveNewContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      const targetCustomerId =
        originType === 'OTRO_CLIENTE'
          ? customerId
          : customers.find((c) => c.is_vw)?.id || customers[0]?.id;

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: targetCustomerId,
          name: newCntName,
          position: newCntPosition,
          department: newCntDept,
          email: newCntEmail,
          phone: newCntPhone,
          contact_type:
            originType === 'LICITACION_VW'
              ? 'COMPRADOR_VW'
              : originType === 'DIRECTA_VW'
              ? 'SOLICITANTE_VW'
              : 'CONTACTO_EXTERNO',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al registrar contacto.');
      }
      setContacts((prev) => [...prev, data.contact]);
      if (originType === 'LICITACION_VW') {
        setVwBuyerName(data.contact.name);
      } else if (originType === 'DIRECTA_VW') {
        setVwRequesterName(data.contact.name);
        if (data.contact.department) setVwDepartment(data.contact.department);
        setContactInfo(data.contact.email || data.contact.phone || '');
      } else {
        setContactName(data.contact.name);
        setContactInfo(data.contact.email || data.contact.phone || '');
      }
      setNewContactModal(false);
      setNewCntName('');
      setNewCntPosition('');
      setNewCntDept('');
      setNewCntEmail('');
      setNewCntPhone('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear contacto');
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* CABECERA COMPACTA ESTILO ERP TRANS */}
      <div className="isl-card px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/solicitudes"
              className="text-xs text-[#C72106] font-bold hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Solicitudes y Cotizaciones</span>
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">
              Folio Automático · Estado Inicial: Recibida
            </span>
          </div>
          <h1 className="text-lg font-black text-[#0F2747] uppercase tracking-wider mt-0.5 font-titulos">
            Registrar Nueva Solicitud de Cotización
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/solicitudes"
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            form="newQuoteRequestForm"
            disabled={submitting}
            className="px-5 py-2 bg-[#C72106] hover:bg-[#A31B05] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-industrial-red transition flex items-center gap-1.5 cursor-pointer font-titulos disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Generando Expediente...' : 'Guardar y Generar Expediente'}</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-xl bg-red-50 border-2 border-[#C72106] text-[#C72106] text-xs font-semibold">
          {formError}
        </div>
      )}

      <form id="newQuoteRequestForm" onSubmit={handleCreateRequest} className="space-y-4">
        {/* PASO 1: SELECCIÓN DINÁMICA DE ORIGEN (A, B o C) */}
        <div className="isl-card p-5 space-y-3.5">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                1. Seleccione el Origen de la Solicitud
              </h2>
              <p className="text-xs text-slate-500">
                El formulario mostrará únicamente los campos correspondientes al origen seleccionado.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-[#0F2747] font-mono text-xs font-bold">
              Folio: Automático (COT-{previewYear}-{previewPrefix}-XXXX)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Opción A: Licitación Volkswagen */}
            <button
              type="button"
              onClick={() => setOriginType('LICITACION_VW')}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                originType === 'LICITACION_VW'
                  ? 'border-[#C72106] bg-red-50/40 ring-2 ring-[#C72106]/15'
                  : 'border-slate-200 hover:border-[#0F2747]/50 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-[#0F2747] text-white text-[11px] font-bold font-titulos uppercase">
                  Origen A
                </span>
                <FileSpreadsheet
                  className={`w-5 h-5 ${
                    originType === 'LICITACION_VW' ? 'text-[#C72106]' : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <div className="font-black text-sm text-[#0F2747] font-titulos uppercase">
                  Licitación Volkswagen
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publicada mediante plataforma VWM con LASTENHEFT y estructura económica Excel.
                </p>
              </div>
            </button>

            {/* Opción B: Solicitud directa Volkswagen */}
            <button
              type="button"
              onClick={() => setOriginType('DIRECTA_VW')}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                originType === 'DIRECTA_VW'
                  ? 'border-[#C72106] bg-red-50/40 ring-2 ring-[#C72106]/15'
                  : 'border-slate-200 hover:border-[#0F2747]/50 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-[#0F2747] text-white text-[11px] font-bold font-titulos uppercase">
                  Origen B
                </span>
                <UserCheck
                  className={`w-5 h-5 ${
                    originType === 'DIRECTA_VW' ? 'text-[#C72106]' : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <div className="font-black text-sm text-[#0F2747] font-titulos uppercase">
                  Solicitud Directa Volkswagen
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solicitada directamente por personal de nave o departamento de VWM.
                </p>
              </div>
            </button>

            {/* Opción C: Otro cliente */}
            <button
              type="button"
              onClick={() => setOriginType('OTRO_CLIENTE')}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                originType === 'OTRO_CLIENTE'
                  ? 'border-[#C72106] bg-red-50/40 ring-2 ring-[#C72106]/15'
                  : 'border-slate-200 hover:border-[#0F2747]/50 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-[#0F2747] text-white text-[11px] font-bold font-titulos uppercase">
                  Origen C
                </span>
                <Building2
                  className={`w-5 h-5 ${
                    originType === 'OTRO_CLIENTE' ? 'text-[#C72106]' : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <div className="font-black text-sm text-[#0F2747] font-titulos uppercase">
                  Otro Cliente Industrial
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solicitud recibida de Audi, Gestamp, Schaeffler u otra empresa industrial.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* PASO 2: CAMPOS ESPECÍFICOS SEGÚN ORIGEN + CAMPOS COMUNES (2 COLUMNAS) */}
        <div className="isl-card p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black text-[#0F2747] uppercase tracking-wider font-titulos">
                2. Datos Específicos de{' '}
                {originType === 'LICITACION_VW'
                  ? 'Licitación Volkswagen'
                  : originType === 'DIRECTA_VW'
                  ? 'Solicitud Directa Volkswagen'
                  : 'Otro Cliente'}
              </h2>
              <p className="text-xs text-slate-400">
                Complete los datos de identificación comercial y técnica del requerimiento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* COLUMNA IZQUIERDA: CAMPOS ESPECÍFICOS DEL ORIGEN */}
            <div className="space-y-3.5">
              {originType === 'LICITACION_VW' && (
                <>
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Cliente Asignado
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Volkswagen de México S.A. de C.V. (Complejo Puebla)"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-bold text-[#0F2747]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Número o Referencia de Licitación <span className="text-[#C72106]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={vwTenderNumber}
                      onChange={(e) => setVwTenderNumber(e.target.value)}
                      placeholder="Ej. VWM-LIC-2026-4410 / RFQ-99201"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold uppercase text-slate-700 font-titulos">
                        Comprador Responsable VWM <span className="text-[#C72106]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewContactModal(true)}
                        className="text-[11px] text-[#C72106] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuevo Comprador</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      list="vw-buyers-list"
                      value={vwBuyerName}
                      onChange={(e) => setVwBuyerName(e.target.value)}
                      placeholder="Nombre del comprador responsable en VWM"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                    <datalist id="vw-buyers-list">
                      {vwContacts.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Fecha Límite de Presentación <span className="text-[#C72106]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-bold uppercase text-[#0F2747] font-titulos block">
                      Documentación Técnica de Licitación (Opcional al crear)
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasLastenheft}
                        onChange={(e) => setHasLastenheft(e.target.checked)}
                        className="rounded text-[#C72106]"
                      />
                      <span className="font-medium text-slate-700">
                        Incluye LASTENHEFT (Especificación Técnica VWM)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasEconomicExcel}
                        onChange={(e) => setHasEconomicExcel(e.target.checked)}
                        className="rounded text-[#C72106]"
                      />
                      <span className="font-medium text-slate-700">
                        Incluye Excel de Estructura Económica oficial del comprador
                      </span>
                    </label>
                  </div>
                </>
              )}

              {originType === 'DIRECTA_VW' && (
                <>
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Cliente Asignado
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Volkswagen de México S.A. de C.V. (Solicitud Directa Planta)"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-bold text-[#0F2747]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Departamento / Nave Solicitante <span className="text-[#C72106]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={vwDepartment}
                      onChange={(e) => setVwDepartment(e.target.value)}
                      placeholder="Ej. Nave 4 - Prensas, Nave 21 - Pintura, Mantenimiento Central..."
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold uppercase text-slate-700 font-titulos">
                        Nombre del Solicitante VWM <span className="text-[#C72106]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewContactModal(true)}
                        className="text-[11px] text-[#C72106] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuevo Solicitante</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      list="vw-requesters-list"
                      value={vwRequesterName}
                      onChange={(e) => setVwRequesterName(e.target.value)}
                      placeholder="Ej. Ing. Omar Sánchez Minutti"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                    <datalist id="vw-requesters-list">
                      {vwContacts.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Correo o Teléfono <span className="text-[#C72106]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder="correo@vw.com.mx / Ext."
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Medio de Recepción <span className="text-[#C72106]">*</span>
                      </label>
                      <select
                        value={receptionChannel}
                        onChange={(e) => setReceptionChannel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                      >
                        {RECEPTION_CHANNELS.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {originType === 'OTRO_CLIENTE' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold uppercase text-slate-700 font-titulos">
                        Cliente <span className="text-[#C72106]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewCustomerModal(true)}
                        className="text-[11px] text-[#C72106] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuevo Cliente</span>
                      </button>
                    </div>
                    <select
                      required
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value);
                        const firstCnt = contacts.find((c) => c.customer_id === e.target.value);
                        setContactName(firstCnt?.name || '');
                        setContactInfo(firstCnt?.email || firstCnt?.phone || '');
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    >
                      <option value="" disabled>
                        -- Seleccione Cliente --
                      </option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.plant_or_location || c.short_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold uppercase text-slate-700 font-titulos">
                        Contacto del Cliente <span className="text-[#C72106]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewContactModal(true)}
                        className="text-[11px] text-[#C72106] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nuevo Contacto</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      list="ext-contacts-list"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Nombre del ingeniero o comprador solicitante"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                    <datalist id="ext-contacts-list">
                      {selectedCustomerContacts.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Correo / Teléfono Contacto
                      </label>
                      <input
                        type="text"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder="contacto@empresa.com"
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                        Medio de Recepción <span className="text-[#C72106]">*</span>
                      </label>
                      <select
                        value={receptionChannel}
                        onChange={(e) => setReceptionChannel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                      >
                        {RECEPTION_CHANNELS.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* COLUMNA DERECHA: CAMPOS COMUNES DEL PROYECTO */}
            <div className="space-y-3.5">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Nombre del Proyecto <span className="text-[#C72106]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej. Fabricación de dispositivos de sujeción / Mantenimiento Reductor..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Descripción del Requerimiento <span className="text-[#C72106]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Alcance técnico, cantidades preliminares, planos o especificaciones relevantes..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Fecha de Recepción <span className="text-[#C72106]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>

                {originType !== 'LICITACION_VW' && (
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Fecha Límite (Cuando exista)
                    </label>
                    <input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Responsable Interno Asignado <span className="text-[#C72106]">*</span>
                </label>
                <select
                  required
                  value={responsibleUserId}
                  onChange={(e) => setResponsibleUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-bold text-slate-900"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Observaciones Iniciales
                </label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Notas sobre levantamiento en sitio, urgencia o condiciones comerciales..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* NOTA DE EXPEDIENTE Y GOOGLE DRIVE */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs">
          <div className="w-8 h-8 rounded-lg bg-[#0F2747] text-white flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-slate-700">
            <strong className="text-[#0F2747] font-bold">
              Creación Automática de Expediente:
            </strong>{' '}
            Al guardar, el sistema asignará un folio único (<code className="font-mono">COT-{previewYear}-{previewPrefix}-XXXX</code>), establecerá el estado inicial <strong>«Recibida»</strong> y estructurará la ruta documental <code className="font-mono">IN SIDE LOGISTIC / COTIZACIONES / {previewYear} / FOLIO</code>. Los documentos son opcionales al crear la solicitud y pueden adjuntarse en cualquier momento desde el expediente.
          </div>
        </div>
        {/* BOTÓN DE GUARDADO INFERIOR ADICIONAL */}
        <div className="isl-card px-5 py-3.5 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Verifique que los campos con <strong className="text-[#C72106]">*</strong> estén completos antes de guardar.
          </span>
          <div className="flex items-center gap-2.5">
            <Link
              href="/solicitudes"
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#C72106] hover:bg-[#A31B05] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-industrial-red transition flex items-center gap-1.5 cursor-pointer font-titulos disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Generando Expediente...' : 'Guardar y Generar Expediente'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* MODAL ALTA DE NUEVO CLIENTE */}
      {newCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                  Alta de Nuevo Cliente
                </h3>
                <p className="text-xs text-slate-300">
                  Registrar nueva empresa en el catálogo de IN SIDE LOGISTIC
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewCustomerModal(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Ej. Benteler de México S.A. de C.V."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Nombre Corto / Siglas
                  </label>
                  <input
                    type="text"
                    value={newCustShort}
                    onChange={(e) => setNewCustShort(e.target.value)}
                    placeholder="Ej. BENTELER"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Planta / Ubicación
                  </label>
                  <input
                    type="text"
                    value={newCustPlant}
                    onChange={(e) => setNewCustPlant(e.target.value)}
                    placeholder="Ej. Parque FINSA Puebla"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  RFC (Opcional)
                </label>
                <input
                  type="text"
                  value={newCustRfc}
                  onChange={(e) => setNewCustRfc(e.target.value)}
                  placeholder="Ej. BME030112AA1"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono uppercase"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Contacto Inicial (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newCustContactName}
                    onChange={(e) => setNewCustContactName(e.target.value)}
                    placeholder="Ej. Ing. Ricardo Domínguez"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Correo del Contacto
                  </label>
                  <input
                    type="email"
                    value={newCustContactEmail}
                    onChange={(e) => setNewCustContactEmail(e.target.value)}
                    placeholder="contacto@empresa.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewCustomerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase font-titulos cursor-pointer"
                >
                  {savingCustomer ? 'Guardando...' : '+ Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALTA DE NUEVO CONTACTO / COMPRADOR / SOLICITANTE */}
      {newContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-400 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-[#0F2747] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-titulos">
                  Registrar Contacto / Solicitante
                </h3>
                <p className="text-xs text-slate-300">
                  Asociar persona de contacto al catálogo de clientes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewContactModal(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewContact} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newCntName}
                  onChange={(e) => setNewCntName(e.target.value)}
                  placeholder="Ej. Ing. Juan Carlos Morales"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Puesto / Cargo
                  </label>
                  <input
                    type="text"
                    value={newCntPosition}
                    onChange={(e) => setNewCntPosition(e.target.value)}
                    placeholder="Ej. Comprador Técnico"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Departamento / Nave
                  </label>
                  <input
                    type="text"
                    value={newCntDept}
                    onChange={(e) => setNewCntDept(e.target.value)}
                    placeholder="Ej. Nave 21 - Pintura"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={newCntEmail}
                    onChange={(e) => setNewCntEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Teléfono / Ext.
                  </label>
                  <input
                    type="text"
                    value={newCntPhone}
                    onChange={(e) => setNewCntPhone(e.target.value)}
                    placeholder="222 230 8000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewContactModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase font-titulos cursor-pointer"
                >
                  {savingContact ? 'Guardando...' : '+ Guardar Contacto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
