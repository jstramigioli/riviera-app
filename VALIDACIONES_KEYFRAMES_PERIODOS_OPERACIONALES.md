# Validaciones de Keyframes y Períodos Operacionales

## Resumen de Implementaciones

Se han implementado las siguientes validaciones para garantizar la integridad entre keyframes y períodos operacionales:

### 1. Validación de Creación de Keyframes

**Ubicación:** `backend/src/controllers/dynamicPricing.controller.js` - método `createSeasonalKeyframe`

**Funcionalidad:**
- No se permite crear keyframes normales (no operacionales) fuera de un período de apertura
- Se valida que la fecha del keyframe esté dentro de al menos un período operacional
- Los keyframes operacionales (apertura/cierre) no están sujetos a esta validación

**Mensaje de error:**
```
"No se puede crear un keyframe fuera de un período de apertura. La fecha debe estar dentro de un período operacional."
```

### 2. Validación de Actualización de Keyframes

**Ubicación:** `backend/src/controllers/dynamicPricing.controller.js` - método `updateSeasonalKeyframe`

**Funcionalidad:**
- No se permite mover keyframes normales fuera de un período de apertura
- Se valida que la nueva fecha esté dentro de al menos un período operacional
- Los keyframes operacionales no se pueden modificar desde esta interfaz

**Mensaje de error:**
```
"No se puede mover un keyframe fuera de un período de apertura. La fecha debe estar dentro de un período operacional."
```

### 3. Eliminación Automática de Keyframes

**Ubicación:** `backend/src/controllers/operationalPeriod.controller.js` - método `deleteOperationalPeriod`

**Funcionalidad:**
- Cuando se elimina un período operacional, se eliminan automáticamente TODOS los keyframes dentro de ese período
- Esto incluye tanto keyframes normales como operacionales
- Se eliminan keyframes desde la fecha de apertura hasta la fecha de cierre (inclusive)

**Comportamiento:**
```javascript
// Eliminar TODOS los keyframes entre la fecha de apertura y cierre (inclusive)
await prisma.seasonalKeyframe.deleteMany({
  where: {
    hotelId: period.hotelId,
    date: {
      gte: openingKeyframe.date,
      lte: closingKeyframe.date
    }
  }
});
```

## Scripts de Prueba

Se han creado los siguientes scripts para verificar el funcionamiento:

### 1. `test-keyframe-validation.js`
- Prueba la validación de creación de keyframes
- Verifica que se rechacen keyframes fuera de períodos operacionales
- Verifica que se permitan keyframes dentro de períodos operacionales

### 2. `test-keyframe-update-validation.js`
- Prueba la validación de actualización de keyframes
- Verifica que se rechace mover keyframes fuera de períodos operacionales
- Verifica que se permita mover keyframes dentro de períodos operacionales

### 3. `test-period-deletion-with-keyframes.js`
- Prueba la eliminación automática de keyframes al eliminar un período
- Verifica que se eliminen todos los keyframes dentro del período
- Verifica que se mantengan los keyframes fuera del período

## Casos de Uso Cubiertos

### ✅ Casos Válidos
1. Crear keyframe dentro de un período operacional
2. Mover keyframe dentro del mismo período operacional
3. Mover keyframe a otro período operacional (si existe)
4. Eliminar período operacional (elimina todos los keyframes internos)

### ❌ Casos Rechazados
1. Crear keyframe fuera de cualquier período operacional
2. Mover keyframe fuera de todos los períodos operacionales
3. Modificar keyframes operacionales desde la interfaz de keyframes normales

## Beneficios de la Implementación

1. **Integridad de Datos:** Garantiza que no existan keyframes huérfanos fuera de períodos operacionales
2. **Consistencia:** Mantiene la coherencia entre períodos y keyframes
3. **Experiencia de Usuario:** Proporciona mensajes de error claros y específicos
4. **Automatización:** Elimina automáticamente keyframes cuando se elimina un período
5. **Flexibilidad:** Permite múltiples períodos operacionales y keyframes entre ellos

## Notas Técnicas

- Las validaciones se realizan a nivel de base de datos usando Prisma
- Los mensajes de error están en español para mejor experiencia de usuario
- Se mantiene la compatibilidad con keyframes operacionales existentes
- Las validaciones son transaccionales para garantizar consistencia 