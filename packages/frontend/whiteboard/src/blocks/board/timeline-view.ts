import { I18n } from '@affine/i18n';
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { BoardCardPreview } from './grid';
import type { BoardLodLevel } from './live-budget';
import type { BoardLodHandlers } from './lod-view';

export type TimelineScale = 'day' | 'week' | 'month' | 'quarter';

export type TimelineMilestone = {
  id: string;
  at: string;
  title: string;
};

export type TimelineRow = BoardCardPreview & {
  startAt?: string;
  endAt?: string;
  invalidRange?: boolean;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function parseTimelineDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function isInvalidRange(start?: string, end?: string): boolean {
  const from = parseTimelineDate(start);
  const to = parseTimelineDate(end);
  return !!from && !!to && to.getTime() < from.getTime();
}

export function timelineWindow(
  rows: Array<{ startAt?: string; endAt?: string }>,
  scale: TimelineScale,
  now = new Date()
): { start: Date; end: Date; ticks: Date[] } {
  const dates = rows.flatMap(row =>
    [parseTimelineDate(row.startAt), parseTimelineDate(row.endAt)].filter(
      (value): value is Date => !!value
    )
  );
  const min = dates.reduce(
    (acc, date) => (date < acc ? date : acc),
    dates[0] ?? now
  );
  const max = dates.reduce(
    (acc, date) => (date > acc ? date : acc),
    dates[0] ?? new Date(now.getTime() + 14 * MS_DAY)
  );
  const start = startOfScale(min, scale);
  const end = endOfScale(max, scale);
  return { start, end, ticks: ticksBetween(start, end, scale) };
}

function startOfScale(date: Date, scale: TimelineScale): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (scale === 'month' || scale === 'quarter') {
    const month = scale === 'quarter' ? Math.floor(copy.getUTCMonth() / 3) * 3 : copy.getUTCMonth();
    return new Date(Date.UTC(copy.getUTCFullYear(), month, 1));
  }
  if (scale === 'week') {
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
  }
  return copy;
}

function endOfScale(date: Date, scale: TimelineScale): Date {
  const start = startOfScale(date, scale);
  if (scale === 'day') return new Date(start.getTime() + MS_DAY);
  if (scale === 'week') return new Date(start.getTime() + 7 * MS_DAY);
  if (scale === 'month') {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  }
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
}

function ticksBetween(start: Date, end: Date, scale: TimelineScale): Date[] {
  const ticks: Date[] = [];
  let cursor = new Date(start);
  const last = end.getTime() <= start.getTime() ? start.getTime() + MS_DAY : end.getTime();
  while (cursor.getTime() <= last && ticks.length < 64) {
    ticks.push(new Date(cursor));
    cursor = endOfScale(cursor, scale);
  }
  return ticks;
}

export function barPercent(
  start: Date | null,
  end: Date | null,
  windowStart: Date,
  windowEnd: Date
): { left: number; width: number } | null {
  if (!start && !end) return null;
  const span = Math.max(1, windowEnd.getTime() - windowStart.getTime());
  const from = (start ?? end ?? windowStart).getTime();
  const to = (end ?? start ?? windowEnd).getTime();
  const left = ((from - windowStart.getTime()) / span) * 100;
  const width = ((to - from) / span) * 100;
  return {
    left: Math.min(100, Math.max(0, left)),
    width: Math.min(100, Math.max(2, width)),
  };
}

function tickLabel(date: Date, scale: TimelineScale): string {
  if (scale === 'day') return date.toISOString().slice(5, 10);
  if (scale === 'week') return date.toISOString().slice(0, 10);
  if (scale === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

export function nextTimelineScale(scale: TimelineScale): TimelineScale {
  if (scale === 'day') return 'week';
  if (scale === 'week') return 'month';
  if (scale === 'month') return 'quarter';
  return 'day';
}

export function renderBoardTimeline(options: {
  rows: TimelineRow[];
  level: BoardLodLevel;
  scale?: TimelineScale;
  milestones?: TimelineMilestone[];
  handlers?: BoardLodHandlers & {
    onDates?: (rowId: string, startAt: string, endAt: string) => void;
    onScale?: (scale: TimelineScale) => void;
  };
}) {
  const scale = options.scale ?? 'week';
  const dated = options.rows.map(row => ({
    ...row,
    invalidRange: isInvalidRange(row.startAt, row.endAt),
  }));
  const hasDates = dated.some(row => row.startAt || row.endAt);
  const window = timelineWindow(dated, scale);
  const interactive = options.level === 'l2' && !!options.handlers?.onDates;

  const scaleLabel =
    scale === 'day'
      ? I18n['com.affine.whiteboard.board.timeline.scale.day']()
      : scale === 'week'
        ? I18n['com.affine.whiteboard.board.timeline.scale.week']()
        : scale === 'month'
          ? I18n['com.affine.whiteboard.board.timeline.scale.month']()
          : I18n['com.affine.whiteboard.board.timeline.scale.quarter']();

  if (!hasDates) {
    return html`
      <div class="wb-board-timeline" data-testid="wb-board-timeline" data-empty="true">
        ${I18n['com.affine.whiteboard.board.timeline.empty']()}
      </div>
    `;
  }

  return html`
    <div
      class="wb-board-timeline wb-board-timeline--${options.level}"
      data-testid="wb-board-timeline"
      data-scale=${scale}
    >
      <div class="wb-board-timeline__axis">
        ${repeat(
          window.ticks,
          tick => tick.toISOString(),
          tick => html`<span class="wb-board-timeline__tick">${tickLabel(tick, scale)}</span>`
        )}
        ${
          options.handlers?.onScale
            ? html`<button
                type="button"
                data-testid="wb-board-timeline-scale"
                @click=${() => options.handlers?.onScale?.(nextTimelineScale(scale))}
              >
                ${scaleLabel}
              </button>`
            : nothing
        }
      </div>
      ${repeat(
        options.milestones ?? [],
        item => item.id,
        item => {
          const at = parseTimelineDate(item.at);
          const bar = barPercent(at, at, window.start, window.end);
          if (!bar) return nothing;
          return html`<div
            class="wb-board-timeline__milestone"
            style=${styleMap({ left: `${bar.left}%` })}
            title=${item.title}
          >
            ${options.level === 'l0' ? nothing : item.title}
          </div>`;
        }
      )}
      ${repeat(
        dated,
        row => row.id,
        row => {
          const bar = barPercent(
            parseTimelineDate(row.startAt),
            parseTimelineDate(row.endAt),
            window.start,
            window.end
          );
          return html`
            <div class="wb-board-timeline__row" data-row-id=${row.id}>
              ${
                options.level === 'l0'
                  ? nothing
                  : html`<div class="wb-board-timeline__title">${row.title}</div>`
              }
              ${
                bar
                  ? html`<div
                      class="wb-board-timeline__track"
                    >
                      <div
                        class="wb-board-timeline__bar${row.invalidRange ? ' is-invalid' : ''}"
                        style=${styleMap({
                          left: `${bar.left}%`,
                          width: `${bar.width}%`,
                        })}
                        ?draggable=${interactive}
                        @pointerdown=${(event: PointerEvent) => {
                          if (!interactive || !row.startAt || !row.endAt) return;
                          event.stopPropagation();
                          const start = parseTimelineDate(row.startAt);
                          const end = parseTimelineDate(row.endAt);
                          if (!start || !end) return;
                          const delta = 1;
                          const nextStart = new Date(start.getTime() + delta * MS_DAY);
                          const nextEnd = new Date(end.getTime() + delta * MS_DAY);
                          options.handlers?.onDates?.(
                            row.id,
                            nextStart.toISOString(),
                            nextEnd.toISOString()
                          );
                        }}
                      ></div>
                    </div>`
                  : html`<div class="wb-board-timeline__placeholder">
                      ${I18n['com.affine.whiteboard.board.timeline.empty']()}
                    </div>`
              }
              ${
                row.invalidRange && options.level !== 'l0'
                  ? html`<div class="wb-board-timeline__warn">
                      ${I18n['com.affine.whiteboard.board.timeline.invalid-range']()}
                    </div>`
                  : nothing
              }
            </div>
          `;
        }
      )}
    </div>
  `;
}
