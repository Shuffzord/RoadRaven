web application/stitch/projects/12324493918104232168/screens/54b6b24930a54d97adf766540351a758
# Design System Documentation: Monolith IDE (High-Utility)

## 1. Overview & Creative North Star
**Creative North Star: "The Terminal Architect"**

The Monolith IDE design system is built for precision, utility, and speed. It rejects the soft, rounded aesthetic of consumer web apps in favor of a "no-nonsense" professional tool environment. It draws inspiration from modern IDEs (VS Code, JetBrains), technical CAD software, and system terminals.

**Key Principles:**
- **Information Density**: Prioritize data over whitespace.
- **Visual Precision**: Use 1px borders for containment rather than shadows.
- **Functional Typography**: Monospaced fonts for IDs and metadata; clean, tight sans-serif for UI.
- **Tactile Feedback**: Instant, discrete shifts in color rather than slow, bouncy animations.

---

## 2. Color Palette & Roles

### Primary Surfaces
- **Background Root** (`#131313`): The deepest level of the application.
- **Surface Container** (`#1b1b1c`): Sidebars, drawers, and secondary panels.
- **Surface Elevated** (`#2a2a2a`): Hover states, active nodes, and tooltips.

### Accents & Semantic
- **Action Primary** (`#ffffff`): High-contrast text and primary icons.
- **Border Subtle** (`rgba(255, 255, 255, 0.1)`): The standard 1px separator.
- **Border Active** (`#ffffff`): Selection rings and active tab indicators.
- **Status Todo** (`#858585`): Muted gray for pending work.
- **Status In-Progress** (`#e2c08d`): Warm gold for active monitoring.
- **Status Done** (`#81b88b`): Muted green for completion.
- **Status Blocked** (`#c74e39`): Desaturated red for errors.

---

## 3. Typography Rules

### Font Families
- **UI Primary**: `Inter` (Sans-serif) - used for labels, navigation, and core text.
- **Technical/Code**: `Space Grotesk` or `JetBrains Mono` (Monospaced) - used for node IDs, timestamps, and metadata.

### Hierarchy
- **Heading/Title**: 14px, Bold, Uppercase, Tracking-tighter.
- **Body Standard**: 13px, Regular, Leading-normal.
- **Technical Label**: 11px, Monospace, Uppercase, Tracking-wider.
- **Micro Metadata**: 10px, Monospace, Muted opacity (0.6).

---

## 4. Component Stylings

### Nodes (Tree Elements)
- **Shape**: Rect-0 (sharp corners).
- **Border**: 1px solid Border Subtle.
- **Background**: Surface Container.
- **Active State**: 1px solid Border Active + Subtle scaling (1.02x).
- **Status Indicator**: A 4px vertical bar on the left edge using the semantic status colors.

### Side Panel (The "Editor Pane")
- **Placement**: Right-docked.
- **Layout**: Header, Metadata Table, Markdown Zone.
- **Separation**: Vertical 1px border separating it from the tree canvas.
- **Inputs**: Darkened background (`#0e0e0e`) with 1px border; sharp corners.

### Buttons (Utility Icons)
- **Small/Icon-only**: 32x32px.
- **Hover**: Background shift to Surface Elevated.
- **Primary Action (e.g., DEPLOY)**: White background, Black text, Bold, sharp corners.

---

## 5. Layout & Spacing
- **Base Unit**: 4px grid.
- **Padding**: 4px, 8px, 12px (Avoid 16px+ unless for major section breaks).
- **Canvas**: Dark grid pattern (`#1e1e1e` dot grid) to suggest a technical workspace.
- **Navigation**: Top-docked slim bar (48px height) for global actions and project context.

---

## 6. Depth & Elevation
- **Shadows**: None.
- **Containment**: Exclusively handled via 1px borders and tonal background shifts.
- **Layering**: Sidebars and panels are "docked" rather than floating to maintain the IDE feel.