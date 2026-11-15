---
name: Riviera PMS
description: UI operativa densa para recepción y back-office del Hotel Riviera
colors:
  primary: "#3f5f8a"
  primary-dark: "#334d70"
  primary-light: "#e8eef5"
  secondary: "#5a6f85"
  bg: "#f4f5f7"
  surface: "#ffffff"
  text: "#3a4250"
  text-dark: "#1f2933"
  text-muted: "#6b7280"
  border: "#d8dde6"
  success: "#2f9e44"
  warning: "#f59f00"
  danger: "#e03131"
  reservation: "#b8d4e3"
typography:
  body:
    fontFamily: "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  section:
    fontFamily: "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  page-title:
    fontFamily: "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
---

# Design System — Riviera PMS

## Product context

Pantallas de operación hotelera (Libro, consulta/reserva, cobros, config). Modo **Operate**: la UI sirve la tarea, no se exhibe. Usuarios: recepción y administración en mostrador o back-office.

## Foundations

- **Color:** navy operativo `#3f5f8a` como único acento de acción/selección. Fondos neutros `#f4f5f7` / blanco. Semántica success/warning/danger solo para estado.
- **Tipo:** una familia (Segoe UI). Escala fija densa: 12 / 13 / 14 / 16. Sin display faces ni Inter/Roboto como identidad.
- **Espaciado:** 4 / 8 / 12 / 16 / 24. Grupos compactos; separación clara entre bloques de tarea.
- **Radio / sombra:** 4–8px; sombras de una capa baja (`--shadow-sm/md`). Sin glass, glows ni gradientes violet.
- **Iconos:** SVG (`react-icons`). Sin emojis en UI.

Fuente canónica de tokens: `frontend/src/styles/variables.css`. Guía de proyecto: estética PMS (navy, densidad, sin vibe-coding).

## Voice & tone

Copy corto, operativo, en español rioplatense de mostrador. Controles nombran la acción (“Crear reserva”, “Guardar consulta”). Errores nombran el problema y la salida. Sin marketing ni claims inventados.

## Components

- **Botón primario:** navy sólido; una CTA dominante por barra de acciones.
- **Botón secundario:** borde neutro, fondo blanco; nunca compite con el primario.
- **Inputs / selects:** alto ~36px, borde `#d8dde6`, focus ring navy 3px / 20% opacidad (nunca azul Bootstrap).
- **Tabs de tramo:** underline navy en activo; inactivos muted; sin cards por tab.
- **Lista de habitaciones:** fila seleccionable; selección = fondo `primary-light` + borde navy (no Material blue).
- **Lista de habitaciones (Consulta):** fila horizontal con nombre · chip de tipo (borde fino, sin fondo sólido raro) · descripción; sin badge de capacidad. Si hay promo automática: **nombre de la promo a la izquierda del precio tachado**, **valor promocional debajo**. Solo el listado de habitaciones hace scroll (el formulario y acciones quedan fijos). El desglose por noche vive en el panel derecho (no expandir en la card).
- **Panel derecho (timeline + balance):** arriba timeline de estadía; debajo **Tarifa** con orden: chevron fijo junto al título Tarifa (no baja al expandir) → desglose por noche colapsable (solo Noche + Tarifa; sin Promo/Final por noche; solo noches con tarifa > 0) → Subtotal → promos RATE (descuento agregado) → Total; luego **Reservado por** y **Estado inicial**; sin modal de confirmación.

## Layout & spacing

Flujo consulta/reserva en **dos columnas full-bleed** (apiladas en estrecho): **izquierda** formulario (cliente → tramos → fechas/servicio → habitaciones → acciones); **derecha** un solo panel con **timeline arriba** y **tarifas/promos/balance debajo**. Confirmar/crear reserva desde la misma pantalla.

- Columnas a borde de viewport: **sin gap** entre columnas y **sin cards flotantes** (ni sombra ni radio en el marco de columnas); solo divisores 1px.
- Panel derecho sobre `primary-light`; tipografía sobre azul claro → **texto oscuro / navy** (no gris muted). Sobre navy sólido → texto claro.
- En el tramo activo: **check-in, check-out y tipo de servicio en la misma fila**.
- Título de página fuera del grid; sin lead bajo el título.
- Cabecera densa a la izquierda (cliente, huéspedes, camas, notas).
- Barra de acciones al pie del flujo del formulario (primario a la derecha).
- Densidad de recepción: ritmo 4/8/12; menos padding ornamental, más contraste tipográfico por rol.

## Do's and Don'ts

**Do**

- Jerarquía tipográfica legible al squint (título / sección / label / valor).
- Un acento navy para acción y selección.
- Proximidad por significado; ritmo 8/12/16.

**Don't**

- Cards dentro de cards ni badges decorativos.
- Azul Bootstrap / Material (`#007bff`, `#2196f3`) ni violet gradients.
- Emojis, glassmorphism, sombras multicapa, tipografía ornamental.
- Varios botones del mismo peso visual en la barra de acciones.
