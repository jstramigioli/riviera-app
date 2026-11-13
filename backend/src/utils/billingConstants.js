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

function methodRequiresBilling(metodo) {
  return BILLING_REQUIRED_METHODS.includes(metodo);
}

function isCardMethod(metodo) {
  return metodo === 'Tarjeta Credito' || metodo === 'Tarjeta Debito';
}

module.exports = {
  BILLING_REQUIRED_METHODS,
  INVOICE_TYPES,
  DOCUMENT_TYPES_AR,
  IVA_CONDITIONS,
  DEFAULT_IVA_CONDITION,
  methodRequiresBilling,
  isCardMethod
};
