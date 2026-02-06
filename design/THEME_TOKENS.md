# Admin Portal Theme Tokens (Light/Dark)

Use these design tokens to keep the portal sleek, modern, and consistent across light/dark modes. Tokens can be mapped to Tailwind config or a custom theming system.

## Color
- Primary: #2563EB (light) / #60A5FA (dark accents)
- Surface: #FFFFFF (light) / #0F172A (dark)
- Surface Muted: #F8FAFC (light) / #111827 (dark)
- Border: #E2E8F0 (light) / #1F2937 (dark)
- Text Primary: #0F172A (light) / #E5E7EB (dark)
- Text Secondary: #475569 (light) / #9CA3AF (dark)
- Success: #10B981
- Warning: #F59E0B
- Danger: #EF4444
- Info: #0EA5E9
- Chart Palette: [#2563EB, #10B981, #F59E0B, #EF4444, #6366F1, #14B8A6]

## Typography
- Font Family: "Inter", system sans (or your chosen brand font)
- Base Size: 16px; Scale: 1.125
- Weights: 400, 500, 600

## Spacing & Layout
- Spacing scale: 4, 8, 12, 16, 20, 24, 32 px
- Radius: 10px cards; 6px inputs/buttons
- Elevation: cards use subtle shadow (light) or border + slight shadow (dark)

## Components
- Cards: Surface + border; hover lift; padding 16–20px
- Buttons: Primary/secondary/ghost; focus ring #2563EB at 1.5px
- Inputs: Subtle border; focus ring; filled background in dark mode (#111827)
- Nav: Left rail with active indicator bar; collapse/expand; icons with labels
- Tables: Compact density option; row hover; zebra optional
- Charts: Match chart palette; gridlines low-contrast; tooltips use surface-muted
- Map: Use dark tiles in dark mode; control chrome matches theme

## Mode Handling
- Default to system preference; allow manual toggle; persist per user.
- Provide CSS variables or tokens for both modes and ensure contrast (WCAG AA).