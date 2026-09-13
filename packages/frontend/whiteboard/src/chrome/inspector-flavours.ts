import { WHITEBOARD_FLAVOURS } from '../const';

export const MOSAIC_INSPECTOR_FLAVOURS = [
  WHITEBOARD_FLAVOURS.chart,
  WHITEBOARD_FLAVOURS.board,
  WHITEBOARD_FLAVOURS.sketch,
] as const;

export type MosaicInspectorFlavour = (typeof MOSAIC_INSPECTOR_FLAVOURS)[number];

export function isInspectorFlavour(
  flavour: string
): flavour is MosaicInspectorFlavour {
  return (MOSAIC_INSPECTOR_FLAVOURS as readonly string[]).includes(flavour);
}
