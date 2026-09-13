# Workshop chrome patterns (WC1)

Behavior we copy; UI is Mosaic tokens, not Miro HTML/CSS.

| Anchor | Size | Notes |
| ----- | ---- | ----- |
| Left creation rail | 32–36 hit, inset 12px, vertically centered | Overlay on `edgeless-toolbar-widget`. Senior tools open as a hover column to the right. Auto-hide shifts **left**, not down. |
| Zoom | bottom-left 12px | Same `mosaicChromePanel` recipe. Must not overlap the rail on 1440 / 1280. |
| Selection bar | 36px, floats on the object | Skin only. Do not pin it to the bottom on desktop. |

**Do not copy:** Miro hex (`#4262ff`, `#ffd02f`, `#ff9999`), Roobert, mirotone, `@mirohq/*` icons.

**Fallback:** flag off, mobile, present mode, or edgeless viewport ≤1200 → stock bottom toolbar. The 1200px check is the editor viewport (same container as the stock zoom toolbar), not the window; collapse the app sidebar in e2e so 1440 / 1280 windows actually exceed the breakpoint.

Sticky as a distinct rail button is WC2.
