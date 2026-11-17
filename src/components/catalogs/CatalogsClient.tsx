'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ShieldCheck, Plus, Check, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type {
  CustomerContactRecord,
  CustomerRecord,
  SafeUser,
  UserRole,
} from '@/lib/db/types';

interface CatalogsClientProps {
  initialCustomers: CustomerRecord[];
  initialContacts: CustomerContactRecord[];
  initialUsers: SafeUser[];
  currentUser: SafeUser;
}

export function CatalogsClient({
  initialCustomers,
  initialContacts,
  initialUsers,
  currentUser,
}: CatalogsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'CUSTOMERS' | 'CONTACTS' | 'USERS'>('CUSTOMERS');
  const [customers, setCustomers] = useState(initialCustomers);
  const [contacts, setContacts] = useState(initialContacts);
  const [users, setUsers] = useState(initialUsers);

  const canManageCatalogs = currentUser.role === 'ADMIN' || currentUser.role === 'EDITOR';
  const canManageUsers = currentUser.role === 'ADMIN';

  // Nuevo cliente
  const [custName, setCustName] = useState('');
  const [custShort, setCustShort] = useState('');
  const [custPlant, setCustPlant] = useState('');
  const [custRfc, setCustRfc] = useState('');

  // Nuevo contacto
  const [cntCustomerId, setCntCustomerId] = useState(customers[0]?.id || '');
  const [cntName, setCntName] = useState('');
  const [cntPosition, setCntPosition] = useState('');
  const [cntDept, setCntDept] = useState('');
  const [cntEmail, setCntEmail] = useState('');
  const [cntPhone, setCntPhone] = useState('');

  // Nuevo usuario (Solo ADMIN)
  const [usrCode, setUsrCode] = useState('');
  const [usrName, setUsrName] = useState('');
  const [usrEmail, setUsrEmail] = useState('');
  const [usrPassword, setUsrPassword] = useState('');
  const [usrRole, setUsrRole] = useState<UserRole>('EDITOR');
  const [usrDept, setUsrDept] = useState('Ingeniería y Presupuestos');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: custName,
        short_name: custShort,
        plant_or_location: custPlant,
        rfc: custRfc,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setErrorMsg(data.message || 'Error al registrar cliente.');
      return;
    }
    setCustomers((prev) => [...prev, data.customer]);
    setCustName('');
    setCustShort('');
    setCustPlant('');
    setCustRfc('');
    router.refresh();
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: cntCustomerId,
        name: cntName,
        position: cntPosition,
        department: cntDept,
        email: cntEmail,
        phone: cntPhone,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setErrorMsg(data.message || 'Error al registrar contacto.');
      return;
    }
    setContacts((prev) => [...prev, data.contact]);
    setCntName('');
    setCntPosition('');
    setCntDept('');
    setCntEmail('');
    setCntPhone('');
    router.refresh();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_code: usrCode,
        name: usrName,
        email: usrEmail,
        password: usrPassword,
        role: usrRole,
        department: usrDept,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setErrorMsg(data.message || 'Error al crear usuario.');
      return;
    }
    setUsers((prev) => [...prev, data.user]);
    setUsrCode('');
    setUsrName('');
    setUsrEmail('');
    setUsrPassword('');
    router.refresh();
  };

  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'CUSTOMER'; item: CustomerRecord }
    | { type: 'CONTACT'; item: CustomerContactRecord }
    | { type: 'USER'; item: SafeUser }
    | null
  >(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingItem(true);
    setErrorMsg('');
    try {
      if (pendingDelete.type === 'CUSTOMER') {
        const res = await fetch(`/api/customers?id=${encodeURIComponent(pendingDelete.item.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'No se pudo eliminar el cliente.');
        }
        setCustomers((prev) => prev.filter((c) => c.id !== pendingDelete.item.id));
        setContacts((prev) => prev.filter((cnt) => cnt.customer_id !== pendingDelete.item.id));
      } else if (pendingDelete.type === 'CONTACT') {
        const res = await fetch(`/api/contacts?id=${encodeURIComponent(pendingDelete.item.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'No se pudo eliminar el contacto.');
        }
        setContacts((prev) => prev.filter((c) => c.id !== pendingDelete.item.id));
      } else {
        const res = await fetch(`/api/users?id=${encodeURIComponent(pendingDelete.item.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'No se pudo eliminar el usuario.');
        }
        setUsers((prev) => prev.filter((usr) => usr.id !== pendingDelete.item.id));
      }
      setPendingDelete(null);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el registro.');
      setPendingDelete(null);
    } finally {
      setDeletingItem(false);
    }
  };

  const handleDeleteCustomer = (cust: CustomerRecord) =>
    setPendingDelete({ type: 'CUSTOMER', item: cust });
  const handleDeleteContact = (cnt: CustomerContactRecord) =>
    setPendingDelete({ type: 'CONTACT', item: cnt });
  const handleDeleteUser = (u: SafeUser) => setPendingDelete({ type: 'USER', item: u });

  return (
    <div className="space-y-4">
      <div className="isl-card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase text-[#C72106] font-titulos">
            Catálogos Maestros y Control de Acceso
          </span>
          <h1 className="text-xl font-black text-[#0F2747] uppercase font-titulos">
            Clientes, Contactos y Usuarios Autorizados
          </h1>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold font-titulos uppercase">
          <button
            type="button"
            onClick={() => setTab('CUSTOMERS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              tab === 'CUSTOMERS' ? 'bg-[#0F2747] text-white' : 'text-slate-600'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Clientes ({customers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('CONTACTS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              tab === 'CONTACTS' ? 'bg-[#0F2747] text-white' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contactos / Compradores ({contacts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('USERS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer ${
              tab === 'USERS' ? 'bg-[#0F2747] text-white' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Usuarios y Roles ({users.length})</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#C72106] text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {tab === 'CUSTOMERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 isl-card overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-3 px-4">Siglas</th>
                  <th className="py-3 px-4">Razón Social</th>
                  <th className="py-3 px-4">Planta / Complejo</th>
                  <th className="py-3 px-4">RFC</th>
                  {canManageUsers && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#0F2747]">{c.short_name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600">{c.plant_or_location || '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{c.rfc || '—'}</td>
                    {canManageUsers && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#C72106] font-bold text-[11px] cursor-pointer transition"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 isl-card p-5 space-y-3 text-xs">
            <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
              Registrar Nuevo Cliente
            </h2>
            {canManageCatalogs ? (
              <form onSubmit={handleAddCustomer} className="space-y-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Siglas Cortas
                  </label>
                  <input
                    type="text"
                    value={custShort}
                    onChange={(e) => setCustShort(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Planta / Ubicación
                  </label>
                  <input
                    type="text"
                    value={custPlant}
                    onChange={(e) => setCustPlant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    RFC
                  </label>
                  <input
                    type="text"
                    value={custRfc}
                    onChange={(e) => setCustRfc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase rounded-lg font-titulos flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Cliente</span>
                </button>
              </form>
            ) : (
              <div className="p-3 rounded-lg bg-slate-100 text-slate-600">
                Su rol de <strong>Consulta</strong> permite visualizar el catálogo sin permisos de modificación.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'CONTACTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 isl-card overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Cargo / Departamento</th>
                  <th className="py-3 px-4">Correo / Teléfono</th>
                  {canManageUsers && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((cnt) => (
                  <tr key={cnt.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-[#0F2747]">{cnt.customer_short_name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{cnt.name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {cnt.position} {cnt.department ? `· ${cnt.department}` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {cnt.email || cnt.phone || '—'}
                    </td>
                    {canManageUsers && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(cnt)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#C72106] font-bold text-[11px] cursor-pointer transition"
                          title="Eliminar contacto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 isl-card p-5 space-y-3 text-xs">
            <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
              Registrar Contacto / Comprador
            </h2>
            {canManageCatalogs ? (
              <form onSubmit={handleAddContact} className="space-y-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Cliente *
                  </label>
                  <select
                    value={cntCustomerId}
                    onChange={(e) => setCntCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={cntName}
                    onChange={(e) => setCntName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Puesto / Cargo
                  </label>
                  <input
                    type="text"
                    value={cntPosition}
                    onChange={(e) => setCntPosition(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Departamento / Nave
                  </label>
                  <input
                    type="text"
                    value={cntDept}
                    onChange={(e) => setCntDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={cntEmail}
                    onChange={(e) => setCntEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase rounded-lg font-titulos flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Contacto</span>
                </button>
              </form>
            ) : (
              <div className="p-3 rounded-lg bg-slate-100 text-slate-600">
                Su rol de <strong>Consulta</strong> no cuenta con permisos para modificar contactos.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 isl-card overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-blue-200 text-[11px] font-bold uppercase text-slate-600 font-titulos">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Correo</th>
                  <th className="py-3 px-4">Rol Autorizado</th>
                  <th className="py-3 px-4">Departamento</th>
                  {canManageUsers && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#0F2747]">
                      {u.employee_code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0F2747] text-white">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.department}</td>
                    {canManageUsers && (
                      <td className="py-3 px-4 text-right">
                        {u.id === currentUser.id ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Sesión actual
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#C72106] font-bold text-[11px] cursor-pointer transition"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 isl-card p-5 space-y-3 text-xs">
            <h2 className="text-sm font-black text-[#0F2747] uppercase font-titulos">
              Alta de Usuario Autorizado
            </h2>
            {canManageUsers ? (
              <form onSubmit={handleAddUser} className="space-y-3">
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Código de Colaborador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ING-0003"
                    value={usrCode}
                    onChange={(e) => setUsrCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={usrName}
                    onChange={(e) => setUsrName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Correo Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={usrEmail}
                    onChange={(e) => setUsrEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Rol *
                    </label>
                    <select
                      value={usrRole}
                      onChange={(e) => setUsrRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="CONSULTA">CONSULTA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={usrPassword}
                      onChange={(e) => setUsrPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-700 mb-1 font-titulos">
                    Departamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={usrDept}
                    onChange={(e) => setUsrDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#C72106] hover:bg-[#A31B05] text-white font-bold uppercase rounded-lg font-titulos flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Autorizar Usuario</span>
                </button>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                Solo el rol <strong>Administrador</strong> puede dar de alta o modificar usuarios autorizados.
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.type === 'CUSTOMER'
            ? 'Eliminar Cliente'
            : pendingDelete?.type === 'CONTACT'
            ? 'Eliminar Contacto'
            : 'Eliminar Usuario'
        }
        message={
          pendingDelete?.type === 'CUSTOMER'
            ? `¿Seguro que deseas eliminar al cliente "${pendingDelete.item.short_name} — ${pendingDelete.item.name}"?`
            : pendingDelete?.type === 'CONTACT'
            ? `¿Seguro que deseas eliminar al contacto "${pendingDelete.item.name}"?`
            : pendingDelete?.type === 'USER'
            ? `¿Seguro que deseas eliminar al usuario "${pendingDelete.item.name} (${pendingDelete.item.employee_code})"?`
            : ''
        }
        confirmLabel="Sí, Eliminar"
        loading={deletingItem}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
