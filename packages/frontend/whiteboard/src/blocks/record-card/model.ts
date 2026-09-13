import {
  type GfxCommonBlockProps,
  GfxCompatible,
} from '@blocksuite/affine/std/gfx';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/affine/store';

import { WHITEBOARD_FLAVOURS } from '../../const';

export type RecordCardBlockProps = {
  databaseDocId: string;
  databaseId: string;
  rowId: string;
  compact: boolean;
  tags?: string[];
} & GfxCommonBlockProps;

export const RecordCardBlockSchema = defineBlockSchema({
  flavour: WHITEBOARD_FLAVOURS.recordCard,
  props: (): RecordCardBlockProps => ({
    xywh: '[0,0,280,136]',
    index: 'a0',
    rotate: 0,
    scale: 1,
    lockedBySelf: false,
    databaseDocId: '',
    databaseId: '',
    rowId: '',
    compact: false,
    tags: undefined,
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:surface', 'affine:note'],
    children: [],
  },
  toModel: () => new RecordCardBlockModel(),
});

export const RecordCardBlockSchemaExtension = BlockSchemaExtension(
  RecordCardBlockSchema
);

export class RecordCardBlockModel extends GfxCompatible<RecordCardBlockProps>(
  BlockModel
) {}
