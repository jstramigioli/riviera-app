# Sistema de Consultas - Backend

## Descripción

El sistema de consultas permite almacenar consultas de reservas con todos los campos opcionales, que posteriormente pueden convertirse en reservas confirmadas una vez que se completen todos los datos necesarios.

## Modelos de Datos

### Query (Consulta)
- **id**: Identificador único (autoincrement)
- **roomId**: ID de la habitación (opcional)
- **mainClientId**: ID del cliente principal (opcional)
- **checkIn**: Fecha de check-in (opcional)
- **checkOut**: Fecha de check-out (opcional)
- **totalAmount**: Monto total (opcional)
- **status**: Estado de la consulta (opcional, default: 'pendiente')
- **reservationType**: Tipo de reserva (opcional, default: 'con_desayuno')
- **notes**: Notas adicionales (opcional)
- **fixed**: Si la consulta está fija (opcional, default: false)
- **requiredGuests**: Número de huéspedes requeridos (opcional)
- **requiredRoomId**: ID de habitación requerida (opcional)
- **requiredTags**: Tags requeridos (array, opcional)
- **requirementsNotes**: Notas de requerimientos (opcional)
- **createdAt**: Fecha de creación
- **updatedAt**: Fecha de actualización

### QueryGuest (Huésped de Consulta)
- **id**: Identificador único (autoincrement)
- **firstName**: Nombre (opcional)
- **lastName**: Apellido (opcional)
- **documentType**: Tipo de documento (opcional, default: 'DNI')
- **documentNumber**: Número de documento (opcional)
- **phone**: Teléfono (opcional)
- **email**: Email (opcional)
- **address**: Dirección (opcional)
- **city**: Ciudad (opcional)
- **queryId**: ID de la consulta (opcional)
- **createdAt**: Fecha de creación
- **updatedAt**: Fecha de actualización

### QueryPayment (Pago de Consulta)
- **id**: Identificador único (autoincrement)
- **queryGuestId**: ID del huésped de la consulta
- **amount**: Monto (opcional)
- **type**: Tipo de pago (opcional)
- **description**: Descripción (opcional)
- **date**: Fecha del pago (opcional)
- **createdAt**: Fecha de creación
- **updatedAt**: Fecha de actualización

### QueryNightRate (Tarifa Nocturna de Consulta)
- **id**: Identificador único (cuid)
- **queryId**: ID de la consulta
- **date**: Fecha (opcional)
- **baseRate**: Tarifa base (opcional)
- **dynamicRate**: Tarifa dinámica (opcional)
- **finalRate**: Tarifa final (opcional)
- **serviceType**: Tipo de servicio (opcional)
- **serviceRate**: Tarifa de servicio (opcional)
- **occupancyScore**: Puntuación de ocupación (opcional)
- **isWeekend**: Si es fin de semana (opcional)
- **isHoliday**: Si es feriado (opcional)
- **gapPromotionApplied**: Si se aplicó promoción de gap (opcional)
- **gapPromotionRate**: Tarifa de promoción de gap (opcional)
- **manualOverride**: Si es override manual (opcional)
- **basePrice**: Precio base (opcional)
- **occupancyAdjustment**: Ajuste por ocupación (opcional)
- **anticipationAdjustment**: Ajuste por anticipación (opcional)
- **weekendAdjustment**: Ajuste por fin de semana (opcional)
- **holidayAdjustment**: Ajuste por feriado (opcional)
- **gapPromotionAmount**: Monto de promoción de gap (opcional)
- **serviceAdjustment**: Ajuste de servicio (opcional)
- **createdAt**: Fecha de creación
- **updatedAt**: Fecha de actualización

## Endpoints API

### Consultas Principales

#### GET /api/queries
Obtiene todas las consultas con sus relaciones.

#### GET /api/queries/:id
Obtiene una consulta específica por ID.

#### POST /api/queries
Crea una nueva consulta.

**Ejemplo de request body:**
```json
{
  "roomId": 1,
  "mainClientId": 1,
  "checkIn": "2025-01-15T00:00:00.000Z",
  "checkOut": "2025-01-18T00:00:00.000Z",
  "totalAmount": 1500.00,
  "status": "pendiente",
  "reservationType": "con_desayuno",
  "notes": "Consulta de ejemplo",
  "requiredGuests": 2,
  "requiredTags": ["vista_mar"],
  "guests": [
    {
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan@email.com"
    }
  ]
}
```

#### PUT /api/queries/:id
Actualiza una consulta existente.

#### DELETE /api/queries/:id
Elimina una consulta.

### Conversión a Reserva

#### POST /api/queries/:id/convert-to-reservation
Convierte una consulta en una reserva confirmada.

**Requisitos mínimos para la conversión:**
- roomId
- mainClientId
- checkIn
- checkOut
- totalAmount

### Gestión de Huéspedes

#### POST /api/queries/:id/guests
Agrega un huésped a una consulta.

#### PUT /api/queries/:id/guests/:guestId
Actualiza un huésped de una consulta.

#### DELETE /api/queries/guests/:guestId
Elimina un huésped de una consulta.

## Estados de Consulta

- **pendiente**: Consulta recién creada
- **en_revision**: Consulta siendo revisada
- **confirmada**: Consulta lista para convertir a reserva
- **cancelada**: Consulta cancelada
- **convertida**: Consulta ya convertida a reserva

## Flujo de Trabajo

1. **Creación de Consulta**: Se crea una consulta con datos mínimos o completos
2. **Edición**: Se pueden agregar/modificar datos de la consulta
3. **Revisión**: Se revisa la consulta y se actualiza su estado
4. **Confirmación**: Una vez completados todos los datos necesarios, se confirma
5. **Conversión**: La consulta se convierte en una reserva confirmada
6. **Eliminación**: La consulta original se elimina automáticamente

## Ventajas del Sistema

1. **Flexibilidad**: Todos los campos son opcionales
2. **Trazabilidad**: Se mantiene un historial de consultas
3. **Conversión Automática**: Fácil conversión a reservas confirmadas
4. **Validación**: Validación de datos mínimos antes de la conversión
5. **Relaciones Complejas**: Mantiene todas las relaciones como las reservas

## Scripts de Utilidad

### test-queries.js
Script para probar todas las funcionalidades del sistema de consultas.

### cleanup-test-queries.js
Script para limpiar consultas de prueba.

### backup-database.js
Script para crear backups completos de la base de datos.

## Migración de Datos

El sistema incluye scripts para migrar datos existentes y crear backups antes de cualquier operación que modifique la base de datos.

## Consideraciones de Seguridad

- Siempre hacer backup antes de operaciones críticas
- Validar datos antes de la conversión a reserva
- Mantener auditoría de cambios en consultas
- Implementar permisos de usuario según sea necesario 