# Guided Configurator Quote Integration

The guided configurator supports two honest submission modes.

## Current static-site mode

When the `jq-quote-endpoint` meta value in `configurator.html` is empty, the
quote form prepares a complete email addressed to `info@jqwoodworking.com`.
The customer must send that email from their email application. Local file
uploads cannot be attached automatically in this mode, so the interface asks
the customer to attach them to the prepared email.

## Connected endpoint mode

Set the meta value to an HTTPS endpoint that accepts `multipart/form-data`:

```html
<meta name="jq-quote-endpoint" content="https://example.com/api/quotes">
```

The request includes the contact fields, selected files, and a `project` field
containing the complete guided-project JSON. A successful endpoint should
respond with a 2xx status and JSON shaped like:

```json
{
  "reference": "JQ-2026-1234"
}
```

Only a successful server response produces an on-screen submitted confirmation.
Endpoint secrets must remain on the server and must never be embedded in this
static repository.
