# CLI Usage

The CLI is built for both shell scripting and human operators.

## Commands

### `validate <vat>`

```bash
vat-validation-ts validate DE136695976
```

### `validate --country <code> --number <value>`

```bash
vat-validation-ts validate --country DE --number 136695976
```

### `batch [file]`

```bash
vat-validation-ts batch vat-list.txt
printf "DE136695976\nFR40303265045\n" | vat-validation-ts batch
```

## Flags

- `--json`
  - Print machine-readable JSON envelopes to `stdout`
- `--pretty`
  - Force human-friendly text mode; cannot be combined with `--json`
- `--timeout <ms>`
  - Override the request timeout with a positive integer
- `--retries <n>`
  - Retry count for retryable failures with a non-negative integer
- `--concurrency <n>`
  - Batch worker count with a positive integer

## JSON Contract

The CLI uses one JSON envelope in both commands:

```json
{
  "ok": true,
  "result": {}
}
```

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

CLI-originated failures use:

- `CLI_USAGE_ERROR`
- `CLI_IO_ERROR`
- `CLI_RUNTIME_ERROR`

## Exit Codes

- `0`
  - Command ran successfully, even if a VAT number was reported as invalid
- `1`
  - Usage error or execution failure
