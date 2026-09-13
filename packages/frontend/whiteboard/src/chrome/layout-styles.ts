/**
 * Adopted-shadow CSS for WC1. Targets BlockSuite widget internals
 * that vanilla-extract on the document cannot reach.
 */
export const MOSAIC_TOOLBAR_RAIL_CSS = `
:host([data-mosaic-layout='rail']) {
  left: 12px !important;
  top: 50% !important;
  bottom: unset !important;
  width: auto !important;
  height: auto !important;
  max-height: calc(100% - 96px) !important;
  transform: translateY(-50%) !important;
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-wrapper {
  width: auto;
  justify-content: flex-start;
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-toggle-control {
  min-width: 0;
  max-width: none;
  padding-bottom: 0;
  width: fit-content;
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-toggle-control[data-enable='true'] {
  padding-top: 0;
  transform: translateX(-72px);
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-toggle-control[data-enable='true']:hover,
:host([data-mosaic-layout='rail']) .edgeless-toolbar-toggle-control[data-enable='true']:focus-within {
  transform: none;
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-smooth-corner {
  filter: none;
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-container {
  flex-direction: column;
  align-items: center;
  height: auto;
  padding: 8px;
  background: var(--mosaic-paper);
  border-radius: var(--mosaic-chrome-radius);
  border: var(--mosaic-chrome-border);
  box-shadow: var(--mosaic-chrome-shadow);
  font-family: var(--mosaic-font-ui);
}
:host([data-mosaic-layout='rail']) .quick-tools {
  flex-direction: column;
  gap: 4px;
}
:host([data-mosaic-layout='rail']) .quick-tool-item {
  width: var(--mosaic-hit-comfortable);
  height: var(--mosaic-hit-comfortable);
}
:host([data-mosaic-layout='rail']) .quick-tool-more {
  width: var(--mosaic-hit-comfortable);
  height: var(--mosaic-hit-comfortable);
  margin-left: 0;
}
:host([data-mosaic-layout='rail']) .full-divider {
  width: 100%;
  height: 8px;
  margin: 4px 0;
}
:host([data-mosaic-layout='rail']) .full-divider::after {
  width: 100%;
  height: 1px;
}
:host([data-mosaic-layout='rail']) .senior-nav-button-wrapper {
  display: none;
}
:host([data-mosaic-layout='rail']) .senior-tools {
  display: none;
  flex-direction: column;
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  min-width: 96px;
  height: auto;
  padding: 8px;
  background: var(--mosaic-paper);
  border-radius: var(--mosaic-chrome-radius);
  border: var(--mosaic-chrome-border);
  box-shadow: var(--mosaic-chrome-shadow);
}
:host([data-mosaic-layout='rail']) .edgeless-toolbar-container:hover .senior-tools,
:host([data-mosaic-layout='rail']) .edgeless-toolbar-container:focus-within .senior-tools {
  display: flex;
}
:host([data-mosaic-layout='rail']) .senior-tool-item {
  width: 96px;
  height: 64px;
}
:host([data-mosaic-layout='rail']) .icon-container.active-mode-color[active] {
  color: var(--mosaic-accent);
}
`;

export const MOSAIC_ZOOM_PANEL_CSS = `
:host {
  bottom: 12px !important;
  left: 12px !important;
}
`;

export const MOSAIC_ZOOM_INNER_PANEL_CSS = `
.edgeless-zoom-toolbar-container {
  background: var(--mosaic-paper);
  border-radius: var(--mosaic-chrome-radius);
  border: var(--mosaic-chrome-border);
  box-shadow: var(--mosaic-chrome-shadow);
  padding: 4px 8px;
  font-family: var(--mosaic-font-ui);
}
.zoom-percent:hover {
  color: var(--mosaic-accent);
}
`;

export const MOSAIC_SELECTION_PANEL_CSS = `
:host {
  background: var(--mosaic-paper) !important;
  border-radius: var(--mosaic-chrome-radius) !important;
  border: var(--mosaic-chrome-border) !important;
  box-shadow: var(--mosaic-chrome-shadow) !important;
  font-family: var(--mosaic-font-ui);
}
`;

export const MOSAIC_FRAME_TITLE_CSS = `
:host {
  min-height: var(--mosaic-frame-title-height, 24px);
  height: var(--mosaic-frame-title-height, 24px);
  border-radius: var(--mosaic-chrome-radius, 8px);
  font-family: var(--mosaic-font-ui);
  padding: 0 8px;
  border-color: var(--affine-border-color);
}
:host([data-selected='true']) {
  border-color: var(--mosaic-accent);
  box-shadow: 0 0 0 1px var(--mosaic-accent);
}
`;
