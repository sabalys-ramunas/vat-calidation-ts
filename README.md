# vat-validation-ts

[![npm version](https://img.shields.io/npm/v/vat-validation-ts.svg)](https://www.npmjs.com/package/vat-validation-ts)
[![npm downloads](https://img.shields.io/npm/dm/vat-validation-ts.svg)](https://www.npmjs.com/package/vat-validation-ts)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Typed EU VAT validation for Node.js, backed by the European Commission VIES service.

`vat-validation-ts` validates real VAT numbers against VIES, normalizes the response into a clean TypeScript-friendly shape, handles common failure modes with typed errors, supports bounded-concurrency batch processing, and includes a usable CLI.

Available on npm: [vat-validation-ts](https://www.npmjs.com/package/vat-validation-ts)

Links: [npm](https://www.npmjs.com/package/vat-validation-ts) · [GitHub](https://github.com/sabalys-ramunas/vat-validation-ts) · [CLI docs](./docs/cli.md) · [Error docs](./docs/errors.md)

## Why This Package

- Real VIES lookups, not regex-only guesses
- Typed library API with normalized results
- First-class error handling with retryability hints
- Batch helper with bounded concurrency
- CLI for ad hoc checks and scripts
- Mocked tests by default and opt-in live smoke tests

## Install

Install as a dependency:

```bash
npm install vat-validation-ts
```

Run the CLI without installing globally:

```bash
npx vat-validation-ts validate DE136695976
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

Normalize input:

```ts
normalizeVatInput("gr 001 234 567");
// { countryCode: "EL", vatNumber: "001234567", vat: "EL001234567" }
```

Validate one VAT number:

```ts
const result = await validateVat(
  { countryCode: "PT", vatNumber: "501964843" },
  { timeoutMs: 10_000, retries: 1 }
);
```

Validate many VAT numbers with concurrency limits:

```ts
const batch = await validateVatBatch(
  ["DE136695976", "FR40303265045", "IT12345678901"],
  { concurrency: 3 }
);
```

## Error Handling

The library throws stable typed errors with machine-readable codes and a `retryable` flag:

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
npx vat-validation-ts validate DE136695976
```

Structured input:

```bash
npx vat-validation-ts validate --country DE --number 136695976
```

Batch validation from a file:

```bash
npx vat-validation-ts batch vat-list.txt
```

Batch validation from stdin:

```bash
printf "DE136695976\nFR40303265045\n" | npx vat-validation-ts batch
```

JSON output:

```bash
npx vat-validation-ts validate DE136695976 --json
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

## Notes About VIES

VIES is an external government service. It can be slow, temporarily unavailable, or omit company fields for valid VAT numbers. This package treats those behaviors as normal operational cases instead of edge-case afterthoughts.

## Docs

- [How it works](./docs/how-it-works.md)
- [Error handling](./docs/errors.md)
- [CLI usage](./docs/cli.md)
- [Testing strategy](./docs/testing.md)

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

If VIES or the target member-state backend is temporarily unavailable, the live smoke test skips instead of failing. That keeps the test useful for catching local regressions without treating upstream outages as project breakage.

## Publishing

`npm publish` is guarded by `prepublishOnly`, which runs linting, type-checking, tests, the build, and a dry-run pack check first.

Typical release flow:

```bash
npm version patch
npm publish --access public
```

## License

MIT
