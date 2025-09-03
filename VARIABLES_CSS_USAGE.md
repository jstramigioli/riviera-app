# Uso de Variables CSS en la Aplicación

## 🎯 Objetivo
Este documento muestra dónde se están usando las variables CSS globales en la aplicación. Con el texto en verde, podrás identificar visualmente qué partes están usando las variables y cuáles no.

## 📁 Archivos que SÍ usan Variables CSS

### 1. **ReservationBar.css**
- ✅ Usa variables de texto: `var(--color-text-dark)`
- ✅ Usa variables de reservas: `var(--color-reservation)`, `var(--color-reservation-hover)`, `var(--color-reservation-border)`

### 2. **ReservationGrid.module.css**
- ✅ Usa variables de texto: `var(--color-text-main)`, `var(--color-text-light)`, `var(--color-text-muted)`
- ✅ Usa variables de fondo: `var(--color-bg)`, `var(--color-bg-white)`, `var(--color-bg-room)`, `var(--color-bg-highlight)`
- ✅ Usa variables de color primario: `var(--color-primary)`, `var(--color-primary-dark)`
- ✅ Usa variables de borde: `var(--color-border)`

### 3. **App.module.css**
- ✅ Usa variables de texto: `var(--color-text-light)`, `var(--color-text-dark)`, `var(--color-text-muted)`
- ✅ Usa variables de fondo: `var(--color-bg-light)`
- ✅ Usa variables de color primario: `var(--color-primary)`, `var(--color-primary-dark)`
- ✅ Usa variables de estado: `var(--color-danger)`

### 4. **CreateQueryModal.module.css**
- ✅ Usa variables de texto: `var(--color-text-primary)`
- ✅ Usa variables de color primario: `var(--color-primary)`, `var(--color-primary-dark)`
- ✅ Usa variables de estado: `var(--color-error)`

### 5. **NuevaConsulta.module.css**
- ✅ Usa variables de texto: `var(--color-text-primary)`, `var(--color-text-secondary)`
- ✅ Usa variables de color primario: `var(--color-primary)`, `var(--color-primary-dark)`
- ✅ Usa variables de estado: `var(--color-error)`, `var(--color-success)`
- ✅ Usa variables de fondo: `var(--color-bg)`

### 6. **ReservationsTable.module.css**
- ✅ Usa variables de texto: `var(--color-text-dark)`, `var(--color-text-muted)`
- ✅ Usa variables de fondo: `var(--color-bg-white)`, `var(--color-bg-light)`, `var(--color-bg)`
- ✅ Usa variables de color primario: `var(--color-primary)`
- ✅ Usa variables de borde: `var(--color-border)`, `var(--color-border-light)`
- ✅ Usa variables de estado: `var(--color-success-light)`, `var(--color-success-dark)`, `var(--color-info-light)`, `var(--color-info-dark)`, `var(--color-danger-light)`, `var(--color-danger-dark)`

### 7. **SeasonBlockModal.module.css**
- ✅ Usa variables de texto: `var(--color-text-light)`, `var(--color-text-dark)`, `var(--color-text-muted)`, `var(--color-text-main)`

## 🔍 Variables CSS Definidas

### Colores de Texto (Ahora VERDE)
- `--color-text-main: #00ff00`
- `--color-text-light: #00ff00`
- `--color-text-dark: #00ff00`
- `--color-text-muted: #00ff00`
- `--color-text-accent: #00ff00`
- `--color-text-primary: #00ff00`
- `--color-text-secondary: #00ff00`

### Colores de Estado (Ahora VERDE)
- `--color-success: #00ff00`
- `--color-success-light: #00ff00`
- `--color-success-dark: #00ff00`
- `--color-warning: #00ff00`
- `--color-warning-light: #00ff00`
- `--color-danger: #00ff00`
- `--color-danger-light: #00ff00`
- `--color-danger-dark: #00ff00`
- `--color-info: #00ff00`
- `--color-info-light: #00ff00`
- `--color-info-dark: #00ff00`
- `--color-error: #00ff00`

## 🎨 Cómo Identificar el Uso

### Texto Verde = Usa Variables CSS
Si ves texto en **color verde**, significa que ese elemento está usando las variables CSS globales.

### Texto Normal = No Usa Variables CSS
Si ves texto en color normal (negro, gris, etc.), significa que ese elemento NO está usando las variables CSS y tiene colores hardcodeados.

## 📋 Archivos a Revisar

### Componentes que probablemente NO usan variables CSS:
- Componentes de configuración (excepto SeasonBlockModal)
- Componentes de tarifas
- Componentes de habitaciones
- Componentes de clientes
- Componentes de pagos

### Componentes que SÍ usan variables CSS:
- ✅ ReservationBar
- ✅ ReservationGrid
- ✅ App (navegación principal)
- ✅ CreateQueryModal
- ✅ NuevaConsulta
- ✅ ReservationsTable
- ✅ SeasonBlockModal

## 🔧 Próximos Pasos

1. **Identificar visualmente** qué partes de la app tienen texto verde
2. **Marcar los componentes** que NO usan variables CSS
3. **Migrar gradualmente** los componentes que no usan variables
4. **Mantener consistencia** en el sistema de diseño

## 📝 Notas

- Las variables están importadas en `frontend/src/index.css`
- El archivo principal de variables es `frontend/src/styles/variables.css`
- Algunos componentes pueden tener colores hardcodeados que necesitan migración 