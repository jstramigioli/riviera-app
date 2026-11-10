# Auditoría de cambios (PGH-44)

## Qué registra

Mutaciones Prisma sobre entidades clave, con el usuario de la sesión auth (`requireAuth` → AsyncLocalStorage → extensión Prisma):

- Reservas / segmentos / huéspedes
- Clientes
- Consultas (`Query`, `QueryGroup`, …)
- Pagos y cargos
- Tarifas / bloques / precios / servicios
- Configuración y subcategorías de cargo
- Usuarios (sin exponer hashes)

Campos del `AuditLog`: actor (id, username, displayName, role), acción, entidad, entityId, timestamp, summary, before/after/diff.

## API

- `GET /api/audit-logs` — filtros: `entity`, `entityId`, `actorUserId`, `action`, `from`, `to`, `q`, `limit`, `cursor`
- `GET /api/audit-logs/:id`
- `GET /api/audit-logs/meta/entities`

Permiso: `auditoria` (ADMIN, GERENCIA).

## UI

Ruta `/auditoria` (nav visible para admin/gerencia).

## Timestamps `createdAt` / `updatedAt`

| Entidad | Estado |
|---------|--------|
| `Reservation`, `Query`, `QueryGroup`, `Guest`, `Pago`, `Cargo`, … | Ya existían; se agregaron índices en Reservation/Query |
| `Client` | **Agregados** en esta migración (backfill `now()` para filas existentes) |

Exposición API: `GET /api/clients` y detalle de cliente devuelven ambos campos; reservas ya los incluían en el payload (`createdAt` / `updatedAt`) vía `reservationHelpers`. Sirven para comparar “a esta altura del año” más adelante.
