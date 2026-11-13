/** Métodos que fuerzan «Requiere facturación» activado. */
export const BILLING_REQUIRED_METHODS = [
  'Transferencia',
  'Tarjeta Credito',
  'Tarjeta Debito'
];

export const DOCUMENT_TYPES_AR = [
  'DNI',
  'LE',
  'LC',
  'Pasaporte',
  'CUIT',
  'CUIL',
  'CI',
  'Otro'
];

export const IVA_CONDITIONS = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'No Responsable',
  'Responsable No Inscripto'
];

export const DEFAULT_IVA_CONDITION = 'Responsable Inscripto';

/** Concepto del cobro en Nuevo pago (no texto libre). */
export const PAGO_MOTIVOS = ['Pago', 'Seña'];
export const DEFAULT_PAGO_MOTIVO = 'Pago';

export function methodRequiresBilling(metodo) {
  return BILLING_REQUIRED_METHODS.includes(metodo);
}

export function isCardMethod(metodo) {
  return metodo === 'Tarjeta Credito' || metodo === 'Tarjeta Debito';
}

export function todayLocalDateTimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor para input type="date" (YYYY-MM-DD, zona local). */
export function todayLocalDateInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Interpreta YYYY-MM-DD como mediodía local para evitar corrimiento UTC. */
export function localDateInputToIso(dateInputValue) {
  if (!dateInputValue) return null;
  const match = String(dateInputValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const d = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(dateInputValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function emptyBillingForm(overrides = {}) {
  return {
    tipo: 'B',
    fecha: todayLocalDateInputValue(),
    firstName: '',
    lastName: '',
    documentType: 'DNI',
    documentNumber: '',
    address: '',
    email: '',
    businessName: '',
    cuit: '',
    commercialAddress: '',
    ivaCondition: DEFAULT_IVA_CONDITION,
    cardNumber: '',
    ...overrides
  };
}
