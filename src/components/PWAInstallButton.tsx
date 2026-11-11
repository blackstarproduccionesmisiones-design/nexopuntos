import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  appName: string;
  accentColor?: string;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  appName,
  accentColor = '#059669',
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{ backgroundColor: accentColor }}
        className={`inline-flex items-center justify-center gap-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? `Instalar ${appName}` : `Instalar App`}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="pwa-guide-title" className="text-base font-semibold text-slate-900">
                    Instalá {appName} en tu celular
                  </h3>
                  <p className="text-xs text-slate-500">Acceso directo sin pasar por tiendas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">01.</span>
                  <span>
                    Tocá el botón <strong className="inline-flex items-center gap-1 font-semibold">Compartir <Share className="w-3.5 h-3.5 inline" /></strong> en la barra de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">02.</span>
                  <span>
                    Deslizá y elegí <strong>Agregar a inicio</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">03.</span>
                  <span>
                    Confirmá con <strong>Agregar</strong> y tu tarjeta queda lista como app propia.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">01.</span>
                  <span>
                    Abrí el menú del navegador (los tres puntos arriba a la derecha en Chrome o Edge).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">02.</span>
                  <span>
                    Seleccioná <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 mt-0.5">03.</span>
                  <span>
                    En segundos se instala en el teléfono con el ícono y nombre de {appName}.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
