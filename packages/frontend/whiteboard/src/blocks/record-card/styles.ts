import { css } from 'lit';

export const recordCardStyles = css`
  .wb-record-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 12px;
    border-radius: var(--mosaic-chrome-radius, 8px);
    border: var(--mosaic-chrome-border, 1px solid var(--affine-border-color));
    background: var(
      --mosaic-paper,
      var(--affine-background-overlay-panel-color)
    );
    box-shadow: var(--mosaic-app-card-shadow, var(--affine-shadow-1));
    color: var(--affine-text-primary-color);
    font-family: var(--mosaic-font-ui, var(--affine-font-family));
    user-select: none;
  }

  .wb-record-card__kicker {
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--affine-text-secondary-color);
  }

  .wb-record-card__title {
    font-size: 16px;
    line-height: 22px;
    font-weight: 600;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    width: 100%;
  }

  .wb-record-card__meta {
    font-size: 12px;
    line-height: 16px;
    color: var(--affine-text-secondary-color);
  }
`;
