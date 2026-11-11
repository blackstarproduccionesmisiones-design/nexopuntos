import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowRight, QrCode, ShieldCheck, Store } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';
import storeBannerImg from '../assets/images/store_counter_banner_1794360690529.jpg';

export const AuthGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos completar el inicio de sesión con Google.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            NEXO PUNTOS
          </span>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#arquitectura" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Tres portales
            </a>
            <a href="#circuito" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Circuito QR
            </a>
            <a href="#seguridad" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Seguridad
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton appName="NEXO PUNTOS" accentColor="#0F172A" compact />
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loading ? 'Ingresando...' : 'Ingresar con Google'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500">
              Plataforma multi-comercio · Firebase & PWA Instalable
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.08] text-balance">
              Tu club de sellos y puntos en el celular de cada cliente
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
              Administrá múltiples comercios desde el Panel Maestro, operá caja con QR único y
              entregá tarjetas digitales instalables con historial auditable de cada movimiento.
            </p>

            {error && (
              <div className="mt-5 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-900">
                {error}
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{loading ? 'Conectando...' : 'Ingresar con cuenta de Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500">
                Acceso maestro, dueño de local, cajero o socio
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-200 relative">
              <img
                src={storeBannerImg}
                alt="Mostrador comercial operando con tarjeta digital NEXO PUNTOS"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent text-white">
                <div className="text-xs text-slate-300">
                  Operación verificada en caja
                </div>
                <div className="mt-1 font-display text-lg font-semibold">
                  QR aleatorio único · Transacciones atómicas · Sin doble acreditación
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Portals */}
        <section id="arquitectura" className="border-t border-slate-200 bg-white py-14 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-slate-500">Arquitectura en tres capas</p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Un sistema preparado para escalar del primer local al centésimo
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60">
                <ShieldCheck className="w-5 h-5 text-slate-900" />
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
                  01. Panel Maestro NEXO+
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Alta y suspensión de comercios, gestión de planes y límites, y estadísticas
                  consolidadas de toda la plataforma.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60">
                <Store className="w-5 h-5 text-slate-900" />
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
                  02. Panel de cada Comercio
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Registro de clientes, escaneo en caja autorizado por empleados, catálogo de
                  premios, reglas de puntos y libro de movimientos reversibles.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60">
                <QrCode className="w-5 h-5 text-slate-900" />
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
                  03. Portal del Cliente (PWA)
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Tarjeta digital instalable en un toque con QR personal anónimo, saldo actualizado,
                  historial auditable y avisos directos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Loop */}
        <section id="circuito" className="border-t border-slate-200 bg-slate-50 py-14 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10" id="seguridad">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Circuito operativo y control antifraude
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                El QR identifica al socio sin exponer DNI ni teléfono. Ningún cliente puede
                acreditarse puntos por su cuenta: cada operación pasa por una transacción en
                Firestore validada por un empleado activo.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
              <div className="p-4 flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">Compra #001 · Consumo en local</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">+10 pts</span>
              </div>
              <div className="p-4 flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">Compra #002 · Doble promo</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">+15 pts</span>
              </div>
              <div className="p-4 flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">Canje de premio validado</span>
                <span className="font-mono font-semibold text-amber-700 tabular-nums">-20 pts</span>
              </div>
              <div className="p-4 flex items-center justify-between gap-4 bg-slate-50/80">
                <span className="font-semibold text-slate-900">Saldo auditable resultante</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">5 pts</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
