# Error Handling

The library treats error handling as part of the API, not incidental behavior.

## Error Classes

- `VatInputError`
  - The caller supplied an invalid or unsupported VAT value.
  - `retryable: false`
- `VatServiceUnavailableError`
  - The VIES platform itself is temporarily unavailable.
  - `retryable: true`
- `VatMemberStateUnavailableError`
  - The target member state's backend is unavailable.
  - `retryable: true`
- `VatRateLimitError`
  - VIES reported busy or concurrency-related faults such as `GLOBAL_MAX_CONCURRENT_REQ`.
  - `retryable: true`
- `VatTimeoutError`
  - The request exceeded the configured timeout.
  - `retryable: true`
- `VatTransportError`
  - Network or HTTP transport failed before a usable SOAP response was parsed.
  - `retryable: true` for network failures, `false` for unexpected client-side HTTP failures such as non-SOAP `4xx` responses
- `VatParseError`
  - The service returned a payload that could not be parsed as expected.
  - `retryable: false`
- `VatServiceError`
  - A fallback error for unexpected SOAP faults or unknown service behavior.
  - `retryable: false`

## Machine-Readable Error Payloads

Use `toVatErrorInfo(error)` when you want a JSON-safe representation:

```ts
{
  "name": "VatRateLimitError",
  "code": "RATE_LIMITED",
  "message": "The VIES service is busy and asked the client to retry.",
  "retryable": true,
  "serviceFault": "GLOBAL_MAX_CONCURRENT_REQ"
}
```

## Operational Guidance

- Retry `retryable: true` errors with backoff.
- Do not retry `VatInputError`.
- Expect occasional transient government-service faults in production.
- Keep batch concurrency conservative unless you control the traffic pattern carefully.

## HTTP Classification

- Valid SOAP wins over raw HTTP status. If VIES returns a SOAP fault on HTTP `500`, the library maps the SOAP fault.
- Non-SOAP HTTP `429` maps to `VatRateLimitError`.
- Non-SOAP HTTP `408` and `504` map to `VatTimeoutError`.
- Non-SOAP HTTP `5xx` maps to `VatServiceUnavailableError`.
- Non-SOAP HTTP `4xx` maps to `VatTransportError` with `retryable: false`.
- `VatParseError` is reserved for malformed or schema-invalid SOAP responses, including missing required `checkVatResponse` fields.
