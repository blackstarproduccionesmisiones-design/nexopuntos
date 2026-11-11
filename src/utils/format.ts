import type { PushSegment } from '../types';

export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}

export function formatDni(dni: string): string {
  const clean = dni.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeDays(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} días`;
}

export function getSegmentLabel(segment: PushSegment): string {
  switch (segment) {
    case 'all':
      return 'Todos los socios';
    case 'frequent':
      return 'Clientes frecuentes';
    case 'redeemable':
      return 'Con premio disponible';
  }
}
