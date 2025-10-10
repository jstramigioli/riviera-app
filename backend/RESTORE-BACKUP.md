# 📋 Procedimiento para Restaurar un Backup

## ⚠️ IMPORTANTE: Siempre seguir este orden

Cuando restaures un backup de la base de datos, **SIEMPRE** debes ejecutar el script para arreglar las secuencias de autoincrement. De lo contrario, obtendrás errores al intentar crear nuevos registros.

---

## 🔄 Pasos para Restaurar un Backup

### 1️⃣ Hacer Backup del Estado Actual (por seguridad)

```bash
cd backend
npm run export-db
```

Esto guardará el estado actual en `backups/` con fecha y hora.

### 2️⃣ Restaurar el Backup

Usando tu herramienta de PostgreSQL preferida (pgAdmin, psql, etc.):

```bash
# Opción A: Usando psql
psql -U usuario -d nombre_base_datos < ruta/al/backup.sql

# Opción B: Usando pg_restore (si es formato custom)
pg_restore -U usuario -d nombre_base_datos ruta/al/backup.dump
```

### 3️⃣ **CRÍTICO**: Arreglar las Secuencias de Autoincrement

Después de restaurar el backup, **SIEMPRE** ejecuta:

```bash
cd backend
npm run db:fix-sequences
```

Este comando actualizará todas las secuencias de autoincrement para que comiencen desde el ID máximo + 1 de cada tabla.

### 4️⃣ Verificar que Todo Funciona

```bash
# Iniciar el servidor
npm run dev

# En otra terminal, probar crear un cliente
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User"}'
```

Si ves una respuesta exitosa con el nuevo cliente, ¡todo está funcionando! 🎉

---

## 🤔 ¿Por Qué Es Necesario Este Paso?

PostgreSQL usa secuencias (`sequences`) para generar IDs automáticos. Cuando restauras un backup:

1. ✅ Los datos se restauran con sus IDs originales
2. ❌ Las secuencias NO se actualizan automáticamente
3. ❌ La secuencia sigue apuntando al valor anterior
4. ❌ Al crear un nuevo registro, intenta usar un ID que ya existe
5. ❌ Error: "unique constraint failed on the fields: (`id`)"

El script `db:fix-sequences` corrige esto automáticamente.

---

## 🔧 ¿Cuándo Ejecutar el Script?

Ejecuta `npm run db:fix-sequences` después de:

- ✅ Restaurar un backup completo
- ✅ Importar datos desde otro sistema
- ✅ Ejecutar scripts SQL que insertan datos con IDs específicos
- ✅ Ejecutar migraciones de datos (como `pasajeros-migration.js`)
- ✅ Hacer un `pg_restore` o `psql < backup.sql`

---

## 📝 Script Manual (Alternativo)

Si prefieres ejecutar el script manualmente:

```bash
cd backend
npx prisma db execute --schema=./prisma/schema.prisma --file=./scripts/fix-sequences.sql
```

---

## 🆘 Solución de Problemas

### Error: "unique constraint failed on id"

**Causa**: Las secuencias no se actualizaron después del restore.

**Solución**: Ejecuta `npm run db:fix-sequences`

### Error: "relation does not exist"

**Causa**: Prisma no está sincronizado con la base de datos.

**Solución**:
```bash
npx prisma generate
npx prisma db pull
```

---

## 🎯 Checklist Rápido

Después de restaurar un backup:

- [ ] ✅ Backup del estado actual creado
- [ ] ✅ Backup restaurado exitosamente
- [ ] ✅ `npm run db:fix-sequences` ejecutado
- [ ] ✅ Servidor reiniciado
- [ ] ✅ Creación de registros verificada

---

**💡 Tip**: Puedes agregar este script a tu proceso de CI/CD o crear un script de restauración que lo ejecute automáticamente.

