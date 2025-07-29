# Curvas Segmentadas entre Períodos Operacionales

## 🎯 Problema Identificado

**Usuario**: "Entre períodos de apertura, la línea del gráfico no tiene que continuar. Se tiene que cortar, y comenzar una nueva línea en el siguiente período."

## ✅ Solución Implementada

### **Problema**: Curva continua entre períodos operacionales
- **Causa**: La interpolación se realizaba entre todos los keyframes consecutivos sin considerar los períodos operacionales
- **Solución**: Generar múltiples segmentos de curva, uno por cada período operacional

## 🔧 Implementación Técnica

### **1. Lógica de Segmentación**

#### **Antes**: Una sola curva continua ❌
```javascript
// Interpolación para la curva
const points = [];
for (let i = 0; i < sorted.length - 1; i++) {
  const a = sorted[i], b = sorted[i + 1];
  // ... interpolación entre todos los keyframes consecutivos
}
```

#### **Ahora**: Múltiples segmentos de curva ✅
```javascript
// Interpolación para la curva - separada por períodos operacionales
const curveSegments = [];
const operationalPeriods = getOperationalPeriods();

if (operationalPeriods.length === 0) {
  // Lógica original para cuando no hay períodos operacionales
  const points = [];
  // ... interpolación normal
  curveSegments.push(points);
} else {
  // Generar curvas separadas para cada período operacional
  operationalPeriods.forEach((period, periodIndex) => {
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);
    
    // Filtrar keyframes que están dentro de este período
    const periodKeyframes = sorted.filter(k => {
      const keyframeDate = new Date(k.date);
      return keyframeDate >= periodStart && keyframeDate <= periodEnd;
    });
    
    // Generar curva para este período
    const points = [];
    // ... interpolación solo para keyframes del período
    curveSegments.push(points);
  });
}
```

### **2. Renderización de Segmentos**

#### **Antes**: Una sola polyline ❌
```javascript
<polyline
  fill="none"
  stroke="#667eea"
  strokeWidth={4}
  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
/>
```

#### **Ahora**: Múltiples polylines ✅
```javascript
{curveSegments.map((segment, segmentIndex) => (
  <polyline
    key={`curve-segment-${segmentIndex}`}
    fill="none"
    stroke="#667eea"
    strokeWidth={4}
    points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
  />
))}
```

## 📊 Comportamiento Visual

### **Sin Períodos Operacionales**
- **Comportamiento**: Una sola curva continua
- **Visualización**: Línea suave que conecta todos los keyframes

### **Con Períodos Operacionales**
- **Comportamiento**: Múltiples curvas separadas
- **Visualización**: 
  - Curva 1: Desde keyframe de apertura hasta keyframe de cierre del Período 1
  - **Corte**: Sin línea entre Período 1 y Período 2
  - Curva 2: Desde keyframe de apertura hasta keyframe de cierre del Período 2
  - **Corte**: Sin línea después del Período 2

## 🧪 Script de Prueba

Se creó `test-curve-segments.js` que:

1. **Crea dos períodos operacionales separados**:
   - Período 1: 2024-06-01 a 2024-06-15
   - Período 2: 2024-07-01 a 2024-07-15
   - **Gap**: 15 días entre períodos

2. **Crea keyframes en cada período**:
   - Período 1: 2024-06-05 ($8000), 2024-06-10 ($8500), 2024-06-12 ($9000)
   - Período 2: 2024-07-05 ($7500), 2024-07-10 ($8000), 2024-07-12 ($8500)

3. **Verifica la estructura**:
   - Keyframes normales: 7 (6 de prueba + 1 existente)
   - Keyframes operacionales: 8 (4 de prueba + 4 existentes)

## 🎨 Beneficios Visuales

### **Claridad Visual**
- **Antes**: Línea confusa que conectaba períodos cerrados
- **Ahora**: Curvas claramente separadas por períodos operacionales

### **Representación Fiel**
- **Antes**: Sugería continuidad donde no la había
- **Ahora**: Refleja exactamente los períodos de apertura

### **Mejor UX**
- **Antes**: Confuso para el usuario
- **Ahora**: Clara distinción entre períodos abiertos y cerrados

## 🔍 Casos de Uso

### **Caso 1: Sin Períodos Operacionales**
```
Keyframes: [A] -------- [B] -------- [C]
Curva:     [A] -------- [B] -------- [C]
```

### **Caso 2: Con Períodos Operacionales**
```
Período 1: [Apertura] -- [K1] -- [K2] -- [Cierre]
Período 2: [Apertura] -- [K3] -- [K4] -- [Cierre]

Curvas:    [Apertura] -- [K1] -- [K2] -- [Cierre]
           [Apertura] -- [K3] -- [K4] -- [Cierre]
```

## 📝 Notas Técnicas

- **Compatibilidad**: Funciona con keyframes existentes
- **Rendimiento**: Múltiples polylines en lugar de una sola
- **Flexibilidad**: Se adapta automáticamente a cambios en períodos
- **Mantenibilidad**: Código modular y fácil de entender

## ✅ Resultado Final

La implementación garantiza que:
1. **No hay líneas continuas entre períodos operacionales**
2. **Cada período tiene su propia curva independiente**
3. **La visualización es clara y precisa**
4. **El comportamiento es consistente con la lógica de negocio** 