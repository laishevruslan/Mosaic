export function enterFocusMode(input: {
  viewport?: { locked: boolean };
  setFocus: (on: boolean) => void;
  setExempt: (on: boolean) => void;
}): boolean {
  const wasLocked = !!input.viewport?.locked;
  input.setFocus(true);
  input.setExempt(true);
  if (input.viewport) input.viewport.locked = true;
  return wasLocked;
}

export function exitFocusMode(
  input: {
    viewport?: { locked: boolean };
    setFocus: (on: boolean) => void;
    setExempt: (on: boolean) => void;
  },
  wasLocked: boolean
) {
  input.setFocus(false);
  input.setExempt(false);
  if (input.viewport) input.viewport.locked = wasLocked;
}
