import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { LogOut, WifiOff } from 'lucide-react';
import { OperationType, auth, db, handleFirestoreError } from './firebase';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ensureUserProfile } from './services/nexoFirestore';
import {
  MASTER_ADMIN_EMAIL,
  type Canje,
  type Cliente,
  type Comercio,
  type Configuracion,
  type CuentaPuntos,
  type Membresia,
  type MovimientoPuntos,
  type Notificacion,
  type PortalView,
  type Premio,
} from './types';
import { AuthGate } from './components/AuthGate';
import { CustomerPortal } from './components/CustomerPortal';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { MerchantWorkspace } from './components/MerchantWorkspace';
import { PWAInstallButton } from './components/PWAInstallButton';

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  a.forEach((item) => map.set(item.id, item));
  b.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [portal, setPortal] = useState<PortalView>('comercio');
  const [selectedComercioId, setSelectedComercioId] = useState<string | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [configs, setConfigs] = useState<Record<string, Configuracion>>({});
  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [staffClientes, setStaffClientes] = useState<Cliente[]>([]);
  const [myClientes, setMyClientes] = useState<Cliente[]>([]);
  const [staffCuentas, setStaffCuentas] = useState<CuentaPuntos[]>([]);
  const [myCuentas, setMyCuentas] = useState<CuentaPuntos[]>([]);
  const [staffMovimientos, setStaffMovimientos] = useState<MovimientoPuntos[]>([]);
  const [myMovimientos, setMyMovimientos] = useState<MovimientoPuntos[]>([]);
  const [staffCanjes, setStaffCanjes] = useState<Canje[]>([]);
  const [myCanjes, setMyCanjes] = useState<Canje[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  const isMasterAdmin =
    !!user && user.emailVerified && user.email === MASTER_ADMIN_EMAIL;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && nextUser.emailVerified) {
        await ensureUserProfile(nextUser);
        if (nextUser.email === MASTER_ADMIN_EMAIL) {
          setPortal('master');
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const unsubs: (() => void)[] = [];

    const comerciosQuery = isMasterAdmin
      ? collection(db, 'comercios')
      : query(collection(db, 'comercios'), where('estado', '==', 'activo'));
    unsubs.push(
      onSnapshot(
        comerciosQuery,
        (snap) => {
          setComercios(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comercio, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'comercios'),
      ),
    );

    const membQuery = isMasterAdmin
      ? collection(db, 'membresias')
      : query(collection(db, 'membresias'), where('uid', '==', user.uid));
    unsubs.push(
      onSnapshot(
        membQuery,
        (snap) => {
          setMembresias(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Membresia, 'id'>) })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'membresias'),
      ),
    );

    const cfgQuery = isMasterAdmin
      ? collection(db, 'configuracion')
      : query(collection(db, 'configuracion'), where('staffUids', 'array-contains', user.uid));
    unsubs.push(
      onSnapshot(
        cfgQuery,
        (snap) => {
          setConfigs((prev) => {
            const next = { ...prev };
            snap.docs.forEach((d) => {
              next[d.id] = { id: d.id, ...(d.data() as Omit<Configuracion, 'id'>) };
            });
            return next;
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'configuracion'),
      ),
    );

    const premiosQuery = isMasterAdmin
      ? collection(db, 'premios')
      : query(collection(db, 'premios'), where('activo', '==', true));
    unsubs.push(
      onSnapshot(
        premiosQuery,
        (snap) => {
          setPremios(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Premio, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'premios'),
      ),
    );

    const notifQuery = isMasterAdmin
      ? collection(db, 'notificaciones')
      : query(collection(db, 'notificaciones'), where('publico', '==', true));
    unsubs.push(
      onSnapshot(
        notifQuery,
        (snap) => {
          setNotificaciones(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notificacion, 'id'>) })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notificaciones'),
      ),
    );

    if (isMasterAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'clientes'),
          (snap) =>
            setStaffClientes(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'clientes'),
        ),
        onSnapshot(
          collection(db, 'cuentas_puntos'),
          (snap) =>
            setStaffCuentas(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CuentaPuntos, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'cuentas_puntos'),
        ),
        onSnapshot(
          collection(db, 'movimientos_puntos'),
          (snap) =>
            setStaffMovimientos(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MovimientoPuntos, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'movimientos_puntos'),
        ),
        onSnapshot(
          collection(db, 'canjes'),
          (snap) =>
            setStaffCanjes(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Canje, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'canjes'),
        ),
      );
    } else {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'clientes'), where('staffUids', 'array-contains', user.uid)),
          (snap) =>
            setStaffClientes(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'clientes'),
        ),
        onSnapshot(
          query(collection(db, 'cuentas_puntos'), where('staffUids', 'array-contains', user.uid)),
          (snap) =>
            setStaffCuentas(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CuentaPuntos, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'cuentas_puntos'),
        ),
        onSnapshot(
          query(
            collection(db, 'movimientos_puntos'),
            where('staffUids', 'array-contains', user.uid),
          ),
          (snap) =>
            setStaffMovimientos(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MovimientoPuntos, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'movimientos_puntos'),
        ),
        onSnapshot(
          query(collection(db, 'canjes'), where('staffUids', 'array-contains', user.uid)),
          (snap) =>
            setStaffCanjes(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Canje, 'id'>) })),
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'canjes'),
        ),
      );

      if (user.email) {
        const userEmailLower = user.email.toLowerCase();
        unsubs.push(
          onSnapshot(
            query(collection(db, 'clientes'), where('email', '==', userEmailLower)),
            (snap) =>
              setMyClientes(
                snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) })),
              ),
            (err) => handleFirestoreError(err, OperationType.LIST, 'clientes'),
          ),
          onSnapshot(
            query(collection(db, 'cuentas_puntos'), where('clienteEmail', '==', userEmailLower)),
            (snap) =>
              setMyCuentas(
                snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CuentaPuntos, 'id'>) })),
              ),
            (err) => handleFirestoreError(err, OperationType.LIST, 'cuentas_puntos'),
          ),
          onSnapshot(
            query(
              collection(db, 'movimientos_puntos'),
              where('clienteEmail', '==', userEmailLower),
            ),
            (snap) =>
              setMyMovimientos(
                snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MovimientoPuntos, 'id'>) })),
              ),
            (err) => handleFirestoreError(err, OperationType.LIST, 'movimientos_puntos'),
          ),
          onSnapshot(
            query(collection(db, 'canjes'), where('clienteEmail', '==', userEmailLower)),
            (snap) =>
              setMyCanjes(
                snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Canje, 'id'>) })),
              ),
            (err) => handleFirestoreError(err, OperationType.LIST, 'canjes'),
          ),
        );
      }
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, user, isMasterAdmin]);

  // Ensure customer portal has configuracion loaded for any linked customer's comercio
  useEffect(() => {
    if (!authReady || !user || myClientes.length === 0) return;
    myClientes.forEach(async (cli) => {
      if (configs[cli.comercioId]) return;
      const path = `configuracion/${cli.comercioId}`;
      try {
        const snap = await getDoc(doc(db, 'configuracion', cli.comercioId));
        if (snap.exists()) {
          setConfigs((prev) => ({
            ...prev,
            [snap.id]: { id: snap.id, ...(snap.data() as Omit<Configuracion, 'id'>) },
          }));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });
  }, [authReady, user, myClientes, configs]);

  const clientes = useMemo(
    () => mergeById(staffClientes, myClientes),
    [staffClientes, myClientes],
  );
  const cuentas = useMemo(() => mergeById(staffCuentas, myCuentas), [staffCuentas, myCuentas]);
  const movimientos = useMemo(
    () => mergeById(staffMovimientos, myMovimientos),
    [staffMovimientos, myMovimientos],
  );
  const canjes = useMemo(() => mergeById(staffCanjes, myCanjes), [staffCanjes, myCanjes]);

  const staffComercios = useMemo(() => {
    if (isMasterAdmin) return comercios;
    if (!user) return [];
    const allowedIds = new Set(membresias.filter((m) => m.activo).map((m) => m.comercioId));
    return comercios.filter((c) => allowedIds.has(c.id));
  }, [comercios, membresias, isMasterAdmin, user]);

  const activeComercio = useMemo(() => {
    return staffComercios.find((c) => c.id === selectedComercioId) ?? staffComercios[0] ?? null;
  }, [staffComercios, selectedComercioId]);

  useEffect(() => {
    if (!isMasterAdmin && staffComercios.length === 0 && portal === 'comercio') {
      setPortal('cliente');
    }
  }, [isMasterAdmin, staffComercios.length, portal]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Conectando con NEXO PUNTOS...
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const activeConfig: Configuracion | undefined = activeComercio
    ? configs[activeComercio.id] ?? {
        id: activeComercio.id,
        comercioId: activeComercio.id,
        staffUids: activeComercio.staffUids,
        modalidad: 'hibrido',
        puntosPorTramo: 1,
        pesosPorTramo: 1000,
        montoMinimoCompra: 1000,
        bonoPrimeraCompra: 10,
        diasVencimiento: 180,
        promoActiva: false,
        promoMultiplicador: 2,
        sellosObjetivo: 8,
        premioSellos: 'Consumición de cortesía',
        updatedAt: activeComercio.updatedAt,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() =>
              setPortal(isMasterAdmin ? 'master' : staffComercios.length > 0 ? 'comercio' : 'cliente')
            }
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            NEXO PUNTOS
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
            {isMasterAdmin && (
              <button
                type="button"
                onClick={() => setPortal('master')}
                className={`whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
                  portal === 'master'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Panel Maestro NEXO+
              </button>
            )}
            {(isMasterAdmin || staffComercios.length > 0) && (
              <button
                type="button"
                onClick={() => setPortal('comercio')}
                className={`whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
                  portal === 'comercio'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                Panel Comercio
              </button>
            )}
            <button
              type="button"
              onClick={() => setPortal('cliente')}
              className={`whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors cursor-pointer ${
                portal === 'cliente'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Portal del Cliente
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton appName="NexoPuntos" accentColor="#0F172A" compact />
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {portal === 'master' && isMasterAdmin && (
          <MasterAdminPanel
            user={user}
            comercios={comercios}
            clientes={clientes}
            cuentas={cuentas}
            movimientos={movimientos}
            onEnterComercio={(comId) => {
              setSelectedComercioId(comId);
              setPortal('comercio');
            }}
          />
        )}

        {portal === 'comercio' && (
          <div className="space-y-6">
            {staffComercios.length > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs">
                <label htmlFor="active-com-select" className="text-slate-500">
                  Comercio activo:
                </label>
                <select
                  id="active-com-select"
                  value={activeComercio?.id ?? ''}
                  onChange={(e) => setSelectedComercioId(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 font-medium bg-white"
                >
                  {staffComercios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeComercio && activeConfig ? (
              <MerchantWorkspace
                user={user}
                comercio={activeComercio}
                config={activeConfig}
                clientes={clientes.filter((c) => c.comercioId === activeComercio.id)}
                cuentas={cuentas.filter((a) => a.comercioId === activeComercio.id)}
                movimientos={movimientos
                  .filter((m) => m.comercioId === activeComercio.id)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                premios={premios.filter((p) => p.comercioId === activeComercio.id)}
                canjes={canjes
                  .filter((c) => c.comercioId === activeComercio.id)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                notificaciones={notificaciones
                  .filter((n) => n.comercioId === activeComercio.id)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                membresias={membresias.filter((m) => m.comercioId === activeComercio.id)}
                onPreviewCustomer={(cliId) => {
                  setSelectedClienteId(cliId);
                  setPortal('cliente');
                }}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  No tenés comercios asignados todavía
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  {isMasterAdmin
                    ? 'Creá un comercio o cargá los comercios demo desde el Panel Maestro NEXO+.'
                    : `Pedile al administrador (${MASTER_ADMIN_EMAIL}) o al dueño de tu comercio que autorice tu UID: ${user.uid}`}
                </p>
                {isMasterAdmin && (
                  <button
                    type="button"
                    onClick={() => setPortal('master')}
                    className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white cursor-pointer"
                  >
                    Ir al Panel Maestro
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {portal === 'cliente' && (
          <CustomerPortal
            comercios={comercios}
            configs={configs}
            clientes={clientes}
            cuentas={cuentas}
            movimientos={movimientos}
            premios={premios}
            notificaciones={notificaciones}
            selectedClienteId={selectedClienteId}
            onSelectCliente={setSelectedClienteId}
          />
        )}
      </main>

      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Sin conexión — usando datos en caché local</span>
        </div>
      )}
    </div>
  );
}
