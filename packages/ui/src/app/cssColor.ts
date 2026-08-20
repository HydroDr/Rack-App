/**
 * PixiJS's Application background option needs a resolved color, not a
 * CSS custom property string — this reads the current computed value of
 * a --color-* token from :root/[data-theme] so canvas backgrounds stay
 * token-driven (Design_System.docx §6.1's "never hardcoded hex") instead
 * of duplicating a hex literal that would drift from the token.
 */
export function resolveCssColor(customPropertyName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(customPropertyName).trim();
  return value === "" ? fallback : value;
}
