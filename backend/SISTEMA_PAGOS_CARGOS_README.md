# Sistema de Pagos y Cargos por Reserva

## 📋 Resumen de Cambios

Se reemplazó completamente el sistema de pagos anterior (basado en huéspedes individuales) por un nuevo sistema basado en **reservas**. Esto simplifica la gestión financiera al centralizar todos los pagos y cargos a nivel de reserva.

### Modelos Eliminados
- `Payment` (relacionado con `Guest`)

### Modelos Nuevos
- `Pago` - Pagos realizados contra una reserva
- `Cargo` - Cargos aplicados a una reserva

---

## 🗄️ Modelos de Datos

### Modelo `Pago`

Representa un pago realizado por el cliente para una reserva específica.

```prisma
model Pago {
  id         Int         @id @default(autoincrement())
  reservaId  Int
  reserva    Reservation @relation(fields: [reservaId], references: [id], onDelete: Cascade)
  fecha      DateTime    @default(now())
  monto      Decimal     @db.Decimal(10, 2)
  metodo     String      // Efectivo, Tarjeta, Transferencia, etc.
  referencia String?     // Número de comprobante, referencia bancaria, etc.
  notas      String?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}
```

**Campos:**
- `id`: ID único del pago
- `reservaId`: ID de la reserva asociada
- `fecha`: Fecha en que se realizó el pago
- `monto`: Monto del pago (Decimal con 2 decimales)
- `metodo`: Método de pago (ej: "Efectivo", "Tarjeta", "Transferencia")
- `referencia`: Referencia opcional (número de comprobante, etc.)
- `notas`: Notas adicionales opcionales
- `createdAt/updatedAt`: Timestamps de auditoría

### Modelo `Cargo`

Representa un cargo aplicado a una reserva (alojamiento, servicios, consumos, etc.).

```prisma
model Cargo {
  id          Int         @id @default(autoincrement())
  reservaId   Int
  reserva     Reservation @relation(fields: [reservaId], references: [id], onDelete: Cascade)
  descripcion String
  monto       Decimal     @db.Decimal(10, 2)
  fecha       DateTime    @default(now())
  tipo        String      @default("ALOJAMIENTO") // ALOJAMIENTO, SERVICIO, CONSUMO, OTRO
  notas       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

**Campos:**
- `id`: ID único del cargo
- `reservaId`: ID de la reserva asociada
- `descripcion`: Descripción del cargo
- `monto`: Monto del cargo (Decimal con 2 decimales)
- `fecha`: Fecha del cargo
- `tipo`: Tipo de cargo (valores válidos: "ALOJAMIENTO", "SERVICIO", "CONSUMO", "OTRO")
- `notas`: Notas adicionales opcionales
- `createdAt/updatedAt`: Timestamps de auditoría

---

## 🌐 API Endpoints

Base URL: `/api/reservation-payments`

### 1. Resumen y Listados Generales

#### GET `/api/reservation-payments/reservas-saldos`
Obtiene todas las reservas con sus saldos calculados.

**Respuesta:**
```json
[
  {
    "id": 1,
    "status": "CONFIRMADA",
    "mainClient": {
      "id": 1,
      "firstName": "Juan",
      "lastName": "Pérez"
    },
    "cantidadHuespedes": 2,
    "totalCargos": 50000.00,
    "totalPagos": 30000.00,
    "saldo": 20000.00,
    "estadoPago": "PENDIENTE",
    "createdAt": "2025-10-01T10:00:00Z",
    "updatedAt": "2025-10-22T15:30:00Z"
  }
]
```

**Estados de Pago:**
- `PENDIENTE`: Saldo > 0 (debe dinero)
- `PAGADO`: Saldo = 0 (cuenta saldada)
- `A_FAVOR`: Saldo < 0 (pagó de más)

---

#### GET `/api/reservation-payments/reservas/:reservaId/resumen`
Obtiene un resumen financiero completo de una reserva específica.

**Parámetros:**
- `reservaId`: ID de la reserva

**Respuesta:**
```json
{
  "reserva": {
    "id": 1,
    "status": "CONFIRMADA",
    "mainClient": { ... },
    "guests": [ ... ],
    "segments": [ ... ]
  },
  "resumen": {
    "totalCargos": 50000.00,
    "totalPagos": 30000.00,
    "saldo": 20000.00,
    "estadoPago": "PENDIENTE"
  },
  "cargos": {
    "total": 50000.00,
    "cantidad": 3,
    "porTipo": {
      "ALOJAMIENTO": {
        "cantidad": 1,
        "total": 40000.00,
        "items": [ ... ]
      },
      "CONSUMO": {
        "cantidad": 2,
        "total": 10000.00,
        "items": [ ... ]
      }
    },
    "items": [ ... ]
  },
  "pagos": {
    "total": 30000.00,
    "cantidad": 2,
    "porMetodo": {
      "Efectivo": {
        "cantidad": 1,
        "total": 15000.00,
        "items": [ ... ]
      },
      "Tarjeta": {
        "cantidad": 1,
        "total": 15000.00,
        "items": [ ... ]
      }
    },
    "items": [ ... ]
  }
}
```

---

### 2. Gestión de Pagos

#### GET `/api/reservation-payments/reservas/:reservaId/pagos`
Obtiene todos los pagos de una reserva.

**Parámetros:**
- `reservaId`: ID de la reserva

**Respuesta:**
```json
[
  {
    "id": 1,
    "reservaId": 1,
    "fecha": "2025-10-20T10:00:00Z",
    "monto": "15000.00",
    "metodo": "Efectivo",
    "referencia": "REC-001",
    "notas": "Seña inicial",
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-20T10:00:00Z"
  }
]
```

---

#### POST `/api/reservation-payments/reservas/:reservaId/pagos`
Crea un nuevo pago para una reserva.

**Parámetros:**
- `reservaId`: ID de la reserva (en URL)

**Body (JSON):**
```json
{
  "monto": 15000.00,
  "metodo": "Efectivo",
  "referencia": "REC-001",
  "notas": "Seña inicial",
  "fecha": "2025-10-20T10:00:00Z"
}
```

**Campos requeridos:**
- `monto`: Monto del pago (debe ser > 0)
- `metodo`: Método de pago

**Campos opcionales:**
- `referencia`: Número de comprobante o referencia
- `notas`: Notas adicionales
- `fecha`: Fecha del pago (por defecto: fecha actual)

**Respuesta:** 201 Created
```json
{
  "id": 1,
  "reservaId": 1,
  "fecha": "2025-10-20T10:00:00Z",
  "monto": "15000.00",
  "metodo": "Efectivo",
  "referencia": "REC-001",
  "notas": "Seña inicial",
  "createdAt": "2025-10-20T10:00:00Z",
  "updatedAt": "2025-10-20T10:00:00Z"
}
```

---

#### PUT `/api/reservation-payments/pagos/:id`
Actualiza un pago existente.

**Parámetros:**
- `id`: ID del pago (en URL)

**Body (JSON):** (todos los campos son opcionales)
```json
{
  "monto": 16000.00,
  "metodo": "Transferencia",
  "referencia": "TRANS-123",
  "notas": "Actualizado",
  "fecha": "2025-10-20T11:00:00Z"
}
```

**Respuesta:** 200 OK (objeto del pago actualizado)

---

#### DELETE `/api/reservation-payments/pagos/:id`
Elimina un pago.

**Parámetros:**
- `id`: ID del pago (en URL)

**Respuesta:** 200 OK
```json
{
  "message": "Pago eliminado exitosamente"
}
```

---

### 3. Gestión de Cargos

#### GET `/api/reservation-payments/reservas/:reservaId/cargos`
Obtiene todos los cargos de una reserva.

**Parámetros:**
- `reservaId`: ID de la reserva

**Respuesta:**
```json
[
  {
    "id": 1,
    "reservaId": 1,
    "descripcion": "Alojamiento 3 noches",
    "monto": "40000.00",
    "fecha": "2025-10-20T10:00:00Z",
    "tipo": "ALOJAMIENTO",
    "notas": null,
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-20T10:00:00Z"
  }
]
```

---

#### POST `/api/reservation-payments/reservas/:reservaId/cargos`
Crea un nuevo cargo para una reserva.

**Parámetros:**
- `reservaId`: ID de la reserva (en URL)

**Body (JSON):**
```json
{
  "descripcion": "Alojamiento 3 noches",
  "monto": 40000.00,
  "tipo": "ALOJAMIENTO",
  "notas": "Habitación 101",
  "fecha": "2025-10-20T10:00:00Z"
}
```

**Campos requeridos:**
- `descripcion`: Descripción del cargo
- `monto`: Monto del cargo (debe ser > 0)

**Campos opcionales:**
- `tipo`: Tipo de cargo (valores: "ALOJAMIENTO", "SERVICIO", "CONSUMO", "OTRO". Default: "ALOJAMIENTO")
- `notas`: Notas adicionales
- `fecha`: Fecha del cargo (por defecto: fecha actual)

**Respuesta:** 201 Created (objeto del cargo creado)

---

#### PUT `/api/reservation-payments/cargos/:id`
Actualiza un cargo existente.

**Parámetros:**
- `id`: ID del cargo (en URL)

**Body (JSON):** (todos los campos son opcionales)
```json
{
  "descripcion": "Alojamiento 4 noches",
  "monto": 50000.00,
  "tipo": "ALOJAMIENTO",
  "notas": "Extendió estadía",
  "fecha": "2025-10-20T11:00:00Z"
}
```

**Respuesta:** 200 OK (objeto del cargo actualizado)

---

#### DELETE `/api/reservation-payments/cargos/:id`
Elimina un cargo.

**Parámetros:**
- `id`: ID del cargo (en URL)

**Respuesta:** 200 OK
```json
{
  "message": "Cargo eliminado exitosamente"
}
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Crear una reserva con cargos y pagos

```javascript
// 1. Crear cargo inicial por alojamiento
POST /api/reservation-payments/reservas/1/cargos
{
  "descripcion": "Alojamiento 3 noches - Habitación Deluxe",
  "monto": 45000.00,
  "tipo": "ALOJAMIENTO"
}

// 2. Registrar seña del 50%
POST /api/reservation-payments/reservas/1/pagos
{
  "monto": 22500.00,
  "metodo": "Transferencia",
  "referencia": "TRANS-20251020-001",
  "notas": "Seña 50%"
}

// 3. Agregar cargo por servicio extra
POST /api/reservation-payments/reservas/1/cargos
{
  "descripcion": "Desayuno buffet x3",
  "monto": 4500.00,
  "tipo": "SERVICIO"
}

// 4. Registrar pago final
POST /api/reservation-payments/reservas/1/pagos
{
  "monto": 27000.00,
  "metodo": "Efectivo",
  "notas": "Pago al check-out"
}

// 5. Obtener resumen financiero
GET /api/reservation-payments/reservas/1/resumen
```

### Ejemplo 2: Consultar saldos pendientes

```javascript
// Obtener todas las reservas con saldos
GET /api/reservation-payments/reservas-saldos

// Filtrar en frontend las que tienen saldo > 0
const reservasPendientes = reservas.filter(r => r.saldo > 0);
```

---

## 🔄 Migración desde el Sistema Anterior

### Cambios en el Schema

**ANTES:**
```prisma
model Guest {
  payments Payment[]
}

model Payment {
  guestId Int
  guest   Guest
  amount  Float
  type    String  // "payment" o "charge"
}
```

**AHORA:**
```prisma
model Reservation {
  pagos  Pago[]
  cargos Cargo[]
}

model Pago {
  reservaId Int
  reserva   Reservation
  monto     Decimal
  metodo    String
}

model Cargo {
  reservaId   Int
  reserva     Reservation
  monto       Decimal
  tipo        String
  descripcion String
}
```

### Cambios en los Controladores

- **Eliminado:** `payment.controller.js`
- **Nuevo:** `reservationPayments.controller.js`
- **Actualizado:** `guest.controller.js` (método `getGuestBalance` ahora obtiene el saldo desde la reserva)

### Cambios en las Rutas

- **ANTES:** `/api/payments/*`
- **AHORA:** `/api/reservation-payments/*`

---

## ⚠️ Validaciones Importantes

1. **Monto siempre positivo:** Los montos de pagos y cargos deben ser > 0
2. **Tipos de cargo válidos:** Solo se permiten "ALOJAMIENTO", "SERVICIO", "CONSUMO", "OTRO"
3. **Cascading delete:** Al eliminar una reserva, se eliminan automáticamente todos sus pagos y cargos
4. **Decimal precision:** Los montos se guardan con precisión de 2 decimales

---

## 🧪 Testing

Para probar los nuevos endpoints, puedes usar estos comandos curl:

```bash
# Crear un cargo
curl -X POST http://localhost:3000/api/reservation-payments/reservas/1/cargos \
  -H "Content-Type: application/json" \
  -d '{
    "descripcion": "Alojamiento 3 noches",
    "monto": 45000,
    "tipo": "ALOJAMIENTO"
  }'

# Crear un pago
curl -X POST http://localhost:3000/api/reservation-payments/reservas/1/pagos \
  -H "Content-Type: application/json" \
  -d '{
    "monto": 22500,
    "metodo": "Efectivo",
    "notas": "Seña inicial"
  }'

# Obtener resumen financiero
curl http://localhost:3000/api/reservation-payments/reservas/1/resumen
```

---

## 📚 Próximos Pasos

1. **Frontend:** Actualizar la página `CobrosPagos.jsx` para usar los nuevos endpoints
2. **Reportes:** Crear endpoints para reportes financieros (por fecha, por método de pago, etc.)
3. **Historial:** Implementar auditoría de cambios en pagos y cargos
4. **Notificaciones:** Enviar alertas cuando el saldo de una reserva esté pendiente
5. **Integración:** Conectar con sistemas de facturación si es necesario

---

## 🐛 Troubleshooting

### Error: "Payment is not defined"
- **Causa:** Código antiguo intentando usar el modelo Payment eliminado
- **Solución:** Actualizar el código para usar Pago/Cargo

### Error: "Guest has no relation 'payments'"
- **Causa:** Código intentando acceder a payments desde Guest
- **Solución:** Acceder a los pagos desde la reserva: `guest.reservation.pagos`

### Error: "Monto debe ser mayor a 0"
- **Causa:** Intentando crear pago/cargo con monto <= 0
- **Solución:** Validar que el monto sea positivo antes de enviar

---

**Fecha de implementación:** 22 de Octubre, 2025
**Versión:** 1.0.0


