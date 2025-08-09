# Sistema de Tarifas - Endpoints REST API

## 📋 Resumen

Este documento describe todos los endpoints REST implementados para el nuevo sistema de tarifas basado en:
- **Bloques de temporada** (`season_blocks`) con fechas de inicio/fin
- **Tipos de servicio** (`service_types`) configurables (desayuno, media pensión, etc.)
- **Precios base por habitación** (`season_prices`) dentro de cada bloque
- **Ajustes por servicio** (`season_service_adjustments`) con modo fijo o porcentaje

## 🌐 Base URL

```
http://localhost:3001/api
```

## 📊 Endpoints Principales

### 1. Tipos de Servicio (`/service-types`)

#### `GET /service-types`
Lista todos los tipos de servicio activos.

**Query Parameters:**
- `hotelId` (opcional): ID del hotel (default: "default-hotel")

**Respuesta:**
```json
{
  "data": [
    {
      "id": "cme23s1if0003nw5s8lflwpk1",
      "hotelId": "default-hotel",
      "name": "Solo Alojamiento",
      "description": "Solo la habitación sin servicios adicionales",
      "isActive": true,
      "orderIndex": 1,
      "createdAt": "2025-08-08T00:44:02.343Z",
      "updatedAt": "2025-08-08T00:44:02.343Z"
    }
  ],
  "errors": null
}
```

#### `GET /service-types/:id`
Obtiene un tipo de servicio específico.

#### `POST /service-types`
Crea un nuevo tipo de servicio.

**Body:**
```json
{
  "name": "Con Desayuno",
  "description": "Habitación con desayuno continental incluido",
  "hotelId": "default-hotel",
  "orderIndex": 2
}
```

#### `PUT /service-types/:id`
Actualiza un tipo de servicio existente.

#### `DELETE /service-types/:id`
Elimina un tipo de servicio (valida que no esté en uso).

#### `PUT /service-types/order`
Actualiza el orden de los tipos de servicio.

**Body:**
```json
{
  "serviceTypes": [
    { "id": "id1" },
    { "id": "id2" }
  ]
}
```

### 2. Bloques de Temporada (`/season-blocks`)

#### `GET /season-blocks`
Lista todos los bloques de temporada con precios y ajustes.

**Query Parameters:**
- `hotelId` (opcional): ID del hotel (default: "default-hotel")
- `includeInactive` (opcional): Incluir bloques inactivos (default: false)

**Respuesta:**
```json
{
  "data": [
    {
      "id": "cme23s1jv0009nw5slz38f8jy",
      "hotelId": "default-hotel",
      "name": "Temporada Baja",
      "description": "Temporada de menor demanda (junio-agosto)",
      "startDate": "2024-06-01T00:00:00.000Z",
      "endDate": "2024-08-31T00:00:00.000Z",
      "isActive": true,
      "orderIndex": 1,
      "seasonPrices": [
        {
          "id": "price_id",
          "roomTypeId": 1,
          "basePrice": 37200,
          "roomType": {
            "id": 1,
            "name": "single",
            "multiplier": 0.62
          }
        }
      ],
      "seasonServiceAdjustments": [
        {
          "id": "adj_id",
          "serviceTypeId": "service_id",
          "roomTypeId": 1,
          "mode": "PERCENTAGE",
          "value": 12,
          "serviceType": {
            "id": "service_id",
            "name": "Con Desayuno"
          },
          "roomType": {
            "id": 1,
            "name": "single"
          }
        }
      ]
    }
  ],
  "errors": null
}
```

#### `GET /season-blocks/:id`
Obtiene un bloque de temporada específico con toda su configuración.

#### `POST /season-blocks`
Crea un nuevo bloque de temporada completo.

**Body:**
```json
{
  "name": "Temporada Alta",
  "description": "Temporada de mayor demanda",
  "startDate": "2024-12-01",
  "endDate": "2025-03-31",
  "hotelId": "default-hotel",
  "checkOverlaps": true,
  "seasonPrices": [
    {
      "roomTypeId": 1,
      "basePrice": 75000
    },
    {
      "roomTypeId": 2,
      "basePrice": 90000
    }
  ],
  "seasonServiceAdjustments": [
    {
      "serviceTypeId": "service_id",
      "roomTypeId": 1,
      "mode": "PERCENTAGE",
      "value": 15
    }
  ]
}
```

#### `PUT /season-blocks/:id`
Actualiza un bloque de temporada existente.

#### `DELETE /season-blocks/:id`
Elimina un bloque de temporada (cascade elimina precios y ajustes).

#### `PUT /season-blocks/order`
Actualiza el orden de los bloques de temporada.

### 3. Cálculos de Tarifas (`/tariff-calculations`)

#### `GET /tariff-calculations/season-block/:seasonBlockId`
Calcula la matriz de tarifas finales para un bloque específico.

**Query Parameters:**
- `includeIntelligentPricing` (opcional): Aplicar precios inteligentes (default: false)

**Respuesta:**
```json
{
  "data": {
    "seasonBlock": {
      "id": "block_id",
      "name": "Temporada Baja",
      "description": "Descripción del bloque",
      "startDate": "2024-06-01T00:00:00.000Z",
      "endDate": "2024-08-31T00:00:00.000Z"
    },
    "serviceTypes": [
      {
        "id": "service_id",
        "name": "Solo Alojamiento",
        "description": "...",
        "orderIndex": 1
      }
    ],
    "tariffMatrix": [
      {
        "roomType": {
          "id": 1,
          "name": "single",
          "multiplier": 0.62
        },
        "basePrice": 37200,
        "services": [
          {
            "serviceType": {
              "id": "service_id",
              "name": "Solo Alojamiento"
            },
            "basePrice": 37200,
            "adjustmentValue": 0,
            "adjustmentMode": "FIXED",
            "finalPrice": 37200,
            "hasAdjustment": true
          },
          {
            "serviceType": {
              "id": "service_id_2",
              "name": "Con Desayuno"
            },
            "basePrice": 37200,
            "adjustmentValue": 12,
            "adjustmentMode": "PERCENTAGE",
            "finalPrice": 41664,
            "hasAdjustment": true
          }
        ]
      }
    ],
    "calculationInfo": {
      "includeIntelligentPricing": false,
      "calculatedAt": "2025-08-08T01:00:00.000Z",
      "note": "Precios base con ajustes por servicio únicamente"
    }
  },
  "errors": null
}
```

#### `GET /tariff-calculations/date`
Obtiene las tarifas para una fecha específica.

**Query Parameters:**
- `date` (requerido): Fecha en formato YYYY-MM-DD
- `hotelId` (opcional): ID del hotel (default: "default-hotel")

**Ejemplo:**
```
GET /tariff-calculations/date?date=2024-07-15
```

#### `POST /tariff-calculations/compare`
Compara tarifas entre diferentes bloques de temporada.

**Body:**
```json
{
  "blockIds": ["block_id_1", "block_id_2", "block_id_3"]
}
```

## 🔧 Validaciones Implementadas

### Tipos de Servicio:
- ✅ Nombre requerido y único por hotel
- ✅ Verificación de uso antes de eliminar
- ✅ Ordenamiento automático

### Bloques de Temporada:
- ✅ Fechas válidas (inicio < fin)
- ✅ Verificación de solapamientos (configurable)
- ✅ Nombres únicos por hotel
- ✅ Validación de tipos de habitación y servicio existentes
- ✅ Montos fijos ≥ 0
- ✅ Porcentajes entre -100% y 500%
- ✅ Eliminación en cascada de precios y ajustes

## 📝 Formato de Respuestas

Todas las respuestas siguen el formato consistente:

```json
{
  "data": /* Datos solicitados o null en caso de error */,
  "errors": /* Array de mensajes de error o null si todo OK */
}
```

### Códigos de Estado HTTP:
- `200` - Operación exitosa
- `201` - Recurso creado exitosamente
- `400` - Error de validación o datos inválidos
- `404` - Recurso no encontrado
- `500` - Error interno del servidor

## 🚀 Ejemplos de Uso

### Crear un bloque de temporada completo:

```bash
curl -X POST http://localhost:3001/api/season-blocks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Verano 2024",
    "description": "Temporada de verano",
    "startDate": "2024-06-01",
    "endDate": "2024-08-31",
    "seasonPrices": [
      {"roomTypeId": 1, "basePrice": 50000},
      {"roomTypeId": 2, "basePrice": 70000}
    ],
    "seasonServiceAdjustments": [
      {
        "serviceTypeId": "service_breakfast_id",
        "roomTypeId": 1,
        "mode": "PERCENTAGE",
        "value": 15
      }
    ]
  }'
```

### Obtener matriz de tarifas calculadas:

```bash
curl "http://localhost:3001/api/tariff-calculations/season-block/cme23s1jv0009nw5slz38f8jy"
```

### Obtener tarifas para una fecha:

```bash
curl "http://localhost:3001/api/tariff-calculations/date?date=2024-07-15"
```

## 🔄 Orden de Cálculo de Tarifas

1. **Precio Base** (desde `season_prices`)
2. **Ajuste por Servicio** (desde `season_service_adjustments`)
   - Modo FIJO: `precio_base + valor_ajuste`
   - Modo PORCENTAJE: `precio_base * (1 + porcentaje/100)`
3. **Precios Inteligentes** (sistema existente, opcional)

## ✅ Estado del Sistema

**COMPLETADO:**
- ✅ Modelos de base de datos (Prisma schema)
- ✅ Migraciones aplicadas
- ✅ Controladores con validaciones completas
- ✅ Rutas REST registradas
- ✅ Endpoints de cálculo de tarifas
- ✅ Sistema de respuestas consistente
- ✅ Datos de prueba sembrados
- ✅ Pruebas manuales exitosas

**LISTO PARA:**
- 🎯 Integración con el frontend
- 🎯 Desarrollo de interfaces de usuario
- 🎯 Conexión con sistema de precios inteligentes existente 