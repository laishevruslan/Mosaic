import { I18n } from '@affine/i18n';
import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type { WhiteboardPeer } from './protocol';

export class WhiteboardPresenceBar extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 21;
      font: 12px/1.4 var(--affine-font-family, sans-serif);
    }

    .wb-presence {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-overlay-panel-color);
      box-shadow: var(--affine-shadow-1);
    }

    .wb-presence__peer {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }

    .wb-presence__peer[data-following='true'] {
      border-color: var(--affine-primary-color);
    }

    .wb-presence__label {
      color: var(--affine-text-secondary-color);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .wb-presence__btn {
      border: 0;
      border-radius: 6px;
      padding: 4px 8px;
      background: var(--affine-background-tertiary-color);
      color: var(--affine-text-primary-color);
      cursor: pointer;
    }

    .wb-presence__facil {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .wb-presence__timer {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .wb-presence__btn[data-on='true'] {
      background: var(--affine-primary-color);
      color: #fff;
    }
  `;

  @property({ attribute: false })
  accessor peers: WhiteboardPeer[] = [];

  @property({ attribute: false })
  accessor following: number | null = null;

  @property({ attribute: false })
  accessor onFollow: ((clientId: number | null) => void) | undefined;

  @property({ attribute: false })
  accessor onAttention: (() => void) | undefined;

  @property({ type: Boolean, attribute: false })
  accessor facilitationEnabled = false;

  @property({ attribute: false })
  accessor timerLabel = '';

  @property({ type: Boolean, attribute: false })
  accessor timerPaused = false;

  @property({ type: Boolean, attribute: false })
  accessor laserOn = false;

  @property({ type: Boolean, attribute: false })
  accessor privateOn = false;

  @property({ type: Boolean, attribute: false })
  accessor lockOn = false;

  @property({ type: Boolean, attribute: false })
  accessor voteOpen = false;

  @property({ attribute: false })
  accessor onTimer: ((minutes: number) => void) | undefined;

  @property({ attribute: false })
  accessor onTimerPause: (() => void) | undefined;

  @property({ attribute: false })
  accessor onLaser: (() => void) | undefined;

  @property({ attribute: false })
  accessor onSummon: (() => void) | undefined;

  @property({ attribute: false })
  accessor onPrivate: (() => void) | undefined;

  @property({ attribute: false })
  accessor onLock: (() => void) | undefined;

  @property({ attribute: false })
  accessor onVote: (() => void) | undefined;

  @property({ attribute: false })
  accessor onPresent: ((delta: number) => void) | undefined;

  private initials(name: string) {
    return name.slice(0, 1).toUpperCase();
  }

  override render() {
    const followed = this.peers.find(peer => peer.clientId === this.following);
    return html`
      <div class="wb-presence" data-wb-presence>
        ${repeat(
          this.peers,
          peer => peer.clientId,
          peer => html`
            <button
              type="button"
              class="wb-presence__peer"
              style="background:${peer.color}"
              data-following=${peer.clientId === this.following}
              title=${
                peer.editing
                  ? I18n['com.affine.whiteboard.collab.editing']({
                      name: peer.name,
                    })
                  : I18n['com.affine.whiteboard.collab.follow']({
                      name: peer.name,
                    })
              }
              @click=${() =>
                this.onFollow?.(
                  this.following === peer.clientId ? null : peer.clientId
                )}
            >
              ${this.initials(peer.name)}
            </button>
          `
        )}
        ${
          followed
            ? html`<span class="wb-presence__label">
                ${I18n['com.affine.whiteboard.collab.following']({
                  name: followed.name,
                })}
              </span>`
            : nothing
        }
        <button
          type="button"
          class="wb-presence__btn"
          @click=${() => this.onAttention?.()}
        >
          ${I18n['com.affine.whiteboard.collab.look-here']()}
        </button>
        ${
          this.facilitationEnabled
            ? html`<div class="wb-presence__facil" data-testid="wb-facilitation">
                <span class="wb-presence__timer" data-testid="wb-timer">
                  ${this.timerLabel || '0:00'}
                </span>
                <button
                  type="button"
                  class="wb-presence__btn"
                  @click=${() => this.onTimer?.(5)}
                >
                  ${I18n['com.affine.whiteboard.facilitation.timer']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  @click=${() => this.onTimerPause?.()}
                >
                  ${
                    this.timerPaused
                      ? I18n['com.affine.whiteboard.facilitation.resume']()
                      : I18n['com.affine.whiteboard.facilitation.pause']()
                  }
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  data-on=${this.laserOn}
                  data-testid="wb-laser"
                  @click=${() => this.onLaser?.()}
                >
                  ${I18n['com.affine.whiteboard.facilitation.laser']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  data-testid="wb-summon"
                  @click=${() => this.onSummon?.()}
                >
                  ${I18n['com.affine.whiteboard.facilitation.summon']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  data-on=${this.privateOn}
                  @click=${() => this.onPrivate?.()}
                >
                  ${I18n['com.affine.whiteboard.facilitation.private']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  data-on=${this.lockOn}
                  @click=${() => this.onLock?.()}
                >
                  ${I18n['com.affine.whiteboard.facilitation.lock']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  data-on=${this.voteOpen}
                  data-testid="wb-vote"
                  @click=${() => this.onVote?.()}
                >
                  ${I18n['com.affine.whiteboard.facilitation.vote']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  @click=${() => this.onPresent?.(-1)}
                >
                  ${I18n['com.affine.whiteboard.facilitation.prev']()}
                </button>
                <button
                  type="button"
                  class="wb-presence__btn"
                  @click=${() => this.onPresent?.(1)}
                >
                  ${I18n['com.affine.whiteboard.facilitation.next']()}
                </button>
              </div>`
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wb-presence-bar': WhiteboardPresenceBar;
  }
}
