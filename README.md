# LIIT Daily VS Report Generator v0.4

Fixes in this release:
- Loads `template.png` through `fetch()` and `createImageBitmap()` so the canvas remains exportable.
- Fixes the “Tainted canvases may not be exported” PNG error.
- Automatically saves entered roster, points, and daily fields in browser local storage.
- Restores a legacy backup stored under `liitBackup`.

## Run
Use VS Code Live Server. The URL should begin with `http://127.0.0.1` or `http://localhost`.

Do not open `index.html` directly with a `file://` address.
