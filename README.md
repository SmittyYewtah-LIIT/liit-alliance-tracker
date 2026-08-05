# LIIT Daily VS Report Generator v0.5

Fixes in this release:
- Loads `template.png` through `fetch()` and `createImageBitmap()` so the canvas remains exportable.
- Fixes the “Tainted canvases may not be exported” PNG error.
- Automatically saves entered roster, points, and daily fields in browser local storage.
- Restores a legacy backup stored under `liitBackup`.

## Run
Use VS Code Live Server. The URL should begin with `http://127.0.0.1` or `http://localhost`.

Do not open `index.html` directly with a `file://` address.


## Template loading fallback
If the page says the template could not be fetched, use the **Report template** file picker and select `template.png` from the project folder. The chosen local image is loaded into the canvas without tainting it, so PNG export remains available. Saved roster data is stored in browser localStorage and is not erased by choosing a template.


## v0.6 clean-template fix
- Uses `template-clean.png`, which has all prior report data removed.
- New values are drawn onto blank data areas instead of over old values.
- Canvas masks are now fully opaque.
- Excused zero-point members are no longer duplicated in Leadership Follow-Up.
