// Entry point bundled by esbuild into src/vendor/material.js.
// Imports only the Material Web (Material You / MD3) components the manage
// page uses, so the vendored bundle stays as small as possible. The output
// is self-contained (lit included) so it loads under the MV3 `script-src
// 'self'` CSP without any network access.

import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/dialog/dialog.js";
import "@material/web/divider/divider.js";
import "@material/web/ripple/ripple.js";

// Apply the M3 typography scale to the document so md-typescale-* classes
// (e.g. md-typescale-headline-small) render with the correct fonts/metrics.
import { styles as typescaleStyles } from "@material/web/typography/md-typescale-styles.js";

document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
