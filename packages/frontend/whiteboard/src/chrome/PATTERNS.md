# Workshop chrome patterns (WC0–WC3)

Behavior we copy; UI is Mosaic tokens, not Miro HTML/CSS.

| Anchor             | Size                                       | Notes                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left creation rail | 32–36 hit, inset 12px, vertically centered | Overlay on `edgeless-toolbar-widget`. Senior tools open as a hover column to the right. Auto-hide shifts **left**, not down. Sticky is a **new** quick tool (`priority` 95), between select (100) and frame (90). Stock Note stays “page section / text card”. |
| Zoom               | bottom-left 12px                           | Same `mosaicChromePanel` recipe. Must not overlap the rail on 1440 / 1280.                                                                                                                                                                                     |
| Selection bar      | 36px, floats on the object                 | Skin only. Sticky selection adds Mosaic pastel swatches (`wb-sticky-palette`), not the Affine note style panel. Tag picker (`wb-tag-picker`) is a `custom:affine:*` action.                                                                                    |
| Sticky note        | 218×200 (`NOTE_MIN_WIDTH` × 200)           | Preset of `affine:note` with `edgeless.kind: 'sticky'`. Butter paper, sticker shadow, radius 8, `displayMode: edgeless`. Click-to-place; no drag-to-size.                                                                                                      |
| Frame title        | 24px height, radius 8                      | Adopted CSS on `affine-frame-title` when the workshop flag is on. Accent border only when `[data-selected=true]`. Stock title stays 22px when the flag is off.                                                                                                 |
| Empty frame        | dashed 1px                                 | `affine-frame[data-empty=true]` uses a dashed `--affine-border-color` (same ink as `--mosaic-chrome-border`). Selected empty uses `--mosaic-accent`.                                                                                                           |
| App card           | radius 8, shadow-1, hit 36                 | Overlay on edgeless `affine:bookmark` and `affine:embed-linked-doc`. Not a new flavour.                                                                                                                                                                        |
| Object tags        | chips max 3 + overflow                     | `tags?: string[]` on sticky/frame/bookmark/linked-doc/`wb:record-card`. Catalog is workspace `meta.properties.tags.options`. Page notes are not tagged.                                                                                                        |
| Record card        | 280×136 pending chrome                     | Flavour `wb:record-card` (`databaseDocId`, `databaseId`, `rowId`, `compact`). Face/sync is the Kanban track. Slash lives in Content & Media and is hidden inside a sticky.                                                                                     |

**Slash on sticky:** hide groups `Page`, `Content & Media`, `Database`. Keep Basic / List / Align / Style (and date/actions). Headings and code in Basic are still listed.

**Connectors:** gfx notes stay `connectable = true`, so sticky→frame uses the stock connector tool.

**Do not copy:** Miro hex (`#4262ff`, `#ffd02f`, `#ff9999`), Roobert, mirotone, `@mirohq/*` icons.

**Fallback:** flag off, mobile, present mode, or edgeless viewport ≤1200 → stock bottom toolbar. The 1200px check is the editor viewport (same container as the stock zoom toolbar), not the window; collapse the app sidebar in e2e so 1440 / 1280 windows actually exceed the breakpoint.
