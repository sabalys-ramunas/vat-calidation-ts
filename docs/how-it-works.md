# How It Works

`vat-validation-ts` talks to the European Commission VIES `checkVat` SOAP service directly.

## Request Flow

1. The caller provides either a combined VAT string or a structured `{ countryCode, vatNumber }` object.
2. The library normalizes the country code and VAT number body.
3. A SOAP envelope is created for the official `checkVat` operation.
4. The request is sent to the VIES endpoint over HTTPS.
5. The response is classified as SOAP or non-SOAP before any parsing logic runs.
6. SOAP responses are parsed and converted into a normalized TypeScript object.

## Why The Response Is Normalized

The raw SOAP payload is not pleasant to consume. VIES returns stringly typed fields, namespace-heavy XML, and placeholder values such as `---` when company metadata is not available.

This library normalizes that into:

- a canonical VAT string
- a typed `valid` boolean
- `company.name` as `string | null`
- `company.address.raw` and `company.address.lines`
- `request.checkedAt` metadata

## Response Classification

- SOAP responses are parsed even when VIES uses HTTP `500` for a SOAP fault.
- Non-SOAP `429`/`408`/`504`/`5xx` responses are mapped into retryable typed errors.
- Non-SOAP `4xx` responses become non-retryable transport errors.
- A payload is only treated as a parse error when it looks like SOAP but is malformed or missing required fields such as `valid`.

## Input Normalization Rules

- Input is uppercased
- separators such as spaces, dots, and dashes are removed
- leading zeroes are preserved
- `GR` is normalized to `EL`
- `XI` is accepted as a VIES prefix
- unsupported country codes are rejected before any network call

## Service Limits

VIES is not a low-latency API designed for high-volume traffic. Temporary faults are normal. This package exposes them as typed retryable errors and gives the batch helper a bounded concurrency model so the client behaves predictably under load.
