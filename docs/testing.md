# Testing Strategy

This repo uses mocked XML fixtures for normal automated testing and keeps live VIES traffic opt-in.

## Default Test Suite

`npm run test:run` covers:

- input normalization
- SOAP response parsing
- error mapping
- retries and timeouts
- batch behavior
- CLI behavior

These tests are deterministic and do not rely on external network availability.

## Live Smoke Test

Run the live test only when you explicitly want to probe the real VIES service:

```bash
RUN_VIES_LIVE_TESTS=1 VIES_LIVE_VAT=DE136695976 npm run test:live
```

If `VIES_LIVE_VAT` is omitted, the smoke test falls back to `DE136695976` so `RUN_VIES_LIVE_TESTS=1 npm run test:live` still performs a real VIES call.

The live test is intentionally excluded from CI because VIES availability is outside the repo's control.

When the live smoke test hits a retryable upstream fault such as `SERVICE_UNAVAILABLE`, `MS_UNAVAILABLE`, timeout, or a busy/concurrency error, it skips with a note instead of failing the suite.

## Why This Split Exists

The official VIES service can be slow or temporarily unavailable. A serious example repo should acknowledge that reality instead of making CI flaky.
