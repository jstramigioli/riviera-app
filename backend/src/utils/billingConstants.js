/** Métodos de pago que exigen facturación (toggle fijo activado). */
const BILLING_REQUIRED_METHODS = ['Transferencia', 'Tarjeta Credito', 'Tarjeta Debito'];

const INVOICE_TYPES = ['A', 'B', 'T'];

/** Factura B (consumidor) o T (turista extranjero): datos de persona física. */
function isPersonInvoiceType(tipo) {
  return tipo === 'B' || tipo === 'T';
}

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
const COBRO_MOTIVOS = ['Cobro', 'Seña', 'Devolución'];
const DEFAULT_COBRO_MOTIVO = 'Cobro';
const MOTIVO_DEVOLUCION = 'Devolución';

function methodRequiresBilling(metodo) {
  return BILLING_REQUIRED_METHODS.includes(metodo);
}

function isCardMethod(metodo) {
  return metodo === 'Tarjeta Credito' || metodo === 'Tarjeta Debito';
}

function isDevolucionMotivo(motivo) {
  return motivo === MOTIVO_DEVOLUCION;
}

function normalizeCobroMotivo(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_COBRO_MOTIVO;
  const folded = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (folded === 'sena') return 'Seña';
  if (folded === 'cobro' || folded === 'pago') return 'Cobro';
  if (folded === 'devolucion') return MOTIVO_DEVOLUCION;
  return null;
}

module.exports = {
  BILLING_REQUIRED_METHODS,
  INVOICE_TYPES,
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  DEFAULT_IVA_CONDITION,
  COBRO_MOTIVOS,
  DEFAULT_COBRO_MOTIVO,
  MOTIVO_DEVOLUCION,
  methodRequiresBilling,
  isCardMethod,
  isPersonInvoiceType,
  isDevolucionMotivo,
  normalizeCobroMotivo
};
