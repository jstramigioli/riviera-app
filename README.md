# Hotel Riviera — PMS

Sistema interno de gestión hotelera (MVP operativo): libro de reservas, reservas con tarifa manual, clientes, cargos y cobros/pagos.

## Stack

- **Frontend:** React 19 + Vite (`frontend/`)
- **Backend:** Express + Prisma (`backend/`)
- **Base de datos:** PostgreSQL

## Arranque rápido (desarrollo)

### Requisitos

- Node.js 18+
- PostgreSQL

### 1. Instalar dependencias

```bash
npm run install:all
```

### 2. Configurar entorno

```bash
cp backend/.env.example backend/.env
# Editar DATABASE_URL en backend/.env
```

### 3. Base de datos

En una base **vacía de desarrollo**:

```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

> Para bases con datos existentes, usar migraciones con backup previo (`prisma migrate deploy`). No usar `db push` en producción.

### 4. Ejecutar

```bash
npm run dev
```

- API: http://localhost:3001/api
- UI: http://localhost:5173

El frontend proxy `/api` → backend en desarrollo.

## Flujo MVP (producción reducida)

**Habilitado**

1. **Libro de reservas** — grilla/calendario usable
2. **Reservas** — crear/ver/editar con **tarifa manual** por noche (sin cotización automática)
3. **Clientes** — alta, búsqueda y asociación a reserva
4. **Cargos** — alojamiento generado al crear la reserva + consumos/servicios/otros manuales
5. **Cobros y pagos** — saldo y pagos por reserva
6. **Configuración** — hotel, habitaciones, categorías de cargos, calendario operativo, tipo de cambio

**Deshabilitado temporalmente (UI ocultada / redirect)**

- Tarifas automáticas / SeasonBlocks / `getCalculatedRates`
- Precios inteligentes
- Config de tarifas dinámicas (subpestaña Alojamiento en Cargos)

Flags: `frontend/src/config/featureFlags.js`

### Cómo crear una reserva en producción

1. Ir a **Reservas** → **+ Nueva Reserva**
2. Buscar o crear cliente
3. Fechas, huéspedes, tipo de servicio → buscar habitaciones
4. Elegir habitación e ingresar **tarifa por noche**
5. **Crear Reserva** → se generan cargos de alojamiento por noche
6. En el detalle: confirmar/cancelar, agregar cargos de consumo y registrar pagos

**Cancelación:** al cancelar o marcar no-presentada, la habitación se libera para nuevas reservas (y deja de verse en el libro).

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Backend + frontend en paralelo |
| `npm run build` | Build del frontend |
| `npm run test:frontend` | Tests Vitest del frontend |
| `cd backend && npm test` | Tests Jest del backend |

## Notas

- Sin autenticación (MVP interno).
- Endpoints legacy de modelos eliminados responden HTTP 501.
- Hotel por defecto: `default-hotel`.
