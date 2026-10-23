# PDF service

Turns the CRM's document HTML into A4 PDFs with Chromium. It is only needed in
staging and production: in development the app renders PDFs itself with the
locally installed Playwright Chromium.

- No database access, nothing stored on disk.
- Every request must carry an HMAC signature made with `PDF_SERVICE_SECRET`
  (the same value is set in the app). Requests older than 5 minutes are refused.
- All network requests are blocked while rendering; fonts are embedded in the HTML.

## Deploy on Render (free web service)

1. New → Web Service → connect the repository, **Root directory** `pdf-service`, **Runtime** Docker.
2. Instance type: Free. Environment variable `PDF_SERVICE_SECRET` = a random string of 40+ characters.
3. After deploy, set in Vercel: `PDF_RENDERER=service`, `PDF_SERVICE_URL=https://<service>.onrender.com`, `PDF_SERVICE_SECRET=<same value>`.

The free instance sleeps after 15 minutes without traffic; the first PDF after a
pause takes about a minute. The CRM wakes it as soon as someone opens the
Documents tab.

Without this service (`PDF_RENDERER=none`) staff can still print any document
from the preview with the browser's "Save as PDF".

## Run locally

```bash
PDF_SERVICE_SECRET=<40+ characters> npm start
```
