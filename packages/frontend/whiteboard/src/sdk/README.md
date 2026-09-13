# Mosaic board SDK (layer 1)

Typed facade `mosaic.board.*` for workshop chrome. It lives in `@affine/whiteboard` (`src/sdk/board.ts`). There is no competing WebSDK package in dependencies and no `window.miro`.

```ts
import { getMosaicBoard } from '@affine/whiteboard';

const board = getMosaicBoard(std);

board.createSticky({ swatch: 'butter' });
board.createFrame({ title: 'Retro' });
board.createCard({ url: 'https://example.test' });
board.createCard({ databaseId, rowId });
board.createConnector({ source: { id: a }, target: { id: b }, mode: 'curve' });
board.createWidget('chart');
board.addToFrame(frameId, [stickyId]);

board.viewport.get(); // { x, y, zoom, width, height }
board.viewport.set(x, y, zoom, { smooth: true });
board.viewport.zoomTo(frameId ? [frameId] : bound);
board.viewport.fitToScreen();
board.viewport.lock(false);

board.getSelection();
board.setSelection([id]);
board.getMetadata(id);
board.setMetadata(id, 'owner', 'ada'); // JSON, ≤ 6KB, not ACL

board.ui.openPanel({ id: 'templates' }); // or 'frames' | 'widgets'
board.ui.closePanel();
await board.ui.openModal({ title: 'Replace?', message: '…' });

board.on('selection:change', cb);
board.on('viewport:change', cb);
```

Summon / follow stay behind `enable_whiteboard_collab`. This module only wraps `Viewport`, `GfxController`, and block CRUD.

Item metadata is the `mosaicMeta` prop on sticky/frame/bookmark/linked-doc/`wb:record-card`. Connector extras are best-effort Y.Map keys. Block author timestamps use BlockSuite `BlockMeta` on note/frame (`meta:createdAt` / `createdBy` / `updatedAt` / `updatedBy`).
