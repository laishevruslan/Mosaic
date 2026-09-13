import './chrome/card.css';
import './chrome/frame.css';
import './chrome/sticky.css';
import './chrome/tokens.css';

import { BoardBlockComponent } from './blocks/board/board-block';
import { BoardEdgelessBlockComponent } from './blocks/board/board-edgeless-block';
import { BoardPreviewBlockComponent } from './blocks/board/board-preview-block';
import { ChartBlockComponent } from './blocks/chart/chart-block';
import { ChartEdgelessBlockComponent } from './blocks/chart/chart-edgeless-block';
import { ChartPreviewBlockComponent } from './blocks/chart/chart-preview-block';
import { HelloBlockComponent } from './blocks/hello/hello-block';
import { HelloEdgelessBlockComponent } from './blocks/hello/hello-edgeless-block';
import { HelloPreviewBlockComponent } from './blocks/hello/hello-preview-block';
import { RecordCardBlockComponent } from './blocks/record-card/record-card-block';
import { RecordCardEdgelessBlockComponent } from './blocks/record-card/record-card-edgeless-block';
import { RecordCardPreviewBlockComponent } from './blocks/record-card/record-card-preview-block';
import { SketchBlockComponent } from './blocks/sketch/sketch-block';
import { SketchEdgelessBlockComponent } from './blocks/sketch/sketch-edgeless-block';
import { SketchPreviewBlockComponent } from './blocks/sketch/sketch-preview-block';
import { MosaicBoardInspectorHost } from './chrome/inspector-host';
import { MosaicBoardPanelHost } from './chrome/panel-host';
import { MosaicStickyPalette } from './chrome/sticky-palette';
import { MosaicStickyToolButton } from './chrome/sticky-tool-button';
import { MosaicTagChips } from './chrome/tag-chips';
import { MosaicTagChipsLayer } from './chrome/tag-chips-layer';
import { MosaicTagPicker } from './chrome/tag-picker';
import { MosaicWorkshopChromeWidget } from './chrome/workshop-chrome';
import { WhiteboardPresenceBar } from './collab/presence-bar';
import { WhiteboardPerfHud } from './perf/hud';

export function effects() {
  customElements.define('wb-hello', HelloBlockComponent);
  customElements.define('wb-hello-edgeless', HelloEdgelessBlockComponent);
  customElements.define('wb-hello-preview', HelloPreviewBlockComponent);

  customElements.define('wb-chart', ChartBlockComponent);
  customElements.define('wb-chart-edgeless', ChartEdgelessBlockComponent);
  customElements.define('wb-chart-preview', ChartPreviewBlockComponent);

  customElements.define('wb-sketch', SketchBlockComponent);
  customElements.define('wb-sketch-edgeless', SketchEdgelessBlockComponent);
  customElements.define('wb-sketch-preview', SketchPreviewBlockComponent);

  customElements.define('wb-board', BoardBlockComponent);
  customElements.define('wb-board-edgeless', BoardEdgelessBlockComponent);
  customElements.define('wb-board-preview', BoardPreviewBlockComponent);
  customElements.define('wb-record-card', RecordCardBlockComponent);
  customElements.define(
    'wb-record-card-edgeless',
    RecordCardEdgelessBlockComponent
  );
  customElements.define(
    'wb-record-card-preview',
    RecordCardPreviewBlockComponent
  );
  if (!customElements.get('wb-perf-hud')) {
    customElements.define('wb-perf-hud', WhiteboardPerfHud);
  }
  if (!customElements.get('wb-presence-bar')) {
    customElements.define('wb-presence-bar', WhiteboardPresenceBar);
  }
  if (!customElements.get('wb-workshop-chrome')) {
    customElements.define('wb-workshop-chrome', MosaicWorkshopChromeWidget);
  }
  if (!customElements.get('wb-sticky-tool-button')) {
    customElements.define('wb-sticky-tool-button', MosaicStickyToolButton);
  }
  if (!customElements.get('wb-sticky-palette')) {
    customElements.define('wb-sticky-palette', MosaicStickyPalette);
  }
  if (!customElements.get('wb-tag-chips')) {
    customElements.define('wb-tag-chips', MosaicTagChips);
  }
  if (!customElements.get('wb-tag-picker')) {
    customElements.define('wb-tag-picker', MosaicTagPicker);
  }
  if (!customElements.get('wb-tag-chips-layer')) {
    customElements.define('wb-tag-chips-layer', MosaicTagChipsLayer);
  }
  if (!customElements.get('wb-board-panel')) {
    customElements.define('wb-board-panel', MosaicBoardPanelHost);
  }
  if (!customElements.get('wb-board-inspector')) {
    customElements.define('wb-board-inspector', MosaicBoardInspectorHost);
  }
}
