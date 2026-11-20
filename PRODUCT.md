# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Recepcionistas, administración y gerencia del Hotel Riviera (Mar del Plata). Trabajan en mostrador o back-office con el Libro de reservas, consultas, cobros, consumos y configuración del hotel.

*[Inferido del repo y preferencias del Project; no hubo entrevista viva en esta sesión de worker.]*

## Product Purpose

Sistema PMS (gestión hotelera) para operar reservas, habitaciones, tarifas, cargos, pagos, menú/consumos y configuración del establecimiento. Éxito = tareas diarias de recepción y admin sin fricción, con datos coherentes y auditoría.

*[Inferido.]*

## Positioning

Software operativo propio del Hotel Riviera: denso, profesional y orientado a workflow de hotel, no SaaS genérico ni landing marketing.

*[Inferido.]*

## Operating Context

App React + API Node/Prisma. Pantallas clave: Libro de reservas, consultas, estado de cuentas/pagos, configuración (tarifas, menú, promociones, medios de pago, habitaciones). Roles: admin, recepción, gerencia. Preview unificada en rama `cursor/preview-unificada-b4e1`.

## Capabilities and Constraints

- UI operativa densa; tipografía Segoe / escala compacta; primary navy `#3f5f8a`.
- Sin emojis en interfaz; iconos SVG (`react-icons`); submenús de Config solo texto.
- Confirmaciones destructivas: modal in-app (no `window.confirm`/`alert`).
- Design vocabulary para agentes: Impeccable; polish debe respetar el design system PMS existente (`frontend/src/styles/variables.css`, guía estética del Project).
- No mezclar DBs v1/v2; schema solo con backup + migraciones.

## Brand Commitments

- Nombre: Hotel Riviera / Riviera PMS.
- Logo: assets `logo-hotel-primary.png` / variantes azul-blanco.
- Look: navy operativo, fondos neutros `#f4f5f7` / blanco; sin violet gradients ni “AI slop”.

## Evidence on Hand

- Tokens: `frontend/src/styles/variables.css`
- Guía estética Project: docs/guia-estetica.md (store del Project)
- Preferencias de UI/auth/config en memoria del Project

## Product Principles

1. Operar primero: una intención clara por pantalla/sección.
2. Densidad legible: escala tipográfica pareja, sin nesting decorativo.
3. Coherencia de sistema: tokens y patrones compartidos antes que one-offs.
4. Honestidad de estado: loading / vacío / error / éxito visibles y accionables.
5. No inventar claims, testimonios ni datos de marca.

## Accessibility & Inclusion

Controles tocables en mobile; foco visible; contraste AA en texto y estados; labels asociados a inputs. Sin requisito WCAG formal documentado más allá de las convenciones del frontend.

*[Inferido.]*
