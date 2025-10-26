# Sistema de Pestañas en Detalles de Reserva

## 📋 Resumen

Se refactorizó completamente la página de detalles de reserva (`ReservationDetails.jsx`) dividiendo el contenido en **5 componentes modulares** organizados por pestañas, mejorando significativamente la mantenibilidad y experiencia de usuario.

---

## 🗂️ Estructura de Componentes

### Componente Principal

**`/frontend/src/pages/ReservationDetails.jsx`** (simplificado a ~400 líneas)
- Maneja el estado global y la lógica de pestañas
- Carga datos de la reserva
- Gestiona datos financieros (pagos y cargos)
- Renderiza el layout principal con sidebar y contenido

### Componentes de Pestañas

Todos ubicados en `/frontend/src/components/ReservationTabs/`:

1. **`GeneralInfoTab.jsx`** - 🏠 Información General
2. **`PagosTab.jsx`** - 💳 Pagos
3. **`CargosTab.jsx`** - 🧾 Cargos / Consumos
4. **`HuespedesTab.jsx`** - 👥 Huéspedes
5. **`ServiciosTab.jsx`** - 🧹 Servicios / Mantenimiento

### Estilos

- **`ReservationDetails.module.css`** - Estilos del layout principal
- **`ReservationTabs.module.css`** - Estilos compartidos de las pestañas

---

## 🎯 Pestañas Implementadas

### 1. 🏠 Información General

**Componente:** `GeneralInfoTab.jsx`

**Contenido:**
- ✅ **Resumen Financiero**: Estado de cuenta con indicador visual de saldo
  - Total Cargos
  - Total Pagos
  - Saldo (con estados: PENDIENTE, PAGADO, A_FAVOR)
- ✅ **Información de la Reserva**:
  - Fechas (Check-in / Check-out)
  - Cantidad de noches
  - Estado (Pendiente, Confirmada, Ingresada, Finalizada, Cancelada)
  - Número de huéspedes
  - Habitación asignada (con link)
  - Tipo de habitación
  - Servicio contratado
  - Tarifa base
- ✅ **Notas**: Si hay notas adicionales sobre la reserva

**Props:**
```javascript
{
  reservation,        // Objeto de la reserva
  financialSummary,   // Resumen financiero completo
  formatDate,         // Función para formatear fechas
  formatCurrency,     // Función para formatear moneda
  getServiceTypeLabel,// Función para obtener etiqueta de servicio
  getStatusLabel      // Función para obtener etiqueta de estado
}
```

---

### 2. 💳 Pagos

**Componente:** `PagosTab.jsx`

**Funcionalidades:**
- ✅ **Resumen de Pagos**:
  - Total Abonado
  - Saldo Restante
- ✅ **Tabla de Pagos** con:
  - Fecha
  - Monto
  - Método (Efectivo, Tarjeta, Transferencia, etc.)
  - Referencia/Comprobante
  - Notas
  - Acción: Eliminar
- ✅ **Agregar Pago**:
  - Modal con formulario completo
  - Validación de campos requeridos
  - Métodos de pago predefinidos
- ✅ **Estados Vacíos**: Mensaje cuando no hay pagos

**Props:**
```javascript
{
  reservation,
  pagos,              // Array de pagos
  financialSummary,
  loadingFinancial,   // Estado de carga
  formatDate,
  formatCurrency,
  onAddPago,          // Callback para agregar pago
  onDeletePago        // Callback para eliminar pago
}
```

**API Endpoints Usados:**
- `GET /api/reservation-payments/reservas/:reservaId/pagos`
- `POST /api/reservation-payments/reservas/:reservaId/pagos`
- `DELETE /api/reservation-payments/pagos/:id`

---

### 3. 🧾 Cargos / Consumos

**Componente:** `CargosTab.jsx`

**Funcionalidades:**
- ✅ **Resumen de Cargos**:
  - Total Cargos
- ✅ **Tabla de Cargos** con:
  - Fecha
  - Descripción
  - Tipo (Badge con color según tipo)
    - ALOJAMIENTO
    - SERVICIO
    - CONSUMO
    - OTRO
  - Monto
  - Notas
  - Acción: Eliminar
- ✅ **Agregar Cargo**:
  - Modal con formulario completo
  - Validación de campos requeridos
  - Tipos de cargo predefinidos
- ✅ **Estados Vacíos**: Mensaje cuando no hay cargos

**Props:**
```javascript
{
  reservation,
  cargos,             // Array de cargos
  financialSummary,
  loadingFinancial,
  formatDate,
  formatCurrency,
  onAddCargo,         // Callback para agregar cargo
  onDeleteCargo       // Callback para eliminar cargo
}
```

**API Endpoints Usados:**
- `GET /api/reservation-payments/reservas/:reservaId/cargos`
- `POST /api/reservation-payments/reservas/:reservaId/cargos`
- `DELETE /api/reservation-payments/cargos/:id`

---

### 4. 👥 Huéspedes

**Componente:** `HuespedesTab.jsx`

**Funcionalidades:**
- ✅ **Cliente Principal**:
  - Tarjeta destacada con diseño especial
  - Nombre completo
  - Email
  - Teléfono
  - Documento
  - Click para ir al perfil del cliente
- ✅ **Acompañantes**:
  - Grid de tarjetas
  - Información de cada huésped
  - Botón para eliminar (preparado)
- ✅ **Agregar Acompañante**: Botón preparado (pendiente implementar)
- ✅ **Estados Vacíos**: Mensaje cuando no hay acompañantes

**Props:**
```javascript
{
  reservation,
  onClientClick       // Callback para navegar al cliente
}
```

**Pendiente:**
- Formulario para agregar acompañantes
- Editar información de acompañantes
- Funcionalidad de eliminar acompañantes

---

### 5. 🧹 Servicios / Mantenimiento

**Componente:** `ServiciosTab.jsx`

**Funcionalidades:**
- ✅ **Estado Vacío**: Mensaje explicativo
- ✅ **Botón Agregar Registro**: Preparado

**Props:**
```javascript
{
  reservation
}
```

**Pendiente (Implementación Futura):**
- Tabla de registros de limpieza
- Registro de pedidos de mantenimiento
- Notas operativas
- Historial de eventos
- Estados de limpieza por día

---

## 🎨 Características de Diseño

### Layout Principal
- **Sidebar Fijo**: 350px de ancho
  - Header con información básica
  - Menú de pestañas vertical
  - Footer con botones de acción y estados
- **Contenido Principal**: Ocupa el espacio restante
  - Contenido dinámico según pestaña activa
  - Scroll independiente

### Pestañas
- **Indicador Visual**: Pestaña activa destacada
- **Transiciones Suaves**: Animaciones al cambiar de pestaña
- **Responsive**: Se adapta a diferentes tamaños de pantalla

### Resumen Financiero
- **Tarjeta Destacada**: Gradiente de colores llamativo
- **Estados Visuales**:
  - `PENDIENTE`: Amarillo/Naranja
  - `PAGADO`: Verde
  - `A_FAVOR`: Azul
- **Información Clara**: Totales y saldo en una sola vista

### Modales
- **Overlay Oscuro**: Con backdrop blur
- **Animaciones**: Slide-up al abrir
- **Formularios Claros**: Labels, placeholders y validación
- **Botones de Acción**: Destacados y fáciles de usar

### Tablas
- **Diseño Limpio**: Bordes sutiles
- **Hover Effects**: Resalta la fila al pasar el mouse
- **Responsive**: Se adapta al contenido
- **Acciones Inline**: Botones de acción por fila

---

## 🔧 Implementación Técnica

### Estado Global (ReservationDetails.jsx)

```javascript
// Estado principal
const [reservation, setReservation] = useState(null);
const [activeTab, setActiveTab] = useState('general');

// Estado financiero
const [financialSummary, setFinancialSummary] = useState(null);
const [pagos, setPagos] = useState([]);
const [cargos, setCargos] = useState([]);
const [loadingFinancial, setLoadingFinancial] = useState(false);
```

### Carga de Datos Financieros

```javascript
useEffect(() => {
  if ((activeTab === 'pagos' || activeTab === 'cargos' || activeTab === 'general') && reservation) {
    loadFinancialData();
  }
}, [activeTab, reservation]);

const loadFinancialData = async () => {
  const [summary, pagosData, cargosData] = await Promise.all([
    getReservationFinancialSummary(reservation.id),
    getPagosByReserva(reservation.id),
    getCargosByReserva(reservation.id)
  ]);
  
  setFinancialSummary(summary);
  setPagos(pagosData);
  setCargos(cargosData);
};
```

### Renderizado Condicional

```javascript
const renderTabContent = () => {
  switch (activeTab) {
    case 'general':
      return <GeneralInfoTab {...props} />;
    case 'pagos':
      return <PagosTab {...props} />;
    case 'cargos':
      return <CargosTab {...props} />;
    case 'huespedes':
      return <HuespedesTab {...props} />;
    case 'servicios':
      return <ServiciosTab {...props} />;
    default:
      return null;
  }
};
```

---

## 📦 Archivos Creados/Modificados

### Nuevos Archivos

```
frontend/src/components/ReservationTabs/
├── GeneralInfoTab.jsx
├── PagosTab.jsx
├── CargosTab.jsx
├── HuespedesTab.jsx
├── ServiciosTab.jsx
├── ReservationTabs.module.css
└── index.js
```

### Archivos Modificados

```
frontend/src/pages/ReservationDetails.jsx   (refactorizado)
frontend/src/services/api.js                (agregadas funciones de pagos/cargos)
```

### Backend

```
backend/src/controllers/reservationPayments.controller.js   (nuevo)
backend/src/routes/reservationPayments.routes.js            (nuevo)
backend/prisma/schema.prisma                                (modelos Pago y Cargo)
```

---

## 🚀 Beneficios de la Refactorización

### 1. **Mantenibilidad**
- ✅ Componentes pequeños y enfocados (100-200 líneas c/u)
- ✅ Fácil de entender y modificar
- ✅ Cada pestaña es independiente

### 2. **Reutilización**
- ✅ Componentes pueden ser reutilizados en otras vistas
- ✅ Lógica separada de presentación
- ✅ Estilos modulares

### 3. **Testing**
- ✅ Componentes pequeños son más fáciles de testear
- ✅ Props claramente definidos
- ✅ Lógica de negocio separada

### 4. **Escalabilidad**
- ✅ Fácil agregar nuevas pestañas
- ✅ Fácil modificar pestañas existentes
- ✅ No afecta a otros componentes

### 5. **Experiencia de Usuario**
- ✅ Interfaz organizada y clara
- ✅ Información agrupada lógicamente
- ✅ Acceso rápido a cualquier sección
- ✅ Estado financiero siempre visible

---

## 📝 Próximos Pasos

### Corto Plazo
1. **Implementar Gestión de Huéspedes**:
   - Formulario para agregar acompañantes
   - Editar información de huéspedes
   - Eliminar huéspedes
   - Validación de documentos

2. **Implementar Servicios/Mantenimiento**:
   - Tabla de registros de limpieza
   - Formulario de pedidos de mantenimiento
   - Estados de limpieza diaria
   - Historial de eventos

3. **Mejoras en Pagos/Cargos**:
   - Editar pagos y cargos existentes
   - Filtros por fecha/tipo
   - Exportar a PDF/Excel
   - Imprimir comprobantes

### Mediano Plazo
4. **Historial de Cambios**:
   - Auditoría de modificaciones
   - Quién y cuándo se hicieron cambios
   - Restaurar versiones anteriores

5. **Notificaciones**:
   - Alertas de saldo pendiente
   - Recordatorios de pagos
   - Notificaciones de check-in/out

6. **Integración**:
   - Sistema de facturación
   - Envío de comprobantes por email
   - Pagos online

---

## 🐛 Troubleshooting

### Error: "Cannot read property 'id' of undefined"
- **Causa**: La reserva aún no se cargó
- **Solución**: Verificar que `reservation` existe antes de renderizar

### Error: "financi alSummary is null"
- **Causa**: Los datos financieros aún no se cargaron
- **Solución**: Usar optional chaining `financialSummary?.resumen.saldo`

### Las pestañas no cambian
- **Causa**: Estado `activeTab` no se actualiza
- **Solución**: Verificar que `setActiveTab` se llama correctamente

### Los modales no se cierran al hacer click fuera
- **Causa**: El evento `onClick` del overlay no está configurado
- **Solución**: Ya implementado: `onClick={() => setShowModal(false)}`

---

## 💡 Buenas Prácticas Aplicadas

1. **Separación de Responsabilidades**
   - Componentes solo manejan UI
   - Lógica de negocio en el padre
   - API calls centralizados

2. **Props Drilling Minimizado**
   - Solo se pasan props necesarios
   - Funciones de utilidad compartidas

3. **Estado Local vs Global**
   - Estado de modales: local (en cada tab)
   - Estado de datos: global (en ReservationDetails)

4. **Nombres Descriptivos**
   - Variables y funciones con nombres claros
   - Componentes con nombres significativos

5. **Consistencia**
   - Estructura similar en todas las tabs
   - Patrones de diseño repetidos
   - Nomenclatura uniforme

---

**Fecha de Implementación:** 22 de Octubre, 2025  
**Versión:** 1.0.0  
**Desarrollado con:** React + Módulos CSS


