import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, Check, Gift, History, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react';
import type {
  Cliente,
  Comercio,
  Configuracion,
  CuentaPuntos,
  MovimientoPuntos,
  Notificacion,
  Premio,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { formatARS, formatDateTime, formatNumber, formatShortDate } from '../utils/format';
import storeBannerImg from '../assets/images/store_counter_banner_1794360690529.jpg';
import rewardCoffeeImg from '../assets/images/reward_coffee_pastry_1794360691526.jpg';
import rewardBoxImg from '../assets/images/reward_gift_box_1794360691676.jpg';

interface CustomerPortalProps {
  comercios: Comercio[];
  configs: Record<string, Configuracion>;
  clientes: Cliente[];
  cuentas: CuentaPuntos[];
  movimientos: MovimientoPuntos[];
  premios: Premio[];
  notificaciones: Notificacion[];
  selectedClienteId: string | null;
  onSelectCliente: (id: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  comercios,
  configs,
  clientes,
  cuentas,
  movimientos,
  premios,
  notificaciones,
  selectedClienteId,
  onSelectCliente,
}) => {
  const [subTab, setSubTab] = useState<'tarjeta' | 'premios' | 'historial' | 'avisos'>('tarjeta');
  const [walletModal, setWalletModal] = useState<'apple' | 'google' | null>(null);
  const [tempCode, setTempCode] = useState('482910');

  useEffect(() => {
    const updateCode = () => {
      const slot = Math.floor(Date.now() / 60000);
      const pseudo = String(((slot * 7919 + 104729) % 900000) + 100000);
      setTempCode(pseudo);
    };
    updateCode();
    const timer = setInterval(updateCode, 15000);
    return () => clearInterval(timer);
  }, []);

  const cliente = useMemo(() => {
    return clientes.find((c) => c.id === selectedClienteId) ?? clientes[0] ?? null;
  }, [clientes, selectedClienteId]);

  const comercio = useMemo(() => {
    if (!cliente) return comercios[0] ?? null;
    return comercios.find((c) => c.id === cliente.comercioId) ?? comercios[0] ?? null;
  }, [comercios, cliente]);

  const config = comercio ? configs[comercio.id] : undefined;

  const cuenta = useMemo(() => {
    if (!cliente || !comercio) return null;
    return (
      cuentas.find((a) => a.clienteId === cliente.id && a.comercioId === comercio.id) ?? null
    );
  }, [cuentas, cliente, comercio]);

  const comercioPremios = useMemo(() => {
    if (!comercio) return [];
    return premios
      .filter((p) => p.comercioId === comercio.id && p.activo)
      .sort((a, b) => a.puntosRequeridos - b.puntosRequeridos);
  }, [premios, comercio]);

  const clienteMovs = useMemo(() => {
    if (!cliente) return [];
    return movimientos
      .filter((m) => m.clienteId === cliente.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [movimientos, cliente]);

  const comercioAvisos = useMemo(() => {
    if (!comercio) return [];
    return notificaciones
      .filter((n) => n.comercioId === comercio.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notificaciones, comercio]);

  if (!cliente || !comercio) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto">
        <Smartphone className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="mt-3 font-display text-xl font-bold text-slate-900">
          Todavía no tenés una tarjeta vinculada
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Pedile al cajero de tu comercio adherido que te registre con tu email de Google para ver tu
          QR personal, tus puntos disponibles y el catálogo de premios.
        </p>
      </div>
    );
  }

  const puntos = cuenta?.puntosDisponibles ?? 0;
  const sellos = cuenta?.sellosActuales ?? 0;
  const sellosObjetivo = config?.sellosObjetivo ?? 8;
  const accent = comercio.colorAcento || '#059669';

  return (
    <div className="space-y-6">
      {/* Switcher when inspecting multiple cards */}
      {clientes.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Vista de socio en <strong className="text-slate-900">{comercio.nombre}</strong>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="portal-cli-select" className="text-xs text-slate-500">
              Cambiar tarjeta:
            </label>
            <select
              id="portal-cli-select"
              value={cliente.id}
              onChange={(e) => onSelectCliente(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-white"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.qrToken})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Responsive Layout: Left Mobile Card + Right Catalog/Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Digital Wallet Card & QR */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-32 relative bg-slate-900">
            <img
              src={storeBannerImg}
              alt={comercio.nombre}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3 text-white">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-300">{comercio.rubro}</div>
                <h2 className="font-display text-xl font-bold truncate">{comercio.nombre}</h2>
              </div>
              <PWAInstallButton appName={comercio.nombreCorto} accentColor={accent} compact />
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Balance Strip */}
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Puntos disponibles</div>
                <div
                  className="font-mono text-4xl font-bold tabular-nums mt-0.5"
                  style={{ color: accent }}
                >
                  {formatNumber(puntos)}
                </div>
                {cuenta?.venceEl && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Vencimiento: {formatShortDate(cuenta.venceEl)}
                  </div>
                )}
              </div>

              {config?.modalidad !== 'puntos' && (
                <div className="text-right">
                  <div className="text-xs text-slate-500">Sellos</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {sellos}
                    <span className="text-sm font-normal text-slate-400">/{sellosObjetivo}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {cuenta?.visitas ?? 0} visitas
                  </div>
                </div>
              )}
            </div>

            {/* Stamp Progress Dots */}
            {config?.modalidad !== 'puntos' && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 mb-2.5">
                  <span>Tarjeta de sellos</span>
                  <span className="font-medium text-slate-900">{config?.premioSellos}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: sellosObjetivo }).map((_, idx) => {
                    const filled = idx < sellos;
                    return (
                      <div
                        key={idx}
                        style={filled ? { backgroundColor: accent } : undefined}
                        className={`h-10 rounded-lg border flex items-center justify-center font-mono text-xs font-semibold ${
                          filled
                            ? 'border-transparent text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {filled ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Personal QR Block */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <QRCodeSVG value={cliente.qrToken} size={156} level="M" />
              </div>
              <div className="mt-3 font-mono text-sm font-bold text-slate-900 tracking-wider">
                {cliente.qrToken}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Código temporal de caja:{' '}
                <span className="font-mono font-semibold text-slate-900">{tempCode}</span>
              </div>
              <p className="mt-3 text-[11px] text-slate-500 inline-flex items-start gap-1.5 text-left leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  Este QR identifica tu tarjeta sin mostrar datos personales. Solo el personal del
                  comercio puede acreditar o descontar puntos al escanearlo.
                </span>
              </p>
            </div>

            {/* Apple & Google Wallet Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setWalletModal('apple')}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Apple Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => setWalletModal('google')}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Google Wallet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Tabs for Premios / Historial / Avisos */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'tarjeta', label: 'Beneficios activos' },
                { id: 'premios', label: `Premios (${comercioPremios.length})` },
                { id: 'historial', label: `Historial (${clienteMovs.length})` },
                { id: 'avisos', label: `Avisos (${comercioAvisos.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  subTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(subTab === 'tarjeta' || subTab === 'premios') && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    Catálogo de premios de {comercio.nombreCorto}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sumás {config?.puntosPorTramo ?? 1} punto cada{' '}
                    {formatARS(config?.pesosPorTramo ?? 1000)} de compra
                    {config?.promoActiva
                      ? ` · Promo activa x${config.promoMultiplicador}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {comercioPremios.map((p, idx) => {
                  const pct = Math.min(100, Math.round((puntos / p.puntosRequeridos) * 100));
                  const unlocked = puntos >= p.puntosRequeridos;
                  const imgSrc = idx % 2 === 0 ? rewardCoffeeImg : rewardBoxImg;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 overflow-hidden flex flex-col"
                    >
                      <div className="h-32 bg-slate-100 overflow-hidden">
                        <img
                          src={imgSrc}
                          alt={p.titulo}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono text-slate-500 tabular-nums">
                            {formatNumber(p.puntosRequeridos)} puntos
                          </div>
                          <h4 className="mt-1 text-sm font-semibold text-slate-900">{p.titulo}</h4>
                          <p className="mt-1 text-xs text-slate-600">{p.descripcion}</p>
                        </div>

                        <div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: unlocked ? accent : '#0F172A',
                              }}
                            />
                          </div>
                          <div className="mt-1.5 text-[11px] font-medium text-slate-600 flex items-center justify-between">
                            <span>
                              {unlocked
                                ? 'Disponible para canjear en caja'
                                : `Te faltan ${formatNumber(p.puntosRequeridos - puntos)} pts`}
                            </span>
                            <span className="font-mono tabular-nums">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(subTab === 'tarjeta' || subTab === 'historial') && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Historial de movimientos
                  </h3>
                </div>
                <span className="text-xs text-slate-500">Registro auditable</span>
              </div>

              {clienteMovs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aún no tenés movimientos registrados en este comercio.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {clienteMovs.map((m) => (
                    <div
                      key={m.id}
                      className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {m.concepto}
                          {m.revertido ? ' (Revertido)' : ''}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatDateTime(m.createdAt)} · Autorizó: {m.autorizadoPorNombre}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div
                          className={`text-sm font-semibold ${
                            m.puntos >= 0 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {m.puntos >= 0 ? `+${m.puntos}` : m.puntos} pts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Saldo: {formatNumber(m.saldoResultante)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'avisos' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="px-6 py-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-600" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Novedades y promos de {comercio.nombreCorto}
                </h3>
              </div>
              {comercioAvisos.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Sin avisos publicados por el momento.
                </div>
              ) : (
                comercioAvisos.map((n) => (
                  <div key={n.id} className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-900">{n.titulo}</div>
                    <p className="text-xs text-slate-600 mt-1">{n.mensaje}</p>
                    <div className="text-[11px] text-slate-400 mt-1.5">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Wallet Preview Modal */}
      {walletModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {walletModal === 'apple' ? 'Pase Apple Wallet' : 'Tarjeta Google Wallet'}
              </h3>
              <button
                type="button"
                onClick={() => setWalletModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="mt-4 rounded-xl p-5 text-white space-y-4"
              style={{ backgroundColor: accent }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base">{comercio.nombreCorto}</span>
                <Gift className="w-4 h-4 opacity-85" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/20">
                <div>
                  <div className="text-[10px] uppercase opacity-80">Puntos</div>
                  <div className="font-mono text-2xl font-bold tabular-nums">
                    {formatNumber(puntos)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase opacity-80">Sellos</div>
                  <div className="font-mono text-2xl font-bold tabular-nums">
                    {sellos}/{sellosObjetivo}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 flex flex-col items-center">
                <QRCodeSVG value={cliente.qrToken} size={110} />
                <span className="mt-1.5 font-mono text-[11px] font-semibold text-slate-900">
                  {cliente.qrToken}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Mostrá este pase directamente desde la billetera digital de tu teléfono en caja. También
              podés instalar la app web del local para recibir notificaciones de premios y vencimientos.
            </p>
            <button
              type="button"
              onClick={() => setWalletModal(null)}
              className="mt-4 w-full py-2.5 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Cerrar vista previa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
