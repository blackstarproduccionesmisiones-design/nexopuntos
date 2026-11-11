import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowUpRight, Check, PauseCircle, PlayCircle, Plus, Sparkles } from 'lucide-react';
import type { Cliente, Comercio, CuentaPuntos, MovimientoPuntos, PlanId } from '../types';
import {
  createComercioWithDefaults,
  seedDemoComerciosParaMaster,
  updateComercioMaster,
} from '../services/nexoFirestore';
import { formatNumber, formatShortDate } from '../utils/format';

interface MasterAdminPanelProps {
  user: User;
  comercios: Comercio[];
  clientes: Cliente[];
  cuentas: CuentaPuntos[];
  movimientos: MovimientoPuntos[];
  onEnterComercio: (comercioId: string) => void;
}

const PLANS: { id: PlanId; name: string; limit: number; price: string; features: string }[] = [
  {
    id: 'starter',
    name: 'Starter',
    limit: 500,
    price: '$29.000 / mes',
    features: 'Hasta 500 clientes · QR único · Reglas de puntos',
  },
  {
    id: 'pro',
    name: 'Pro',
    limit: 3000,
    price: '$49.000 / mes',
    features: 'Hasta 3.000 clientes · Notificaciones Push · Billetera digital',
  },
  {
    id: 'multisucursal',
    name: 'Multi-sucursal',
    limit: 50000,
    price: '$89.000 / mes',
    features: 'Hasta 50.000 clientes · Cajeros ilimitados · Métricas avanzadas',
  },
];

export const MasterAdminPanel: React.FC<MasterAdminPanelProps> = ({
  user,
  comercios,
  clientes,
  cuentas,
  movimientos,
  onEnterComercio,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState('');
  const [nombreCorto, setNombreCorto] = useState('');
  const [rubro, setRubro] = useState('Gastronomía');
  const [colorAcento, setColorAcento] = useState('#059669');
  const [plan, setPlan] = useState<PlanId>('pro');
  const [ownerEmail, setOwnerEmail] = useState(user.email || '');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const stats = useMemo(() => {
    const activos = comercios.filter((c) => c.estado === 'activo').length;
    const suspendidos = comercios.filter((c) => c.estado === 'suspendido').length;
    const puntosEmitidos = movimientos
      .filter((m) => m.puntos > 0 && !m.revertido)
      .reduce((sum, m) => sum + m.puntos, 0);
    const canjesTotales = movimientos.filter((m) => m.tipo === 'canje').length;
    return {
      activos,
      suspendidos,
      totalClientes: clientes.length,
      puntosEmitidos,
      canjesTotales,
    };
  }, [comercios, clientes, movimientos]);

  const handleSeedDemo = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await seedDemoComerciosParaMaster(user);
      setStatusMsg('Se crearon los comercios demo (Café Brava y Norte Burger) con clientes y movimientos.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateComercio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    const planObj = PLANS.find((p) => p.id === plan) ?? PLANS[1];
    try {
      const id = await createComercioWithDefaults({
        nombre,
        nombreCorto: nombreCorto || nombre.slice(0, 12),
        rubro,
        colorAcento,
        plan,
        limiteClientes: planObj.limit,
        ownerUid: user.uid,
        ownerEmail: ownerEmail || user.email || '',
        ownerNombre: user.displayName || 'Titular',
      });
      setNombre('');
      setNombreCorto('');
      setShowCreate(false);
      setStatusMsg(`Comercio creado y activado correctamente (${id}).`);
    } finally {
      setBusy(false);
    }
  };

  const toggleEstado = async (c: Comercio) => {
    const nuevo = c.estado === 'activo' ? 'suspendido' : 'activo';
    await updateComercioMaster(c.id, { estado: nuevo });
  };

  const changePlan = async (c: Comercio, nextPlan: PlanId) => {
    const pObj = PLANS.find((p) => p.id === nextPlan) ?? PLANS[0];
    await updateComercioMaster(c.id, { plan: nextPlan, limiteClientes: pObj.limit });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Panel Maestro NEXO+ · Administrador: {user.email}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Administración general de comercios
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {comercios.length === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleSeedDemo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Cargar comercios demo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Cerrar formulario' : 'Nuevo comercio'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Global Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Comercios activos</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {stats.activos}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {stats.suspendidos} suspendidos
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Clientes en red NEXO</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(stats.totalClientes)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Puntos emitidos globales</div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {formatNumber(stats.puntosEmitidos)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Canjes totales validados</div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(stats.canjesTotales)}
          </div>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateComercio}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Dar de alta nuevo comercio en la plataforma
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="m-nombre" className="block text-xs font-medium text-slate-700 mb-1.5">
                Nombre comercial
              </label>
              <input
                id="m-nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Heladería Patagonia"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-corto" className="block text-xs font-medium text-slate-700 mb-1.5">
                Nombre corto (máx. 12)
              </label>
              <input
                id="m-corto"
                type="text"
                maxLength={12}
                value={nombreCorto}
                onChange={(e) => setNombreCorto(e.target.value.slice(0, 12))}
                placeholder="Patagonia"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-rubro" className="block text-xs font-medium text-slate-700 mb-1.5">
                Rubro
              </label>
              <input
                id="m-rubro"
                type="text"
                required
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Email del titular
              </label>
              <input
                id="m-email"
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-plan" className="block text-xs font-medium text-slate-700 mb-1.5">
                Plan asignado
              </label>
              <select
                id="m-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanId)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatNumber(p.limit)} clientes)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-color" className="block text-xs font-medium text-slate-700 mb-1.5">
                Color de marca
              </label>
              <input
                id="m-color"
                type="color"
                value={colorAcento}
                onChange={(e) => setColorAcento(e.target.value)}
                className="w-full h-[42px] px-1 py-1 rounded-lg border border-slate-300 bg-white cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Creando...' : 'Crear y activar comercio'}
            </button>
          </div>
        </form>
      )}

      {/* Comercios Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Comercios registrados ({comercios.length})
          </h2>
        </div>

        {comercios.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">Todavía no hay comercios creados</p>
            <p className="text-xs text-slate-500 mt-1">
              Creá el primero desde "Nuevo comercio" o cargá los comercios demo para probar todo el circuito.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                  <th className="py-3 px-6">Comercio</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4 text-right">Clientes</th>
                  <th className="py-3 px-4 text-right">Puntos activos</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-6 text-right">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {comercios.map((c) => {
                  const comClientes = clientes.filter((cli) => cli.comercioId === c.id).length;
                  const comPuntos = cuentas
                    .filter((acc) => acc.comercioId === c.id)
                    .reduce((s, acc) => s + acc.puntosDisponibles, 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: c.colorAcento }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{c.nombre}</div>
                            <div className="text-xs text-slate-500">
                              {c.rubro} · {c.ownerEmail} · Alta {formatShortDate(c.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          aria-label={`Plan de ${c.nombre}`}
                          value={c.plan}
                          onChange={(e) => changePlan(c, e.target.value as PlanId)}
                          className="border border-slate-300 rounded-md px-2.5 py-1 text-xs font-medium bg-white"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="multisucursal">Multi-sucursal</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {comClientes} / {formatNumber(c.limiteClientes)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatNumber(comPuntos)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            c.estado === 'activo' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {c.estado === 'activo' ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleEstado(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            {c.estado === 'activo' ? (
                              <>
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>Suspender</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>Activar</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEnterComercio(c.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                          >
                            <span>Abrir panel</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plans & Limits Reference */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">{p.name}</h3>
              <span className="font-mono text-sm font-semibold text-slate-900">{p.price}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{p.features}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
