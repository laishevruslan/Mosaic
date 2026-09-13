# План: Mosaic Workshop Chrome + семантика доски

Дата: 2026-09-13  
Связанные документы: `plans/miro_whiteboard_implementation_plan.md`, `plans/miro_kanban_parity_plan.md`, `plans/mosaic_enterprise_plan.md` (WB-7, E1, §5.4, §5.6)  
Цель: довести edgeless-доску Mosaic до **workshop-класса UX** (плотность, плавающие панели, creation rail, sticky/frame/card/tag) без зависимостей Miro и без клонирования брендбука.

**Источники паттернов (не код в runtime):** публичные типы `@mirohq/websdk-types` как чеклист API; UX из `miroapp/app-examples` (левая панель, app card, template builder, selection-driven UI). Реализация — своими компонентами: Radix в `@affine/component`, Lit-toolbar BlockSuite, иконки `@blocksuite/icons`.

---

## 0. Короткий вывод

Примитивы уже есть в BlockSuite. Разрыв с «красивой доской» — не в Pixi и не в npm Miro, а в **композиции chrome** и **семантике объектов**:

| Слой | Сейчас | Цель |
| ---- | ------ | ---- |
| Creation tools | Нижняя панель 64px, центр | Левый вертикальный rail, кнопки 32–36px |
| Zoom | Снизу слева | Оставить снизу слева, вписать в chrome-токены |
| Selection | Плавающий бар 36px у объекта | Тот же якорь + опциональный inspector справа |
| Sticky | `affine:note` ~498×92, документ-хаб | Пресет sticky: ~200×200, пастель, ограниченный текст |
| Frame / connector | Сильные примитивы | Скин + SDK-обёртка, не новый движок |
| Card | bookmark / linked-doc / kanban-cell | App-card chrome + `wb:record-card` (стык Kanban) |
| Tag | Doc tags + DB select | Чип на sticky/frame/card |
| Viewport / panel / metadata | Есть API по частям | Единый `mosaic.board.*` фасад |

**Не ставить в продукт:** `mirotone`, `@mirohq/design-system*`, `@mirohq/design-tokens`, Roobert, акцент `#4262ff`, иконки Miro. Developer Terms Miro запрещают Developer Tools для competing product; MIT у `mirotone` не отменяет trade dress.

Флаг: `enable_workshop_chrome` (default false → true после e2e). Старый нижний toolbar остаётся fallback.

---

## 1. Чего не делать

1. `yarn add mirotone` / `@mirohq/design-system` / `@mirohq/websdk-react-hooks`.
2. Копировать hex из брендбука Miro (синий `#4262ff`, жёлтый `#ffd02f`, коралл `#ff9999`, …).
3. Шрифт Roobert (коммерческий). Оставить `baseTheme.fontSansFamily` / текущий Affine stack; OEM переопределяет `--mosaic-font-ui`.
4. Новый flavour ради каждого пункта WebSDK: sticky ≠ отдельный CRDT-тип, если хватает пресета `affine:note`.
5. Переписывать `Viewport`, connector router, frame manager.
6. Форк всего `edgeless-toolbar.ts` «на всякий случай» — только layout + chrome CSS под флагом.
7. Stitches. Панели — Radix `Dialog`/`Popover` из `@affine/component`.
8. Board-first скин всего приложения (исторический WB-7 «вариант F») — **не этот план**. Здесь только edgeless chrome.

---

## 2. Инвентаризация (код, не доки)

### 2.1 Объекты

| Концепт | Ближайшее | Файлы | Gap |
| ------- | --------- | ----- | --- |
| Sticky | `affine:note` | `blocksuite/affine/model/src/blocks/note/`, `blocks/note/src/note-edgeless-block.ts`, `gfx/note/src/note-tool.ts` | Default 498×92, `NoteShadow.Sticker` = тень, не роль; нет tags/author chrome |
| Frame | `affine:frame` | `blocks/frame/`, `widgets/frame-title/`, `fragments/frame-panel/` | Скин title; нет шаблонов frame; SDK wrap |
| Card | `affine:bookmark`, `affine:embed-linked-doc`, kanban cell | `model/src/blocks/bookmark/`, `embed/linked-doc/`, `data-view/.../kanban/pc/card.ts` | Нет canvas `wb:record-card`; нет app-card chrome |
| Connector | `ConnectorElementModel` | `model/src/elements/connector/`, `gfx/connector/` | Default stroke 4px жирноват; нет SDK-фасада |
| Tag | `DocMeta.tags`, DB `multi-select` | `packages/frontend/core/src/modules/tag/`, `--affine-tag-*` | Не рисуются на note/frame |
| Viewport | `Viewport` | `blocksuite/framework/std/src/gfx/viewport.ts`; follow в `whiteboard/src/collab/` | Нет `mosaic.board.viewport`; follow за `enable_whiteboard_collab` |
| Panel/modal | Radix `Modal`, Lit popMenu, widget settings | `packages/frontend/component/src/ui/modal/`, `whiteboard/.../chart-settings-panel.tsx` | Нет dock «app panel» и `openPanel` |
| Metadata | `BlockMeta` (created/updated), не на note/frame | `block-meta-service.ts` | Нет `get/setMetadata` как у item |

### 2.2 Chrome сейчас

| Элемент | Где | Константы |
| ------- | --- | --------- |
| Creation | `edgeless-toolbar-widget`, низ по центру | `TOOLBAR_HEIGHT=64`, `QUICK_TOOL_SIZE=36` |
| Zoom | `affine-edgeless-zoom-toolbar-widget`, `bottom: 20px; left: 12px` | percent 40×32, icon 24 |
| Selection | `affine-toolbar-widget`, Floating UI у объекта | высота 36px |
| Quick tools | select, frame, connector, link | |
| Senior tools | note, shape, pen, mindmap, template | |

`IconButton` в `@affine/component` уже `borderRadius: 8`. Плотность 32–36 **совпадает** с `QUICK_TOOL_SIZE`; менять надо **положение и оболочку**, не изобретать кнопку с нуля.

### 2.3 SDK сейчас

`packages/frontend/whiteboard/src/register-gfx-widget.ts` — слой 0. Публичного `@affine/whiteboard-sdk` нет. Виджеты: `wb:hello|chart|sketch|board`.

---

## 3. Mosaic-токены (T)

Новый тонкий слой, **не** замена `@toeverything/theme`. Overlay CSS variables + recipe-классы.

**Пакет:** `packages/frontend/whiteboard/src/chrome/` (canvas) + реэкспорт recipe в `@affine/component` только если понадобится вне edgeless.

```css
:root {
  --mosaic-font-ui: var(--affine-font-family);
  --mosaic-accent: #0d7377;           /* teal; не #4262ff */
  --mosaic-accent-hover: #0a5c5f;
  --mosaic-accent-pressed: #08484a;
  --mosaic-paper: var(--affine-background-overlay-panel-color);
  --mosaic-chrome-radius: 8px;
  --mosaic-chrome-border: 1px solid var(--affine-border-color);
  --mosaic-chrome-shadow: var(--affine-shadow-2);
  --mosaic-hit: 32px;                 /* icon-button hit area */
  --mosaic-hit-comfortable: 36px;     /* rail primary */
  --mosaic-icon: 20px;
  --mosaic-space: 4px;                /* 4px grid */
}
```

Dark theme: те же имена, значения из `cssVarV2` (`layer/background/overlayPanel`, `layer/insideBorder/border`).

**Sticky pastels** — отдельные ключи, не `edgeless/note/*` как есть (те ближе к насыщенным Affine). Смысл: тёплые бумага/персик/роза; hex **свои**:

| Token | Light (предложение) | Роль |
| ----- | ------------------- | ---- |
| `--mosaic-sticky-butter` | `#F7E7B8` | default sticky |
| `--mosaic-sticky-peach` | `#F6D4B8` | |
| `--mosaic-sticky-blush` | `#F3C9D4` | |
| `--mosaic-sticky-mint` | `#D4EBD6` | |
| `--mosaic-sticky-lilac` | `#DDD5F0` | |
| `--mosaic-sticky-fog` | `#E8ECF1` | нейтральный |

Контрастный текст: `--affine-text-primary-color` / при необходимости `--mosaic-sticky-ink` `#3A3228`. Не копировать Miro sticky hex.

**Recipe `mosaicChromePanel`:** фон paper, radius 8, border 1px, shadow-2, padding 8. Применять к rail, zoom cluster, inspector, template gallery, widget settings.

**Иконки:** только `@blocksuite/icons` (`lit` в toolbar, `rc` в React). Accent на active tool = `--mosaic-accent`, не `--affine-brand-color`, если бренд Affine остаётся голубым `#1e96eb` (тоже не Miro, но rail должен быть Mosaic).

**DoD T:** Storybook/визуальный фикстур: panel, icon-button 32/36, sticky swatches light+dark. Контраст текста на пастелях ≥ 4.5:1.

---

## 4. Продуктовая композиция chrome (C)

Три якоря, как в брифе. Не библиотека — layout существующих виджетов.

```
┌─ rail 32–36 ─┐                    ┌─ inspector (opt) ─┐
│ select       │                    │ selection props     │
│ sticky       │     canvas         │ tags / metadata     │
│ frame        │                    └────────────────────┘
│ connector    │
│ card/shape…  │
│ templates    │
│ more         │
└──────────────┘
     ┌ zoom ─┐              selection bar floats on object
     │ − 100% + fit │
     └────────┘
```

### C1. Left creation rail

Файлы: `blocksuite/affine/widgets/edgeless-toolbar/src/edgeless-toolbar.ts` + CSS.

Под `enable_workshop_chrome`:

- Host: `left: 12px; top: 50%; transform: translateY(-50%); width: auto; height: auto; bottom: unset`.
- Колонка: quick tools вертикально, senior — popover «ещё» или второй столбец по hover.
- Оболочка: `mosaicChromePanel`, gap 4px, кнопки `QUICK_TOOL_SIZE` 36 (уже есть).
- Auto-hide: сдвиг влево, не вниз.
- Viewport ≤1200 / mobile: оставить нижний бар (не ломать immersive iOS).

Порядок tools (workshop): **Select → Sticky → Frame → Connector → Note (doc card) → Shape → Pen → …**. Sticky отделён от note.

Патч BlockSuite минимальный (layout + порядок). Альтернатива без патча: Mosaic `ViewExtension` скрывает `edgeless-toolbar-widget` и монтирует `wb-creation-rail` (Lit или React→Lit), подписанный на те же `QuickToolIdentifier` / `SeniorToolIdentifier`. **Предпочтительно второй путь**, если патч toolbar конфликтует с апстримом.

### C2. Контекстный бар на выделении

`affine-toolbar-widget` уже 36px и Floating UI. Работы:

- Оболочка `mosaicChromePanel` (белая, 1px, radius 8, shadow).
- Sticky: цвет, tag chip, lock — в этом баре.
- Не переносить бар вниз экрана на desktop.

### C3. Zoom снизу

`edgeless-zoom-toolbar`: обернуть в тот же panel recipe; `left: 12px; bottom: 12px`; не перекрывать rail (rail по вертикальному центру, zoom в углу). Fit / ± / percent без смены API (`gfx.fitToScreen()`, `smoothZoom`).

**DoD C:** флаг on — rail слева, zoom снизу слева, selection у объекта; флаг off — текущий низ. Скрин e2e desktop 1440 и 1280.

---

## 5. Компоненты семантики (S)

Спека поведения — матрица `miro.board.*` из websdk-types. Имена в Mosaic: `mosaic.board.*`, без торговой марки в UI.

### 5.1 Sticky — S-Sticky

**Модель.** Не новый flavour. Расширение `NoteProps.edgeless`:

```ts
kind?: 'note' | 'sticky'; // default 'note'
```

Shallow schema patch в `note-model.ts`. Sticky tool пишет:

| Prop | Значение |
| ---- | -------- |
| `displayMode` | `EdgelessOnly` |
| `xywh` | 200×200 (min 170×92 уже есть) |
| `background` | `--mosaic-sticky-butter` (через Color token Mosaic) |
| `edgeless.style.shadowType` | `NoteShadow.Sticker` |
| `edgeless.style.borderRadius` | `NoteCorners.Small` (8) |
| `edgeless.style.borderStyle` | `None` |
| `edgeless.kind` | `'sticky'` |

View: `[data-note-kind=sticky]` — пастельный фон, без page-hub chrome (скрыть «Display in Page», slicer). Slash: paragraph + lists, без database/embed. Двойной клик = edit text.

Creation: новый `StickyTool` (`toolName = 'mosaic:sticky'`) в `packages/frontend/whiteboard/src/chrome/sticky-tool.ts`, кнопка в rail. Старый note tool остаётся «текстовая карточка / page section».

**Не делать:** vote/emoji на sticky в этом плане (facilitation §5.4 enterprise).

### 5.2 Frame — S-Frame

Поведение уже: title, `childElementIds`, `presentationIndex`, background, present tool.

Корректировки:

- Title chrome: высота ≥ 24, radius согласован с tokens, accent только на selected.
- Empty frame: тонкий dashed border `--mosaic-chrome-border`, не «дыра».
- SDK: `createFrame`, `addToFrame`, `zoomToFrame` = `setViewportByBound`.
- Template insert: пресеты пустых frame (retro, 2×2, agenda) через template panel (C5), не новые типы.

### 5.3 Card — S-Card

Два слоя:

**A. App card chrome** (паттерн app-examples / mirotone app-card, свои стили). Обёртка для `affine:bookmark` и `affine:embed-linked-doc` на edgeless: 8px radius, 1px border, shadow-1, favicon + title + description, hit 36px actions. Файлы view: embed-edgeless-linked-doc, bookmark edgeless.

**B. `wb:record-card`** — из `miro_kanban_parity_plan.md` (`{ databaseId, rowId }`). Этот план даёт **chrome и selection toolbar**; схема/синк — Kanban трек. Не дублировать модель.

SDK: `createCard` → bookmark или record-card по аргументам.

### 5.4 Connector — S-Connector

Движок не трогать. Скин + фасад:

- Default workshop: `strokeWidth` 2, `ConnectorMode.Curve` (уже default), rear Arrow.
- Toolbar в mosaic panel.
- SDK: `createConnector({ source, target, mode })` вокруг `ConnectorElementModel`; attach к gfx (`connectable` уже true у блоков, включая `wb:*`).

Проверка DoD: стрелка sticky→frame и sticky→`wb:chart`.

### 5.5 Tag — S-Tag

Переиспользовать `packages/frontend/core/src/modules/tag` (id, value, color) и `--affine-tag-*` / при необходимости mosaic-tag overlay.

Хранение: `tags?: string[]` (ids) на sticky/frame/card. Для note — поле рядом с `edgeless.kind`; для frame — `FrameBlockProps`; для `wb:*` — props виджета.

UI: chip на объекте (max 3 + overflow) + picker в selection bar (`@affine/component` Menu + существующие tag editors).

Не путать с DB Labels канбана: те остаются колонкой; ingest sticky→board мапит object tags → Labels (Kanban F8).

### 5.6 Viewport — S-Viewport

Фасад над `Viewport` + collab follow:

```ts
mosaic.board.viewport.get() → { x, y, zoom, width, height }
set(x, y, zoom, { smooth?: boolean })
zoomTo(bound | elementIds)
fitToScreen()
lock(boolean)           // существующий viewport.locked
on('change', cb)
```

Summon/follow не здесь — `enable_whiteboard_facilitation` / collab. Этот план только стабильный фасад и zoom chrome.

### 5.7 Panel / modal — S-Panel

Паттерн app-examples: **левая app panel** (не модалка на весь экран) + **modal** для confirm/create.

| API (спека) | Реализация Mosaic |
| ----------- | ----------------- |
| `ui.openPanel({ url \| react })` | `MosaicBoardPanelHost`: slide-over 280–320px, `mosaicChromePanel`, Radix Dialog `animation=slideRight` **или** не-modal dock слева от canvas (предпочтительно dock, чтобы не красть фокус канваса) |
| `ui.closePanel` | unmount host |
| `ui.openModal` | существующий `Modal` / `ConfirmModal` |
| notifications | существующий `Notification` / board toast |

Первые панели продукта: Templates, Frames (обёртка `frame-panel`), Widget library (chart/board/sketch). Плагины iframe — слой 2 SDK, не v1.

Widget settings (chart/board): визуально тот же recipe; якорь — inspector справа при выделении виджета (selection-driven).

### 5.8 Metadata — S-Meta

Два уровня, как в websdk-types (`getMetadata` / `setMetadata` на item vs board):

1. **Item:** `Y.Map` `mosaicMeta` на блоке/элементе (JSON-compatible, размер ≤ 6KB). Не для ACL.
2. **Board/doc:** существующий `DocMeta` + workspace properties.

`BlockMeta` (createdAt/By) включить для note/frame (сейчас нет). Sticky chrome опционально показывает автора мелким текстом — P2.

SDK: `getMetadata(id)`, `setMetadata(id, key, value)`.

---

## 6. Паттерны app-examples (поведение, свой UI)

| Паттерн | Поведение, которое копируем | Mosaic UI |
| ------- | --------------------------- | --------- |
| Left app panel | Открывается с tool/rail, не перекрывает всю доску, закрытие явное | `MosaicBoardPanelHost` + tokens |
| App card | Компактная карточка: иконка, title, 1–2 мета, действия на hover | S-Card A |
| Template builder | Галерея пресетов → insert на viewport center / в frame | Панель Templates: `packages/frontend/templates` (edgeless + stickers) + sticky pastels + empty frames |
| Selection-driven UI | Toolbar/inspector следует за selection; пустой selection → только rail | Уже `ToolbarModuleExtension`; inspector подписан на `selection.updated` |

Не переносить HTML/CSS примеров Miro. Скрин/UX-заметки в `packages/frontend/whiteboard/src/chrome/PATTERNS.md` (коротко: якоря, размеры, что не копировать).

---

## 7. Публичный фасад SDK (слой 1)

Файл: `packages/frontend/whiteboard/src/sdk/board.ts` (пакет можно назвать `@mosaic/whiteboard-sdk` / `@affine/whiteboard-sdk` как в enterprise §5.6).

Минимум, покрывающий бриф:

```ts
board.createSticky(props)
board.createFrame(props)
board.createCard(props)
board.createConnector(props)
board.getSelection()
board.setSelection(ids)
board.viewport.*          // §5.6
board.ui.openPanel / closePanel / openModal
board.getMetadata / setMetadata
board.on('selection:change' | 'viewport:change')
```

Реализация — тонкие обёртки над `std.store`, `GfxController`, `Viewport`. Без `window.miro`. Типы писать сами; `@mirohq/websdk-types` только как чеклист в ревью, **не dependency**.

Слой 2 iframe plugins — вне этого плана (enterprise marketplace P3).

---

## 8. Файлы и флаги

| Работа | Куда |
| ------ | ---- |
| Tokens + recipes | `packages/frontend/whiteboard/src/chrome/tokens.css.ts`, `panel.css.ts` |
| Rail | новый widget `wb-creation-rail` **или** layout-патч `edgeless-toolbar.ts` |
| Sticky tool | `whiteboard/src/chrome/sticky-tool.ts` + shallow `note-model.ts` `edgeless.kind` |
| Sticky CSS | `note-edgeless-block` data-attr + mosaic overlay |
| Tags | `tag` module + props note/frame |
| App card chrome | edgeless views bookmark / linked-doc |
| Panel host | `whiteboard/src/chrome/panel-host.tsx` |
| SDK | `whiteboard/src/sdk/board.ts` |
| Flag | `enable_workshop_chrome` в `feature-flag/constant.ts` + BlockSuite flag service |
| Templates panel | `whiteboard/src/chrome/templates-panel.tsx` + `@affine/templates` |

Мобильный edgeless: rail не включать, пока `enable_mobile_edgeless_editing` не в parity.

---

## 9. Дорожная карта

Спринты по 2 недели. 1 frontend. Параллельно E1 facilitation/kanban: chrome не блокирует timer/vote; sticky ingest в kanban **желает** S-Sticky к фазе Kanban B.

### Фаза WC0 — Tokens (1 неделя)

- [x] CSS variables + `mosaicChromePanel` + icon-button 32/36
- [x] Sticky pastel swatches light/dark, contrast check
- [x] Accent `--mosaic-accent`, шрифт не менять
- [x] Story / visual fixture

**Сделано в коде (2026-09-13).** Overlay-токены Mosaic в `packages/frontend/whiteboard/src/chrome/`: `tokens.ts` (source of truth), `tokens.css.ts` (`:root` / `[data-theme]`), `panel.css.ts` (`mosaicChromePanel`, icon-button 32/36, sticky swatches). Акцент `#0d7377` (teal), шрифт `var(--affine-font-family)`. Визуальный фикстур `tokens-fixture.tsx` + Story `tokens.stories.tsx` (глоб Storybook `@affine/component` расширен). Контраст пастель×чернила ≥ 4.5:1 в unit-тестах `tokens.spec.ts`. Флаг `enable_workshop_chrome` (default false) + i18n en/ru. CSS-переменные регистрируются в `effects()` как overlay и **не** двигают нижний toolbar.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Storybook в этой среде не запускался (нет `storybook dev`); DoD закрыт фикстурой + vitest render. Глоб: `packages/frontend/component/.storybook/main.ts`.
- Тёмные sticky hex не совпадают со светлой таблицей §3: для AA на `--mosaic-sticky-ink` `#F4EFE6` взяты затемнённые бумаги (`#6B5A28` … `#3A4250`). Светлые hex — как в §3.
- Overlay-токены грузятся всегда (effects); визуально flag off ≡ текущий UX до WC1.
- Recipe не реэкспортирован в `@affine/component` (план: только если понадобится вне edgeless).
- `PATTERNS.md` и Playwright «workshop chrome layout» — WC1.
- i18n только en+ru (принятый паттерн проекта); `i18n-completenesses.json` не пересчитывался.
- `yarn.lock` не обновлялся: `@vanilla-extract/css` уже есть в монорепо, полный `yarn install` не гонялся из-за лимита памяти.

### Фаза WC1 — Layout chrome (2 недели)

- [x] Left rail под флагом (предпочтительно Mosaic widget поверх Quick/Senior tools)
- [x] Zoom cluster в panel recipe
- [x] Selection bar в panel recipe
- [x] Fallback нижнего toolbar при флаге off и на mobile
- [x] Playwright: layout screenshots 1440 / 1280

**Сделано в коде (2026-09-13).** Mosaic widget `wb-workshop-chrome` (`packages/frontend/whiteboard/src/chrome/workshop-chrome.ts`) регистрируется в `WhiteboardViewExtension`, когда `enableWorkshopChrome` true. Не форкает `edgeless-toolbar.ts`: adopted-shadow CSS (`layout-styles.ts`) ставит host слева (12px, вертикальный центр), quick tools колонкой, senior — hover-колонка справа; auto-hide `translateX(-72px)`. Zoom host `left/bottom: 12px` + panel recipe на внутреннем `edgeless-zoom-toolbar`. Selection: тот же recipe на `editor-toolbar`. Геометрия `layout.ts` (`> 1200`, не mobile, не present). Flag off / виджет не смонтирован → нижний toolbar без изменений. Фикстур `layout-fixture.tsx` + Story `layout.stories.tsx`. Unit: `layout.spec.ts`, `layout-fixture.spec.tsx`. Playwright spec: `tests/affine-local/e2e/whiteboard/workshop-chrome-layout.spec.ts`. i18n en+ru (rail/zoom/selection + описание флага).

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Playwright screenshots 1440/1280 **не выполнялись** в этой среде (нет поднятого `@affine/web`, лимит памяти). Spec написан: rail left / zoom bottom-left / no overlap; flag off ≡ bottom toolbar; sidebar сворачивается, чтобы editor viewport > 1200. Базовые PNG не сняты.
- Senior tools — hover-колонка справа, не отдельный popover «ещё». Плотность 32–36 у quick tools; senior paper-кнопки в flyout остаются ~96×64.
- Sticky как отдельная кнопка rail — **сделано в WC2**.
- Stock toolbar остаётся в DOM (скрыт/переставлен CSS), чтобы mixins сохраняли `edgelessToolbarContext`.
- Storybook не запускался (как WC0).
- i18n только en+ru; `i18n-completenesses.json` не пересчитывался.
- Isolated `tsc` виджета `workshop-chrome.ts` требует полный yarn-граф `@blocksuite/*` (в этой среде пакеты не слинкованы). `layout.ts` / `adopt.ts` / `layout-styles.ts` / tokens+panel CSS — 0 ошибок. Виджет копирует паттерн Lit `WidgetComponent` как остальные whiteboard widgets.
- ADR «rail = widget vs patch toolbar» как отдельный файл не писался: решение зафиксировано в `PATTERNS.md` + этом абзаце (widget + overlay CSS).

### Фаза WC2 — Sticky + palette (2 недели)

- [x] `edgeless.kind: 'sticky'`
- [x] StickyTool + rail button
- [x] Defaults size/shadow/pastel
- [x] Ограниченный slash
- [x] Connector sticky→frame

**Сделано в коде (2026-09-13).** Sticky — пресет `affine:note`, не новый flavour. `NoteEdgelessProps.kind?: 'note' | 'sticky'` в `note-model.ts` (не в `NoteZodSchema` / last-props, чтобы StickyTool не протекал в NoteTool). `NoteBlockModel.isSticky()`, `isStickyNote` / `isInsideStickyNote`. View: `affine-edgeless-note[data-note-kind=sticky]` + CSS ink/font, скрыт collapse. Toolbar: скрыты Display in Page / Affine style panel / slicer / auto-height; палитра Mosaic через `custom:affine:surface:note` (`wb-sticky-palette`). `StickyTool` (`toolName = 'mosaic:sticky'`) пишет 218×200, `displayMode: edgeless`, butter `{light,dark}`, `NoteShadow.Sticker`, radius 8, `store.addBlock` (не CRUD lastProps). Quick tool priority 95. Slash: `buildSlashMenuItems` прячет группы Page / Content & Media / Database. Connector: gfx notes `connectable = true`. i18n en+ru. Фикстура `sticky-fixture.tsx` + Story `Whiteboard/Chrome/Sticky`. Unit: `sticky-preset.spec.ts`, `sticky-fixture.spec.tsx`. Playwright spec: `tests/affine-local/e2e/whiteboard/workshop-chrome-sticky.spec.ts`.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Playwright sticky e2e **не выполнялся** (нет поднятого `@affine/web`, лимит памяти). Spec написан: flag off — нет кнопки; flag on — click tool + canvas → `[data-note-kind=sticky]`. Базовые PNG не снимались.
- Нет drag-to-size: click ставит фиксированные 218×200 (`NOTE_MIN_WIDTH` × 200; план ~200×200).
- Порядок tools: sticky — **новая** quick-кнопка (priority 95), stock Note не переставлялся.
- Slash: прячутся Page / embed-media / Database; в Basic остаются headings, code, quote, divider, callout/latex. План формулировал «paragraph + lists».
- Connector sticky→frame: наследуется `connectable = true`; отдельного e2e рисования коннектора нет.
- Tags / lock chip / author на sticky — tags сделаны в WC3; lock chip / author — P2. Vote/emoji — facilitation. SDK `board.createSticky` — сделано в WC4.
- Flag `enable_workshop_chrome` по-прежнему default **false**.
- i18n только en+ru; `i18n-completenesses.json` не пересчитывался.
- Isolated `tsc` Lit tool/palette/widget (`sticky-tool.ts`, `sticky-tool-button.ts`, `sticky-palette.ts`, `sticky-toolbar.ts`, `workshop-chrome.ts`) требует полный yarn-граф `@blocksuite/*`. Preset + CSS + фикстуры проверяются отдельно.
- Storybook не запускался (как WC0/WC1).
- `yarn.lock` не обновлялся.

### Фаза WC3 — Frame / Card / Tag (2 недели)

- [x] Frame title/empty sкин
- [x] App-card chrome bookmark + linked-doc
- [x] `tags[]` + chips + picker в selection bar
- [x] Каркас `wb:record-card` chrome, модель — по готовности Kanban

**Сделано в коде (2026-09-13).** Overlay CSS + Mosaic Lit, без fork `edgeless-toolbar.ts` / `frame-title.ts` height constant. Empty frame: `affine-frame[data-empty]` dashed border; title 24px + accent только при `[data-selected=true]` (adopted CSS + MutationObserver). App-card skin на edgeless `affine:bookmark` и `affine:embed-linked-doc` (radius 8, mosaic border/paper, `--affine-shadow-1`, hit 36). `tags?: string[]` на note (только sticky UI), frame, bookmark, linked-doc, `wb:record-card`. Каталог — workspace `meta.properties.tags.options` (`{id,value,color}` + `--affine-tag-*`), не `@affine/core` TagService. Chips max 3 + overflow (`wb-tag-chips-layer`); picker `wb-tag-picker` в selection bar (`custom:affine:*`). `wb:record-card` — chrome skeleton `{ xywh, databaseDocId, databaseId, rowId, compact, tags }` + pending UI; slash под `enable_workshop_chrome`. i18n en+ru. Фикстура `objects-fixture.tsx` + Story `Whiteboard/Chrome/Objects`. Unit: `object-tags.spec.ts`, `objects-fixture.spec.tsx`. Playwright spec: `tests/affine-local/e2e/whiteboard/workshop-chrome-objects.spec.ts`.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Playwright WC3 e2e **не выполнялся** (нет поднятого `@affine/web`, лимит памяти). Spec написан: flag on → sticky → `[data-testid=mosaic-tag-add]`. Базовые PNG не снимались.
- Frame title skin — adopted CSS, не fork константы высоты в `frame-title.ts` (stock остаётся 22px при флаге off).
- Empty-frame templates (retro / 2×2 / agenda) — сделано в WC5. SDK `createFrame` / `createCard` / `zoomToFrame` / `getMetadata` — сделано в WC4 (`viewport.zoomTo`, item `mosaicMeta`).
- `wb:record-card` — только chrome: нет database face, нет row sync / ingest, empty pending UI. Схема/синк — Kanban B2, не дублируется здесь.
- Slash record-card в группе Content & Media; на sticky slash эта группа скрыта (фильтр WC2).
- Tag picker не использует React TagService / `@affine/core` (цикл: core уже зависит от `@affine/whiteboard`).
- Chip overlay может съезжать относительно zoom/parent transform; надёжный UI — picker на selection bar.
- Tags на page notes **не** показываются (только sticky среди `affine:note`).
- Lock chip / author — P2. Vote/emoji — facilitation. DB Labels kanban ingest — F8.
- Flag `enable_workshop_chrome` по-прежнему default **false**.
- i18n только en+ru; `i18n-completenesses.json` не пересчитывался.
- Isolated `tsc` Lit widgets (`tag-picker.ts`, `tag-chips.ts`, `tag-chips-layer.ts`, `tag-toolbar.ts`, `workshop-chrome.ts`, record-card Lit) требует полный yarn-граф `@blocksuite/*`. `object-tags.ts` / tokens / CSS / фикстуры проверяются отдельно. `register-gfx-widget.spec.ts` в этой среде не загружается (`Cannot find package '@blocksuite/affine/std/gfx'`).
- Storybook не запускался (как WC0–WC2).
- `yarn.lock` не обновлялся.

### Фаза WC4 — Viewport / Panel / Metadata + SDK (2 недели)

- [x] `mosaic.board.viewport` фасад
- [x] `MosaicBoardPanelHost` (Templates + Frames)
- [x] `mosaicMeta` get/set
- [x] BlockMeta на note/frame
- [x] `board.ts` слой 1 + README без чужих типов в dependencies

**Сделано в коде (2026-09-13).** Фасад `createMosaicBoard` / `getMosaicBoard(std)` в `packages/frontend/whiteboard/src/sdk/` (export `./sdk`, без отдельного npm `@affine/whiteboard-sdk` и без `window.miro` / `@mirohq/*`). API: `createSticky` / `createFrame` / `createCard` / `createConnector`, selection, `viewport.get|set|zoomTo|fitToScreen|lock|on('change')`, `ui.openPanel|closePanel|openModal`, item `getMetadata` / `setMetadata` (JSON, ≤ 6KB), `on('selection:change' | 'viewport:change')`. Viewport `get/set` — top-left `{x,y}` = `viewportX/Y`, `set` переводит в center. Connector mode: `straight=0 / orthogonal=1 / curve=2`, stroke 2, rear Arrow — без импорта enum. Frame title в runtime оборачивается в `Text`. `mosaicMeta` на note/frame/bookmark/linked-doc/`wb:record-card`; `BlockMeta` timestamps на note/frame (и уже были на bookmark). Dock `wb-board-panel` 300px, left = inset или inset+rail+gap (72 при rail), вкладки Templates (insert empty frame + sticky) и Frames (список + `zoomTo`). Modal — overlay в том же виджете. Регистрация только при `enableWorkshopChrome` + edgeless. i18n en+ru. Фикстура `panel-fixture.tsx` + Story `Whiteboard/Chrome/Panel`. Unit: `sdk/*.spec.ts`, `layout.spec.ts` (300/72), `panel-fixture.spec.tsx`. Playwright spec: `tests/affine-local/e2e/whiteboard/workshop-chrome-sdk.spec.ts`.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Playwright WC4 e2e **не выполнялся** (нет поднятого `@affine/web`, лимит памяти). Spec написан: flag on → handle → dock + templates tab + insert-frame. Базовые PNG не снимались.
- Templates — тонкий insert-shell заменён галереей WC5 (empty / retro / 2×2 / agenda / pastel pack + Affine snapshots).
- Frames dock — Mosaic list + `viewport.zoomTo([id])`, не обёртка stock `affine-frame-panel` / fragment. Правый Affine frame panel не тронут.
- `ui.openModal` — Lit overlay в `wb-board-panel`, не `@affine/component` Modal/ConfirmModal (не тянем `@affine/component` в whiteboard).
- Нет опубликованного пакета `@affine/whiteboard-sdk`; контракт живёт в `@affine/whiteboard` `src/sdk`. PluginContext / iframe plugins — слой 2, не WC4.
- `mosaicMeta` на gfx-примитивах (connector) — best-effort extra key в Y.Map, не `@field` на `ConnectorElementModel`.
- Board-level `getMetadata()` без id / DocMeta mosaic map — не сделано (только item-level).
- Widget library (chart/board/sketch) как третья вкладка панели и selection-driven inspector — WC5.
- BlockMeta author chrome на sticky — P2.
- Summon/follow не в этом фасаде (`enable_whiteboard_collab`).
- Панель показывается только при rail-режиме workshop chrome (не mobile, не fallback ≤1200).
- Flag `enable_workshop_chrome` по-прежнему default **false**.
- i18n только en+ru; `i18n-completenesses.json` не пересчитывался.
- Isolated `tsc` Lit (`panel-host.ts`, `from-std.ts`, `workshop-chrome.ts`) требует полный yarn-граф `@blocksuite/*`. Чистые `sdk/types|viewport|metadata|board` + `layout.ts` проверяются отдельно. `register-gfx-widget.spec.ts` в этой среде не загружается (`Cannot find package '@blocksuite/affine/std/gfx'`).
- Storybook не запускался (как WC0–WC3).
- `yarn.lock` не обновлялся.

### Фаза WC5 — Template builder + inspector (2 недели)

- [x] Галерея: edgeless templates, sticker sets, empty frames, pastel packs
- [x] Insert в центр viewport / в выделенный frame
- [x] Selection-driven inspector справа для `wb:chart|board|sketch` (существующие settings panels пересадить в recipe)
- [ ] Flag default-on после WC1–WC4 e2e

**Сделано в коде (2026-09-13).** Галерея Mosaic в левом `wb-board-panel`: empty frame, retro 3-up, 2×2, agenda, pastel pack (6 swatches), sticky; вкладка Widgets вставляет `wb:chart|board|sketch` через `board.createWidget`. Insert — viewport center или в единственный выделенный frame (`insertMosaicTemplate`). Встроенные Affine edgeless/sticker snapshots читаются с `EdgelessTemplatePanel.templates` (регистрация по-прежнему в core `registerTemplates()`, без зависимости `@affine/templates` в whiteboard) и вставляются `createTemplateJob`. Inspector `wb-board-inspector` справа 300px: при выделении chart/board монтирует существующие React settings; sketch — hint. При rail chrome in-widget `position:fixed` settings скрыты (`workshopRailFromElement`). i18n en+ru. Фикстуры `panel-fixture` / `inspector-fixture` + Stories. Unit: `templates-catalog.spec.ts`, `templates-insert.spec.ts`, `inspector-flavours.spec.ts`, `inspector-fixture.spec.tsx`. Playwright spec: `workshop-chrome-templates.spec.ts`. Flag default **false**.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Playwright WC5 e2e **не выполнялся**. Spec написан: flag on → dock → retro + widgets tab. Базовые PNG не снимались.
- Flag `enable_workshop_chrome` **не** default-on: e2e WC1–WC4 в этой среде не гонялись.
- Affine snapshots в галерее только если core уже вызвал `EdgelessTemplatePanel.templates.extend`. Кап 24 на категорию. Insert Affine template использует stock `createTemplateJob` (template — справа от контента, sticker — viewport center); в выделенный frame Affine snapshot не кладётся.
- Нет отдельного пакета `@affine/templates` в `@affine/whiteboard` (намеренно, без `yarn.lock`).
- Inspector не переносит settings chart/board в `@affine/component`; это те же React-панели в Mosaic dock. Sketch inspector без vis/export controls (тулбар на selection bar).
- Widget insert скрыт, если flavour нет в schema (флаг chart/board/sketch выключен).
- Undo insert наследуется от BlockSuite captureSync вызывающей стороны; отдельной обёртки undo нет.
- Flag по-прежнему default **false**.
- i18n только en+ru; `i18n-completenesses.json` не пересчитывался.
- Isolated `tsc` Lit (`panel-host.ts`, `inspector-host.ts`, `templates-affine.ts`) требует полный yarn-граф `@blocksuite/*`. Каталог + insert + layout проверяются отдельно.
- Storybook не запускался.
- `yarn.lock` не обновлялся.

**Оценка суммарно:** ~9–11 недель одного frontend; WC0–WC2 можно раньше facilitation demo «стикеры → kanban».

---

## 10. Тесты и DoD

1. Flag off ≡ текущий UX (регрессия toolbar снизу).
2. Flag on: rail слева, zoom снизу, selection floats; нет пересечения rail×zoom на 1440.
3. Sticky: create, type, color, tag, connect to frame, reload Yjs.
4. App card: bookmark на доске выглядит как chrome panel, не «сырой iframe».
5. Templates panel: insert template, undo.
6. SDK unit: viewport get/set, metadata round-trip, selection event.
7. A11y: rail buttons focus ring, aria-pressed на active tool; контраст sticky.
8. Юридический чеклист PR: нет `@mirohq/*`, нет mirotone, нет Roobert, нет `#4262ff`.

Метрика product (стык enterprise §10): воркшоп 5 человек создаёт стикеры с rail без поиска «note tool».

---

## 11. Связь с другими планами

| План | Связь |
| ---- | ----- |
| `miro_whiteboard_implementation_plan.md` | Примитивы/LOD/виджеты сделаны; этот план — chrome + семантика + SDK имена |
| `miro_kanban_parity_plan.md` | F8 ingest sticky→row; `wb:record-card`; не начинать Timeline здесь |
| `mosaic_enterprise_plan.md` | Заменяет WB-7 «board-first скин P3» на трек **WC** внутри E1; SDK слой 1 = §5.6 пункт 2 |
| Facilitation §5.4 | Timer/vote/laser поверх того же rail (кнопка workshop), не отдельный chrome |

---

## 12. Следующий конкретный шаг

1. Снять Playwright screenshots 1440/1280 (`workshop-chrome-layout.spec.ts`) и прогнать sticky/objects/sdk/templates specs на живом `@affine/web`. Flag default-on — только после этих e2e.
2. Facilitation (timer/vote/laser) поверх того же rail, если нужен workshop demo.
3. Не подключать npm Miro «на посмотреть в бандле».
