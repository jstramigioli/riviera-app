/** Métodos de pago que exigen facturación (toggle fijo activado). */
const BILLING_REQUIRED_METHODS = ['Transferencia', 'Tarjeta Credito', 'Tarjeta Debito'];

const INVOICE_TYPES = ['A', 'B'];

const DOCUMENT_TYPES_AR = [
  'DNI',
  'LE',
  'LC',
  'Pasaporte',
  'CUIT',
  'CUIL',
  'CI',
  'Otro'
];

const IVA_CONDITIONS = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'No Responsable',
  'Responsable No Inscripto'
];

const DEFAULT_IVA_CONDITION = 'Responsable Inscripto';

/** Concepto del cobro (no texto libre). */
const PAGO_MOTIVOS = ['Pago', 'Seña'];
const DEFAULT_PAGO_MOTIVO = 'Pago';

function methodRequiresBilling(metodo) {
  return BILLING_REQUIRED_METHODS.includes(metodo);
}

function isCardMethod(metodo) {
  return metodo === 'Tarjeta Credito' || metodo === 'Tarjeta Debito';
}

function normalizePagoMotivo(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_PAGO_MOTIVO;
  const folded = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (folded === 'sena') return 'Seña';
  if (folded === 'pago') return 'Pago';
  return null;
}

module.exports = {
  BILLING_REQUIRED_METHODS,
  INVOICE_TYPES,
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  DEFAULT_IVA_CONDITION,
  PAGO_MOTIVOS,
  DEFAULT_PAGO_MOTIVO,
  methodRequiresBilling,
  isCardMethod,
  normalizePagoMotivo
};
