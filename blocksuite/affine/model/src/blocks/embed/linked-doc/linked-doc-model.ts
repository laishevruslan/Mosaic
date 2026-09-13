import { BlockModel } from '@blocksuite/store';

import type { ReferenceInfo } from '../../../consts/doc.js';
import type { EmbedCardStyle } from '../../../utils/index.js';
import { defineEmbedModel } from '../../../utils/index.js';

export const EmbedLinkedDocStyles = [
  'vertical',
  'horizontal',
  'list',
  'cube',
  'horizontalThin',
  'citation',
] as const satisfies EmbedCardStyle[];

export type EmbedLinkedDocBlockProps = {
  style: (typeof EmbedLinkedDocStyles)[number];
  caption: string | null;
  footnoteIdentifier: string | null;
  /** Workspace tag ids (WC3). */
  tags?: string[];
  /** Item metadata (WC4). */
  mosaicMeta?: Record<string, unknown>;
} & ReferenceInfo;

export class EmbedLinkedDocModel extends defineEmbedModel<EmbedLinkedDocBlockProps>(
  BlockModel
) {}
