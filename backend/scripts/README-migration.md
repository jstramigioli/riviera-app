# 🚀 Migración desde Google Sheets

Este script te permite migrar datos de pasajeros/huéspedes desde Google Sheets a tu base de datos.

## 📋 Requisitos Previos

### 1. Configurar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Sheets API**:
   - Ve a "APIs y servicios" > "Biblioteca"
   - Busca "Google Sheets API"
   - Haz clic en "Habilitar"

### 2. Crear Credenciales de Servicio

1. Ve a "APIs y servicios" > "Credenciales"
2. Haz clic en "Crear credenciales" > "Cuenta de servicio"
3. Completa la información:
   - **Nombre**: `riviera-migration` (o el que prefieras)
   - **Descripción**: `Cuenta de servicio para migración de datos`
4. Haz clic en "Crear y continuar"
5. En "Otorgar acceso a esta cuenta de servicio":
   - Selecciona "Editor" como rol
   - Haz clic en "Continuar"
6. Haz clic en "Listo"
7. En la lista de cuentas de servicio, haz clic en la que acabas de crear
8. Ve a la pestaña "Claves"
9. Haz clic en "Agregar clave" > "Crear nueva clave"
10. Selecciona "JSON" y haz clic en "Crear"
11. Descarga el archivo JSON

### 3. Configurar el Proyecto

1. Mueve el archivo JSON descargado a la carpeta `backend/scripts/`
2. Renómbralo a `credentials.json`

### 4. Compartir Google Sheets

1. Abre tu Google Sheets con los datos de pasajeros
2. Haz clic en "Compartir" (esquina superior derecha)
3. Agrega la cuenta de servicio (el email que aparece en el archivo credentials.json)
4. Dale permisos de "Editor"
5. Copia el ID de la hoja de la URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

## 📊 Formato de Google Sheets

Tu Google Sheets debe tener el siguiente formato:

| Nombre | Apellido | DNI | Email | Teléfono | Dirección | Ciudad |
|--------|----------|-----|-------|----------|-----------|--------|
| Juan | Pérez | 12345678 | juan@email.com | +54 11 1234-5678 | Av. Corrientes 123 | Buenos Aires |
| María | García | 87654321 | maria@email.com | +54 11 8765-4321 | Calle Florida 456 | Córdoba |

### Headers Soportados

El script reconoce automáticamente estos headers (no distingue mayúsculas/minúsculas):

- **Nombre**: `nombre`, `firstname`, `primer nombre`
- **Apellido**: `apellido`, `lastname`, `primer apellido`
- **Tipo de Documento**: `tipo documento`, `documenttype`, `tipo de documento`
- **Número de Documento**: `numero documento`, `documentnumber`, `dni`, `pasaporte`
- **Teléfono**: `telefono`, `phone`, `teléfono`
- **Email**: `email`, `correo`, `correo electrónico`
- **Dirección**: `direccion`, `address`, `dirección`
- **Ciudad**: `ciudad`, `city`

## 🚀 Ejecutar la Migración

### Opción 1: Usar el script directamente

```bash
cd backend/scripts
node google-sheets-migration.js SPREADSHEET_ID [RANGE]
```

**Ejemplo:**
```bash
node google-sheets-migration.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms A1:Z1000
```

### Opción 2: Usar el script de ejemplo

1. Edita `example-migration.js`
2. Reemplaza `TU_SPREADSHEET_ID_AQUI` con tu ID real
3. Ejecuta:
```bash
node example-migration.js
```

### Opción 3: Usar desde el código

```javascript
const { migrateFromGoogleSheets } = require('./google-sheets-migration');

await migrateFromGoogleSheets('TU_SPREADSHEET_ID', 'A1:Z1000');
```

## 📈 Resultados

El script mostrará:

- ✅ **Huéspedes creados**: Cantidad de registros importados exitosamente
- ⚠️ **Huéspedes omitidos**: Registros que ya existían o tenían errores
- ❌ **Errores**: Detalles de problemas encontrados

### Validaciones Automáticas

El script valida automáticamente:

- ✅ Nombre y apellido son obligatorios
- ✅ Formato de email válido (si se proporciona)
- ✅ Evita duplicados por DNI o email
- ✅ Limpia espacios en blanco

## 🔧 Solución de Problemas

### Error: "No se encontró el archivo credentials.json"
- Verifica que el archivo esté en la carpeta `backend/scripts/`
- Asegúrate de que se llame exactamente `credentials.json`

### Error: "Error al leer Google Sheets"
- Verifica que hayas compartido la hoja con la cuenta de servicio
- Confirma que el ID de la hoja sea correcto
- Asegúrate de que la Google Sheets API esté habilitada

### Error: "reservationId is required"
- Ejecuta la migración de Prisma para aplicar los cambios del esquema:
```bash
cd backend
npx prisma migrate dev --name make_reservation_optional
```

### Huéspedes duplicados
- El script evita automáticamente duplicados por DNI o email
- Si necesitas forzar la importación, modifica la lógica en `createGuests()`

## 📝 Notas Importantes

- **Backup**: Siempre haz un backup de tu base de datos antes de migrar
- **Pruebas**: Prueba primero con una pequeña cantidad de datos
- **Formato**: Asegúrate de que la primera fila contenga los headers
- **Permisos**: La cuenta de servicio necesita permisos de lectura en la hoja

## 🎯 Próximos Pasos

Después de la migración, puedes:

1. **Revisar los datos** en tu aplicación
2. **Crear reservas** para los huéspedes migrados
3. **Agregar pagos** si tienes esa información
4. **Limpiar datos** duplicados o incorrectos

¡La migración está lista! 🎉 