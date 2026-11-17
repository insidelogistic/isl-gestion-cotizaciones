'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function AdminDeleteRequestButton({
  requestId,
  folio,
  projectName,
  redirectAfterDelete,
}: {
  requestId: string;
  folio: string;
  projectName: string;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo eliminar la cotización.');
      }
      setConfirmOpen(false);
      if (redirectAfterDelete) {
        router.push(redirectAfterDelete);
      }
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar la cotización.');
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[#C72106] font-bold text-xs transition cursor-pointer"
        title="Eliminar expediente y cotización (Solo Administrador)"
        aria-label={`Eliminar expediente ${folio}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Eliminar</span>
      </button>

      {errorMsg && (
        <span className="text-xs text-[#C72106] font-semibold ml-1">{errorMsg}</span>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar Expediente"
        message={`¿Seguro que deseas eliminar definitivamente la cotización/expediente "${folio} — ${projectName}" y todas sus revisiones? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
