/**
 * The Forest palette, as the frontend defines it in `app/styles/common/palette.css`: `accent` is the
 * lime ramp, the neutrals are `slate`. Copied rather than shared — this package depends on nothing in
 * the frontend, and a viewer that trails a shade behind a redesign is not a defect.
 *
 * Only the shades this page uses are here. The pairings below are the accessible ones: lime 500 is
 * the brand colour but it carries 1.96:1 against white, so it is a FILL with dark text on it, never
 * text itself. Lime 700 (4.54:1) is the lightest shade usable as text on white, and the dark chrome
 * takes lime 400 (11.5:1 on slate 1000).
 */
const LIME = {
  400: '#afdf3c',
  500: '#99c924',
  600: '#7ba01f',
  700: '#62801a',
  800: '#496015',
} as const;

const SLATE = {
  100: '#f0f1f3',
  200: '#e0e3e8',
  300: '#c1c7d1',
  500: '#8390a2',
  700: '#505d6f',
  900: '#282e38',
  1000: '#14171c',
} as const;

const RED = { 100: '#fdecec', 700: '#bf3636' } as const;
const EMERALD = { 600: '#10b981' } as const;
const YELLOW = { 600: '#f59e0b' } as const;
const BLUE = { 600: '#3b82f6' } as const;

/**
 * Inter and Source Code Pro are the frontend's faces, first in the stack so a machine that has them
 * uses them. They are NOT fetched: a page holding an API key in memory must not talk to a font CDN,
 * for the same reason the Redoc bundle is served from here rather than from one. Everyone else gets
 * the system UI font, which is the price of that.
 */
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Passed to `Redoc.init`. Unknown keys are merged into Redoc's own defaults, so this is additive. */
export const REDOC_THEME = {
  colors: {
    primary: { main: LIME[700] },
    success: { main: EMERALD[600] },
    warning: { main: YELLOW[600] },
    error: { main: RED[700] },
    text: { primary: SLATE[1000], secondary: SLATE[700] },
    border: { light: SLATE[200], dark: SLATE[300] },
    http: {
      get: LIME[600],
      post: EMERALD[600],
      put: BLUE[600],
      patch: YELLOW[600],
      delete: RED[700],
      options: SLATE[700],
      head: SLATE[700],
      basic: SLATE[700],
      link: BLUE[600],
    },
  },
  typography: {
    fontSize: '15px',
    lineHeight: '1.6',
    fontFamily: SANS,
    headings: { fontFamily: SANS, fontWeight: '600' },
    code: { fontFamily: MONO, fontSize: '13px' },
    links: { color: LIME[700], visited: LIME[700], hover: LIME[800] },
  },
  // Forest's own chrome is dark with lime accents; Redoc's two panels are where that reads.
  sidebar: {
    backgroundColor: SLATE[1000],
    textColor: SLATE[300],
    activeTextColor: LIME[400],
    arrow: { color: SLATE[500] },
  },
  rightPanel: { backgroundColor: SLATE[900], textColor: SLATE[100] },
  schema: { typeNameColor: SLATE[700], typeTitleColor: LIME[700], requireLabelColor: RED[700] },
} as const;

/** The shell around Redoc: the key prompt, and the error box it writes into. */
export const PAGE_STYLES = `
      body { margin: 0; font-family: ${SANS}; color: ${SLATE[1000]}; }
      #unlock { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 14px 20px; background: ${SLATE[1000]}; color: #fff; }
      #unlock strong { font-size: 15px; font-weight: 600; margin-right: 4px; }
      #unlock strong span { color: ${LIME[400]}; }
      #unlock label { font-size: 13px; color: ${SLATE[300]}; }
      #unlock input { flex: 1 1 280px; max-width: 420px; padding: 7px 10px; font: inherit; font-size: 14px; color: #fff; background: ${SLATE[900]}; border: 1px solid ${SLATE[700]}; border-radius: 4px; }
      #unlock input:focus { outline: 2px solid ${LIME[500]}; outline-offset: 1px; }
      #unlock button { padding: 7px 16px; font: inherit; font-size: 14px; font-weight: 600; color: ${SLATE[1000]}; background: ${LIME[500]}; border: 0; border-radius: 4px; cursor: pointer; }
      #unlock button:hover { background: ${LIME[400]}; }
      #error { display: none; margin: 20px; padding: 12px 14px; border-left: 3px solid ${RED[700]}; background: ${RED[100]}; color: ${RED[700]}; font-size: 14px; white-space: pre-wrap; }
      #error[data-shown] { display: block; }
`;
