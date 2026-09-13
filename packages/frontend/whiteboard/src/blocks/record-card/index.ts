import { registerGfxWidget } from '../../register-gfx-widget';
import { EdgelessClipboardRecordCardConfig } from './edgeless-clipboard-config';
import { RecordCardBlockSchema, RecordCardBlockSchemaExtension } from './model';
import { RecordCardBlockInteraction } from './record-card-edgeless-block';
import { RecordCardSlashMenuConfigExtension } from './slash-menu';

export const recordCardWidget = registerGfxWidget({
  flavour: RecordCardBlockSchema.model.flavour,
  schema: RecordCardBlockSchemaExtension,
  view: {
    page: 'wb-record-card',
    edgeless: 'wb-record-card-edgeless',
    preview: 'wb-record-card-preview',
  },
  slash: RecordCardSlashMenuConfigExtension,
  clipboard: EdgelessClipboardRecordCardConfig,
  interaction: RecordCardBlockInteraction,
});

export { RecordCardBlockSchema, RecordCardBlockSchemaExtension } from './model';
export { RecordCardBlockComponent } from './record-card-block';
export { RecordCardEdgelessBlockComponent } from './record-card-edgeless-block';
export { RecordCardPreviewBlockComponent } from './record-card-preview-block';
