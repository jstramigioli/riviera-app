# Guía estética — Hotel Riviera (frontend)

Referencia para páginas y componentes nuevos. Objetivo: UI operativa, densa y profesional (hotel / back-office), sin “vibe coding”.

> Origen: guía del Project de Cursor, incorporada al repo el 2026-11-26.
> Los tokens canónicos están en `frontend/src/styles/variables.css`. Los colores coinciden con esta guía;
> la escala tipográfica del código difiere (ver nota en la sección Tipografía).

## Principios

- **Sin emojis en la interfaz.** Textos, labels, tabs, alerts, tooltips, empty states y mensajes copiables van en texto plano.
- **Iconos sí, con SVG.** Acciones (editar, borrar, settings, buscar, cerrar) usan `react-icons` (fi / fa) u otro SVG. El icono acompaña o sustituye el control; no decora títulos.
- **Navy operativo, no violet.** Primary cercano a `#3f5f8a` / `#334d70`. Evitar gradientes púrpura, glows y sombras multicapa.
- **Densidad.** Escala tipográfica chica y pareja; menos nesting de cards/paneles; una intención por bloque.
- **Estado con color + texto**, no con emoji de semáforo. Ej.: “Activo” / “Próximo” / “Finalizado” + clase CSS o punto de color.

## Tipografía

| Token | Uso | Valor de referencia (guía) |
|---|---|---|
| `--font-main` | UI | `'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif` |
| `--font-size-base` | cuerpo | 13px |
| `--font-size-small` | meta / ayuda | ~11px (0.846rem) |
| `--font-size-medium` | labels | ~12px (0.923rem) |
| `--font-size-large` | subtítulos de sección | ~14px (1.077rem) |
| `--font-size-xlarge` | títulos de página | ~16px (1.23rem) |
| `--font-size-xxlarge` | hero interno (raro) | ~18px (1.385rem) |

> Nota (2026-11-26): `variables.css` define hoy base 14px, small 12px, medium 13px, large 15px, xlarge 16px, xxlarge 18px.
> Mandan los tokens del código hasta que se decida lo contrario.

- No mezclar un título enorme con body minúsculo.
- No achicar textos ya compactos hasta ilegibles.
- Evitar Inter / Roboto / system-ui como identidad de marca en pantallas nuevas si el shell ya usa Segoe.

## Color (navy / neutros)

| Rol | Referencia |
|---|---|
| Primary | `#3f5f8a` |
| Primary dark | `#334d70` |
| Primary light / highlight | `#e8eef5` |
| Secondary | `#5a6f85` |
| Fondo app | `#f4f5f7` |
| Superficie | `#ffffff` |
| Texto | `#3a4250` / muted `#6b7280` |
| Borde | `#d8dde6` |
| Success / Warning / Danger | `#2f9e44` / `#f59f00` / `#e03131` |
| Barra de reserva | `#b8d4e3` (pastel, no neón) |

## Densidad y layout

- Radio: `--radius-sm/md/lg` → 4 / 6 / 8px.
- Sombra: `--shadow-sm` / `--shadow-md` (una capa, baja opacidad).
- Nav: ~52px de alto.
- Preferir toolbar + un panel a headers de bienvenida anidados.
- Cards solo cuando contienen interacción o un grupo claro; no envolver cada label.
- Espaciado interno consistente (8 / 12 / 16), sin “aire” de landing.
- Listados y perfiles: fondo blanco directo, sin card blanca sobre fondo gris (decisión 2026-11-24).

## Iconografía

| Hacer | No hacer |
|---|---|
| `FiSettings`, `FiEdit2`, `FiTrash2`, `FiSearch`, `FiX`, … | ⚙️ ✏️ 🗑️ 🔍 en JSX |
| `aria-hidden` en iconos decorativos; `aria-label` / `title` en botones solo-icono | Emoji como único contenido del botón |
| Estado: texto + clase (`.statusActive`) o SVG | 🟢 Activo / ❌ Error |

## Copy / strings

- Alertas: sin ✅ ❌ ⚠️ (y las confirmaciones destructivas van en modal in-app, no `window.alert`/`confirm`).
- Textos exportados / portapapeles: headings en MAYÚSCULAS o título plano, sin pictogramas.
- Tests: assertar el texto limpio (`'Estadísticas'`, no `'📊 Estadísticas'`).

## Verificación rápida

Cuenta emojis en strings de UI de `frontend/src` (excluye `console.*` y comentarios):

```bash
node scripts/verify-ui-emojis.mjs
```

## Checklist página nueva

- [ ] Sin emojis en markup ni copy visible
- [ ] Acciones con SVG (`react-icons`)
- [ ] Tipografía en tokens densos
- [ ] Primary navy, fondos neutros, sin gradient violet
- [ ] Un título de sección + un bloque de contenido (sin nesting decorativo), sin texto lead bajo el título
- [ ] Estados con color CSS + texto
- [ ] Mobile: controles tocables, sin depender de hover para lo crítico
