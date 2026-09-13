import { RecordCardBlockComponent } from './record-card-block';

export class RecordCardPreviewBlockComponent extends RecordCardBlockComponent {
  override renderBlock() {
    return this.renderContent(true);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-record-card-preview': RecordCardPreviewBlockComponent;
  }
}
