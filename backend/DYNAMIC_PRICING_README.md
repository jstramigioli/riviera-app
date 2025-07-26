# Sistema de Tarifas Dinámicas

## 🎯 Descripción General

El nuevo sistema de tarifas dinámicas permite calcular precios automáticamente basándose en múltiples factores como ocupación, anticipación, temporada, eventos, etc. El sistema mantiene compatibilidad con el modelo anterior mientras introduce capacidades avanzadas de pricing dinámico.

## 🏗️ Arquitectura del Sistema

### Modelos Principales

#### 1. DynamicPricingConfig
Configuración global que define los pesos y parámetros del sistema:
- `anticipationThresholds`: Umbrales de anticipación (ej: [21, 14, 7, 3] días)
- `anticipationWeight`: Peso del factor de anticipación (0-1)
- `globalOccupancyWeight`: Peso de la ocupación global (0-1)
- `isWeekendWeight`: Peso de fin de semana (0-1)
- `isHolidayWeight`: Peso de feriados (0-1)
- `demandIndexWeight`: Peso del índice de demanda (0-1)
- `weatherScoreWeight`: Peso del clima (0-1)
- `eventImpactWeight`: Peso de eventos (0-1)
- `maxAdjustmentPercentage`: Máximo ajuste permitido (ej: 0.4 = 40%)

#### 2. SeasonalKeyframe
Puntos clave para la curva de precios estacionales:
- `date`: Fecha del keyframe
- `basePrice`: Precio base para tipo estándar
- El sistema interpola entre keyframes para generar precios diarios

#### 3. DailyRoomRate
Tarifa diaria calculada por el sistema:
- `baseRate`: Precio base interpolado desde keyframes
- `dynamicRate`: Precio final tras aplicar occupancy score
- `withBreakfast`: Precio con desayuno
- `withHalfBoard`: Precio con media pensión
- `isManualOverride`: Si es true, respeta el valor manual

#### 4. RoomGapPromotion
Descuentos por huecos entre reservas:
- `discountRate`: Porcentaje de descuento (ej: 0.15 = 15%)

#### 5. MealPricingRule
Configuración de precios de comidas:
- `breakfastMode`: FIXED o PERCENTAGE
- `breakfastValue`: Valor fijo o porcentaje
- `dinnerMode`: FIXED o PERCENTAGE
- `dinnerValue`: Valor fijo o porcentaje

## 🔧 Funcionalidades Principales

### Cálculo de ExpectedOccupancyScore

El sistema calcula un score de ocupación esperada (0-1) basado en:

```javascript
score = (
  anticipationFactor * anticipationWeight +
  occupancyFactor * globalOccupancyWeight +
  weekendFactor * isWeekendWeight +
  holidayFactor * isHolidayWeight +
  demandIndex * demandIndexWeight +
  weatherScore * weatherScoreWeight +
  eventImpact * eventImpactWeight
)
```

### Interpolación de Keyframes

El sistema interpola linealmente entre keyframes estacionales para obtener el precio base diario:

```javascript
// Encontrar keyframes más cercanos
// Interpolar linealmente entre ellos
basePrice = beforePrice + (afterPrice - beforePrice) * ratio
```

### Ajuste Dinámico

Aplica el score de ocupación al precio base:

```javascript
adjustmentPercentage = (occupancyScore - 0.5) * 2; // -1 a 1
finalAdjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustmentPercentage));
dynamicPrice = basePrice * (1 + finalAdjustment);
```

## 📡 APIs Disponibles

### Configuración
- `GET /api/dynamic-pricing/config/:hotelId` - Obtener configuración
- `PUT /api/dynamic-pricing/config/:hotelId` - Crear/actualizar configuración

### Keyframes Estacionales
- `GET /api/dynamic-pricing/keyframes/:hotelId` - Obtener keyframes
- `POST /api/dynamic-pricing/keyframes/:hotelId` - Crear keyframe
- `PUT /api/dynamic-pricing/keyframes/:id` - Actualizar keyframe
- `DELETE /api/dynamic-pricing/keyframes/:id` - Eliminar keyframe

### Tarifas Dinámicas
- `GET /api/dynamic-pricing/rates/:hotelId/:roomTypeId` - Obtener tarifas
- `POST /api/dynamic-pricing/rates/:hotelId/:roomTypeId/generate` - Generar tarifas
- `PUT /api/dynamic-pricing/rates/:hotelId/:roomTypeId/:date` - Override manual

### Reglas de Comidas
- `GET /api/dynamic-pricing/meals/:hotelId` - Obtener reglas
- `PUT /api/dynamic-pricing/meals/:hotelId` - Crear/actualizar reglas

### Promociones por Huecos
- `GET /api/dynamic-pricing/gap-promotions/:roomId/:date` - Obtener promociones
- `POST /api/dynamic-pricing/gap-promotions/:roomId/:date` - Aplicar promoción

### Cálculos
- `POST /api/dynamic-pricing/calculate-score/:hotelId/:date` - Calcular score

## 🚀 Migración

### Ejecutar Migración
```bash
cd backend
node scripts/migrate-to-dynamic-pricing.js
```

### Datos Migrados
1. **Configuración por defecto** con pesos balanceados
2. **Keyframes estacionales** basados en datos existentes o valores por defecto
3. **Reglas de comidas** con valores típicos (15% desayuno, 20% cena)
4. **Tarifas dinámicas** generadas para los próximos 6 meses

## 📊 Compatibilidad

### Modelo Legacy
- `DailyRate` se mantiene como modelo legacy
- Los datos existentes se preservan
- El nuevo sistema funciona en paralelo

### Migración Gradual
1. El sistema legacy sigue funcionando
2. Las nuevas funcionalidades están disponibles
3. Puedes migrar gradualmente según necesites

## 🔍 Ejemplos de Uso

### Configurar Sistema
```javascript
// Configuración básica
const config = {
  anticipationThresholds: [21, 14, 7, 3],
  anticipationWeight: 0.3,
  globalOccupancyWeight: 0.25,
  isWeekendWeight: 0.15,
  isHolidayWeight: 0.1,
  demandIndexWeight: 0.1,
  weatherScoreWeight: 0.05,
  eventImpactWeight: 0.05,
  maxAdjustmentPercentage: 0.4
};

await fetch('/api/dynamic-pricing/config/default-hotel', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});
```

### Crear Keyframes
```javascript
// Keyframes para temporada alta
const keyframes = [
  { date: '2024-12-15', basePrice: 12000 },
  { date: '2024-01-15', basePrice: 10000 },
  { date: '2024-02-15', basePrice: 8000 }
];

for (const keyframe of keyframes) {
  await fetch('/api/dynamic-pricing/keyframes/default-hotel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keyframe)
  });
}
```

### Generar Tarifas
```javascript
// Generar tarifas para un mes
const response = await fetch('/api/dynamic-pricing/rates/default-hotel/1/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  })
});
```

## 🛠️ Próximos Pasos

1. **Revisar configuración** según necesidades específicas
2. **Ajustar keyframes** según temporada real
3. **Configurar reglas de comidas** según precios actuales
4. **Actualizar frontend** para usar nuevas APIs
5. **Implementar métricas** de ocupación real
6. **Agregar factores externos** (clima, eventos, etc.)

## 📈 Monitoreo

### Métricas Importantes
- Score de ocupación esperada
- Ajustes aplicados por factor
- Precisión de predicciones
- Rendimiento del sistema

### Logs
El sistema registra:
- Cálculos de scores
- Generación de tarifas
- Errores de interpolación
- Overrides manuales

## 🔒 Consideraciones de Seguridad

- Validación de inputs en todas las APIs
- Límites en ajustes máximos
- Logs de cambios manuales
- Backup de configuraciones

## 📚 Referencias

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Patrones de Pricing Dinámico](https://en.wikipedia.org/wiki/Dynamic_pricing)
- [Interpolación Lineal](https://en.wikipedia.org/wiki/Linear_interpolation) 