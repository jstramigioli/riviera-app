# Hotel Riviera — PMS

Sistema interno de gestión hotelera: libro de reservas, consultas, tarifas, cobros/pagos y configuración.

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

## Flujo MVP

1. **Configuración** — hotel, habitaciones, tipo de cambio, bloques de temporada
2. **Consultas** — cotizar y crear reserva
3. **Libro de reservas** — visualizar y gestionar
4. **Cobros y pagos** — registrar pagos y ver saldos

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Backend + frontend en paralelo |
| `npm run build` | Build del frontend |
| `npm run test:frontend` | Tests Vitest del frontend |
| `cd backend && npm test` | Tests Jest del backend (si existen) |

## Notas

- Sin autenticación (MVP interno).
- Endpoints legacy de modelos eliminados responden HTTP 501.
- Hotel por defecto: `default-hotel`.
