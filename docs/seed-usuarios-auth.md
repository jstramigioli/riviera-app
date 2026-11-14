# Usuarios de prueba — Auth (PGH-36)

Seed idempotente para la DB `riviera_v1`.

## Cómo cargar

```bash
cd backend
npm run seed:users
```

Requiere `DATABASE_URL` apuntando a `riviera_v1` (nunca a `riviera`).

## Credenciales

| Usuario     | Contraseña     | Rol        | Acceso |
|-------------|----------------|------------|--------|
| `admin`     | `admin123`     | ADMIN      | Todo (usuarios, tarifas, settings, reservas, finanzas, reportes) |
| `gerencia`  | `gerencia123`  | GERENCIA   | Reservas, clientes, finanzas, reportes. Sin usuarios ni settings críticos / tarifas |
| `recepcion` | `recepcion123` | RECEPCION  | Reservas, clientes, cargos/pagos del día a día. Sin tarifas, configuración ni usuarios |

## Sesión

- Cookie httpOnly `riviera_session` (14 días por defecto, `SESSION_DAYS`).
- Persistente entre recargas.
- Menú de cuenta: **Cambiar de usuario** / **Cerrar sesión**.
