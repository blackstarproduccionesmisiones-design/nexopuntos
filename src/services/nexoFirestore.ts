import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type {
  Cliente,
  Comercio,
  ComercioEstado,
  Configuracion,
  CuentaPuntos,
  Membresia,
  MembershipRole,
  MovimientoPuntos,
  Notificacion,
  PlanId,
  Premio,
  PushSegment,
} from '../types';

export function generateQrToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'NX-';
  for (let i = 0; i < 10; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function generateOperationId(prefix = 'op'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `usuarios/${user.uid}`;
  try {
    await setDoc(doc(db, 'usuarios', user.uid), {
      uid: user.uid,
      nombre: (user.displayName || user.email || 'Usuario').slice(0, 100),
      email: (user.email || '').slice(0, 140),
      ultimoAcceso: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createComercioWithDefaults(params: {
  nombre: string;
  nombreCorto: string;
  rubro: string;
  colorAcento: string;
  plan: PlanId;
  limiteClientes: number;
  ownerUid: string;
  ownerEmail: string;
  ownerNombre: string;
}): Promise<string> {
  const comercioId = `com_${Date.now()}`;
  const now = new Date().toISOString();
  const staffUids = [params.ownerUid];

  const batch = writeBatch(db);

  const comercioData: Omit<Comercio, 'id'> = {
    nombre: params.nombre.trim().slice(0, 80),
    nombreCorto: params.nombreCorto.trim().slice(0, 12),
    rubro: params.rubro.trim().slice(0, 50),
    colorAcento: params.colorAcento,
    plan: params.plan,
    estado: 'activo',
    limiteClientes: params.limiteClientes,
    ownerUid: params.ownerUid,
    ownerEmail: params.ownerEmail.trim().slice(0, 120),
    staffUids,
    createdAt: now,
    updatedAt: now,
  };
  batch.set(doc(db, 'comercios', comercioId), comercioData);

  const configData = {
    comercioId,
    staffUids,
    modalidad: 'hibrido',
    puntosPorTramo: 1,
    pesosPorTramo: 1000,
    montoMinimoCompra: 1000,
    bonoPrimeraCompra: 10,
    diasVencimiento: 180,
    promoActiva: false,
    promoMultiplicador: 2,
    promoTitulo: 'Doble puntaje en horario feliz',
    sellosObjetivo: 8,
    premioSellos: 'Consumición de cortesía',
    updatedAt: now,
  };
  batch.set(doc(db, 'configuracion', comercioId), configData);

  const membId = `${comercioId}_${params.ownerUid}`;
  const membData: Omit<Membresia, 'id'> = {
    comercioId,
    ownerUid: params.ownerUid,
    uid: params.ownerUid,
    email: params.ownerEmail.trim().slice(0, 140),
    nombre: params.ownerNombre.trim().slice(0, 100),
    rol: 'owner',
    activo: true,
    createdAt: now,
  };
  batch.set(doc(db, 'membresias', membId), membData);

  const defaultPremios = [
    {
      titulo: 'Bebida o Infusión sin cargo',
      descripcion: 'Canjeable en mostrador cualquier día de la semana.',
      puntosRequeridos: 30,
      imageKey: 'coffee',
    },
    {
      titulo: 'Combo Desayuno o Hamburguesa',
      descripcion: 'Premio principal acumulando puntos de tus compras.',
      puntosRequeridos: 100,
      imageKey: 'box',
    },
    {
      titulo: '25% OFF en tu compra total',
      descripcion: 'Descuento especial aplicable en caja sin tope.',
      puntosRequeridos: 150,
      imageKey: 'discount',
    },
  ];

  defaultPremios.forEach((p, idx) => {
    const pId = `prem_${comercioId}_${idx + 1}`;
    batch.set(doc(db, 'premios', pId), {
      comercioId,
      staffUids,
      titulo: p.titulo,
      descripcion: p.descripcion,
      puntosRequeridos: p.puntosRequeridos,
      activo: true,
      imageKey: p.imageKey,
      createdAt: now,
    });
  });

  try {
    await batch.commit();
    return comercioId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `comercios/${comercioId}`);
  }
}

export async function updateComercioMaster(
  comercioId: string,
  patch: Partial<{
    estado: ComercioEstado;
    plan: PlanId;
    limiteClientes: number;
    nombre: string;
    nombreCorto: string;
    rubro: string;
    colorAcento: string;
  }>,
): Promise<void> {
  const path = `comercios/${comercioId}`;
  try {
    await updateDoc(doc(db, 'comercios', comercioId), {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateConfiguracionComercio(
  comercioId: string,
  config: Omit<Configuracion, 'id'>,
): Promise<void> {
  const path = `configuracion/${comercioId}`;
  try {
    await setDoc(doc(db, 'configuracion', comercioId), {
      ...config,
      comercioId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function registrarClienteComercio(params: {
  comercio: Comercio;
  nombre: string;
  dni: string;
  telefono?: string;
  email?: string;
  autorUid: string;
}): Promise<{ clienteId: string; qrToken: string }> {
  const clienteId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cuentaId = `${params.comercio.id}_${clienteId}`;
  const qrToken = generateQrToken();
  const now = new Date().toISOString();

  const batch = writeBatch(db);

  const clienteDoc: Record<string, unknown> = {
    comercioId: params.comercio.id,
    staffUids: params.comercio.staffUids,
    nombre: params.nombre.trim().slice(0, 100),
    dni: params.dni.replace(/\D/g, '').slice(0, 16),
    qrToken,
    activo: true,
    createdByUid: params.autorUid,
    createdAt: now,
  };
  if (params.telefono?.trim()) clienteDoc.telefono = params.telefono.trim().slice(0, 30);
  if (params.email?.trim()) clienteDoc.email = params.email.trim().toLowerCase().slice(0, 140);

  batch.set(doc(db, 'clientes', clienteId), clienteDoc);

  const cuentaDoc: Record<string, unknown> = {
    comercioId: params.comercio.id,
    staffUids: params.comercio.staffUids,
    clienteId,
    puntosDisponibles: 0,
    sellosActuales: 0,
    totalAcumulado: 0,
    totalCanjeado: 0,
    visitas: 0,
    updatedAt: now,
  };
  if (params.email?.trim()) cuentaDoc.clienteEmail = params.email.trim().toLowerCase().slice(0, 140);

  batch.set(doc(db, 'cuentas_puntos', cuentaId), cuentaDoc);

  try {
    await batch.commit();
    return { clienteId, qrToken };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clientes/${clienteId}`);
  }
}

export async function acreditarPuntosTransaccion(params: {
  comercio: Comercio;
  config: Configuracion;
  cliente: Cliente;
  montoCompra: number;
  sellosDelta: number;
  puntosManual?: number;
  concepto: string;
  operacionId: string;
  autorUid: string;
  autorNombre: string;
}): Promise<{ puntosGanados: number; nuevoSaldo: number }> {
  const cuentaId = `${params.comercio.id}_${params.cliente.id}`;
  const cuentaRef = doc(db, 'cuentas_puntos', cuentaId);
  const opRef = doc(db, 'operaciones_idempotentes', params.operacionId);
  const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const movRef = doc(db, 'movimientos_puntos', movId);

  try {
    return await runTransaction(db, async (tx) => {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists()) {
        throw new Error('Operación duplicada bloqueada (doble escaneo prevenido).');
      }

      const cuentaSnap = await tx.get(cuentaRef);
      if (!cuentaSnap.exists()) {
        throw new Error('La cuenta de puntos del cliente no existe.');
      }

      const cuenta = cuentaSnap.data() as CuentaPuntos;

      let puntosGanados = 0;
      if (typeof params.puntosManual === 'number') {
        puntosGanados = params.puntosManual;
      } else if (params.montoCompra >= params.config.montoMinimoCompra) {
        const basePuntos = Math.floor(params.montoCompra / params.config.pesosPorTramo) * params.config.puntosPorTramo;
        const mult = params.config.promoActiva ? params.config.promoMultiplicador : 1;
        const bonoPrimera = cuenta.visitas === 0 ? params.config.bonoPrimeraCompra : 0;
        puntosGanados = Math.round(basePuntos * mult) + bonoPrimera;
      }

      const nuevoSaldo = Math.max(0, cuenta.puntosDisponibles + puntosGanados);
      const nuevosSellos = Math.max(0, cuenta.sellosActuales + params.sellosDelta);
      const now = new Date().toISOString();

      const cuentaPatch: Record<string, unknown> = {
        puntosDisponibles: nuevoSaldo,
        sellosActuales: nuevosSellos,
        totalAcumulado: cuenta.totalAcumulado + Math.max(0, puntosGanados),
        visitas: cuenta.visitas + 1,
        ultimaOperacionId: params.operacionId,
        updatedAt: now,
      };
      if (params.config.diasVencimiento > 0) {
        cuentaPatch.venceEl = addDaysIso(params.config.diasVencimiento);
      }

      tx.update(cuentaRef, cuentaPatch);

      const movDoc: Record<string, unknown> = {
        comercioId: params.comercio.id,
        staffUids: params.comercio.staffUids,
        clienteId: params.cliente.id,
        clienteNombre: params.cliente.nombre,
        tipo: 'credito',
        concepto: params.concepto.trim().slice(0, 160),
        puntos: puntosGanados,
        sellos: params.sellosDelta,
        montoCompra: Math.max(0, params.montoCompra),
        saldoResultante: nuevoSaldo,
        autorizadoPorUid: params.autorUid,
        autorizadoPorNombre: params.autorNombre.slice(0, 100),
        operacionId: params.operacionId,
        revertido: false,
        createdAt: now,
      };
      if (params.cliente.clienteUid) movDoc.clienteUid = params.cliente.clienteUid;
      if (params.cliente.email) movDoc.clienteEmail = params.cliente.email;

      tx.set(movRef, movDoc);

      tx.set(opRef, {
        comercioId: params.comercio.id,
        autorizadoPorUid: params.autorUid,
        createdAt: now,
      });

      return { puntosGanados, nuevoSaldo };
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Operación duplicada')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `cuentas_puntos/${cuentaId}`);
  }
}

export async function ajusteManualTransaccion(params: {
  comercio: Comercio;
  cliente: Cliente;
  puntosDelta: number;
  sellosDelta: number;
  concepto: string;
  operacionId: string;
  autorUid: string;
  autorNombre: string;
}): Promise<{ nuevoSaldo: number }> {
  const cuentaId = `${params.comercio.id}_${params.cliente.id}`;
  const cuentaRef = doc(db, 'cuentas_puntos', cuentaId);
  const opRef = doc(db, 'operaciones_idempotentes', params.operacionId);
  const movRef = doc(db, 'movimientos_puntos', `mov_${Date.now()}`);

  try {
    return await runTransaction(db, async (tx) => {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists()) throw new Error('Operación duplicada.');
      const cuentaSnap = await tx.get(cuentaRef);
      if (!cuentaSnap.exists()) throw new Error('Cuenta no encontrada.');

      const cuenta = cuentaSnap.data() as CuentaPuntos;
      const nuevoSaldo = Math.max(0, cuenta.puntosDisponibles + params.puntosDelta);
      const nuevosSellos = Math.max(0, cuenta.sellosActuales + params.sellosDelta);
      const now = new Date().toISOString();

      tx.update(cuentaRef, {
        puntosDisponibles: nuevoSaldo,
        sellosActuales: nuevosSellos,
        ultimaOperacionId: params.operacionId,
        updatedAt: now,
      });

      const movDoc: Record<string, unknown> = {
        comercioId: params.comercio.id,
        staffUids: params.comercio.staffUids,
        clienteId: params.cliente.id,
        clienteNombre: params.cliente.nombre,
        tipo: params.puntosDelta >= 0 ? 'ajuste' : 'debito',
        concepto: params.concepto.trim().slice(0, 160),
        puntos: params.puntosDelta,
        sellos: params.sellosDelta,
        montoCompra: 0,
        saldoResultante: nuevoSaldo,
        autorizadoPorUid: params.autorUid,
        autorizadoPorNombre: params.autorNombre.slice(0, 100),
        operacionId: params.operacionId,
        revertido: false,
        createdAt: now,
      };
      if (params.cliente.clienteUid) movDoc.clienteUid = params.cliente.clienteUid;
      if (params.cliente.email) movDoc.clienteEmail = params.cliente.email;

      tx.set(movRef, movDoc);
      tx.set(opRef, {
        comercioId: params.comercio.id,
        autorizadoPorUid: params.autorUid,
        createdAt: now,
      });

      return { nuevoSaldo };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `cuentas_puntos/${cuentaId}`);
  }
}

export async function revertirMovimientoTransaccion(params: {
  comercio: Comercio;
  movimiento: MovimientoPuntos;
  operacionId: string;
  autorUid: string;
  autorNombre: string;
}): Promise<void> {
  if (params.movimiento.revertido) {
    throw new Error('Este movimiento ya fue revertido.');
  }
  const cuentaId = `${params.comercio.id}_${params.movimiento.clienteId}`;
  const cuentaRef = doc(db, 'cuentas_puntos', cuentaId);
  const origRef = doc(db, 'movimientos_puntos', params.movimiento.id);
  const revRef = doc(db, 'movimientos_puntos', `rev_${Date.now()}`);
  const opRef = doc(db, 'operaciones_idempotentes', params.operacionId);

  try {
    await runTransaction(db, async (tx) => {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists()) throw new Error('Reversión duplicada.');

      const origSnap = await tx.get(origRef);
      if (!origSnap.exists() || origSnap.data().revertido === true) {
        throw new Error('El movimiento ya fue revertido.');
      }

      const cuentaSnap = await tx.get(cuentaRef);
      if (!cuentaSnap.exists()) throw new Error('Cuenta no encontrada.');
      const cuenta = cuentaSnap.data() as CuentaPuntos;

      const puntosReversion = -params.movimiento.puntos;
      const sellosReversion = -params.movimiento.sellos;
      const nuevoSaldo = Math.max(0, cuenta.puntosDisponibles + puntosReversion);
      const nuevosSellos = Math.max(0, cuenta.sellosActuales + sellosReversion);
      const now = new Date().toISOString();

      tx.update(origRef, { revertido: true });
      tx.update(cuentaRef, {
        puntosDisponibles: nuevoSaldo,
        sellosActuales: nuevosSellos,
        ultimaOperacionId: params.operacionId,
        updatedAt: now,
      });

      const revDoc: Record<string, unknown> = {
        comercioId: params.comercio.id,
        staffUids: params.comercio.staffUids,
        clienteId: params.movimiento.clienteId,
        clienteNombre: params.movimiento.clienteNombre,
        tipo: 'reversion',
        concepto: `Reversión: ${params.movimiento.concepto}`.slice(0, 160),
        puntos: puntosReversion,
        sellos: sellosReversion,
        montoCompra: 0,
        saldoResultante: nuevoSaldo,
        autorizadoPorUid: params.autorUid,
        autorizadoPorNombre: params.autorNombre.slice(0, 100),
        operacionId: params.operacionId,
        revertido: false,
        createdAt: now,
      };
      if (params.movimiento.clienteUid) revDoc.clienteUid = params.movimiento.clienteUid;
      if (params.movimiento.clienteEmail) revDoc.clienteEmail = params.movimiento.clienteEmail;

      tx.set(revRef, revDoc);
      tx.set(opRef, {
        comercioId: params.comercio.id,
        autorizadoPorUid: params.autorUid,
        createdAt: now,
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `movimientos_puntos/${params.movimiento.id}`);
  }
}

export async function canjearPremioTransaccion(params: {
  comercio: Comercio;
  cliente: Cliente;
  premio: Premio | { id: string; titulo: string; puntosRequeridos: number; modoSellos?: boolean; sellosCost?: number };
  operacionId: string;
  autorUid: string;
  autorNombre: string;
}): Promise<{ codigoValidacion: string; nuevoSaldo: number }> {
  const cuentaId = `${params.comercio.id}_${params.cliente.id}`;
  const cuentaRef = doc(db, 'cuentas_puntos', cuentaId);
  const opRef = doc(db, 'operaciones_idempotentes', params.operacionId);
  const movRef = doc(db, 'movimientos_puntos', `mov_${Date.now()}`);
  const canjeRef = doc(db, 'canjes', `can_${Date.now()}`);
  const codigoValidacion = `CJ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const isStampRedeem = 'modoSellos' in params.premio && params.premio.modoSellos;
  const sellosCost = 'sellosCost' in params.premio ? (params.premio.sellosCost ?? 8) : 0;

  try {
    return await runTransaction(db, async (tx) => {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists()) throw new Error('Canje duplicado bloqueado.');

      const cuentaSnap = await tx.get(cuentaRef);
      if (!cuentaSnap.exists()) throw new Error('Cuenta no encontrada.');
      const cuenta = cuentaSnap.data() as CuentaPuntos;

      if (isStampRedeem) {
        if (cuenta.sellosActuales < sellosCost) {
          throw new Error('Sellos insuficientes para este canje.');
        }
      } else if (cuenta.puntosDisponibles < params.premio.puntosRequeridos) {
        throw new Error('Puntos insuficientes para este premio.');
      }

      const puntosUsados = isStampRedeem ? 0 : params.premio.puntosRequeridos;
      const sellosDelta = isStampRedeem ? -sellosCost : 0;
      const nuevoSaldo = cuenta.puntosDisponibles - puntosUsados;
      const nuevosSellos = cuenta.sellosActuales + sellosDelta;
      const now = new Date().toISOString();

      tx.update(cuentaRef, {
        puntosDisponibles: nuevoSaldo,
        sellosActuales: nuevosSellos,
        totalCanjeado: cuenta.totalCanjeado + puntosUsados,
        ultimaOperacionId: params.operacionId,
        updatedAt: now,
      });

      const movDoc: Record<string, unknown> = {
        comercioId: params.comercio.id,
        staffUids: params.comercio.staffUids,
        clienteId: params.cliente.id,
        clienteNombre: params.cliente.nombre,
        tipo: 'canje',
        concepto: `Canje de premio: ${params.premio.titulo}`.slice(0, 160),
        puntos: -puntosUsados,
        sellos: sellosDelta,
        montoCompra: 0,
        saldoResultante: nuevoSaldo,
        autorizadoPorUid: params.autorUid,
        autorizadoPorNombre: params.autorNombre.slice(0, 100),
        operacionId: params.operacionId,
        revertido: false,
        createdAt: now,
      };
      if (params.cliente.clienteUid) movDoc.clienteUid = params.cliente.clienteUid;
      if (params.cliente.email) movDoc.clienteEmail = params.cliente.email;
      tx.set(movRef, movDoc);

      const canjeDoc: Record<string, unknown> = {
        comercioId: params.comercio.id,
        staffUids: params.comercio.staffUids,
        clienteId: params.cliente.id,
        clienteNombre: params.cliente.nombre,
        premioId: params.premio.id,
        premioTitulo: params.premio.titulo.slice(0, 80),
        puntosUsados,
        estado: 'entregado',
        codigoValidacion,
        autorizadoPorUid: params.autorUid,
        autorizadoPorNombre: params.autorNombre.slice(0, 100),
        createdAt: now,
        entregadoAt: now,
      };
      if (params.cliente.clienteUid) canjeDoc.clienteUid = params.cliente.clienteUid;
      if (params.cliente.email) canjeDoc.clienteEmail = params.cliente.email;
      tx.set(canjeRef, canjeDoc);

      tx.set(opRef, {
        comercioId: params.comercio.id,
        autorizadoPorUid: params.autorUid,
        createdAt: now,
      });

      return { codigoValidacion, nuevoSaldo };
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('insuficientes') || err.message.includes('duplicado'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `canjes/${canjeRef.id}`);
  }
}

export async function crearPremioComercio(params: {
  comercio: Comercio;
  titulo: string;
  descripcion: string;
  puntosRequeridos: number;
  imageKey?: string;
}): Promise<void> {
  const premioId = `prem_${Date.now()}`;
  try {
    await setDoc(doc(db, 'premios', premioId), {
      comercioId: params.comercio.id,
      staffUids: params.comercio.staffUids,
      titulo: params.titulo.trim().slice(0, 80),
      descripcion: params.descripcion.trim().slice(0, 200),
      puntosRequeridos: Math.max(1, params.puntosRequeridos),
      activo: true,
      imageKey: params.imageKey || 'coffee',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `premios/${premioId}`);
  }
}

export async function eliminarPremioComercio(premioId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'premios', premioId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `premios/${premioId}`);
  }
}

export async function enviarNotificacionComercio(params: {
  comercio: Comercio;
  titulo: string;
  mensaje: string;
  segmento: PushSegment;
  destinatarios: number;
  creadoPorUid: string;
}): Promise<void> {
  const notifId = `not_${Date.now()}`;
  try {
    await setDoc(doc(db, 'notificaciones', notifId), {
      comercioId: params.comercio.id,
      staffUids: params.comercio.staffUids,
      titulo: params.titulo.trim().slice(0, 80),
      mensaje: params.mensaje.trim().slice(0, 240),
      segmento: params.segmento,
      destinatarios: params.destinatarios,
      publico: true,
      creadoPorUid: params.creadoPorUid,
      createdAt: new Date().toISOString(),
    } satisfies Omit<Notificacion, 'id'>);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `notificaciones/${notifId}`);
  }
}

export async function agregarEmpleadoComercio(params: {
  comercio: Comercio;
  uid: string;
  email: string;
  nombre: string;
  rol: MembershipRole;
}): Promise<void> {
  const membId = `${params.comercio.id}_${params.uid.trim()}`;
  const updatedStaff = Array.from(new Set([...params.comercio.staffUids, params.uid.trim()])).slice(0, 25);
  const now = new Date().toISOString();

  const batch = writeBatch(db);
  batch.set(doc(db, 'membresias', membId), {
    comercioId: params.comercio.id,
    ownerUid: params.comercio.ownerUid,
    uid: params.uid.trim(),
    email: params.email.trim().slice(0, 140),
    nombre: params.nombre.trim().slice(0, 100),
    rol: params.rol,
    activo: true,
    createdAt: now,
  });

  batch.update(doc(db, 'comercios', params.comercio.id), {
    staffUids: updatedStaff,
    updatedAt: now,
  });

  batch.update(doc(db, 'configuracion', params.comercio.id), {
    staffUids: updatedStaff,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `membresias/${membId}`);
  }
}

export async function seedDemoComerciosParaMaster(masterUser: User): Promise<void> {
  const existing = await getDocs(query(collection(db, 'comercios'), where('ownerUid', '==', masterUser.uid)));
  if (!existing.empty) return;

  const now = new Date().toISOString();
  const com1Id = 'com_brava_cafe';
  const com2Id = 'com_norte_burger';
  const staffUids = [masterUser.uid];

  const batch = writeBatch(db);

  // Comercio 1: Café Brava
  batch.set(doc(db, 'comercios', com1Id), {
    nombre: 'Café Brava & Tostaduría',
    nombreCorto: 'Café Brava',
    rubro: 'Cafetería y Pastelería',
    colorAcento: '#059669',
    plan: 'pro',
    estado: 'activo',
    limiteClientes: 3000,
    ownerUid: masterUser.uid,
    ownerEmail: masterUser.email || '',
    staffUids,
    createdAt: daysAgoIso(30),
    updatedAt: now,
  });

  batch.set(doc(db, 'configuracion', com1Id), {
    comercioId: com1Id,
    staffUids,
    modalidad: 'hibrido',
    puntosPorTramo: 1,
    pesosPorTramo: 1000,
    montoMinimoCompra: 1500,
    bonoPrimeraCompra: 10,
    diasVencimiento: 180,
    promoActiva: true,
    promoMultiplicador: 2,
    promoTitulo: 'Doble puntaje mañanas de 8 a 11 hs',
    sellosObjetivo: 8,
    premioSellos: 'Flat White + Croissant artesanal',
    updatedAt: now,
  });

  batch.set(doc(db, 'membresias', `${com1Id}_${masterUser.uid}`), {
    comercioId: com1Id,
    ownerUid: masterUser.uid,
    uid: masterUser.uid,
    email: masterUser.email || '',
    nombre: masterUser.displayName || 'Administrador Maestro',
    rol: 'owner',
    activo: true,
    createdAt: daysAgoIso(30),
  });

  const premios1 = [
    { id: 'prem_brava_1', titulo: 'Bebida o Cortado gratis', descripcion: 'Cualquier espresso o infusión en barra.', puntosRequeridos: 30, imageKey: 'coffee' },
    { id: 'prem_brava_2', titulo: 'Combo Desayuno Brava', descripcion: 'Latte especialidad + croissant recién horneado.', puntosRequeridos: 100, imageKey: 'box' },
    { id: 'prem_brava_3', titulo: 'Descuento especial 25% OFF', descripcion: 'Aplicable sobre el total de tu ticket.', puntosRequeridos: 150, imageKey: 'discount' },
  ];
  for (const p of premios1) {
    batch.set(doc(db, 'premios', p.id), {
      comercioId: com1Id,
      staffUids,
      titulo: p.titulo,
      descripcion: p.descripcion,
      puntosRequeridos: p.puntosRequeridos,
      activo: true,
      imageKey: p.imageKey,
      createdAt: daysAgoIso(29),
    });
  }

  const demoClientes = [
    { id: 'cli_camila', nombre: 'Camila Fernández', dni: '38440112', tel: '+54 9 11 5421-8830', email: 'camila.fernandez@gmail.com', qr: 'NX-7K9M2P4Q', pts: 112, sellos: 7, visitas: 12 },
    { id: 'cli_martin', nombre: 'Martín Echeverría', dni: '34812905', tel: '+54 9 11 6109-4412', email: masterUser.email || 'martin@demo.com', qr: 'NX-4R8V1W3Z', pts: 68, sellos: 8, visitas: 9 },
    { id: 'cli_lucia', nombre: 'Lucía Pereyra', dni: '41092341', tel: '+54 9 11 4982-1174', email: 'luciapereyra@gmail.com', qr: 'NX-9B2C5D8F', pts: 34, sellos: 4, visitas: 5 },
  ];

  demoClientes.forEach((c, idx) => {
    batch.set(doc(db, 'clientes', c.id), {
      comercioId: com1Id,
      staffUids,
      nombre: c.nombre,
      dni: c.dni,
      telefono: c.tel,
      email: c.email,
      qrToken: c.qr,
      activo: true,
      createdByUid: masterUser.uid,
      createdAt: daysAgoIso(20 - idx * 3),
    });
    batch.set(doc(db, 'cuentas_puntos', `${com1Id}_${c.id}`), {
      comercioId: com1Id,
      staffUids,
      clienteId: c.id,
      clienteEmail: c.email,
      puntosDisponibles: c.pts,
      sellosActuales: c.sellos,
      totalAcumulado: c.pts + 30,
      totalCanjeado: 30,
      visitas: c.visitas,
      venceEl: addDaysIso(160),
      updatedAt: daysAgoIso(idx),
    });
    batch.set(doc(db, 'movimientos_puntos', `mov_demo_${idx + 1}`), {
      comercioId: com1Id,
      staffUids,
      clienteId: c.id,
      clienteEmail: c.email,
      clienteNombre: c.nombre,
      tipo: 'credito',
      concepto: 'Compra #001 · Consumo en mostrador',
      puntos: 18,
      sellos: 1,
      montoCompra: 9000,
      saldoResultante: c.pts,
      autorizadoPorUid: masterUser.uid,
      autorizadoPorNombre: masterUser.displayName || 'Administrador',
      operacionId: `op_seed_${idx + 1}`,
      revertido: false,
      createdAt: daysAgoIso(idx),
    });
  });

  batch.set(doc(db, 'notificaciones', 'not_demo_1'), {
    comercioId: com1Id,
    staffUids,
    titulo: 'Doble puntaje en horario feliz',
    mensaje: 'Sumá 2x puntos en todas tus compras de 8 a 11 hs mostrando tu QR en caja.',
    segmento: 'all',
    destinatarios: 3,
    publico: true,
    creadoPorUid: masterUser.uid,
    createdAt: daysAgoIso(1),
  });

  // Comercio 2: Norte Burger House
  batch.set(doc(db, 'comercios', com2Id), {
    nombre: 'Norte Burger House',
    nombreCorto: 'Norte Burger',
    rubro: 'Gastronomía',
    colorAcento: '#C2410C',
    plan: 'starter',
    estado: 'activo',
    limiteClientes: 500,
    ownerUid: masterUser.uid,
    ownerEmail: masterUser.email || '',
    staffUids,
    createdAt: daysAgoIso(15),
    updatedAt: now,
  });

  batch.set(doc(db, 'configuracion', com2Id), {
    comercioId: com2Id,
    staffUids,
    modalidad: 'puntos',
    puntosPorTramo: 1,
    pesosPorTramo: 1000,
    montoMinimoCompra: 2000,
    bonoPrimeraCompra: 15,
    diasVencimiento: 90,
    promoActiva: false,
    promoMultiplicador: 2,
    sellosObjetivo: 10,
    premioSellos: 'Hamburguesa Doble + Papas',
    updatedAt: now,
  });

  batch.set(doc(db, 'membresias', `${com2Id}_${masterUser.uid}`), {
    comercioId: com2Id,
    ownerUid: masterUser.uid,
    uid: masterUser.uid,
    email: masterUser.email || '',
    nombre: masterUser.displayName || 'Administrador Maestro',
    rol: 'owner',
    activo: true,
    createdAt: daysAgoIso(15),
  });

  batch.set(doc(db, 'premios', 'prem_norte_1'), {
    comercioId: com2Id,
    staffUids,
    titulo: 'Bebida gratis',
    descripcion: 'Gaseosa o cerveza tirada de 500ml.',
    puntosRequeridos: 30,
    activo: true,
    imageKey: 'coffee',
    createdAt: daysAgoIso(14),
  });

  batch.set(doc(db, 'premios', 'prem_norte_2'), {
    comercioId: com2Id,
    staffUids,
    titulo: 'Hamburguesa Norte Doble',
    descripcion: 'Medallón doble smash con cheddar y papas.',
    puntosRequeridos: 100,
    activo: true,
    imageKey: 'box',
    createdAt: daysAgoIso(14),
  });

  await batch.commit();
}
