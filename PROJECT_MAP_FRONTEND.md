# Mapa del Proyecto - Frontend

## Estructura General

El frontend es una aplicación React que gestiona un sistema de reservas hoteleras con funcionalidades avanzadas de pricing dinámico y gestión de habitaciones.

## /src/App.jsx
- **Componente raíz**: Maneja el routing principal y la lógica de estado global
- **Responsabilidades**: 
  - Configuración de rutas (Reservas, Calendario, Configuración, Estadísticas)
  - Gestión de estado de reservas y clientes
  - Validaciones de formularios y conflictos de reservas
  - Integración con APIs del backend

## /pages

### CalendarioGestion.jsx
- **Página principal**: Vista de calendario mensual para gestión de días abiertos/cerrados
- **Funcionalidades**:
  - Visualización de días del mes con estados (abierto/cerrado/feriado)
  - Edición de precios fijos y dinámicos por día
  - Integración con sistema de pricing dinámico
  - Navegación entre meses

### Configuracion.jsx
- **Panel de configuración**: Gestión de parámetros del hotel
- **Incluye**: Configuración de habitaciones, etiquetas, pricing dinámico, períodos operacionales

### Estadisticas.jsx
- **Dashboard de estadísticas**: Métricas y reportes del hotel

## /components

### Componentes Principales de Reservas

#### ReservationGrid.jsx (820 líneas)
- **Componente central**: Grid interactivo de reservas con drag & drop
- **Funcionalidades**:
  - Visualización de reservas en formato de tabla temporal
  - Drag & drop para mover reservas entre habitaciones/fechas
  - Resize de reservas para cambiar duración
  - Scroll infinito horizontal
  - Integración con paneles laterales

#### ReservationBar.jsx
- **Barra de reserva individual**: Renderiza una reserva específica en el grid
- **Características**: Tooltips, estados visuales, interacciones de mouse

#### CreateReservationPanel.jsx (734 líneas)
- **Panel de creación**: Formulario completo para nuevas reservas
- **Incluye**: Selección de habitación, fechas, cliente, validaciones

#### RoomSelectionModal.jsx (621 líneas)
- **Modal de selección**: Interfaz para elegir habitaciones disponibles
- **Funcionalidades**: Filtros, búsqueda, validación de disponibilidad

### Componentes de Gestión de Clientes

#### ClientList.jsx (286 líneas)
- **Lista de clientes**: Vista tabular con búsqueda y filtros
- **Funcionalidades**: CRUD de clientes, búsqueda, ordenamiento

#### ClientStats.jsx
- **Estadísticas de clientes**: Métricas y KPIs de clientes

#### EditClientModal.jsx (319 líneas)
- **Modal de edición**: Formulario completo para editar datos de clientes
- **Incluye**: Validaciones, campos dinámicos, integración con API

### Componentes de Configuración

#### /configuracion/
- **SeasonalCurveEditor.jsx** (1792 líneas): Editor de curvas estacionales para pricing dinámico
- **HabitacionesTab.jsx** (819 líneas): Gestión de tipos de habitaciones
- **OperationalPeriodsPanel.jsx** (604 líneas): Configuración de períodos operacionales
- **OpenDaysPanel.jsx** (628 líneas): Gestión de días abiertos/cerrados
- **DynamicPricingConfigPanel.jsx** (310 líneas): Configuración del sistema de pricing dinámico
- **DynamicPricingWeightsEditor.jsx** (467 líneas): Editor de pesos para algoritmos de pricing
- **EtiquetasTab.jsx** (349 líneas): Gestión de etiquetas para categorización
- **HotelConfigPanel.jsx** (344 líneas): Configuración general del hotel
- **CoefficientsPanel.jsx** (228 líneas): Gestión de coeficientes de pricing
- **MealPricingEditor.jsx** (226 líneas): Editor de precios de comidas

### Componentes de UI/UX

#### Header.jsx
- **Header de navegación**: Menú principal y navegación entre secciones

#### SidePanel.jsx
- **Panel lateral**: Contenedor para información contextual

#### EditPanel.jsx
- **Panel de edición**: Formularios de edición rápida

#### DayEditPanel.jsx (331 líneas)
- **Editor de días**: Configuración específica por día (precios, estados)

#### DayInfoSidePanel.jsx (180 líneas)
- **Panel de información**: Detalles de un día específico

#### FloatingAddButton.jsx
- **Botón flotante**: Acceso rápido a creación de reservas

#### FloatingNotification.jsx
- **Notificaciones**: Sistema de alertas y mensajes

#### LocationSelector.jsx (357 líneas)
- **Selector de ubicación**: Filtro por localidad/ciudad

#### RateEditor.jsx (214 líneas)
- **Editor de tarifas**: Configuración de precios por tipo de habitación

#### RateViewer.jsx
- **Visor de tarifas**: Visualización de precios actuales

#### ReservationRequirements.jsx (160 líneas)
- **Requisitos de reserva**: Validaciones y reglas de negocio

#### RoomList.jsx
- **Lista de habitaciones**: Vista de habitaciones disponibles

#### RatesCalendar.jsx (429 líneas)
- **Calendario de tarifas**: Vista temporal de precios

## /hooks

### useAppData.js
- **Hook principal**: Gestión de estado global de la aplicación
- **Responsabilidades**:
  - Carga inicial de datos (habitaciones, reservas, clientes)
  - Estado de loading y errores
  - Ordenamiento de habitaciones

### useSidePanel.js
- **Hook de panel lateral**: Gestión del estado del panel lateral
- **Funcionalidades**:
  - Control de apertura/cierre
  - Estado de edición
  - Datos seleccionados (reserva/cliente)

### useTags.js
- **Hook de etiquetas**: Integración con TagsContext
- **Funcionalidades**: Acceso a etiquetas y operaciones CRUD

## /contexts

### TagsContext.jsx
- **Contexto de etiquetas**: Estado global para etiquetas del sistema
- **Funcionalidades**:
  - Carga de etiquetas desde API
  - Operaciones CRUD (crear, actualizar, eliminar)
  - Estado de loading

## /services

### api.js (477 líneas)
- **Servicio central de API**: Todas las llamadas al backend
- **Endpoints principales**:
  - CRUD de reservas, clientes, habitaciones
  - Gestión de tarifas y pricing dinámico
  - Operaciones de días abiertos/cerrados
  - Gestión de pagos y huéspedes
  - Configuración de hotel y períodos operacionales

## /utils

### apiUtils.js (70 líneas)
- **Utilidades de API**: Funciones auxiliares para llamadas a API
- **Incluye**: Actualización de reservas y clientes con optimistic updates

### reservationUtils.js (66 líneas)
- **Utilidades de reservas**: Validaciones y lógica de negocio
- **Funcionalidades**:
  - Validación de conflictos de reservas
  - Validación de fechas
  - Notificaciones de conflictos

### roomTypeUtils.js (52 líneas)
- **Utilidades de tipos de habitación**: Lógica específica para room types
- **Incluye**: Cálculos de precios y validaciones

### roomUtils.js
- **Utilidades de habitaciones**: Funciones auxiliares para habitaciones
- **Incluye**: Ordenamiento y formateo

### documentUtils.js
- **Utilidades de documentos**: Manejo de tipos de documento
- **Funcionalidades**: Abreviaciones y validaciones de documentos

## /styles
- **Archivos CSS modulares**: Estilos específicos por componente
- **Incluye**: Variables CSS globales, estilos de componentes principales

## /assets
- **Recursos estáticos**: Imágenes, iconos, datos geográficos
- **Incluye**: `arg-localities.json` para datos de localidades argentinas

---

## Notas de Arquitectura

### Patrones Identificados
- **Custom Hooks**: Uso extensivo de hooks personalizados para lógica reutilizable
- **Context API**: TagsContext para estado global de etiquetas
- **Componentes modulares**: Separación clara de responsabilidades
- **CSS Modules**: Estilos encapsulados por componente

### Problemas de Escalabilidad Detectados

1. **Componentes muy grandes**: 
   - `SeasonalCurveEditor.jsx` (1792 líneas) - Necesita refactorización
   - `ReservationGrid.jsx` (820 líneas) - Lógica compleja mezclada
   - `CreateReservationPanel.jsx` (734 líneas) - Demasiadas responsabilidades

2. **Duplicación de lógica**:
   - Validaciones de formularios repetidas en múltiples componentes
   - Lógica de drag & drop parcialmente duplicada
   - Manejo de estados de loading disperso

3. **Acoplamiento alto**:
   - `App.jsx` maneja demasiada lógica de negocio
   - Dependencias circulares entre componentes

### Refactors Recomendados

1. **Extraer lógica de validación**:
   - Crear hook `useFormValidation` para validaciones reutilizables
   - Centralizar reglas de negocio en utils específicos

2. **Simplificar componentes grandes**:
   - Dividir `SeasonalCurveEditor` en subcomponentes
   - Extraer lógica de `ReservationGrid` a hooks especializados
   - Separar formularios complejos en componentes más pequeños

3. **Mejorar gestión de estado**:
   - Considerar Redux/Zustand para estado más complejo
   - Centralizar estado de loading/error
   - Implementar cache de datos con React Query

4. **Optimizar rendimiento**:
   - Implementar React.memo en componentes pesados
   - Virtualización para listas grandes
   - Lazy loading de componentes de configuración

5. **Mejorar testing**:
   - Aumentar cobertura de tests (actualmente limitada)
   - Implementar tests de integración
   - Tests de hooks personalizados

### Fortalezas del Proyecto
- **Arquitectura modular**: Separación clara de responsabilidades
- **Hooks personalizados**: Buena abstracción de lógica reutilizable
- **Sistema de pricing dinámico**: Funcionalidad avanzada bien implementada
- **UI/UX consistente**: Componentes reutilizables y patrones visuales coherentes 