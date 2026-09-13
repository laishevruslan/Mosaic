const sheets = new WeakMap<object, CSSStyleSheet>();

function sheetFor(key: object, cssText: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined') return null;
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    sheets.set(key, sheet);
  }
  return sheet;
}

export function adoptStyleSheet(
  root: ShadowRoot | null | undefined,
  cssText: string,
  key: object
): void {
  const sheet = sheetFor(key, cssText);
  if (!root || !sheet) return;
  if (root.adoptedStyleSheets.includes(sheet)) return;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

export function dropStyleSheet(
  root: ShadowRoot | null | undefined,
  key: object
): void {
  const sheet = sheets.get(key);
  if (!root || !sheet) return;
  root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
    current => current !== sheet
  );
}
