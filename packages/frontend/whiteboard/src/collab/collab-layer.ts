import { I18n } from '@affine/i18n';
import { disposeMember } from '@blocksuite/affine/global/disposable';
import { Bound } from '@blocksuite/affine/global/gfx';
import {
  CommentProviderIdentifier,
  FeatureFlagService,
} from '@blocksuite/affine/shared/services';
import { GfxExtension } from '@blocksuite/affine/std/gfx';

import { parseXywhRect } from '../perf/l0-scene';
import { whiteboardTelemetry } from '../perf/telemetry';
import { WhiteboardCommentAnchorsIdentifier } from './anchor-provider';
import {
  getDocAwareness,
  patchCollabAwareness,
  readLocalPayload,
} from './awareness';
import { type CommentPin, pinsForBlock } from './comment-anchor';
import {
  activeLasers,
  consumeSummon,
  createdByOf,
  formatTimer,
  isFacilitatorLockedForPeer,
  isPrivateHidden,
  localAuthorId,
  nextFrameIndex,
  pauseTimer,
  prevFrameIndex,
  readFacilitatorLock,
  readPrivateMode,
  readSharedTimer,
  remainingTimerMs,
  resumeTimer,
  startTimer,
} from './facilitation';
import { WhiteboardPresenceBar } from './presence-bar';
import {
  ATTENTION_TTL_MS,
  canFollow,
  followViewport,
  isAttentionActive,
  makeAttention,
  makeLaser,
  makeSummon,
  POINTER_THROTTLE_MS,
  readPeers,
  shouldPublish,
  VIEWPORT_THROTTLE_MS,
  type WhiteboardPeer,
} from './protocol';
import {
  castVote,
  closeVoteSession,
  getDocYjs,
  readVoteSession,
  startVoteSession,
  tallyVotes,
} from './vote-session';

/**
 * Presence, follow, attention pulse and gfx comment pins (plan §6.6).
 */
export class WhiteboardCollabLayerExtension extends GfxExtension {
  static override key = 'whiteboardCollabLayer';

  private readonly overlay: HTMLDivElement = document.createElement('div');
  private bar: WhiteboardPresenceBar | null = null;
  private lastPointer = 0;
  private lastViewport = 0;
  private following: number | null = null;
  private attentionTimer = 0;
  private tickTimer = 0;
  private laserOn = false;
  private readonly appliedSummons = new Set<string>();
  private presentIndex = 0;
  private readonly unsubs: Array<() => void> = [];

  private readonly onPointerMove = (event: Event) => {
    if (!(event instanceof PointerEvent)) return;
    const now = Date.now();
    if (!shouldPublish(this.lastPointer, now, POINTER_THROTTLE_MS)) return;
    this.lastPointer = now;
    const [x, y] = this.gfx.viewport.toModelCoordFromClientCoord([
      event.clientX,
      event.clientY,
    ]);
    if (this.laserOn && this.facilitationEnabled()) {
      patchCollabAwareness(this.awareness(), {
        pointer: { x, y },
        laser: makeLaser({ x, y }, now),
      });
      return;
    }
    patchCollabAwareness(this.awareness(), { pointer: { x, y } });
  };

  override mounted() {
    if (!this.flagEnabled()) return;
    this.overlay.className = 'wb-collab-overlay';
    this.overlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:2;';
    const mount =
      document.querySelector('.affine-edgeless-viewport') ?? this.std.host;
    mount.append(this.overlay);

    if (!customElements.get('wb-presence-bar')) {
      customElements.define('wb-presence-bar', WhiteboardPresenceBar);
    }
    this.bar = document.createElement('wb-presence-bar');
    this.bar.onFollow = clientId => this.setFollow(clientId);
    this.bar.onAttention = () => this.publishAttention();
    this.wireFacilitationBar();
    document.body.append(this.bar);

    const element = this.gfx.viewport.element ?? mount;
    element.addEventListener('pointermove', this.onPointerMove);
    const viewport = this.gfx.viewport.viewportUpdated.subscribe(() => {
      this.publishViewport();
      this.draw();
    });
    const comments = this.std.getOptional(CommentProviderIdentifier);
    const redraw = () => this.draw();
    const commentSubs = comments
      ? [
          comments.onCommentAdded(redraw),
          comments.onCommentResolved(redraw),
          comments.onCommentDeleted(redraw),
        ]
      : [];
    const anchors = this.std.getOptional(WhiteboardCommentAnchorsIdentifier);
    const stopAnchors = anchors?.subscribe(redraw);
    const awareness = this.awareness();
    const onChange = () => this.onAwareness();
    awareness?.on?.('change', onChange);
    const doc = this.std.store.doc as {
      on?: (event: string, fn: (update: Uint8Array) => void) => void;
      off?: (event: string, fn: (update: Uint8Array) => void) => void;
    };
    const onDocUpdate = (update: Uint8Array) => {
      if (update?.byteLength)
        whiteboardTelemetry.noteWsPayload(update.byteLength);
    };
    doc.on?.('update', onDocUpdate);
    this.unsubs.push(
      () => viewport.unsubscribe(),
      () => awareness?.off?.('change', onChange),
      () => element.removeEventListener('pointermove', this.onPointerMove),
      () => doc.off?.('update', onDocUpdate),
      () => commentSubs.forEach(disposeMember),
      () => stopAnchors?.()
    );
    this.publishViewport();
    this.onAwareness();
    if (this.facilitationEnabled()) {
      this.tickTimer = window.setInterval(() => this.syncBar(), 500);
      const onClick = (event: Event) => this.onVoteClick(event);
      this.overlay.addEventListener('pointerdown', onClick);
      this.unsubs.push(() =>
        this.overlay.removeEventListener('pointerdown', onClick)
      );
    }
  }

  override unmounted() {
    if (this.attentionTimer) window.clearTimeout(this.attentionTimer);
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    for (const unsub of this.unsubs.splice(0)) unsub();
    this.bar?.remove();
    this.bar = null;
    this.overlay.remove();
    this.following = null;
    patchCollabAwareness(this.awareness(), {
      pointer: undefined,
      followClientId: null,
      attention: undefined,
      viewport: undefined,
      editing: undefined,
      timer: undefined,
      laser: undefined,
      summon: undefined,
      privateMode: undefined,
      facilitatorLock: undefined,
      presentation: undefined,
    });
  }

  private awareness() {
    return getDocAwareness(this.std.store);
  }

  private flagEnabled() {
    try {
      const service =
        this.std.getOptional(FeatureFlagService) ??
        this.std.store.get(FeatureFlagService);
      return (
        !!service.getFlag('enable_whiteboard_collab') ||
        !!service.getFlag('enable_whiteboard_facilitation')
      );
    } catch {
      return false;
    }
  }

  private facilitationEnabled() {
    try {
      const service =
        this.std.getOptional(FeatureFlagService) ??
        this.std.store.get(FeatureFlagService);
      return !!service.getFlag('enable_whiteboard_facilitation');
    } catch {
      return false;
    }
  }

  private setFollow(clientId: number | null) {
    const awareness = this.awareness();
    const states = awareness?.getStates?.();
    if (
      clientId != null &&
      states &&
      !canFollow(states as never, clientId, awareness?.clientID)
    ) {
      return;
    }
    this.following = clientId;
    patchCollabAwareness(awareness, { followClientId: clientId });
    this.applyFollow();
    this.syncBar();
  }

  private wireFacilitationBar() {
    if (!this.bar) return;
    this.bar.onTimer = minutes => {
      patchCollabAwareness(this.awareness(), {
        timer: startTimer(minutes * 60_000, Date.now(), this.awareness()?.clientID),
      });
      this.syncBar();
    };
    this.bar.onTimerPause = () => {
      const local = readLocalPayload(this.awareness());
      const timer = local?.timer;
      if (!timer) return;
      patchCollabAwareness(this.awareness(), {
        timer: timer.paused ? resumeTimer(timer) : pauseTimer(timer),
      });
      this.syncBar();
    };
    this.bar.onLaser = () => {
      this.laserOn = !this.laserOn;
      if (!this.laserOn) {
        patchCollabAwareness(this.awareness(), { laser: undefined });
      }
      this.syncBar();
    };
    this.bar.onSummon = () => {
      const viewport = this.gfx.viewport;
      patchCollabAwareness(this.awareness(), {
        summon: makeSummon({
          x: viewport.centerX,
          y: viewport.centerY,
          zoom: viewport.zoom,
        }),
      });
    };
    this.bar.onPrivate = () => {
      const local = readLocalPayload(this.awareness());
      patchCollabAwareness(this.awareness(), {
        privateMode: !local?.privateMode,
      });
      this.applyPrivateMode();
      this.syncBar();
    };
    this.bar.onLock = () => {
      const local = readLocalPayload(this.awareness());
      patchCollabAwareness(this.awareness(), {
        facilitatorLock: !local?.facilitatorLock,
      });
      this.syncBar();
    };
    this.bar.onVote = () => {
      const doc = getDocYjs(this.std.store);
      if (!doc) return;
      const session = readVoteSession(doc);
      if (session && !session.closed) {
        closeVoteSession(doc);
      } else {
        startVoteSession(doc);
      }
      this.syncBar();
      this.draw();
    };
    this.bar.onPresent = delta => {
      const frames = this.frameModels();
      if (!frames.length) return;
      this.presentIndex =
        delta < 0
          ? prevFrameIndex(this.presentIndex, frames.length)
          : nextFrameIndex(this.presentIndex, frames.length);
      const frame = frames[this.presentIndex];
      const rect = parseXywhRect(frame.xywh);
      if (!rect) return;
      this.gfx.viewport.setViewportByBound(
        new Bound(rect.x, rect.y, rect.w, rect.h),
        [0.1, 0.1, 0.1, 0.1],
        true
      );
      patchCollabAwareness(this.awareness(), {
        presentation: { frameId: frame.id, index: this.presentIndex },
      });
    };
  }

  private frameModels() {
    return [...this.gfx.layer.blocks]
      .filter(model => model.flavour === 'affine:frame')
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private applySummon() {
    const awareness = this.awareness();
    const states = awareness?.getStates?.();
    if (!states) return;
    const peers = readPeers(states as never, awareness?.clientID);
    const summon = consumeSummon(peers, this.appliedSummons);
    if (!summon) return;
    this.gfx.viewport.setViewport(summon.zoom, [summon.x, summon.y]);
  }

  private applyPrivateMode() {
    const awareness = this.awareness();
    const states = awareness?.getStates?.();
    const local = readLocalPayload(awareness);
    const on = states
      ? readPrivateMode(states as never, local)
      : !!local?.privateMode;
    const author = localAuthorId(
      awareness?.getLocalState?.() as
        | { user?: { name?: string; id?: string } }
        | undefined
    );
    for (const model of this.gfx.layer.blocks) {
      const view = this.std.host.view.getBlock(model.id);
      if (!(view instanceof HTMLElement)) continue;
      const hidden = isPrivateHidden(
        createdByOf(model as never),
        author,
        on
      );
      view.style.opacity = hidden ? '0' : '';
      view.style.pointerEvents = hidden ? 'none' : '';
    }
  }

  private applyFacilitatorLock() {
    const awareness = this.awareness();
    const states = awareness?.getStates?.();
    const local = readLocalPayload(awareness);
    const lock = states
      ? readFacilitatorLock(states as never, awareness?.clientID, local)
      : { on: false as const };
    if (isFacilitatorLockedForPeer(lock, awareness?.clientID)) {
      this.gfx.viewport.locked = true;
      return;
    }
    const focusOn = [...this.gfx.layer.blocks].some(model => {
      const props = (
        model as { props?: { focusMode?: boolean }; flavour: string }
      ).props;
      return model.flavour === 'wb:board' && !!props?.focusMode;
    });
    if (!focusOn) this.gfx.viewport.locked = false;
  }

  private onVoteClick(event: Event) {
    if (!(event instanceof PointerEvent)) return;
    const doc = getDocYjs(this.std.store);
    const session = doc ? readVoteSession(doc) : undefined;
    if (!doc || !session || session.closed) return;
    event.stopPropagation();
    const [x, y] = this.gfx.viewport.toModelCoordFromClientCoord([
      event.clientX,
      event.clientY,
    ]);
    const voter =
      localAuthorId(
        this.awareness()?.getLocalState?.() as
          | { user?: { name?: string; id?: string } }
          | undefined
      ) || String(this.awareness()?.clientID ?? 'local');
    for (const model of this.gfx.layer.blocks) {
      const rect = parseXywhRect(model.xywh);
      if (!rect) continue;
      if (
        x >= rect.x &&
        y >= rect.y &&
        x <= rect.x + rect.w &&
        y <= rect.y + rect.h
      ) {
        castVote(doc, voter, model.id);
        this.draw();
        return;
      }
    }
  }

  private publishViewport() {
    // A follower's camera mirrors the leader; publishing it would feed the
    // leader's own position back to them.
    if (this.following != null) return;
    const now = Date.now();
    if (!shouldPublish(this.lastViewport, now, VIEWPORT_THROTTLE_MS)) return;
    this.lastViewport = now;
    const viewport = this.gfx.viewport;
    patchCollabAwareness(this.awareness(), {
      viewport: {
        x: viewport.centerX,
        y: viewport.centerY,
        zoom: viewport.zoom,
      },
    });
  }

  private publishAttention() {
    const bound = this.gfx.viewport.viewportBounds;
    patchCollabAwareness(this.awareness(), {
      attention: makeAttention({
        x: bound.x,
        y: bound.y,
        w: bound.w,
        h: bound.h,
      }),
    });
    if (this.attentionTimer) window.clearTimeout(this.attentionTimer);
    this.attentionTimer = window.setTimeout(() => {
      patchCollabAwareness(this.awareness(), { attention: undefined });
      this.draw();
    }, ATTENTION_TTL_MS);
    this.draw();
  }

  private onAwareness() {
    if (this.following != null) this.applyFollow();
    this.applySummon();
    this.applyPrivateMode();
    this.applyFacilitatorLock();
    this.syncBar();
    this.draw();
  }

  private applyFollow() {
    const states = this.awareness()?.getStates?.();
    if (!states || this.following == null) return;
    const viewport = followViewport(states as never, this.following);
    if (!viewport) return;
    this.gfx.viewport.setViewport(viewport.zoom, [viewport.x, viewport.y]);
  }

  private syncBar() {
    if (!this.bar) return;
    const awareness = this.awareness();
    const states = awareness?.getStates?.();
    this.bar.peers = states
      ? readPeers(states as never, awareness?.clientID)
      : [];
    this.bar.following =
      this.following ?? readLocalPayload(awareness)?.followClientId ?? null;
    this.bar.facilitationEnabled = this.facilitationEnabled();
    const local = readLocalPayload(awareness);
    const timer = states
      ? readSharedTimer(states as never, local)
      : local?.timer;
    this.bar.timerLabel = formatTimer(remainingTimerMs(timer));
    this.bar.timerPaused = !!timer?.paused;
    this.bar.laserOn = this.laserOn;
    this.bar.privateOn = states
      ? readPrivateMode(states as never, local)
      : !!local?.privateMode;
    const lock = states
      ? readFacilitatorLock(states as never, awareness?.clientID, local)
      : { on: !!local?.facilitatorLock, owner: awareness?.clientID };
    this.bar.lockOn = lock.on;
    const doc = getDocYjs(this.std.store);
    const vote = doc ? readVoteSession(doc) : undefined;
    this.bar.voteOpen = !!vote && !vote.closed;
    whiteboardTelemetry.noteCollaborators(this.bar.peers.length);
    if (states) {
      try {
        whiteboardTelemetry.noteWsPayload(
          JSON.stringify([...states.values()]).length
        );
      } catch {
        // awareness payload size is best-effort
      }
    }
    this.bar.requestUpdate();
  }

  private commentPins(): CommentPin[] {
    const anchors = this.std.getOptional(WhiteboardCommentAnchorsIdentifier);
    const resolve = anchors ? (id: string) => anchors.get(id) : undefined;
    const pins: CommentPin[] = [];
    for (const model of this.gfx.layer.blocks) {
      const rect = parseXywhRect(model.xywh);
      if (!rect) continue;
      const comments =
        (
          model as {
            comments?: Record<string, boolean>;
            props?: { comments?: Record<string, boolean> };
          }
        ).comments ??
        (model as { props?: { comments?: Record<string, boolean> } }).props
          ?.comments;
      pins.push(...pinsForBlock(model.id, rect, comments, resolve));
    }
    return pins;
  }

  private draw() {
    const camera = this.gfx.viewport;
    const scale = camera.zoom * camera.viewScale;
    const toView = (x: number, y: number) => ({
      x: (x - camera.viewportX) * scale,
      y: (y - camera.viewportY) * scale,
    });
    whiteboardTelemetry.noteBoardObjects(this.gfx.layer.blocks.length);
    const awareness = this.awareness();
    const peers: WhiteboardPeer[] = awareness?.getStates?.()
      ? readPeers(awareness.getStates() as never, awareness.clientID)
      : [];
    const pulses = peers
      .map(peer => peer.attention)
      .filter(bound => isAttentionActive(bound));
    const local = readLocalPayload(awareness)?.attention;
    if (isAttentionActive(local)) pulses.push(local);

    const pins = this.commentPins();
    this.overlay.replaceChildren();
    for (const peer of peers) {
      if (!peer.pointer) continue;
      const tip = toView(peer.pointer.x, peer.pointer.y);
      const cursor = document.createElement('div');
      cursor.className = 'wb-collab-cursor';
      cursor.style.cssText = `position:absolute;left:${tip.x}px;top:${tip.y}px;pointer-events:none;transform:translate(-2px,-2px);`;
      const dot = document.createElement('span');
      dot.style.cssText = `display:block;width:10px;height:10px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${peer.color};box-shadow:0 1px 3px rgba(0,0,0,.35);`;
      const name = document.createElement('span');
      name.className = 'wb-collab-cursor-name';
      // textContent, never innerHTML: peer names are remote input.
      name.textContent = peer.name;
      name.style.cssText = `position:absolute;left:12px;top:10px;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;white-space:nowrap;color:#fff;background:${peer.color};`;
      cursor.append(dot, name);
      this.overlay.append(cursor);
    }
    for (const laser of activeLasers(peers)) {
      const tip = toView(laser.x, laser.y);
      const beam = document.createElement('div');
      beam.className = 'wb-collab-laser';
      beam.style.cssText = `position:absolute;left:${tip.x - 10}px;top:${tip.y - 10}px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle, #ef4444 0%, transparent 70%);pointer-events:none;box-shadow:0 0 12px #ef4444;`;
      this.overlay.append(beam);
    }
    const voteDoc = getDocYjs(this.std.store);
    const vote = voteDoc ? readVoteSession(voteDoc) : undefined;
    this.overlay.style.pointerEvents = vote && !vote.closed ? 'auto' : 'none';
    if (vote) {
      const totals = tallyVotes(vote);
      for (const model of this.gfx.layer.blocks) {
        const count = totals[model.id];
        if (!count) continue;
        const rect = parseXywhRect(model.xywh);
        if (!rect) continue;
        const view = toView(rect.x + rect.w, rect.y);
        const badge = document.createElement('div');
        badge.className = 'wb-collab-vote';
        badge.textContent = String(count);
        badge.style.cssText = `position:absolute;left:${view.x - 8}px;top:${view.y - 8}px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#0d7377;color:#fff;font-size:11px;line-height:16px;text-align:center;pointer-events:none;`;
        this.overlay.append(badge);
      }
    }
    for (const pulse of pulses) {
      if (!pulse) continue;
      const topLeft = toView(pulse.x, pulse.y);
      const node = document.createElement('div');
      node.className = 'wb-collab-pulse';
      node.style.cssText = `position:absolute;left:${topLeft.x}px;top:${topLeft.y}px;width:${pulse.w * scale}px;height:${pulse.h * scale}px;border:2px solid var(--affine-primary-color);border-radius:8px;box-shadow:0 0 0 6px color-mix(in srgb, var(--affine-primary-color) 25%, transparent);pointer-events:none;`;
      this.overlay.append(node);
    }
    for (const pin of pins) {
      const view = toView(pin.x, pin.y);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wb-collab-pin';
      button.setAttribute(
        'aria-label',
        I18n['com.affine.whiteboard.collab.comment-pin']()
      );
      button.style.cssText = `position:absolute;left:${view.x - 8}px;top:${view.y - 8}px;width:16px;height:16px;border:0;border-radius:50%;background:var(--affine-primary-color);pointer-events:auto;cursor:pointer;`;
      button.addEventListener('click', event => {
        event.stopPropagation();
        this.std
          .getOptional(CommentProviderIdentifier)
          ?.highlightComment(pin.commentId);
      });
      this.overlay.append(button);
    }
  }
}
