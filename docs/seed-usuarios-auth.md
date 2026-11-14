# Usuarios de prueba — Auth (PGH-36 / PGH-161)

Seed idempotente para la DB `riviera_v1`.

## Cómo cargar

```bash
cd backend
npm run seed:users
```

Requiere `DATABASE_URL` apuntando a `riviera_v1` (nunca a `riviera`).

## Credenciales seed

| Usuario     | Contraseña     | Rol        | Acceso |
|-------------|----------------|------------|--------|
| `admin`     | `admin123`     | ADMIN      | Todo, **único** que gestiona usuarios (Admin no eliminable) |
| `gerencia`  | `gerencia123`  | GERENCIA   | Reservas, clientes, finanzas, reportes. Sin usuarios ni settings/tarifas |
| `recepcion` | `recepcion123` | RECEPCION  | Reservas, clientes, cargos/pagos. Sin tarifas, configuración ni usuarios |

## Roles (PGH-161)

- **Activos (asignables):** Admin, Propietario, Gerencia, Recepción
- **Reservados (enum, aún no asignables en UI):** Camarero/a, Cocina, Mucama, Mantenimiento
- **Propietario:** settings/tarifas/reportes/etc. como Admin, **sin** permiso `users`

Gestión: Configuración → Usuarios (solo Admin).

## Sesión

- Cookie httpOnly `riviera_session` (14 días por defecto, `SESSION_DAYS`).
- Persistente entre recargas.
- Menú de cuenta: **Cambiar de usuario** / **Cerrar sesión**.
