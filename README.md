# vat-validation-ts

VAT validation for Europe, built in TypeScript and backed by the European Commission VIES service.

`vat-validation-ts` validates EU VAT numbers, fetches company details when the upstream service provides them, normalizes the result into a clean typed shape, handles common VIES failure modes, supports batch processing, and ships with a CLI that is actually pleasant to use.

It is intentionally opinionated:

- Live validation through VIES, not regex-only guesses
- Normalized library output, not raw SOAP XML
- Typed errors with retryability hints
- Batch helper with bounded concurrency
- Docs, tests, fixtures, and CI for reliable maintenance

## Features

- Validate a VAT number against the European Commission VIES `checkVat` service
- Retrieve company name and address when VIES returns them
- Normalize placeholder values like `---` to `null`
- Normalize inputs such as `de136695976`, `DE 136 695 976`, or `{ countryCode: "gr", vatNumber: "001234567" }`
- Export a typed library API with stable error classes
- Process VAT numbers in batches with bounded concurrency
- Run from the command line with JSON or human-readable output
- Ship with mocked tests by default and an opt-in live smoke test

## Getting Started

```bash
npm install
npm run build
```

## Quick Start

```ts
import { validateVat } from "vat-validation-ts";

const result = await validateVat("DE136695976");

console.log(result.valid);
console.log(result.company.name);
console.log(result.company.address.lines);
```

Example result:

```json
{
  "countryCode": "DE",
  "vatNumber": "136695976",
  "vat": "DE136695976",
  "valid": true,
  "company": {
    "name": "OpenAI Europe GmbH",
    "address": {
      "raw": "Example Strasse 1\n10115 Berlin",
      "lines": ["Example Strasse 1", "10115 Berlin"]
    }
  },
  "request": {
    "checkedAt": "2026-04-24T12:00:00.000Z",
    "source": "vies-checkVat"
  }
}
```

## Library API

```ts
import {
  normalizeVatInput,
  validateVat,
  validateVatBatch,
  VatInputError,
  VatRateLimitError
} from "vat-validation-ts";
```

### `normalizeVatInput(input)`

Returns a canonical VAT payload:

```ts
normalizeVatInput("gr 001 234 567");
// { countryCode: "EL", vatNumber: "001234567", vat: "EL001234567" }
```

### `validateVat(input, options?)`

Validates a single VAT number through VIES.

```ts
const result = await validateVat(
  { countryCode: "PT", vatNumber: "501964843" },
  { timeoutMs: 10_000, retries: 1 }
);
```

### `validateVatBatch(inputs, options?)`

Validates many VAT numbers without letting one failure kill the whole batch.

```ts
const batch = await validateVatBatch(
  ["DE136695976", "FR40303265045", "IT12345678901"],
  { concurrency: 3 }
);
```

## Error Handling

The library throws typed errors with stable machine-readable codes and a `retryable` flag:

- `VatInputError`
- `VatServiceUnavailableError`
- `VatMemberStateUnavailableError`
- `VatRateLimitError`
- `VatTimeoutError`
- `VatTransportError`
- `VatParseError`
- `VatServiceError`

```ts
import { VatRateLimitError, validateVat } from "vat-validation-ts";

try {
  await validateVat("DE136695976");
} catch (error) {
  if (error instanceof VatRateLimitError) {
    console.error("Retry later");
  }
}
```

## CLI

Validate a single VAT number:

```bash
node dist/cli.js validate DE136695976
```

Structured input:

```bash
node dist/cli.js validate --country DE --number 136695976
```

Batch validation from a file:

```bash
node dist/cli.js batch vat-list.txt
```

Batch validation from stdin:

```bash
printf "DE136695976\nFR40303265045\n" | node dist/cli.js batch
```

JSON output:

```bash
node dist/cli.js validate DE136695976 --json
```

Success envelope:

```json
{
  "ok": true,
  "result": {
    "countryCode": "DE",
    "vatNumber": "136695976",
    "vat": "DE136695976",
    "valid": true,
    "company": {
      "name": "OpenAI Europe GmbH",
      "address": {
        "raw": "Example Strasse 1\n10115 Berlin",
        "lines": ["Example Strasse 1", "10115 Berlin"]
      }
    },
    "request": {
      "checkedAt": "2026-04-24T12:00:00.000Z",
      "source": "vies-checkVat"
    }
  }
}
```

Failure envelope:

```json
{
  "ok": false,
  "error": {
    "name": "VatTimeoutError",
    "code": "TIMEOUT",
    "message": "The VIES request timed out after 10000ms.",
    "retryable": true
  }
}
```

## Development

```bash
npm install
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run pack:check
```

Run the opt-in live smoke test:

```bash
RUN_VIES_LIVE_TESTS=1 VIES_LIVE_VAT=DE136695976 npm run test:live
```

If VIES or the target member-state backend is temporarily unavailable, the live smoke test skips instead of failing. That keeps the repo honest about real code regressions without treating upstream government-service outages as local breakage.

## Docs

- [How it works](./docs/how-it-works.md)
- [Error handling](./docs/errors.md)
- [CLI usage](./docs/cli.md)
- [Testing strategy](./docs/testing.md)

## Notes About VIES

VIES is an external government service. It sometimes responds slowly, returns temporary unavailability faults, or withholds company fields. This package treats those cases as first-class behavior instead of edge-case afterthoughts.

## License

MIT
