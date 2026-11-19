// A digit is one unit wide and a separator about half of that.
const SEPARATOR_WIDTH = 0.5
/** The widest text, in digits, the giant number shows at full size on a 375 px phone next to its unit. Tuned to --ds-text-figure-xl in tokens.css and the .number-stepper__value--long override: recheck at 375 px when either changes. */
export const FULL_SIZE_DIGITS = 4

/** True when a giant number must shrink to stay inside the screen: "100,25" does, "62,5" and "1000" do not. */
export function isLongFigure(text: string): boolean {
  const width = [...text].reduce((sum, char) => sum + (/\d/.test(char) ? 1 : SEPARATOR_WIDTH), 0)
  return width > FULL_SIZE_DIGITS
}
