/** Modelos Prisma cuyas mutaciones se registran en AuditLog. */
const AUDITED_ENTITIES = new Set([
  'Reservation',
  'ReservationSegment',
  'Client',
  'Guest',
  'Pago',
  'Cargo',
  'Query',
  'QueryGroup',
  'QueryGuest',
  'QueryPayment',
  'SeasonBlock',
  'SeasonPrice',
  'ServiceType',
  'BlockServiceSelection',
  'ProportionCoefficient',
  'Configuracion',
  'SubcategoriaCargo',
  'Hotel',
  'DynamicPricingConfig',
  'User'
]);

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany'
]);

const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  'tokenHash'
]);

const SUMMARY_FIELDS = [
  'id',
  'name',
  'nombre',
  'clave',
  'username',
  'displayName',
  'firstName',
  'lastName',
  'status',
  'monto',
  'montoARS',
  'descripcion',
  'basePrice',
  'valor',
  'reservaId',
  'reservationId',
  'mainClientId',
  'role',
  'isActive',
  'isDraft'
];

module.exports = {
  AUDITED_ENTITIES,
  WRITE_OPS,
  SENSITIVE_FIELDS,
  SUMMARY_FIELDS
};
