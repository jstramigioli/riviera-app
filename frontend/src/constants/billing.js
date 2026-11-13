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

export function emptyBillingForm(overrides = {}) {
  return {
    tipo: 'B',
    fecha: todayLocalDateTimeInputValue(),
    motivo: '',
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
