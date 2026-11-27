# CLAUDE.md — Riviera App (v1)

Instrucciones para agentes de programación (Claude Code y Cursor) que trabajan en este repositorio.
Es la **fuente única** de reglas del proyecto. Cursor la carga vía `.cursor/rules/proyecto.mdc`.

Riviera App es el PMS (sistema de gestión) del Hotel Riviera, Mar del Plata. Usuarios: recepción,
administración, gerencia y propietarios. Idioma del producto y del código de dominio: español.

---

## 1. Metodología de trabajo

1. No suponer cómo está implementado algo: inspeccionar el código antes de proponer cambios.
2. Respetar la arquitectura, convenciones y decisiones ya adoptadas (secciones 4–7).
3. Sin refactors, dependencias ni complejidad innecesaria si alcanza una solución más simple.
4. Antes de un cambio importante: analizar, identificar archivos/componentes afectados y explicar brevemente el enfoque.
5. Atención especial a lo que pueda afectar otras funcionalidades, datos existentes o el esquema de la DB.
6. Si el cambio requiere migraciones, configuración, documentación o ajustes en otras partes, resolverlo como parte del trabajo.
7. Después de implementar, correr tests y verificaciones pertinentes (sección 3). Compilar no es terminar.
8. No eliminar información, funcionalidades ni datos sin justificación clara.
9. No hacer cambios fuera del alcance pedido; no cambiar UI no solicitada.
10. Actitud crítica: si una propuesta tiene problemas técnicos o funcionales, señalarlo antes de implementarla.
11. Ante dudas de producto, confirmar con Julián antes de implementar.

---

## 2. Base de datos — regla crítica

- **Dos líneas del programa:** v1 (este repo) y v2 (otro proyecto, otra máquina). **Nunca mezclar sus bases.**
  - v1 usa `riviera_v1` (o `riviera_legacy`) en `backend/.env`. Si `riviera` ya es de v2 en esa máquina, no usarla.
  - `backend/src/index.js` avisa al arrancar si `DATABASE_URL` no apunta a `riviera_v1`.
- **Entorno local de Julián:** la DB que se usa es la del `.env` de la **raíz** (`riviera_v1`); `backend/.env` (versionado)
  apunta a otra (`riviera`) y falla la autenticación. Para levantar el backend con la DB correcta, correrlo desde la raíz
  (`node backend/src/index.js`: dotenv lee el `.env` del cwd). Backups locales en `C:\Users\julii\Documents\riviera-backups\` (fuera del repo).
- **Ramas:** `origin/main` suele estar atrás de la línea real de trabajo (ramas `cursor/*` encadenadas, cada PR se mergea
  sobre la anterior). Antes de empezar, partir de la rama más reciente de esa línea, no de `main`; si no, la DB local tiene
  migraciones que el código no conoce (y al revés) y el merge posterior trae conflictos.
- **Backup completo antes de cualquier operación que modifique la DB.** Preguntar: «¿Hay un backup reciente de la base de datos antes de proceder?»
- **Prohibido sin backup y confirmación explícita:** `npx prisma db push`, `npx prisma migrate reset`, `npx prisma db pull`, o cualquier comando destructivo/estructural.
- Nunca `db push` con datos importantes. Cambios de esquema **solo con migraciones**.
- Después de restaurar un backup o importar datos con IDs: `npm run db:fix-sequences` (ver `backend/RESTORE-BACKUP.md`).

### Flujo de migraciones (lo definen los agentes; seguir este procedimiento)

1. Editar `backend/prisma/schema.prisma`.
2. Generar el SQL **sin aplicarlo**:
   - Con DB de desarrollo disponible: `npx prisma migrate dev --create-only --name <nombre_snake_case>`.
     Si `migrate dev` detecta drift y propone **reset**, cancelar y avisar: no aceptar nunca el reset.
   - Sin DB: `prisma migrate diff --from-schema-datamodel <schema anterior> --to-schema-datamodel prisma/schema.prisma --script`
     (schema anterior con `git show HEAD:backend/prisma/schema.prisma > <scratch>/old.prisma`) y guardar en
     `prisma/migrations/<YYYYMMDDHHMMSS>_<nombre>/migration.sql`.
3. Revisar el SQL a mano: backfill/defaults para columnas `NOT NULL` en tablas con datos, renombres
   (Prisma los genera como drop + add: reescribir como `RENAME` para no perder datos), drops intencionales.
   Mantener el estilo de las migraciones existentes: SQL idempotente cuando sea posible
   (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object …`) y sin prefijo `"public".` que agrega `migrate diff`.
4. Timestamp de carpeta **único** y posterior al último; archivo UTF-8 **sin BOM**.
5. Aplicar con `npx prisma migrate deploy` (previo backup) y `npx prisma generate`.
6. Nunca editar una migración ya aplicada; corregir con una migración nueva.
   El historial **no se reproduce desde cero** (`20250101000000_add_block_service_types` corre antes que `init` y falla):
   para probar una migración nueva, crear la DB descartable con `migrate diff --from-empty --to-schema-datamodel <schema anterior>`,
   aplicar la migración con `psql` (dos veces, para verificar idempotencia) y comprobar drift con `migrate diff --from-url … --to-schema-datamodel`.
7. Si el cambio toca la auditoría (entidad nueva clave) actualizar `backend/src/audit/entities.js`.

---

## 3. Comandos

Requisitos: Node 22, PostgreSQL. Backend en `:3001`, frontend Vite en `:5173` (proxy `/api` → 3001).

```bash
npm run install:all           # deps raíz + backend + frontend
npm run dev                   # backend (nodemon) + frontend (vite)
cd backend && npx prisma migrate deploy   # con backup previo
cd backend && npm run seed:users          # admin/admin123, gerencia/gerencia123, recepcion/recepcion123
```

Verificación:

```bash
cd backend && npx jest                 # Prisma mockeado en tests/setup.js, no necesita DB
cd frontend && npx vitest run
cd frontend && npx eslint .
cd frontend && npx vite build
node scripts/verify-ui-emojis.mjs      # emojis en strings de UI (desde la raíz)
```

**Línea base conocida (2026-11-26, rama `claude/auditoria-integral`)** — no hay suite en verde; verificar que no aparezcan fallos *nuevos*:
- Backend: 131/379 tests fallan, siempre en las mismas 11 suites viejas de `tests/controllers/*` (401 por auth agregada después),
  `tests/middlewares/validation.test.js` y `tests/services/dynamicPricingService.test.js`. Si fallan más suites con
  `Cannot find module` (p. ej. `cookie-parser`, `pdfkit`), los `node_modules` locales están viejos: `npm install` en `backend/`.
- npm 11 bloquea los install scripts de Prisma (`npm warn install-scripts`): después de instalar correr `npx prisma generate`.
  No usar `npm audit fix` a ciegas en backend: sube Prisma de minor (6.13 → 6.19) junto con el resto.
- Frontend: 50/502 fallan en 7 archivos (`api.test.js`, `useAppData`, `useSeasonBlock`, `SeasonBlockModal`, `DayEditPanel`, `roomTypeUtils`, `HotelConfigPanel`).
- ESLint: 124 errores / 29 warnings. Build OK (aviso de chunk > 500 kB).
- `verify-ui-emojis`: 1 falso positivo (`↔` en nombre de test de `CobroForm.test.jsx`).

**Trampa de `.gitignore`:** ignora `*.test.js` y `test-*.js`. Los tests de backend existentes están forzados;
un test nuevo `*.test.js` hay que agregarlo con `git add -f`. (`*.test.jsx` del frontend no se ve afectado.)

---

## 4. Arquitectura y convenciones

- **Monorepo:** `backend/` (Express 4 + Prisma 6 + PostgreSQL, CommonJS) y `frontend/` (React 19 + Vite 7 + React Router 7, ESM).
- **Backend:** `src/routes/*.routes.js` → `src/controllers/*.controller.js`; lógica reutilizable en `src/services/` y `src/utils/`
  (motor de promociones, imputación de cobros, balances, fechas). Rutas montadas en `src/app.js` con permiso por área
  (`requirePermission`: ops, reservas, clientes, finanzas, tarifas, settings, auditoria, gastronomia). Permisos por rol en `src/auth/permissions.js`.
- **Auth:** cookie httpOnly `riviera_session` (14 días, `SESSION_DAYS`). Roles activos: Admin, Propietario, Gerencia, Recepción;
  reservados (no asignables aún): Camarero/a, Cocina, Mucama, Mantenimiento. Solo Admin gestiona usuarios. Detalle: `docs/seed-usuarios-auth.md`.
- **Auditoría:** extensión Prisma + AsyncLocalStorage registra mutaciones con el usuario de la sesión (`docs/auditoria-cambios.md`).
  Entidades clave (reservas, consultas, clientes, cobros, cargos…) llevan `createdAt`/`updatedAt`.
- **Prisma:** usar siempre el cliente compartido `require('../utils/prisma')`; **nunca** `new PrismaClient()` en un módulo
  (se saltea la auditoría y abre otro pool de conexiones). En tests de backend, mockear `src/utils/prisma` (ver `tests/setup.js`).
- **Operaciones de varias tablas** (tramos, cargos de alojamiento, cobros, borrados): dentro de `prisma.$transaction`;
  calcular antes y escribir todo junto al final.
- **Estado de reserva:** cancelar / reactivar va por `PATCH /api/reservations/:id/status` (desactiva tramos; al reactivar
  enciende solo el último grupo desactivado y chequea disponibilidad → 409 `ROOM_NOT_AVAILABLE`). Los tramos nunca se borran:
  editar la estadía o borrar un tramo los deja `isActive=false`. Una reserva con cobros imputados no se elimina (409 `RESERVATION_HAS_COBROS`).
- **Frontend:** páginas en `src/pages/`, componentes en `src/components/` (CSS Modules `*.module.css`), llamadas HTTP en `src/services/api.js`,
  tokens en `src/styles/variables.css`. Tests junto al componente (`X.test.jsx`).
- **Dominio en español:** `Cobro` (antes `Pago`, renombrado), `Cargo`, `Consulta`/`Query`, tramos = `ReservationSegment`, estado «Prerreserva» (antes «Pendiente»).
- **Archivos grandes** (`Consulta.jsx` ~4500 líneas, `CobroForm.jsx`, `reservationCobros.controller.js`, `api.js`): cambios quirúrgicos.
- **Commits:** Conventional Commits en español con scope y ticket cuando existe: `feat(check-in): progreso N/M (PGH-353)`, `fix(ui): …`. Commits chicos y atómicos.

---

## 5. Decisiones funcionales vigentes

**Navegación**
- Menú superior sin Tarifas, Precios inteligentes ni Auditoría. Tarifas y Auditoría solo desde Configuración; las rutas viejas redirigen.
- Libro como hub: Hoy + Más (consulta / reserva / consumo). Consumos: modal comanda + menú en Config (bebidas/minutas/cafetería), teclado-first.

**Libro de Reservas y Calendario**
- Libro rehecho (`LibroReservasBoard`): estructura tipo v2, look v1, **sin drag/resize**, ancho de celda como v2.
  Fechas y código con máxima coherencia; se puede modificar código viejo (esquema solo con backup + migraciones).
- Reservas finalizadas en gris claro.
- Calendario: recrear en v1 usando v2 solo como referencia de estructura; mantener look de v1; no copiar v2 tal cual. Confirmar dudas antes.
- Panel de reserva: teléfono y email del cliente (solo valores) con copiar + WhatsApp/mailto.

**Consulta / reserva**
- Auto-split de tramos solo por disponibilidad del tipo de servicio pedido; no partir por bloques de temporada si el servicio sigue disponible.
- Tarifa de reserva: pestañas Automática (default + promos) y Precio manual (total estadía); se guarda el promedio por noche con ajuste de centavos y flag de creación con tarifa manual.
- Editar reserva: panel derecho más ancho con 2 columnas (actual fija vs modificada editable con auto/manual y promos).

**Tarifas**
- Seed: solo 3 servicios canónicos (alojamiento / desayuno / media pensión), sin nombres duplicados.
- Sin sistema de redondeo. Sin proporciones automáticas: precios de bloque solo manuales.
- Activar un bloque respeta el overlap real de fechas. En edición de bloque, guardar/cancelar = íconos tilde/cruz arriba.

**Promociones y descuentos**
- Todas las promociones se calculan sobre la tarifa **bruta** (no en cascada ni sobre subtotal post-promo).
- Con varios tramos, condiciones y aplicación como una sola estadía (no por segmento).
- Modalidad «Automática» u «Opcional» (default activado/desactivado); no «manual». «Valor manual» es solo un toggle del beneficio.
  En Consulta: «+ promoción» con desplegable de opcionales; default on = como automática con X; default off = se activa al elegirla.
- Descuentos SETTLEMENT (por medio de pago): se suman (auto + opcionales); los automáticos siempre activos; UI de listado como promos.

**Dashboard**
- Ingresos = hoy + atrasados no ingresados. Egresos = pendientes de finalizar con checkout ≤ hoy (no futuros).
- Minimizar acciones destructivas/accidentales (Caja sin editar/eliminar cobros); esas acciones van en Estado de cuentas, perfil y reserva.

**Clientes y check-in**
- Check-in online: formulario propio con datos personales estándar + patente; mismos campos que el perfil de cliente.

**Gastronomía**
- Comandas (`Comanda` + `ComandaItem`, `backend/src/utils/comandas.js`): cada comanda tiene un **ámbito** único (Cena / Minutas / Cafetería / Frigobar)
  para reportes por sector; los productos no se duplican por ámbito. Cada línea copia el precio (histórico) y genera un `Cargo` con
  subcategoría del grupo del producto (nunca `null`: la sincronización de alojamiento borra los cargos sin subcategoría).
  Los cargos de comanda no se editan sueltos: se quita la línea o se anula la comanda. Frigobar solo en cuentas de reserva.
- Tipos de cena flexibles (Configuración → Cenas, `backend/src/utils/cenas.js`, `/api/cenas/tipos`): cada tipo es un producto del
  grupo CENAS con dos variedades de precio, `Alojado` y `Externo` (nombres fijos del sistema). Se crean, renombran, desactivan
  (o eliminan si nunca se usaron) solo desde esa sección; el menú genérico rechaza tocar CENAS y la pestaña Menú no lo muestra.
- Gestión de comensales (Gastronomía → Comensales, `backend/src/utils/comidasGestion.js`): «+ Cena» registra una cena no incluida
  (huésped que pasa esa noche o externo) y crea su comanda de Cena (tipo × comensales, precio según comensal, editable); las
  bebidas se agregan a esa comanda (`POST /api/consumptions/orders/:id/items`). Cancelar una cena manual quita solo la línea de la
  cena; cancelar una incluida no toca dinero y se puede reactivar. No se permite cena paga si la reserva ya la tiene incluida.
- Almuerzo sin cargo (`BeneficioGastronomico`, `backend/src/utils/beneficios.js`): se genera al cancelar una cena incluida
  (uno por reserva y noche); no es saldo ni equivale a platos. Se aplica en una comanda de Minutas de la reserva: todo queda
  sin cargo (`ComandaItem.bonificado`, sin Cargo, subtotal de referencia) salvo bebidas (`GRUPOS_CON_CARGO`). Estados
  DISPONIBLE / UTILIZADO (con su comanda) / ANULADO (motivo). `reconcileBeneficios` (en cada sync de reserva y al cancelar /
  reactivar) anula por check-out y restaura si se revierte, anula si la fecha sale de la estadía o se reactiva la cena; la
  anulación MANUAL solo se revierte a mano. Anular la comanda devuelve el beneficio; con el beneficio usado no se reactiva la cena.
  Detalle de reserva → pestaña Comidas (beneficios + grilla de la estadía + dieta/notas); el panel de reserva del Libro
  muestra «Almuerzo sin cargo: N disponibles» (enlace a esa pestaña).
- Reporte de ventas gastronómicas (Estadísticas → Ventas gastronómicas, `GET /api/reportes/ventas-gastronomia?desde&hasta`,
  permiso `reportes`, `backend/src/utils/reporteVentas.js`): por ámbito y por producto desde las líneas de comandas activas
  (precio histórico); separa facturado (con Cargo) de sin cargo (bonificado). Consumos previos a las comandas no entran.
- Comidas previstas (`PrestacionComida`, `backend/src/utils/prestacionesComida.js`, `GET /api/comidas?fecha=`): por cada noche d con servicio S
  → cena el día d si S incluye cena y desayuno el día d+1 si incluye desayuno. Régimen interno en `ServiceType.incluyeDesayuno/incluyeCena`
  (sin UI). Generan PENDIENTE/CONFIRMADA/INGRESADA/FINALIZADA. Se sincronizan al crear/modificar reservas, tramos o estado
  (`safeSyncPrestacionesComida`); si una fecha sale de la estadía y tiene datos operativos (cancelación, pax manual, notas) queda `vigente=false`.
  Carga inicial / resincronización: `cd backend && npm run sync:comidas [-- --dry-run]` (con backup). Dashboard y panel del día leen la API.
- Rediseño gastronómico en curso por etapas: 1) comandas y ámbito (hecha); 2) prestaciones de comida generadas por la reserva (hecha);
  3) gestión de comensales, cenas manuales y tipos de cena (hecha); 4) beneficio «Almuerzo sin cargo» (hecha);
  5) reportes por ámbito (hecha).
  Los servicios ofrecidos siguen siendo Solo alojamiento / Con desayuno / Media pensión: el régimen de comidas se maneja internamente sin cambiar esa UI.
- Menús diarios: editan recepción, propietarios y admin; cocina no.
- PDF menú diario: una hoja A5; tipografía ~16pt, auto-reducir si no entra; postres en 2 columnas en la misma hoja; espaciado fijo.
- Logo oficial (`frontend/public/riviera-hotel-logo.png`) en PDF de menú y planillas de liquidación, sin deformar proporciones.

**Herramientas de debug (intencionales, solo ADMIN)**
- FAB abajo-izquierda para simular la fecha del sistema (localStorage). Con debug activo, frontend **y** backend usan la fecha simulada como «hoy» (cobros, caja, dashboard, etc.).
  El backend solo respeta el header `X-Simulated-Today` si la sesión es de rol ADMIN.
- Simulación de rol en el FAB debug (sesión como ese rol en todo el sistema); no «previsualizar como» en el dashboard.
- FAB de reservas ficticias para generar/limpiar datos de prueba.

---

## 6. UI y diseño

Referencias, en orden: `frontend/src/styles/variables.css` (tokens canónicos) → `DESIGN.md` → `docs/guia-estetica.md` → `PRODUCT.md`.

- UI operativa, densa y profesional; menos nesting de divs/cards; una intención por bloque. Sin «vibe coding».
- **Sin emojis** en la interfaz (labels, tabs, alerts, tooltips, empty states, textos copiables). Íconos SVG (`react-icons`) sí,
  salvo en submenús de Configuración (solo texto). `aria-label`/`title` en botones solo-ícono.
- Navy `#3f5f8a` como único acento; sin azul Bootstrap/Material, gradientes violeta, glows ni sombras multicapa.
- Tipografía Segoe UI en escala pareja; no achicar textos ya chicos hasta ilegibles; no mezclar títulos enormes con body minúsculo.
- Sin textos lead/descriptivos bajo el título de cada página.
- Estados con color + texto (punto/clase CSS), nunca con emoji.
- Confirmaciones destructivas: modal in-app (`ConfirmationModal`), **nunca** `window.confirm`/`alert`.
- Layout de páginas nuevas: panel azul izquierdo navegable + contenido a la derecha (como Consultas/Reservas/Estado de cuentas), salvo indicación contraria.
- Listados y perfiles (cuentas, clientes, reservas, consultas, habitaciones): fondo blanco directo, sin card blanca sobre fondo gris.
- Chips de reserva clickeables en toda la app → detalle de reserva. En tablas, el cliente se muestra solo con nombre (sin email debajo).
- Aplanar secciones anidadas (p. ej. Config/Cargos y Tarifas).

**Escala tipográfica (decidido 2026-11-26):** la de `variables.css` — base 14px; small 12, medium 13, large 15,
xlarge 16, xxlarge 18. Usar siempre los tokens `--font-size-*`, no valores sueltos; no cambiar la escala sin decisión explícita.

**Impeccable** (`.cursor/skills/impeccable/`): usarlo solo en tareas de UI, con el comando pertinente (sin auditorías inútiles);
nunca en backend/DB/infra. Mantener coherencia con `DESIGN.md`/`PRODUCT.md` y preservar las decisiones visuales existentes.

---

## 7. Entorno local de Julián (Julian-Notebook)

- Antes de abrir/usar Chrome u otro navegador interactivo, o de tocar carpetas fuera del worktree de riviera-app, pedir permiso explícito y esperar confirmación.
- Control local: usar My Machines (Private Worker de Cursor), no `agent worker start`, salvo indicación contraria.

---

## 8. Documentación del repo

- **Vigente:** este archivo, `DESIGN.md`, `PRODUCT.md`, `docs/guia-estetica.md`, `docs/auditoria-cambios.md`, `docs/seed-usuarios-auth.md`,
  `backend/RESTORE-BACKUP.md`, READMEs de sistemas en `backend/` (verificar contra el código antes de confiar).
- **Histórica / desactualizada (no usar como fuente):** los `.md` sueltos de la raíz (`CORRECCION*`, `SNAP_*`, `TOOLTIP_*`, `NUEVO_SISTEMA_TARIFAS*`,
  `PROPORCIONES_*`, etc.), `PROJECT_MAP_FRONTEND.md` (componentes que ya no existen), `backend/tests/README.md`, `frontend/README.md` (plantilla Vite).
  La rama `cursor/preview-unificada-b4e1` que menciona `PRODUCT.md` ya no existe.
- Archivos de Cursor (`.cursor/rules/cuidado-db.mdc`, skill Impeccable): no modificar ni eliminar; su contenido está integrado acá.

**Pendientes conocidos (no tocar sin pedido):** `backend/.env` versionado; backups con datos personales versionados
(`backend/backups/`, `*.sql`, `Registro de pasajeros.xlsx`); archivos `.backup` en `frontend/src`; scripts `scripts/*.mjs` con rutas de Windows hardcodeadas.
