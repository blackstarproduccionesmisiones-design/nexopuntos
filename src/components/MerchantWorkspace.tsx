import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bell,
  Check,
  Gift,
  LayoutDashboard,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Send,
  Settings,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  Canje,
  Cliente,
  Comercio,
  Configuracion,
  CuentaPuntos,
  LoyaltyModalidad,
  Membresia,
  MerchantTab,
  MovimientoPuntos,
  Notificacion,
  Premio,
  PushSegment,
} from '../types';
import {
  acreditarPuntosTransaccion,
  agregarEmpleadoComercio,
  ajusteManualTransaccion,
  canjearPremioTransaccion,
  crearPremioComercio,
  eliminarPremioComercio,
  enviarNotificacionComercio,
  generateOperationId,
  registrarClienteComercio,
  revertirMovimientoTransaccion,
  updateComercioMaster,
  updateConfiguracionComercio,
} from '../services/nexoFirestore';
import { formatARS, formatDateTime, formatDni, formatNumber } from '../utils/format';

interface MerchantWorkspaceProps {
  user: User;
  comercio: Comercio;
  config: Configuracion;
  clientes: Cliente[];
  cuentas: CuentaPuntos[];
  movimientos: MovimientoPuntos[];
  premios: Premio[];
  canjes: Canje[];
  notificaciones: Notificacion[];
  membresias: Membresia[];
  onPreviewCustomer: (clienteId: string) => void;
}

const TABS: { id: MerchantTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'resumen', label: 'Resumen y Libro', icon: LayoutDashboard },
  { id: 'caja', label: 'Caja y QR', icon: ScanLine },
  { id: 'clientes', label: 'Clientes y QR', icon: Users },
  { id: 'premios', label: 'Premios y Canjes', icon: Gift },
  { id: 'push', label: 'Notificaciones', icon: Bell },
  { id: 'config', label: 'Reglas y Equipo', icon: Settings },
];

export const MerchantWorkspace: React.FC<MerchantWorkspaceProps> = ({
  user,
  comercio,
  config,
  clientes,
  cuentas,
  movimientos,
  premios,
  canjes,
  notificaciones,
  membresias,
  onPreviewCustomer,
}) => {
  const [tab, setTab] = useState<MerchantTab>('caja');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Caja POS state
  const [scanQuery, setScanQuery] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(clientes[0]?.id ?? null);
  const [montoCompra, setMontoCompra] = useState('5000');
  const [sellosCompra, setSellosCompra] = useState(1);
  const [conceptoCompra, setConceptoCompra] = useState('Compra en mostrador');
  const [activeOpId, setActiveOpId] = useState(() => generateOperationId('pos'));
  const [ajustePts, setAjustePts] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  // New Client state
  const [cliNombre, setCliNombre] = useState('');
  const [cliDni, setCliDni] = useState('');
  const [cliTel, setCliTel] = useState('');
  const [cliEmail, setCliEmail] = useState('');

  // New Premio state
  const [premTitulo, setPremTitulo] = useState('');
  const [premDesc, setPremDesc] = useState('');
  const [premPts, setPremPts] = useState('50');

  // Push state
  const [pushTitle, setPushTitle] = useState('Doble puntaje hoy en mostrador');
  const [pushBody, setPushBody] = useState('Mostrá tu QR personal al pasar por caja y acumulá el doble.');
  const [pushSeg, setPushSeg] = useState<PushSegment>('all');

  // Config & Team state
  const [cfgForm, setCfgForm] = useState<Configuracion>(config);
  const [brandName, setBrandName] = useState(comercio.nombre);
  const [brandShort, setBrandShort] = useState(comercio.nombreCorto);
  const [brandColor, setBrandColor] = useState(comercio.colorAcento);
  const [empUid, setEmpUid] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empNombre, setEmpNombre] = useState('');

  const cuentaByCliente = useMemo(() => {
    const map = new Map<string, CuentaPuntos>();
    cuentas.forEach((c) => map.set(c.clienteId, c));
    return map;
  }, [cuentas]);

  const filteredClientes = useMemo(() => {
    const q = scanQuery.trim().toLowerCase();
    if (!q) return clientes;
    const digits = q.replace(/\D/g, '');
    return clientes.filter(
      (c) =>
        c.qrToken.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        (digits.length > 0 && c.dni.replace(/\D/g, '').includes(digits)),
    );
  }, [clientes, scanQuery]);

  const activeCliente = useMemo(() => {
    return clientes.find((c) => c.id === selectedClienteId) ?? filteredClientes[0] ?? null;
  }, [clientes, selectedClienteId, filteredClientes]);

  const activeCuenta = activeCliente ? cuentaByCliente.get(activeCliente.id) : undefined;

  const numericMonto = Number(montoCompra.replace(/\D/g, '')) || 0;
  const previewPuntos = useMemo(() => {
    if (numericMonto < config.montoMinimoCompra) return 0;
    const base = Math.floor(numericMonto / config.pesosPorTramo) * config.puntosPorTramo;
    const mult = config.promoActiva ? config.promoMultiplicador : 1;
    const bono = (activeCuenta?.visitas ?? 0) === 0 ? config.bonoPrimeraCompra : 0;
    return Math.round(base * mult) + bono;
  }, [numericMonto, config, activeCuenta]);

  const comercioStats = useMemo(() => {
    const puntosCirculacion = cuentas.reduce((s, c) => s + c.puntosDisponibles, 0);
    const totalCanjes = canjes.length;
    const movimientosHoy = movimientos.filter(
      (m) => m.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10),
    ).length;
    return {
      totalSocios: clientes.length,
      puntosCirculacion,
      totalCanjes,
      movimientosHoy,
    };
  }, [clientes, cuentas, canjes, movimientos]);

  const isSuspended = comercio.estado === 'suspendido';

  const handleAcreditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCliente) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await acreditarPuntosTransaccion({
        comercio,
        config,
        cliente: activeCliente,
        montoCompra: numericMonto,
        sellosDelta: config.modalidad === 'puntos' ? 0 : sellosCompra,
        concepto: conceptoCompra || 'Compra en local',
        operacionId: activeOpId,
        autorUid: user.uid,
        autorNombre: user.displayName || user.email || 'Empleado',
      });
      setActiveOpId(generateOperationId('pos'));
      setBannerMsg({
        type: 'ok',
        text: `Acreditado a ${activeCliente.nombre}: +${res.puntosGanados} pts (Saldo actual: ${formatNumber(res.nuevoSaldo)} pts).`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error al acreditar puntos.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAjuste = async (sign: 1 | -1) => {
    if (!activeCliente) return;
    const pts = Math.abs(Number(ajustePts)) * sign;
    if (!pts) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await ajusteManualTransaccion({
        comercio,
        cliente: activeCliente,
        puntosDelta: pts,
        sellosDelta: 0,
        concepto: ajusteMotivo.trim() || 'Ajuste manual autorizado',
        operacionId: generateOperationId('adj'),
        autorUid: user.uid,
        autorNombre: user.displayName || user.email || 'Empleado',
      });
      setAjustePts('');
      setAjusteMotivo('');
      setBannerMsg({
        type: 'ok',
        text: `Ajuste aplicado a ${activeCliente.nombre}. Nuevo saldo: ${formatNumber(res.nuevoSaldo)} pts.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo aplicar el ajuste.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCanjear = async (premio: Premio) => {
    if (!activeCliente) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await canjearPremioTransaccion({
        comercio,
        cliente: activeCliente,
        premio,
        operacionId: generateOperationId('can'),
        autorUid: user.uid,
        autorNombre: user.displayName || user.email || 'Empleado',
      });
      setBannerMsg({
        type: 'ok',
        text: `Canje entregado: ${premio.titulo} · Código ${res.codigoValidacion} · Saldo restante: ${res.nuevoSaldo} pts.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo procesar el canje.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevertir = async (mov: MovimientoPuntos) => {
    setBusy(true);
    setBannerMsg(null);
    try {
      await revertirMovimientoTransaccion({
        comercio,
        movimiento: mov,
        operacionId: generateOperationId('rev'),
        autorUid: user.uid,
        autorNombre: user.displayName || user.email || 'Empleado',
      });
      setBannerMsg({
        type: 'ok',
        text: `Movimiento revertido correctamente para ${mov.clienteNombre}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo revertir el movimiento.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRegistrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliNombre.trim() || !cliDni.trim()) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await registrarClienteComercio({
        comercio,
        nombre: cliNombre,
        dni: cliDni,
        telefono: cliTel,
        email: cliEmail,
        autorUid: user.uid,
      });
      setSelectedClienteId(res.clienteId);
      setCliNombre('');
      setCliDni('');
      setCliTel('');
      setCliEmail('');
      setBannerMsg({
        type: 'ok',
        text: `Cliente registrado con QR único ${res.qrToken}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo registrar al cliente.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCrearPremio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!premTitulo.trim()) return;
    setBusy(true);
    try {
      await crearPremioComercio({
        comercio,
        titulo: premTitulo,
        descripcion: premDesc || 'Canjeable mostrando tu tarjeta digital en caja.',
        puntosRequeridos: Number(premPts) || 30,
      });
      setPremTitulo('');
      setPremDesc('');
      setPremPts('50');
    } finally {
      setBusy(false);
    }
  };

  const handleEnviarPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) return;
    setBusy(true);
    try {
      await enviarNotificacionComercio({
        comercio,
        titulo: pushTitle,
        mensaje: pushBody,
        segmento: pushSeg,
        destinatarios: clientes.length,
        creadoPorUid: user.uid,
      });
      setBannerMsg({
        type: 'ok',
        text: `Notificación enviada a ${clientes.length} clientes del comercio.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      await updateConfiguracionComercio(comercio.id, {
        comercioId: comercio.id,
        staffUids: comercio.staffUids,
        modalidad: cfgForm.modalidad,
        puntosPorTramo: Number(cfgForm.puntosPorTramo) || 1,
        pesosPorTramo: Number(cfgForm.pesosPorTramo) || 1000,
        montoMinimoCompra: Number(cfgForm.montoMinimoCompra) || 0,
        bonoPrimeraCompra: Number(cfgForm.bonoPrimeraCompra) || 0,
        diasVencimiento: Number(cfgForm.diasVencimiento) || 0,
        promoActiva: cfgForm.promoActiva,
        promoMultiplicador: Number(cfgForm.promoMultiplicador) || 2,
        promoTitulo: cfgForm.promoTitulo || 'Promoción especial',
        sellosObjetivo: Number(cfgForm.sellosObjetivo) || 8,
        premioSellos: cfgForm.premioSellos || 'Consumición de cortesía',
        updatedAt: new Date().toISOString(),
      });
      await updateComercioMaster(comercio.id, {
        nombre: brandName,
        nombreCorto: brandShort.slice(0, 12),
        colorAcento: brandColor,
      });
      setBannerMsg({
        type: 'ok',
        text: 'Reglas de acumulación e identidad actualizadas en Firestore.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empUid.trim() || !empEmail.trim()) return;
    setBusy(true);
    try {
      await agregarEmpleadoComercio({
        comercio,
        uid: empUid,
        email: empEmail,
        nombre: empNombre || empEmail,
        rol: 'employee',
      });
      setEmpUid('');
      setEmpEmail('');
      setEmpNombre('');
      setBannerMsg({ type: 'ok', text: 'Empleado autorizado agregado al equipo.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Comercio Header + Subnav */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            className="w-4 h-10 rounded-md shrink-0"
            style={{ backgroundColor: comercio.colorAcento }}
          />
          <div>
            <div className="text-xs text-slate-500">
              {comercio.rubro} · Plan {comercio.plan.toUpperCase()} ·{' '}
              <span className={isSuspended ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                {comercio.estado === 'activo' ? 'Activo' : 'Suspendido'}
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {comercio.nombre}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isSuspended && (
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-900 text-sm font-medium">
          Este comercio se encuentra suspendido desde el Panel Maestro. Las acreditaciones y canjes están bloqueados por reglas de seguridad.
        </div>
      )}

      {bannerMsg && (
        <div
          role="status"
          className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-between gap-3 ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            {bannerMsg.text}
          </span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-xs underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TAB 1: RESUMEN Y LIBRO AUDITABLE */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Clientes registrados</div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {comercioStats.totalSocios}
                <span className="text-xs font-normal text-slate-400">
                  {' '}
                  / {formatNumber(comercio.limiteClientes)}
                </span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Puntos en circulación</div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {formatNumber(comercioStats.puntosCirculacion)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Canjes entregados</div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {comercioStats.totalCanjes}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Regla de acumulación</div>
              <div className="mt-2 font-mono text-lg font-bold text-slate-900 tabular-nums">
                {config.puntosPorTramo} pt / {formatARS(config.pesosPorTramo)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Historial auditable de movimientos
                </h2>
                <p className="text-xs text-slate-500">
                  Registro individual de créditos, débitos, canjes y reversiones con trazabilidad de empleado
                </p>
              </div>
            </div>

            {movimientos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Sin movimientos registrados todavía.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                      <th className="py-3 px-5">Operación</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Autorizado por</th>
                      <th className="py-3 px-4 text-right">Puntos</th>
                      <th className="py-3 px-4 text-right">Saldo</th>
                      <th className="py-3 px-5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5">
                          <div className="font-medium text-slate-900">
                            {m.concepto}
                            {m.revertido ? ' · REVERTIDO' : ''}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {m.tipo.toUpperCase()} · {formatDateTime(m.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-800">{m.clienteNombre}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{m.autorizadoPorNombre}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                          <span className={m.puntos >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                            {m.puntos >= 0 ? `+${m.puntos}` : m.puntos}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatNumber(m.saldoResultante)}
                        </td>
                        <td className="py-3 px-5 text-right">
                          {!m.revertido && m.tipo !== 'reversion' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRevertir(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revertir</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CAJA Y ESCÁNER QR */}
      {tab === 'caja' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lookup / Scan QR */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 space-y-2">
              <label htmlFor="caja-scan" className="block text-xs font-medium text-slate-700">
                Escanear código QR, buscar por nombre o DNI
              </label>
              <div className="relative">
                <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="caja-scan"
                  type="text"
                  value={scanQuery}
                  onChange={(e) => setScanQuery(e.target.value)}
                  placeholder="Ej. NX-7K9M2P4Q o 38440112..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {filteredClientes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No se encontró ningún cliente con "{scanQuery}". Podés registrarlo en la pestaña Clientes y QR.
                </div>
              ) : (
                filteredClientes.map((c) => {
                  const acc = cuentaByCliente.get(c.id);
                  const active = activeCliente?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClienteId(c.id)}
                      className={`w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{c.nombre}</div>
                        <div
                          className={`text-xs font-mono mt-0.5 ${
                            active ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {c.qrToken} · DNI {formatDni(c.dni)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono text-xs tabular-nums">
                        <div className={active ? 'text-emerald-300 font-bold' : 'text-emerald-700 font-bold'}>
                          {formatNumber(acc?.puntosDisponibles ?? 0)} pts
                        </div>
                        <div className={active ? 'text-slate-300' : 'text-slate-500'}>
                          {acc?.sellosActuales ?? 0}/{config.sellosObjetivo} sellos
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Cashier Action */}
          {activeCliente ? (
            <div className="lg:col-span-7 space-y-6">
              <form
                onSubmit={handleAcreditar}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="text-xs font-mono text-slate-500">
                      {activeCliente.qrToken} · DNI {formatDni(activeCliente.dni)}
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
                      {activeCliente.nombre}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Saldo disponible</div>
                    <div className="font-mono text-3xl font-bold text-emerald-700 tabular-nums">
                      {formatNumber(activeCuenta?.puntosDisponibles ?? 0)} pts
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pos-monto" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Monto de la compra ($ ARS)
                    </label>
                    <input
                      id="pos-monto"
                      type="text"
                      inputMode="numeric"
                      value={montoCompra}
                      onChange={(e) => setMontoCompra(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono"
                    />
                    <p className="mt-1.5 text-xs text-slate-600">
                      Acredita{' '}
                      <strong className="font-mono text-emerald-700">+{previewPuntos} pts</strong>{' '}
                      ({config.puntosPorTramo} pt cada {formatARS(config.pesosPorTramo)}
                      {config.promoActiva ? ` · Promo x${config.promoMultiplicador}` : ''}
                      {(activeCuenta?.visitas ?? 0) === 0 && config.bonoPrimeraCompra > 0
                        ? ` + ${config.bonoPrimeraCompra} bono 1ra compra`
                        : ''}
                      )
                    </p>
                  </div>

                  <div>
                    <label htmlFor="pos-concepto" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Concepto de operación
                    </label>
                    <input
                      id="pos-concepto"
                      type="text"
                      value={conceptoCompra}
                      onChange={(e) => setConceptoCompra(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                    {config.modalidad !== 'puntos' && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <span>Sellos a sumar:</span>
                        <select
                          value={sellosCompra}
                          onChange={(e) => setSellosCompra(Number(e.target.value))}
                          className="border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                        >
                          <option value={0}>0</option>
                          <option value={1}>+1 sello</option>
                          <option value={2}>+2 sellos</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    ID idempotente: {activeOpId}
                  </span>
                  <button
                    type="submit"
                    disabled={busy || isSuspended}
                    style={{ backgroundColor: comercio.colorAcento }}
                    className="px-5 py-3 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Procesando...' : `Autorizar y acreditar +${previewPuntos} pts`}
                  </button>
                </div>
              </form>

              {/* Quick Redemptions */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Canjear premio en mostrador
                </h3>
                <div className="space-y-2.5">
                  {premios
                    .filter((p) => p.activo)
                    .map((p) => {
                      const canRedeem = (activeCuenta?.puntosDisponibles ?? 0) >= p.puntosRequeridos;
                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{p.titulo}</div>
                            <div className="text-xs font-mono text-slate-500">
                              {formatNumber(p.puntosRequeridos)} puntos requeridos
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy || isSuspended || !canRedeem}
                            onClick={() => handleCanjear(p)}
                            className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                          >
                            {canRedeem ? 'Entregar y descontar' : 'Puntos insuficientes'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Manual Adjustment */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Ajuste manual autorizado (por devolución o bonificación)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    type="number"
                    min={1}
                    value={ajustePts}
                    onChange={(e) => setAjustePts(e.target.value)}
                    placeholder="Puntos"
                    className="sm:col-span-3 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                  />
                  <input
                    type="text"
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                    placeholder="Motivo del ajuste..."
                    className="sm:col-span-5 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy || isSuspended || !ajustePts}
                    onClick={() => handleAjuste(1)}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  >
                    + Sumar
                  </button>
                  <button
                    type="button"
                    disabled={busy || isSuspended || !ajustePts}
                    onClick={() => handleAjuste(-1)}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer"
                  >
                    - Descontar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Registrá un cliente en la pestaña Clientes y QR para comenzar a operar en caja.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLIENTES Y GENERACIÓN DE QR */}
      {tab === 'clientes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleRegistrarCliente}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-700" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Registrar cliente y generar QR
              </h2>
            </div>
            <div>
              <label htmlFor="cli-nom" className="block text-xs font-medium text-slate-700 mb-1">
                Nombre y apellido
              </label>
              <input
                id="cli-nom"
                type="text"
                required
                value={cliNombre}
                onChange={(e) => setCliNombre(e.target.value)}
                placeholder="Ej. Julieta Navarro"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cli-dni" className="block text-xs font-medium text-slate-700 mb-1">
                DNI
              </label>
              <input
                id="cli-dni"
                type="text"
                required
                value={cliDni}
                onChange={(e) => setCliDni(e.target.value)}
                placeholder="39504712"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="cli-tel" className="block text-xs font-medium text-slate-700 mb-1">
                Teléfono (opcional)
              </label>
              <input
                id="cli-tel"
                type="tel"
                value={cliTel}
                onChange={(e) => setCliTel(e.target.value)}
                placeholder="+54 9 11 ..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cli-mail" className="block text-xs font-medium text-slate-700 mb-1">
                Email Google del cliente (para vincular su Portal)
              </label>
              <input
                id="cli-mail"
                type="email"
                value={cliEmail}
                onChange={(e) => setCliEmail(e.target.value)}
                placeholder="cliente@gmail.com"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy || isSuspended}
              className="w-full py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Crear tarjeta con QR aleatorio
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Tarjetas digitales emitidas ({clientes.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {clientes.map((c) => {
                const acc = cuentaByCliente.get(c.id);
                return (
                  <div
                    key={c.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                        <QRCodeSVG value={c.qrToken} size={56} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{c.nombre}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          Token QR: {c.qrToken} · DNI {formatDni(c.dni)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Saldo: <strong className="text-slate-900">{formatNumber(acc?.puntosDisponibles ?? 0)} pts</strong> ·{' '}
                          {acc?.visitas ?? 0} visitas
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClienteId(c.id);
                          setTab('caja');
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                      >
                        Operar en caja
                      </button>
                      <button
                        type="button"
                        onClick={() => onPreviewCustomer(c.id)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Ver portal</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PREMIOS Y CANJES */}
      {tab === 'premios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCrearPremio}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-slate-900">
              Agregar recompensa al catálogo
            </h2>
            <div>
              <label htmlFor="pr-tit" className="block text-xs font-medium text-slate-700 mb-1">
                Nombre del premio
              </label>
              <input
                id="pr-tit"
                type="text"
                required
                value={premTitulo}
                onChange={(e) => setPremTitulo(e.target.value)}
                placeholder="Ej. Bebida gratis"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pr-desc" className="block text-xs font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                id="pr-desc"
                rows={2}
                value={premDesc}
                onChange={(e) => setPremDesc(e.target.value)}
                placeholder="Condiciones de canje..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pr-pts" className="block text-xs font-medium text-slate-700 mb-1">
                Puntos requeridos
              </label>
              <input
                id="pr-pts"
                type="number"
                min={1}
                required
                value={premPts}
                onChange={(e) => setPremPts(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar premio</span>
            </button>
          </form>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="px-6 py-4">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Catálogo vigente ({premios.length})
                </h2>
              </div>
              {premios.map((p) => (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{p.titulo}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.descripcion}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatNumber(p.puntosRequeridos)} pts
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarPremioComercio(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label={`Eliminar ${p.titulo}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="px-6 py-4">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Últimos canjes entregados ({canjes.length})
                </h2>
              </div>
              {canjes.length === 0 ? (
                <div className="p-6 text-xs text-slate-500">Todavía no hubo canjes en este comercio.</div>
              ) : (
                canjes.map((c) => (
                  <div key={c.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">
                        {c.premioTitulo} · {c.clienteNombre}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Código {c.codigoValidacion} · {formatDateTime(c.createdAt)}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                      -{formatNumber(c.puntosUsados)} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: NOTIFICACIONES PUSH */}
      {tab === 'push' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleEnviarPush}
            className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-slate-900">
              Enviar aviso directo a tus socios
            </h2>
            <div>
              <label htmlFor="m-ptit" className="block text-xs font-medium text-slate-700 mb-1">
                Título
              </label>
              <input
                id="m-ptit"
                type="text"
                required
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-pmsg" className="block text-xs font-medium text-slate-700 mb-1">
                Mensaje
              </label>
              <textarea
                id="m-pmsg"
                rows={3}
                required
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="m-pseg" className="block text-xs font-medium text-slate-700 mb-1">
                Segmento
              </label>
              <select
                id="m-pseg"
                value={pushSeg}
                onChange={(e) => setPushSeg(e.target.value as PushSegment)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="all">Todos los clientes ({clientes.length})</option>
                <option value="frequent">Clientes frecuentes</option>
                <option value="redeemable">Con puntos para canjear</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{ backgroundColor: comercio.colorAcento }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar notificación</span>
            </button>
          </form>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            <div className="px-6 py-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Avisos enviados ({notificaciones.length})
              </h2>
            </div>
            {notificaciones.map((n) => (
              <div key={n.id} className="px-6 py-4">
                <div className="text-sm font-semibold text-slate-900">{n.titulo}</div>
                <div className="text-xs text-slate-600 mt-0.5">{n.mensaje}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {formatDateTime(n.createdAt)} · {n.destinatarios} destinatarios
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: REGLAS DE ACUMULACIÓN Y EQUIPO */}
      {tab === 'config' && (
        <div className="space-y-6">
          <form
            onSubmit={handleGuardarConfig}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Reglas de acumulación, bonos y vencimientos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre local</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre corto</label>
                <input
                  type="text"
                  maxLength={12}
                  value={brandShort}
                  onChange={(e) => setBrandShort(e.target.value.slice(0, 12))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Color de marca</label>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-full h-[38px] px-1 py-1 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Modalidad</label>
                <select
                  value={cfgForm.modalidad}
                  onChange={(e) => setCfgForm({ ...cfgForm, modalidad: e.target.value as LoyaltyModalidad })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="puntos">Solo puntos por monto</option>
                  <option value="sellos">Solo sellos por visita</option>
                  <option value="hibrido">Mixto (Puntos + Sellos)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Puntos por tramo</label>
                <input
                  type="number"
                  min={1}
                  value={cfgForm.puntosPorTramo}
                  onChange={(e) => setCfgForm({ ...cfgForm, puntosPorTramo: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cada cuántos $ ARS</label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={cfgForm.pesosPorTramo}
                  onChange={(e) => setCfgForm({ ...cfgForm, pesosPorTramo: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Compra mínima ($ ARS)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={cfgForm.montoMinimoCompra}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, montoMinimoCompra: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bono 1ra compra (pts)</label>
                <input
                  type="number"
                  min={0}
                  value={cfgForm.bonoPrimeraCompra}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, bonoPrimeraCompra: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vencimiento (días, 0=no)</label>
                <input
                  type="number"
                  min={0}
                  value={cfgForm.diasVencimiento}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, diasVencimiento: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sellos objetivo</label>
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={cfgForm.sellosObjetivo}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, sellosObjetivo: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Multiplicador promo</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={cfgForm.promoMultiplicador}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, promoMultiplicador: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgForm.promoActiva}
                  onChange={(e) => setCfgForm({ ...cfgForm, promoActiva: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span>Activar multiplicador promocional ahora (x{cfgForm.promoMultiplicador})</span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Guardar reglas
              </button>
            </div>
          </form>

          {/* Authorized Staff */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Cuentas de empleados autorizados ({membresias.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Solo los UIDs registrados aquí pueden acreditar, ajustar o canjear puntos en este comercio.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {membresias.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{m.nombre}</div>
                    <div className="text-slate-500 font-mono">
                      {m.email} · UID: {m.uid}
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-slate-800">
                    {m.rol.toUpperCase()} · {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddEmpleado} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <input
                type="text"
                required
                value={empUid}
                onChange={(e) => setEmpUid(e.target.value)}
                placeholder="UID Firebase del empleado"
                className="sm:col-span-4 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
              <input
                type="email"
                required
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                placeholder="Email Google"
                className="sm:col-span-4 px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <input
                type="text"
                value={empNombre}
                onChange={(e) => setEmpNombre(e.target.value)}
                placeholder="Nombre cajero"
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="submit"
                disabled={busy}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
              >
                Autorizar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
