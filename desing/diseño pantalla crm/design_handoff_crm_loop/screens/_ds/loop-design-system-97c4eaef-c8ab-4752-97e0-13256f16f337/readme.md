# Loop — Design System

Loop is a simple CRM for small businesses (shops, salons, repair services — any small team tracking customers and follow-ups). Two user types: Marta, the owner, works from a computer and her phone; Carlos, an employee, works standing at the counter on a phone or tablet. Neither has prior experience with business software, so the product avoids software jargon entirely and stays mobile-first.

**Source:** this design system was built directly from a written specification supplied by the user (color tokens, typography, spacing, radii/shadows, icon set, and the full 21-component inventory with usage notes) — no Figma file or codebase was attached. Every token value and component below is taken verbatim from that spec. No logo was provided (see "Iconography" below).

## Principles

- **No jargon.** Shop language ("cliente", "seguimiento", "venta"), never professional software vocabulary.
- **Mobile-first.** Touch targets ≥44px; used standing, one-handed.
- **Warm and approachable.** Pastel colors, very rounded corners, direct tone — no corporate aesthetic.
- **No brand imagery.** There is no logo. Wherever a mark would go, the word "Loop" is set in type instead.

## Content fundamentals

- **Language:** Spanish, informal "tú" register, direct and short. Labels read like something a shop owner would say out loud: "Seguimiento: hoy", "Aún no tienes clientes", "¿Qué ha dicho el cliente?".
- **Vocabulary:** always "cliente" (never "contacto" or "lead"), "seguimiento" (never "tarea" or "recordatorio"), "venta" (never "oportunidad" o "deal"). No abbreviations, no technical CRM terms.
- **Buttons/actions:** imperative, one action, one verb — "Guardar", "Añadir cliente", "Eliminar cliente", "Llamar".
- **Errors:** plain and specific ("Introduce un teléfono válido"), always shown as text under the field, never color alone.
- **Empty states:** reassuring, tell the person exactly what to do next ("Añade tu primer cliente para empezar a hacer seguimiento").
- **Emoji:** never used. Icons carry all non-text signal.

## Visual foundations

- **Color:** OKLCH throughout, defined for light and `[data-theme="dark"]`. Background is a warm, low-saturation off-white — never pure white/gray. Primary is a warm teal-green used for the single primary action per screen. Five client-status pairs (`--status-*-bg/text`) share the same lightness/chroma and differ only in hue, so they read as a consistent family. Overdue follow-ups use a warm amber (`--color-alert-*`) — deliberately never pure red, to stay urgent without being aggressive; red is reserved for form validation errors only.
- **Typography:** one family, Plus Jakarta Sans (geometric, warm), across every weight from 400–800. A small mobile-first scale: screen-title and section-title use `clamp()` to grow slightly on larger screens; body text is 16px minimum.
- **Spacing:** strict 4px base scale (4 to 64). Reference breakpoints at 640px (tablet) and 1024px (desktop) — used as literals in `@media`, not custom properties.
- **Radii:** very rounded throughout — 10px small controls up to a full pill for buttons/chips/badges and a circle for avatars. This is the strongest signature of the "warm, non-corporate" feel.
- **Shadows:** extremely subtle — just enough to lift a card off the background (`shadow-sm`), never a strong drop shadow. No inner shadows, no glows.
- **Borders:** thin (1px), low-contrast, used to separate surfaces more than shadows are.
- **Backgrounds:** flat color only — no gradients, no textures, no photography, no illustration. The warm off-white background plus white/near-white cards is the entire background system.
- **Animation:** not specified in the source spec — keep transitions minimal and functional (short opacity/color fades on hover, no bounce or elaborate motion) until the brand defines more.
- **Hover/press states:** hover darkens (primary → primary-hover → primary-active on press) or tints a soft background (`--color-primary-soft`) for secondary/ghost buttons. No scale/shrink effects.
- **Cards:** soft 1px border + very rounded corners (`--radius-lg`) + `--shadow-sm`. No colored left-border accents.
- **Overlays:** two distinct shapes on purpose — `Modal` is a bottom sheet (thumb reach, editing actions); `ConfirmDialog` is centered (important/destructive confirmations) — so the two never look alike.
- **Transparency/blur:** only a flat semi-transparent scrim (`oklch(0.2 0.01 80 / 0.45)`) behind modals/dialogs; no backdrop blur.
- **Imagery:** none in the source spec — no photography, illustration, or generic imagery to copy in. Avatars are initials on a soft tinted circle, never photos (a confirmed product decision, not a placeholder).

## Iconography

- **System:** [Lucide](https://lucide.dev) (MIT), loaded from CDN (`https://unpkg.com/lucide@latest/dist/umd/lucide.js`) — not a custom icon font or SVG sprite, since none was provided.
- **Style:** line icons, 1.75 stroke weight, 24px grid.
- **Set in use:** `phone`, `message-circle` (generic chat glyph standing in for WhatsApp — not the WhatsApp logo), `mail`, `map-pin`, `search`, `plus`, `pencil`, `arrow-left`, `calendar`, `calendar-check`, `wallet`, `x`, `users`, `bar-chart-2`, `settings`, `check`, `alert-circle`, `trash-2`, `help-circle`.
- **Emoji:** never used.
- **No logo:** the source spec explicitly has no brand mark. Every place a logo would normally sit (nav header, thumbnail, marketing) instead shows "Loop" set in Plus Jakarta Sans 800. If a real logo exists, share it and this system should be updated to use it in place of the wordmark.

## Intentional additions

Every component below comes directly from the source spec's 21-component inventory — nothing was added beyond it.

## Index

- `styles.css` — root stylesheet, imports everything in `tokens/`.
- `tokens/colors.css`, `typography.css`, `spacing.css`, `radii-shadows.css` — all design tokens (light + dark).
- `components/foundation/` — Icon.
- `components/forms/` — Button, Input, SearchBar, Select, Switch, Textarea.
- `components/feedback/` — Badge, Toast.
- `components/navigation/` — FilterChips, IconButton, Sidebar, TabBar, TopBar.
- `components/data/` — Avatar, Card, DetailRow, EmptyState, ListItem, StatCard.
- `components/overlay/` — ConfirmDialog, Modal.
- `guidelines/` — foundation specimen cards (colors, type, spacing, radii/shadows, brand wordmark).
- `ui_kits/loop/index.html` — click-through mobile CRM: client list (overdue first), client detail, add-client and log-call modals, delete confirmation, toast.
- `thumbnail.html` — project homepage tile.
- `SKILL.md` — portable skill file for using this system in Claude Code.

## Components (21)

foundation: Icon
forms: Button, Input, SearchBar, Select, Switch, Textarea
feedback: Badge, Toast
navigation: FilterChips, IconButton, Sidebar, TabBar, TopBar
data: Avatar, Card, DetailRow, EmptyState, ListItem, StatCard
overlay: ConfirmDialog, Modal

## Screen coverage

| Screen | Key components |
|---|---|
| Client list | TopBar, SearchBar, FilterChips, ListItem (Avatar + Badge) |
| Client detail | TopBar, Avatar, Badge, IconButton, DetailRow |
| Add/edit client | Modal or full screen: Input, Select, Textarea, Button |
| Log call/note | Modal, Textarea, Button |
| Today / daily summary | StatCard, ListItem, EmptyState |
| Stats | StatCard |
| Settings | Switch, Sidebar/TabBar |
| Delete client / destructive action | ConfirmDialog |
| Non-destructive confirmation | Toast |
| Navigation between sections | TabBar (mobile) / Sidebar (desktop) |
