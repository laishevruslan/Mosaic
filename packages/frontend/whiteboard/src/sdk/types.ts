/**
 * Public Mosaic board SDK types (WC4). Written here — not imported from
 * competing WebSDK type packages.
 */

import type { MosaicStickySwatchId } from '../chrome/tokens';

export type MosaicBound = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MosaicViewportState = {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
};

export type MosaicViewportSetOptions = {
  smooth?: boolean;
};

export type MosaicConnection = {
  id?: string;
  position?: [number, number];
};

/** Matches BlockSuite ConnectorMode numeric values without importing the enum. */
export type MosaicConnectorMode = 'straight' | 'orthogonal' | 'curve';

export const MOSAIC_CONNECTOR_MODE = {
  straight: 0,
  orthogonal: 1,
  curve: 2,
} as const;

export const MOSAIC_CONNECTOR_STROKE_WIDTH = 2;
export const MOSAIC_CONNECTOR_REAR = 'Arrow';
export const MOSAIC_CONNECTOR_FRONT = 'None';

export type MosaicCreateStickyProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  swatch?: MosaicStickySwatchId;
  tags?: string[];
};

export type MosaicCreateFrameProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
  tags?: string[];
};

export type MosaicCreateBookmarkCard = {
  url: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tags?: string[];
};

export type MosaicCreateLinkedDocCard = {
  pageId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tags?: string[];
};

export type MosaicCreateRecordCard = {
  databaseId: string;
  rowId: string;
  databaseDocId?: string;
  compact?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tags?: string[];
};

export type MosaicCreateCardProps =
  | MosaicCreateBookmarkCard
  | MosaicCreateLinkedDocCard
  | MosaicCreateRecordCard;

export type MosaicCreateConnectorProps = {
  source: MosaicConnection;
  target: MosaicConnection;
  mode?: MosaicConnectorMode;
};

export type MosaicPanelId = 'templates' | 'frames' | 'widgets' | (string & {});

export type MosaicWidgetKind = 'chart' | 'board' | 'sketch';

export type MosaicOpenPanelOptions = {
  id: MosaicPanelId;
};

export type MosaicOpenModalOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type MosaicBoardEvent = 'selection:change' | 'viewport:change';

export type MosaicMetaValue =
  | string
  | number
  | boolean
  | null
  | MosaicMetaValue[]
  | { readonly [key: string]: MosaicMetaValue };

export type MosaicMeta = Record<string, MosaicMetaValue>;

export type MosaicFrameInfo = {
  id: string;
  title: string;
};

export const MOSAIC_FRAME_DEFAULT_WIDTH = 480;
export const MOSAIC_FRAME_DEFAULT_HEIGHT = 320;
export const MOSAIC_BOOKMARK_CARD_WIDTH = 320;
export const MOSAIC_BOOKMARK_CARD_HEIGHT = 90;
