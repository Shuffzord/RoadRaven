# Design System Documentation: RoadRaven

## 1. Overview & Creative North Star

**Creative North Star: "The Engineered Canvas"**

RoadRaven's design balances IDE-level information density with modern visual polish. It takes structural cues from VS Code and JetBrains (sidebar, panels, status bar) but applies Figma/Linear-inspired refinements: rounded corners, subtle shadows, smooth transitions. The result is a professional tool that doesn't feel cold.

**Key Principles:**
- **Canvas-first**: The tree visualization is the hero — all chrome supports it
- **IDE structure, modern finish**: Sidebar + panels + status bar, but with softer edges and depth cues
- **Configurable density**: Node edge style (rounded/sharp), node gap (compact/default/spacious), connector style (curved/straight) are user preferences
- **Functional typography**: Monospaced fonts for IDs and metadata; clean sans-serif for UI
- **Smooth feedback**: 150-200ms transitions on hover/panel slide; instant theme switching

---

## 2. Color Palette & Roles

### Dark Theme (Default)
- **Background Root** (`#131313`): Deepest level of the application
- **Surface Container** (`#1b1b1c`): Sidebar, side panel, drawers
- **Surface Elevated** (`#252527`): Hover states, active elements, toolbar containers
- **Surface High** (`#353535`): Tooltips, dropdowns, highest elevation

### Text
- **Primary** (`#e0e0e0`): Main text, labels
- **Secondary** (`#c6c6c6`): Body copy, inactive labels
- **Muted** (`#858585`): Placeholder text, micro metadata

### Borders
- **Subtle** (`rgba(255,255,255,0.1)`): Standard 1px separator
- **Active** (`#ffffff`): Selection rings, active indicators

### Accent
- **Action Primary** (`#4a9eff`): Used sparingly — selected node ring, primary CTA, active nav highlight

### Status Colors
- **Not Started / Todo** (`#6b6b6b`): Muted gray
- **In Progress** (`#4a9eff`): Blue (matches accent)
- **Completed** (`#4ade80`): Green
- **Blocked** (`#ef4444`): Red

### Light Theme Overrides
- Background: `#ffffff`, Surface: `#f5f5f5`, Text: `#1a1a1a`, Borders: `rgba(0,0,0,0.1)`
- Same accent blue, same status colors

### High Contrast Theme Overrides
- Background: `#000000`, Surface: `#0a0a0a`, Text: `#ffffff`, Borders: `rgba(255,255,255,0.4)` at 2px
- Accent: `#60b0ff` (brighter for visibility), status colors boosted saturation

---

## 3. Typography Rules

### Font Families
- **UI Primary**: `Inter` — labels, navigation, core text
- **Technical/Code**: `Space Grotesk` — node IDs, timestamps, metadata

### Hierarchy
- **Heading**: 14px, Bold (700), Line height 1.2
- **Body**: 13px, Regular (400), Line height 1.5
- **Label**: 11px, Regular (400), Line height 1.2, Uppercase, tracking-wider
- **Micro**: 10px, Regular (400), Line height 1.2, Uppercase

---

## 4. Component Styling

### Nodes (Tree Elements)
- **Shape**: Rounded corners (8px) by default; sharp (2px) as configuration option
- **Border**: 1px solid Border Subtle
- **Background**: Surface Container
- **Status Indicator**: 4px vertical bar on left edge using status colors (the defining visual element)
- **Hover**: Subtle shadow elevation + border brightening (150ms transition)
- **Selected**: Accent-colored border ring (1px)
- **Status badge**: Small pill with colored dot + status text below title

### Side Panel
- **Placement**: Right-docked, 340px width, slides in on node click (200ms ease-out)
- **Layout**: Header (title + close), metadata, divider, notes section
- **Separation**: 1px border on left edge

### Top Bar
- **Height**: 48-52px
- **Layout**: App name | New + Open buttons | Search bar | View controls | Theme switcher + Settings
- **Style**: Flat, clean, icon-forward with text labels

### Sidebar
- **Width**: 220px, collapsible to 48px icon-only strip (Ctrl+B)
- **Sections**: Recent Files, Navigator (mini tree outline), Settings
- **Separation**: 1px border on right edge

### Status Bar
- **Height**: 32px
- **Layout**: File path (left) | Node count (center) | Zoom + theme + connection (right)

---

## 5. Layout & Spacing
- **Base Unit**: 4px grid
- **Node gap**: Configurable — compact / default / spacious presets
- **Canvas**: Dot-grid background (40px spacing, subtle opacity)
- **Connector lines**: Curved bezier (default) or straight (configurable)

---

## 6. Depth & Elevation
- **Shadows**: Subtle, used sparingly on hover states and floating panels (not heavy box-shadows)
- **Containment**: Primarily via 1px borders and tonal background shifts
- **Layering**: Panels are docked; config panel and tooltips float

---

## 7. Design Reference

**Canonical reference**: `variant-c-merged.html` in this directory. Open in browser to see the interactive mockup with working theme switching, node configuration, and panel interactions.
