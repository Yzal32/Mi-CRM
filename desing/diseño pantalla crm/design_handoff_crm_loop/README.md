# Handoff: Loop — CRM simple para negocios pequeños

## Overview
Loop es un CRM mobile-first para negocios pequeños (peluquerías, talleres, tiendas). Lo usan dos perfiles: la Dueña (Marta), que gestiona todo desde el móvil y el ordenador, y el Empleado (Carlos), que lo usa de pie, en el móvil o tablet, para atender clientes rápido. Este paquete cubre el flujo completo de alta/gestión de clientes, seguimientos, ventas, estadísticas, acceso y administración de empleados.

## About the Design Files
Los ficheros de `screens/` son **referencias de diseño en HTML** (Design Components de un editor visual) — prototipos que muestran el aspecto y comportamiento previstos, no código de producción para copiar tal cual. La tarea es **recrear estos diseños en el stack real del repositorio** (React, Vue, etc. — el que ya use el proyecto, o el que se decida si es un proyecto nuevo), usando los patrones y librerías propias de ese código. No se debe incrustar este HTML directamente en la app.

Cada pantalla incluye **dos versiones responsive** (móvil primero, luego escritorio) mostradas lado a lado dentro del mismo archivo a modo de catálogo — no son dos rutas distintas, son el mismo diseño en dos anchos de viewport.

## Fidelity
**Alta fidelidad (hifi)**: colores, tipografía, espaciado, radios y sombras finales, tomados de un Design System ya definido (ver "Design Tokens" abajo). Los prototipos son interactivos de verdad (estado real en JS): búsqueda en vivo, validación de formularios, apertura/cierre de hojas, etc. — reprodúcelo con la misma lógica, no solo el aspecto visual.

## Design System
Todos los tokens (colores, tipografía, espaciado, radios/sombras) y los 21 componentes base (Button, Input, SearchBar, Select, Switch, Textarea, Badge, Toast, FilterChips, IconButton, Sidebar, TabBar, TopBar, Avatar, Card, DetailRow, EmptyState, ListItem, StatCard, ConfirmDialog, Modal) están en `screens/_ds/`. El catálogo completo con sus estados está en `screens/Libreria de Componentes CRM.dc.html`. Úsalo como fuente de verdad de estilos antes de mirar cada pantalla individual.

Puntos clave del sistema:
- **Color**: definido en OKLCH, con tema claro y oscuro (`[data-theme="dark"]`). Fondo cálido, nunca blanco/gris puro. Primario: verde-teal cálido, un único color de acción primaria por pantalla. 5 pares de color de estado de cliente (Nuevo/Contactado/Interesado/Venta cerrada/Perdido) con el mismo brillo/saturación, solo cambia el tono. Alerta (seguimiento atrasado) en ámbar cálido — nunca rojo puro. Rojo reservado solo para errores de validación.
- **Tipografía**: una sola familia, Plus Jakarta Sans, pesos 400–800. Cuerpo mínimo 16px.
- **Espaciado**: escala de 4px (4 a 64).
- **Radios**: muy redondeados — 10px en controles pequeños, pill completo en botones/badges/chips, círculo en avatares.
- **Sombras**: muy sutiles, solo para separar tarjetas del fondo.
- **Iconos**: Lucide (línea, grosor 1.75, grid 24px), cargado por CDN.
- **Sin logo**: no hay marca gráfica, en su lugar se usa la palabra "Loop" en Plus Jakarta Sans 800.
- **Idioma y tono**: español informal ("tú"), vocabulario de tienda ("cliente", "seguimiento", "venta" — nunca "contacto", "tarea", "deal"). Sin jerga de software, sin emojis.

## Screens / Views

### 1. Iniciar sesión (`01 - Iniciar Sesion.dc.html`)
- **Propósito**: acceso individual por persona (Dueña o Empleado) a la app.
- **Layout**: tarjeta centrada, wordmark "Loop" + nombre del negocio, dos campos (Email, Contraseña) y botón primario "Entrar" a ancho completo.
- **Comportamiento**: si falta email o contraseña, error genérico bajo el formulario ("Revisa tu email y contraseña"). Si el email pertenece a una cuenta desactivada, error específico ("Esta cuenta ya no tiene acceso..."). Si todo es correcto, navega a "Hoy". No hay recuperación de contraseña ni autorregistro — las cuentas las crea la Dueña desde "Gestión de empleados".
- **Extra**: icono de sol/luna en la esquina que alterna el tema claro/oscuro de toda la pantalla (aplica `data-theme="dark"` sobre los tokens de color).

### 2. Hoy / Seguimiento (`02 - Hoy (Seguimiento).dc.html`)
- **Propósito**: pantalla de inicio tras el login. Resumen de seguimientos atrasados y de hoy.
- **Layout**: buscador arriba + botón "+" de acceso directo a "Nuevo cliente"; lista agrupada en "Atrasados" (fondo ámbar) y "Hoy" (fondo neutro), cada fila con avatar, nombre, tipo de acción (icono) y cuándo. Estado vacío ("¡Estás al día!") cuando no hay pendientes.
- **Comportamiento**: el buscador filtra la lista en vivo por nombre, recalculando ambos grupos y sus contadores; muestra "Sin resultados" si no hay coincidencias.
- **Navegación**: TabBar/Sidebar con Clientes, Hoy (activa), Estadísticas, Ajustes. Tocar una fila abriría la Ficha de cliente.

### 3. Lista de clientes (`03 - Lista de Clientes.dc.html`)
- **Propósito**: encontrar un cliente por nombre, teléfono o negocio, o dar de alta uno nuevo.
- **Layout**: buscador arriba, botón flotante "+" en móvil / botón "Nuevo cliente" en escritorio, lista de clientes (avatar, nombre, badge de estado, icono de seguimiento pendiente/atrasado si aplica). Estado vacío con CTA "Añadir cliente".
- **Comportamiento**: filtro en vivo por nombre, teléfono o negocio.
- **Navegación**: viene de "Hoy"; toca un cliente → Ficha de cliente; "+" → Nuevo cliente.

### 4. Nuevo cliente (`04 - Nuevo Cliente.dc.html`)
- **Propósito**: alta rápida de cliente (menos de 30 segundos).
- **Layout**: Nombre y Teléfono destacados arriba (lo esencial); separador "Opcional"; debajo Email, Negocio, Canal de origen (selector de 6 opciones: Web, Redes sociales, Email, WhatsApp, Recomendación, Visita en tienda) y Estado (5 opciones, "Nuevo" por defecto). Botón "Guardar" a ancho completo.
- **Validación**: si no hay teléfono ni email, error de formulario ("Necesitas al menos un teléfono o un email..."). Si el teléfono ya existe, error específico bajo el campo Teléfono.
- **Comportamiento**: al guardar con éxito, navegaría a la Ficha del cliente recién creado.

### 5. Ficha de cliente (`05 - Ficha de Cliente.dc.html`) — la pantalla más completa
- **Propósito**: consultar y actualizar todo sobre un cliente. Jerarquía: lo urgente (nota destacada, próximo seguimiento) va primero, sin scroll.
- **Layout** (de arriba a abajo): cabecera (avatar, nombre, badge de estado editable en un paso mediante selector compacto, botón de lápiz que abre una hoja de edición con Nombre/Teléfono/Email/Canal, teléfono y email, canal de origen) → nota destacada fija (fondo distinto, con botón para quitarla) → bloque de próximo seguimiento (fecha, tipo con icono, botones Completar/Descartar/Reprogramar; o estado vacío con botón "Marcar seguimiento") → lista de notas anteriores (con quién la escribió — Marta o Carlos — y fecha; botón "Añadir nota" con opción de marcarla como destacada) → historial de compras (descripción, importe, fecha; enlace a "Registrar venta").
- **Comportamiento clave**:
  - Cambiar el estado del cliente es un solo paso (select junto al badge).
  - Añadir una nota destacada cuando ya hay otra pide confirmación antes de sustituirla; la antigua pasa a la lista normal, sin quedar marcada de ninguna forma.
  - Reprogramar seguimiento: hoja con atajos (Mañana / En 3 días / En 1 semana) **y** selector de fecha libre, ambos siempre disponibles.
  - Todas las hojas (editar cliente, añadir nota, reprogramar) son bottom-sheets en móvil y diálogos centrados en escritorio.
- **Layout escritorio**: 2 columnas — cabecera + nota destacada + seguimiento a la izquierda; notas + ventas a la derecha.
- **Navegación**: llega desde Hoy, Lista de clientes, o tras guardar en Nuevo cliente/Registrar venta. Volver atrás regresa a la pantalla de origen.

### 6. Registrar venta (`06 - Registrar Venta.dc.html`)
- **Propósito**: apuntar una venta justo tras cerrarla, para el cliente de la ficha abierta.
- **Layout**: nombre del cliente fijo arriba (no editable aquí), tres campos (descripción, importe, fecha — hoy por defecto), botón "Guardar venta".
- **Validación**: descripción e importe obligatorios (mínimo, con mensajes de error propios).
- **Comportamiento**: al guardar, confirma y mostraría la venta ya en el historial de la ficha; vuelve a la Ficha de cliente. Volver atrás sin guardar también regresa allí.

### 7. Estadísticas (`07 - Estadisticas.dc.html`)
- **Propósito**: registro global de ventas de todos los clientes.
- **Layout**: chips de periodo (Hoy / Esta semana / Este mes / Histórico, "Hoy" por defecto) que controlan un resumen de dos StatCard (Facturado + nº de Ventas); debajo, buscador por cliente y lista de ventas (avatar, cliente, descripción, fecha, importe).
- **Comportamiento**: el resumen y la lista se recalculan según el periodo elegido y el texto buscado. Tocar una venta llevaría a la ficha de ese cliente.
- **Navegación**: sección propia del menú principal (Estadísticas / stats).

### 8. Gestión de empleados (`08 - Gestion de Empleados.dc.html`)
- **Propósito**: panel de administración — solo lo ve la Dueña; los Empleados no tienen acceso a esta pantalla.
- **Layout**: rail de administración propio (distinto del menú principal), lista de empleados (nombre, email, selector de Rol — Empleado/Administradora, badge Activo/Inactivo, menú ⋯ con Desactivar/Reactivar y Restablecer contraseña). Botón "Añadir empleado" abre una pantalla propia con Nombre, Email, Contraseña inicial y Rol.
- **Validación**: email duplicado al añadir empleado → error específico bajo el campo.
- **Comportamiento**: desactivar pide confirmación ("¿Quitarle el acceso a [nombre]? Podrás reactivarlo más adelante"); reactivar es inmediato. Restablecer contraseña genera una temporal al momento, mostrada con aviso de que debe cambiarla en su primer acceso. Solo la Dueña puede cambiar el rol de alguien.

### 9. Mi cuenta (`09 - Mi Cuenta.dc.html`)
- **Propósito**: espacio mínimo y discreto desde el que cualquier usuario con sesión iniciada (Marta o Carlos) cambia su propia contraseña, sin depender de que la Dueña se la resetee. Se accede desde la pestaña "Ajustes" de la navegación principal.
- **Layout**: tarjeta con avatar, nombre y email del usuario conectado; debajo, dos filas — "Cambiar contraseña" y "Cerrar sesión". No incluye edición de nombre o email.
- **Comportamiento**: "Cambiar contraseña" abre una hoja (bottom-sheet en móvil, diálogo centrado en escritorio) con tres campos — contraseña actual, nueva y confirmación. Si la contraseña actual no coincide o las dos contraseñas nuevas no coinciden entre sí, error de validación bajo el campo correspondiente. Al guardar con éxito, confirma con un aviso breve sin cerrar la sesión.
- **Nota de proceso**: pantalla añadida el 2026-08-08, después de las 8 originales — su tarea de diseño (PRO-52 en Linear) ya existía desde el 2026-08-07, pero el archivo no se había generado. Ver "CRM, cambios y mejoras" en Notion.

## Design Tokens
Ver `screens/_ds/tokens/` (`colors.css`, `typography.css`, `spacing.css`, `radii-shadows.css`) para los valores exactos en OKLCH — no reproducir aproximaciones, usar esos valores literales (o su equivalente hex/rgb si el stack destino no soporta OKLCH).

## Assets
No hay imágenes ni logotipo — todo el sistema visual es color plano + tipografía + iconos Lucide (cargados desde CDN, ver `_ds_bundle.js`). Los avatares son iniciales sobre un círculo de color, nunca fotos.

## Files
- `screens/Libreria de Componentes CRM.dc.html` — catálogo de los 14 componentes de producto (badges, formularios, tarjetas de nota/venta, etc.) en sus estados (vacío, con contenido, error).
- `screens/Mapa de Navegacion CRM.dc.html` — mapa de navegación entre pantallas.
- `screens/01` a `09` — las 9 pantallas de producto descritas arriba, cada una con su versión móvil y de escritorio.
- `screens/_ds/` — Design System completo (tokens, componentes fuente en JSX de referencia, guía).
