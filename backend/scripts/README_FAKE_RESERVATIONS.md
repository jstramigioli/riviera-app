# Sistema de Reservas Ficticias para Testing

Este sistema te permite crear reservas de prueba con clientes ficticios para probar diferentes configuraciones del sistema de reservas.

## 🎯 Propósito

- Crear reservas de prueba rápidamente
- Probar diferentes configuraciones de ocupación
- Simular escenarios reales de reservas
- Facilitar el testing del sistema sin afectar datos reales

## 📋 Características

### ✅ Funcionalidades Principales
- **Reservas configurables**: Cantidad, fechas, duración
- **Distribución flexible**: Aleatoria, fines de semana, días laborables, uniforme
- **Clientes ficticios**: Generación automática con datos realistas
- **Multi-habitación**: Soporte para reservas con múltiples habitaciones
- **Estados variados**: Confirmadas, pendientes, canceladas
- **Limpieza fácil**: Eliminación masiva de datos de prueba

### 🎛️ Parámetros Configurables
- Número de reservas
- Mes y año objetivo
- Duración mínima y máxima
- Distribución temporal
- Probabilidad de reservas multi-habitación
- Estados y tipos de reserva

## 🚀 Uso Rápido

### Crear reservas básicas (configuración por defecto)
```bash
node scripts/create-fake-reservations.js create
```

### Crear 100 reservas para septiembre
```bash
node scripts/create-fake-reservations.js create --numReservations=100 --targetMonth=9
```

### Crear reservas solo para fines de semana
```bash
node scripts/create-fake-reservations.js create --distribution=weekends --minDuration=3 --maxDuration=7
```

### Limpiar todas las reservas ficticias
```bash
node scripts/create-fake-reservations.js clean
```

### Ver configuración actual
```bash
node scripts/create-fake-reservations.js config
```

## 📊 Configuración por Defecto

```javascript
{
  numReservations: 50,           // Cantidad de reservas
  targetMonth: 8,                // Agosto
  targetYear: 2025,              // Año
  minDuration: 2,                // Duración mínima (días)
  maxDuration: 10,               // Duración máxima (días)
  distribution: 'random',        // Distribución temporal
  multiRoomProbability: 0.1,     // 10% multi-habitación
  maxRoomsPerReservation: 3      // Máximo 3 habitaciones por reserva
}
```

## 🎛️ Opciones de Distribución

### `random`
- Reservas distribuidas aleatoriamente en todo el mes
- Útil para simular ocupación real

### `weekends`
- Solo fines de semana (sábados y domingos)
- Ideal para hoteles turísticos

### `weekdays`
- Solo días laborables (lunes a viernes)
- Perfecto para hoteles de negocios

### `evenly`
- Distribución uniforme (lunes, miércoles, viernes)
- Para testing de ocupación equilibrada

## 📝 Parámetros Disponibles

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `--numReservations` | número | Cantidad de reservas | `--numReservations=100` |
| `--targetMonth` | número | Mes (1-12) | `--targetMonth=9` |
| `--targetYear` | número | Año | `--targetYear=2025` |
| `--minDuration` | número | Duración mínima (días) | `--minDuration=2` |
| `--maxDuration` | número | Duración máxima (días) | `--maxDuration=10` |
| `--distribution` | string | Tipo de distribución | `--distribution=weekends` |
| `--multiRoomProbability` | decimal | Probabilidad multi-habitación | `--multiRoomProbability=0.2` |

## 🎯 Casos de Uso Comunes

### 1. Testing de Alta Ocupación
```bash
node scripts/create-fake-reservations.js create --numReservations=200 --distribution=random
```

### 2. Simulación de Temporada Alta
```bash
node scripts/create-fake-reservations.js create --numReservations=150 --distribution=weekends --minDuration=5 --maxDuration=14
```

### 3. Testing de Ocupación Baja
```bash
node scripts/create-fake-reservations.js create --numReservations=20 --distribution=weekdays --minDuration=1 --maxDuration=3
```

### 4. Testing de Reservas Multi-Habitación
```bash
node scripts/create-fake-reservations.js create --multiRoomProbability=0.3 --maxRoomsPerReservation=5
```

## 🔧 Scripts Relacionados

### Verificar Campo esFicticio
```bash
node scripts/verify-client-ficticio-field.js verify
```

### Crear Solo Clientes Ficticios
```bash
node scripts/create-fake-clients.js create
```

### Listar Clientes Ficticios
```bash
node scripts/create-fake-clients.js list
```

## 📈 Estadísticas Generadas

El script proporciona estadísticas detalladas:

- **Reservas creadas exitosamente**
- **Reservas fallidas**
- **Clientes ficticios utilizados**
- **Habitaciones utilizadas**
- **Distribución por estado**
- **Distribución por tipo (individual/multi-habitación)**

## 🧹 Limpieza de Datos

### Eliminar Todas las Reservas Ficticias
```bash
node scripts/create-fake-reservations.js clean
```

### Eliminar Solo Clientes Ficticios
```bash
node scripts/create-fake-clients.js clean
```

## ⚠️ Consideraciones Importantes

1. **Backup**: Siempre hacer backup antes de usar estos scripts
2. **Entorno**: Usar solo en entorno de desarrollo/testing
3. **Datos Reales**: Los clientes ficticios tienen `esFicticio = true`
4. **Habitaciones**: Solo usa habitaciones con status 'disponible'
5. **Fechas**: Verifica que las fechas no se superpongan

## 🔍 Monitoreo

### Verificar Estado de la Base de Datos
```bash
node scripts/verify-client-ficticio-field.js stats
```

### Contar Reservas Ficticias
```sql
SELECT COUNT(*) FROM "Reservation" r 
JOIN "Client" c ON r."mainClientId" = c.id 
WHERE c."esFicticio" = true;
```

## 🎨 Personalización

Puedes modificar el archivo `create-fake-reservations.js` para:

- Agregar más tipos de distribución
- Cambiar los pesos de estados
- Modificar las notas de reserva
- Agregar más datos de clientes ficticios
- Personalizar la lógica de generación

## 📞 Soporte

Si encuentras problemas:

1. Verifica que la base de datos esté sincronizada
2. Asegúrate de tener habitaciones disponibles
3. Revisa los logs de error
4. Usa el script de verificación para diagnosticar

---

**¡Disfruta testing tu sistema de reservas! 🎉** 