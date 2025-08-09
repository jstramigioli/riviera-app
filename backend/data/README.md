# Datos de la Base de Datos

Este directorio contiene los datos exportados de la base de datos PostgreSQL del sistema de gestión del hotel Riviera.

## Archivos

- `tags.json` - Etiquetas de habitaciones
- `roomTypes.json` - Tipos de habitaciones
- `rooms.json` - Habitaciones con sus etiquetas
- `clients.json` - Clientes registrados
- `guests.json` - Huéspedes
- `payments.json` - Pagos y cargos
- `reservations.json` - Reservas con relaciones
- `dailyRates.json` - Tarifas diarias por tipo de habitación
- `metadata.json` - Metadatos de la exportación

## Cómo usar

### Exportar datos de la base de datos actual

```bash
cd backend
npm run export-db
```

Esto exportará todos los datos de tu base de datos PostgreSQL a archivos JSON en este directorio.

### Importar datos a una base de datos

```bash
cd backend
npm run import-db
```

Esto importará todos los datos de los archivos JSON a tu base de datos PostgreSQL.

## Notas importantes

1. **Backup**: Siempre haz un backup de tu base de datos antes de importar datos
2. **Relaciones**: Los scripts manejan automáticamente las relaciones entre tablas
3. **Upsert**: La importación usa `upsert` para evitar duplicados basándose en los IDs
4. **Orden**: Los datos se importan en el orden correcto para respetar las relaciones

## Para subir a GitHub

1. Ejecuta `npm run export-db` para exportar los datos actuales
2. Revisa los archivos JSON generados
3. Haz commit y push de los archivos:

```bash
git add data/
git commit -m "Agregar datos de la base de datos"
git push
```

## Seguridad

⚠️ **Importante**: Estos archivos pueden contener información sensible. Asegúrate de:
- No subir datos de producción con información personal real
- Revisar los datos antes de hacer commit
- Considerar usar datos de ejemplo para el repositorio público 