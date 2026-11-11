export const MASTER_ADMIN_EMAIL = 'blackstarproducciones.misiones@gmail.com';

export type PlanId = 'starter' | 'pro' | 'multisucursal';
export type ComercioEstado = 'activo' | 'suspendido';
export type LoyaltyModalidad = 'puntos' | 'sellos' | 'hibrido';
export type MembershipRole = 'owner' | 'employee';
export type MovimientoTipo = 'credito' | 'debito' | 'canje' | 'ajuste' | 'reversion';
export type CanjeEstado = 'pendiente' | 'entregado' | 'cancelado';
export type PushSegment = 'all' | 'frequent' | 'redeemable';
export type PortalView = 'master' | 'comercio' | 'cliente';
export type MerchantTab = 'resumen' | 'caja' | 'clientes' | 'premios' | 'push' | 'config';

export interface Comercio {
  id: string;
  nombre: string;
  nombreCorto: string;
  rubro: string;
  colorAcento: string;
  logoUrl?: string;
  plan: PlanId;
  estado: ComercioEstado;
  limiteClientes: number;
  ownerUid: string;
  ownerEmail: string;
  staffUids: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Configuracion {
  id: string; // == comercioId
  comercioId: string;
  staffUids: string[];
  modalidad: LoyaltyModalidad;
  puntosPorTramo: number;
  pesosPorTramo: number;
  montoMinimoCompra: number;
  bonoPrimeraCompra: number;
  diasVencimiento: number; // 0 = sin vencimiento
  promoActiva: boolean;
  promoMultiplicador: number;
  promoTitulo?: string;
  sellosObjetivo: number;
  premioSellos: string;
  updatedAt: string;
}

export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  ultimoAcceso: string;
}

export interface Membresia {
  id: string; // `${comercioId}_${uid}`
  comercioId: string;
  ownerUid: string;
  uid: string;
  email: string;
  nombre: string;
  rol: MembershipRole;
  activo: boolean;
  createdAt: string;
}

export interface Cliente {
  id: string;
  comercioId: string;
  staffUids: string[];
  nombre: string;
  dni: string;
  telefono?: string;
  email?: string;
  qrToken: string;
  clienteUid?: string;
  activo: boolean;
  createdByUid: string;
  createdAt: string;
}

export interface CuentaPuntos {
  id: string; // `${comercioId}_${clienteId}`
  comercioId: string;
  staffUids: string[];
  clienteId: string;
  clienteUid?: string;
  clienteEmail?: string;
  puntosDisponibles: number;
  sellosActuales: number;
  totalAcumulado: number;
  totalCanjeado: number;
  visitas: number;
  ultimaOperacionId?: string;
  venceEl?: string;
  updatedAt: string;
}

export interface MovimientoPuntos {
  id: string;
  comercioId: string;
  staffUids: string[];
  clienteId: string;
  clienteUid?: string;
  clienteEmail?: string;
  clienteNombre: string;
  tipo: MovimientoTipo;
  concepto: string;
  puntos: number;
  sellos: number;
  montoCompra: number;
  saldoResultante: number;
  autorizadoPorUid: string;
  autorizadoPorNombre: string;
  operacionId: string;
  revertido: boolean;
  createdAt: string;
}

export interface Premio {
  id: string;
  comercioId: string;
  staffUids: string[];
  titulo: string;
  descripcion: string;
  puntosRequeridos: number;
  activo: boolean;
  imageKey?: string;
  createdAt: string;
}

export interface Canje {
  id: string;
  comercioId: string;
  staffUids: string[];
  clienteId: string;
  clienteUid?: string;
  clienteEmail?: string;
  clienteNombre: string;
  premioId: string;
  premioTitulo: string;
  puntosUsados: number;
  estado: CanjeEstado;
  codigoValidacion: string;
  autorizadoPorUid?: string;
  autorizadoPorNombre?: string;
  createdAt: string;
  entregadoAt?: string;
}

export interface Notificacion {
  id: string;
  comercioId: string;
  staffUids: string[];
  titulo: string;
  mensaje: string;
  segmento: PushSegment;
  destinatarios: number;
  publico: boolean;
  creadoPorUid: string;
  createdAt: string;
}
