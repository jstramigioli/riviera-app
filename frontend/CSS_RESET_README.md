# CSS Reset - Documentación

## 📋 Descripción

Este proyecto incluye un **CSS Reset completo** implementado en `frontend/src/index.css` que normaliza los estilos por defecto del navegador para garantizar consistencia visual y evitar problemas de alineación.

## 🎯 Objetivos

### ✅ Problemas Solucionados:
- **Altura inesperada de elementos**: Como el problema del `h3` que tenía 89px en lugar de ~29px
- **Márgenes y padding inconsistentes**: Eliminados todos los estilos por defecto
- **Alineación impredecible**: Normalización de `line-height` y `box-sizing`
- **Estilos de navegador variables**: Consistencia entre diferentes navegadores

### ✅ Beneficios:
- **Desarrollo más predecible**: Los elementos se comportan de manera consistente
- **Menos CSS personalizado**: No necesitas resetear elementos constantemente
- **Mejor mantenimiento**: Estilos base normalizados
- **Responsive design más fácil**: Elementos con comportamiento predecible

## 🔧 Elementos Reseteados

### 📝 **Elementos de Texto**
```css
h1, h2, h3, h4, h5, h6 {
  margin: 0;
  padding: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: 1.2;
  height: auto;
  min-height: 0;
}
```

### 📋 **Listas**
```css
ul, ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
```

### 🔗 **Enlaces**
```css
a {
  text-decoration: none;
  color: inherit;
}
```

### 🔘 **Botones**
```css
button {
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
  padding: 0;
  margin: 0;
}
```

### 📝 **Inputs y Textareas**
```css
input, textarea, select {
  font: inherit;
  border: none;
  outline: none;
  background: none;
  padding: 0;
  margin: 0;
}
```

### 🖼️ **Imágenes**
```css
img {
  max-width: 100%;
  height: auto;
  display: block;
}
```

### 📊 **Tablas**
```css
table {
  border-collapse: collapse;
  border-spacing: 0;
}
```

## 🎨 Box Sizing

### ✅ **Modelo de Caja Consistente**
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

**Beneficios:**
- **Cálculos más intuitivos**: `width` incluye `padding` y `border`
- **Layouts más predecibles**: No hay sorpresas con el tamaño de los elementos
- **Responsive design más fácil**: Elementos con dimensiones consistentes

## 📏 Line Height

### ✅ **Altura de Línea Normalizada**
```css
h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
}
```

**Beneficios:**
- **Alineación consistente**: Todos los títulos tienen la misma altura relativa
- **Espaciado predecible**: Control total sobre el espacio vertical
- **Mejor legibilidad**: Altura de línea optimizada

## 🚀 Uso en el Proyecto

### ✅ **Cómo Aplicar Estilos**

#### **Antes (sin reset):**
```css
.title h3 {
  margin: 0;
  padding: 0;
  line-height: 1.2;
  height: auto;
  min-height: 0;
  box-sizing: border-box;
}
```

#### **Después (con reset):**
```css
.title h3 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}
```

### ✅ **Ventajas del Reset:**
- **Menos código**: No necesitas resetear constantemente
- **Más limpio**: CSS más enfocado en el diseño
- **Más mantenible**: Cambios globales desde un solo lugar

## 🔄 Mantenimiento

### ✅ **Cuándo Actualizar el Reset:**
- **Nuevos elementos HTML5**: Agregar resets para elementos modernos
- **Problemas de alineación**: Identificar patrones comunes
- **Nuevos navegadores**: Asegurar compatibilidad

### ✅ **Buenas Prácticas:**
- **No modificar el reset**: Mantenerlo como base estable
- **Usar CSS modules**: Para estilos específicos de componentes
- **Documentar cambios**: Explicar modificaciones importantes

## 📚 Referencias

### ✅ **Inspirado en:**
- **Eric Meyer's Reset CSS**: Base fundamental
- **Normalize.css**: Compatibilidad entre navegadores
- **Modern CSS Reset**: Elementos HTML5 y modernos

### ✅ **Elementos Cubiertos:**
- ✅ Elementos de texto (h1-h6, p, span, etc.)
- ✅ Elementos de formulario (input, button, textarea, etc.)
- ✅ Elementos de lista (ul, ol, li, etc.)
- ✅ Elementos multimedia (img, video, audio, etc.)
- ✅ Elementos de tabla (table, tr, td, etc.)
- ✅ Elementos semánticos (section, article, nav, etc.)
- ✅ Elementos de código (code, pre, etc.)
- ✅ Elementos de citación (blockquote, cite, etc.)

## 🎉 Resultado Final

Con este reset CSS, el proyecto ahora tiene:
- **✅ Consistencia visual** en todos los navegadores
- **✅ Desarrollo más predecible** sin sorpresas de alineación
- **✅ CSS más limpio** y mantenible
- **✅ Mejor experiencia de desarrollo** para todo el equipo

---

**Nota**: Este reset se aplica globalmente a todo el proyecto. Para estilos específicos de componentes, usar CSS Modules o styled-components. 