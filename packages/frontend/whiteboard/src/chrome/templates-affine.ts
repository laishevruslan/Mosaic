import {
  createTemplateJob,
  EdgelessTemplatePanel,
  type Template,
} from '@blocksuite/affine/gfx/template';
import { Bound } from '@blocksuite/affine/global/gfx';
import type { BlockStdScope } from '@blocksuite/affine/std';
import { GfxControllerIdentifier } from '@blocksuite/affine/std/gfx';

export type AffineTemplateListItem = {
  name: string;
  category: string;
  template: Template;
};

export type AffineTemplateCategory = {
  name: string;
  items: AffineTemplateListItem[];
};

const AFFINE_TEMPLATE_CAP = 24;

function cloneTemplate(template: Template): Template {
  try {
    return structuredClone(template);
  } catch {
    return {
      ...template,
      assets: template.assets ? { ...template.assets } : undefined,
    };
  }
}

/** Built-in edgeless/sticker snapshots already registered by core. */
export async function listAffineTemplateCategories(): Promise<
  AffineTemplateCategory[]
> {
  const names = await EdgelessTemplatePanel.templates.categories();
  const categories: AffineTemplateCategory[] = [];
  for (const name of names) {
    const list = await EdgelessTemplatePanel.templates.list(name);
    categories.push({
      name,
      items: list.slice(0, AFFINE_TEMPLATE_CAP).map(template => ({
        name: template.name ?? name,
        category: name,
        template,
      })),
    });
  }
  return categories;
}

export async function insertAffineTemplate(
  std: BlockStdScope,
  template: Template
): Promise<void> {
  try {
    const gfx = std.get(GfxControllerIdentifier);
    const next = cloneTemplate(template);
    const center = { x: gfx.viewport.centerX, y: gfx.viewport.centerY };
    const templateJob = createTemplateJob(std, next.type, center);

    const { assets } = next;
    if (assets) {
      await Promise.all(
        Object.entries(assets).map(([key, value]) =>
          fetch(value)
            .then(res => res.blob())
            .then(blob => templateJob.job.assets.set(key, blob))
        )
      );
    }

    const insertedBound = await templateJob.insertTemplate(next.content);
    if (insertedBound && next.type === 'template') {
      const padding = 20 / gfx.viewport.zoom;
      gfx.viewport.setViewportByBound(
        insertedBound instanceof Bound
          ? insertedBound
          : new Bound(
              insertedBound.x,
              insertedBound.y,
              insertedBound.w,
              insertedBound.h
            ),
        [padding, padding, padding, padding],
        true
      );
    }
  } catch (error) {
    console.error('Failed to insert edgeless template', error);
  }
}

export { AFFINE_TEMPLATE_CAP };
