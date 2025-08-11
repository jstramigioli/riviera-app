# Sistema de Proporciones Dinámicas

## 🎯 Descripción

El sistema de proporciones dinámicas permite ajustar tarifas de forma proporcional basándose en las relaciones de precios actuales, sin depender de coeficientes fijos predefinidos.

## 🔧 Funcionamiento

### 1. Captura de Snapshot
Cuando se **activa** el toggle "Usar proporciones inteligentes":
- El sistema captura un snapshot de los precios base actuales de todos los tipos de habitación
- Estos precios se usan como referencia para calcular las proporciones relativas

### 2. Cálculo de Proporciones
Las proporciones se calculan dinámicamente:
```
ratio = precio_base_tipo_habitacion / precio_base_tipo_editado
```

### 3. Aplicación de Cambios
Cuando se modifica un precio con proporciones activadas:
- Se calcula el nuevo precio base del tipo editado
- Se aplica la proporción del snapshot a todos los demás tipos
- Se recalculan todos los precios con sus respectivos ajustes de servicio

## 📋 Flujo de Trabajo

### Escenario: Ajuste de Precios Personalizado

**Paso 1: Proporciones DESACTIVADAS**
```
Precios iniciales:
- Doble base: $100
- Triple base: $150  
- Suite base: $300
```

**Paso 2: Modificación Individual**
```
Modifico Suite base a $400 (solo este precio cambia)
Resultado:
- Doble base: $100 (sin cambios)
- Triple base: $150 (sin cambios)
- Suite base: $400 (modificado)
```

**Paso 3: Activar Proporciones**
```
Sistema captura snapshot:
- Doble: $100 (ratio: 1.0)
- Triple: $150 (ratio: 1.5)  
- Suite: $400 (ratio: 4.0)
```

**Paso 4: Modificación Proporcional**
```
Cambio Doble base de $100 a $200
Resultado automático:
- Doble base: $200 (editado)
- Triple base: $300 ($200 × 1.5)
- Suite base: $800 ($200 × 4.0)
```

## ✨ Ventajas

1. **Flexibilidad Total**: Permite ajustar precios individuales antes de activar proporciones
2. **Proporciones Dinámicas**: Se calculan basándose en precios reales, no coeficientes fijos
3. **Respeta Modificaciones**: Las proporciones reflejan cambios hechos con el sistema desactivado
4. **Simplicidad**: No requiere configuración previa de coeficientes

## 🔄 Estados del Sistema

- **Proporciones OFF**: Solo se modifica el precio específico editado
- **Activar Proporciones**: Se captura snapshot de precios actuales
- **Proporciones ON**: Todos los cambios se aplican proporcionalmente

## 🎯 Resultado

El sistema ahora funciona exactamente como se necesita: permite total control sobre precios individuales y aplicación proporcional basada en las relaciones reales entre tipos de habitación. 