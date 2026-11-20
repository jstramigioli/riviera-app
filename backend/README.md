# Backend - Sistema de Gestión Hotel Riviera

## 📁 Estructura del Proyecto

- `src/` — Código fuente principal
  - `controllers/` — Lógica de controladores (manejan las peticiones)
  - `models/` — Definición de modelos de datos
  - `routes/` — Definición de rutas de la API
  - `middlewares/` — Middlewares personalizados
  - `config/` — Configuración (DB, variables de entorno, etc.)
  - `utils/` — Utilidades y helpers
- `tests/` — Pruebas automatizadas
- `scripts/` — Scripts de utilidad y mantenimiento
- `prisma/` — Schema y migraciones de base de datos
- `package.json` — Dependencias y scripts

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor en modo desarrollo con nodemon

# Producción
npm start                # Iniciar servidor en modo producción

# Testing
npm test                 # Ejecutar todos los tests
npm run test:watch       # Ejecutar tests en modo watch
npm run test:coverage    # Generar reporte de cobertura

# Base de Datos
npm run export-db        # Exportar backup de la base de datos
npm run import-db        # Importar datos a la base de datos
npm run db:fix-sequences # ⚠️ IMPORTANTE: Arreglar secuencias después de restaurar backup

# Seed tarifas reales 2026/27 (idempotente; ver data/tarifas-2026-27.json)
npm run seed:tarifas-2026-27
npm run seed:tarifas-2026-27:replace   # reemplaza bloques del seed
# Opciones extra: node prisma/seed-tarifas-2026-27.js --with-rooms --with-open-days --with-diversidad

# Reservas de Prueba
npm run generate-test-reservations  # Generar reservas de prueba
npm run cleanup-test-reservations   # Limpiar reservas de prueba
```

## ⚠️ IMPORTANTE: Restauración de Backups

**Después de restaurar un backup, SIEMPRE ejecuta:**

```bash
npm run db:fix-sequences
```

Este comando es crítico para evitar errores de "unique constraint" al crear nuevos registros.

📖 **Documentación completa**: Ver [RESTORE-BACKUP.md](./RESTORE-BACKUP.md)

## 🛠️ Mantenimiento

### Problema: Error "unique constraint failed on id"

**Causa**: Las secuencias de autoincrement están desincronizadas.

**Solución**:
```bash
npm run db:fix-sequences
```

### Cuándo ejecutar `db:fix-sequences`:
- ✅ Después de restaurar un backup
- ✅ Después de importar datos con IDs específicos
- ✅ Después de ejecutar scripts de migración de datos
- ✅ Si aparecen errores de "unique constraint" al crear registros

## 📚 Documentación Adicional

- [RESTORE-BACKUP.md](./RESTORE-BACKUP.md) - Procedimiento completo de restauración de backups 