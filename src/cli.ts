import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { validateVatBatch } from "./batch";
import { DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS, validateVat } from "./client";
import { VatValidationError, toVatErrorInfo } from "./errors";
import type {
  ValidateVatOptions,
  VatBatchOptions,
  VatBatchResult,
  VatErrorInfo,
  VatInput,
  VatValidationResult,
} from "./types";

const HELP_TEXT = `vat-validation-ts

Validate EU VAT numbers against the European Commission VIES service.

Usage:
  vat-validation-ts validate <VAT>
  vat-validation-ts validate --country <CODE> --number <VALUE>
  vat-validation-ts batch [file]

Flags:
  --json           Print machine-readable JSON
  --pretty         Force human-readable output
  --timeout <ms>   Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --retries <n>    Retry count for retryable failures (default: ${DEFAULT_RETRIES})
  --concurrency <n>  Batch concurrency (default: 3)
  --help           Show help
  --version        Show version`;

interface CliStreams {
  stderr: { write: (chunk: string) => void };
  stdout: { write: (chunk: string) => void };
}

interface CliRuntime extends Partial<CliStreams> {
  readFile?: typeof readFile;
  readStdin?: () => Promise<string>;
  validateVat?: typeof validateVat;
  validateVatBatch?: typeof validateVatBatch;
}

type CliErrorCode = "CLI_USAGE_ERROR" | "CLI_IO_ERROR" | "CLI_RUNTIME_ERROR";

interface CliErrorInfo {
  code: CliErrorCode;
  message: string;
  name: string;
  retryable: false;
}

type CliJsonEnvelope<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      error: CliErrorInfo | VatErrorInfo;
      ok: false;
    };

class CliError extends Error {
  readonly code: CliErrorCode;

  constructor(code: CliErrorCode, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.code = code;
    this.name = new.target.name;
  }
}

class CliUsageError extends CliError {
  constructor(message: string, cause?: unknown) {
    super("CLI_USAGE_ERROR", message, cause);
  }
}

class CliIoError extends CliError {
  constructor(message: string, cause?: unknown) {
    super("CLI_IO_ERROR", message, cause);
  }
}

class CliRuntimeError extends CliError {
  constructor(message: string, cause?: unknown) {
    super("CLI_RUNTIME_ERROR", message, cause);
  }
}

function getVersion(): string {
  return process.env.VAT_VALIDATION_TS_VERSION ?? process.env.npm_package_version ?? "0.1.0";
}

function toCliErrorInfo(error: unknown): CliErrorInfo | VatErrorInfo {
  if (error instanceof CliError) {
    return {
      code: error.code,
      message: error.message,
      name: error.name,
      retryable: false,
    };
  }

  return toVatErrorInfo(error);
}

function writeJsonEnvelope<T>(stdout: CliStreams["stdout"], envelope: CliJsonEnvelope<T>): void {
  stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

function formatValidationResult(result: VatValidationResult): string {
  const status = result.valid ? "VALID" : "INVALID";
  const lines = [`${status} ${result.vat}`];

  if (result.company.name) {
    lines.push(`Name: ${result.company.name}`);
  }

  if (result.company.address.raw) {
    lines.push(`Address: ${result.company.address.raw}`);
  }

  lines.push(`Checked at: ${result.request.checkedAt}`);

  return `${lines.join("\n")}\n`;
}

function formatBatchResult(result: VatBatchResult): string {
  const lines = result.items.map((item) => {
    if (!item.ok) {
      return `ERROR   ${typeof item.input === "string" ? item.input : `${item.input.countryCode}${item.input.vatNumber}`}  ${item.error.code}`;
    }

    const status = item.result.valid ? "VALID  " : "INVALID";
    const companyName = item.result.company.name ?? "n/a";
    return `${status} ${item.result.vat}  ${companyName}`;
  });

  lines.push("");
  lines.push(
    `Summary: ${result.summary.total} total, ${result.summary.valid} valid, ${result.summary.invalid} invalid, ${result.summary.failed} failed`
  );

  return `${lines.join("\n")}\n`;
}

function formatError(error: unknown): string {
  const cliError = toCliErrorInfo(error);
  return `${cliError.name}: ${cliError.message}\n`;
}

async function defaultReadStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readBatchInput(
  filePath: string | undefined,
  runtime: CliRuntime
): Promise<string[]> {
  let content: string;

  try {
    content = filePath
      ? await (runtime.readFile ?? readFile)(filePath, "utf8")
      : await (runtime.readStdin ?? defaultReadStdin)();
  } catch (error) {
    throw new CliIoError(
      filePath
        ? `Unable to read batch input file: ${filePath}`
        : "Unable to read batch input from stdin.",
      error
    );
  }

  return content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildStructuredInput(countryCode?: string, vatNumber?: string): string | VatInput | null {
  if (!countryCode && !vatNumber) {
    return null;
  }

  if (!countryCode || !vatNumber) {
    throw new CliUsageError("Both --country and --number must be provided together.");
  }

  return {
    countryCode,
    vatNumber,
  };
}

function parsePositiveIntegerFlag(
  value: string | undefined,
  flagName: string,
  fallback: number
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(`${flagName} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (parsed < 1) {
    throw new CliUsageError(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeIntegerFlag(
  value: string | undefined,
  flagName: string,
  fallback: number
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(`${flagName} must be a non-negative integer.`);
  }

  return Number(value);
}

function assertOutputMode(json?: boolean, pretty?: boolean): void {
  if (json && pretty) {
    throw new CliUsageError("--json and --pretty cannot be used together.");
  }
}

function parseValidateOptions(values: {
  json?: boolean;
  pretty?: boolean;
  retries?: string;
  timeout?: string;
}): { json: boolean; options: ValidateVatOptions } {
  assertOutputMode(values.json, values.pretty);

  return {
    json: values.json ?? false,
    options: {
      retries: parseNonNegativeIntegerFlag(values.retries, "--retries", DEFAULT_RETRIES),
      timeoutMs: parsePositiveIntegerFlag(values.timeout, "--timeout", DEFAULT_TIMEOUT_MS),
    },
  };
}

function parseBatchOptions(values: {
  concurrency?: string;
  json?: boolean;
  pretty?: boolean;
  retries?: string;
  timeout?: string;
}): { json: boolean; options: VatBatchOptions } {
  assertOutputMode(values.json, values.pretty);

  return {
    json: values.json ?? false,
    options: {
      concurrency: parsePositiveIntegerFlag(values.concurrency, "--concurrency", 3),
      retries: parseNonNegativeIntegerFlag(values.retries, "--retries", DEFAULT_RETRIES),
      timeoutMs: parsePositiveIntegerFlag(values.timeout, "--timeout", DEFAULT_TIMEOUT_MS),
    },
  };
}

function parseValidateArgs(args: string[]) {
  try {
    return parseArgs({
      allowPositionals: true,
      args,
      options: {
        country: { type: "string" },
        help: { type: "boolean" },
        json: { type: "boolean" },
        number: { type: "string" },
        pretty: { type: "boolean" },
        retries: { type: "string" },
        timeout: { type: "string" },
        version: { type: "boolean" },
      },
      strict: true,
    });
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : "Invalid validate arguments.",
      error
    );
  }
}

function parseBatchArgs(args: string[]) {
  try {
    return parseArgs({
      allowPositionals: true,
      args,
      options: {
        concurrency: { type: "string" },
        help: { type: "boolean" },
        json: { type: "boolean" },
        pretty: { type: "boolean" },
        retries: { type: "string" },
        timeout: { type: "string" },
        version: { type: "boolean" },
      },
      strict: true,
    });
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : "Invalid batch arguments.",
      error
    );
  }
}

export async function runCli(
  argv = process.argv.slice(2),
  runtime: CliRuntime = {}
): Promise<number> {
  const stdout = runtime.stdout ?? process.stdout;
  const stderr = runtime.stderr ?? process.stderr;
  const [command, ...rest] = argv;
  const requestedJson = argv.includes("--json");

  if (!command) {
    stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  try {
    switch (command) {
      case "validate": {
        const parsed = parseValidateArgs(rest);

        if (parsed.values.help) {
          stdout.write(`${HELP_TEXT}\n`);
          return 0;
        }

        if (parsed.values.version) {
          stdout.write(`${getVersion()}\n`);
          return 0;
        }

        const structuredInput = buildStructuredInput(parsed.values.country, parsed.values.number);
        const input = structuredInput ?? parsed.positionals[0];
        const { json, options } = parseValidateOptions(parsed.values);

        if (!input) {
          throw new CliUsageError("Provide a VAT value or --country/--number.");
        }

        const result = await (runtime.validateVat ?? validateVat)(input, options);

        if (json) {
          writeJsonEnvelope(stdout, {
            ok: true,
            result,
          });
        } else {
          stdout.write(formatValidationResult(result));
        }

        return 0;
      }

      case "batch": {
        const parsed = parseBatchArgs(rest);

        if (parsed.values.help) {
          stdout.write(`${HELP_TEXT}\n`);
          return 0;
        }

        if (parsed.values.version) {
          stdout.write(`${getVersion()}\n`);
          return 0;
        }

        const lines = await readBatchInput(parsed.positionals[0], runtime);
        const { json, options } = parseBatchOptions(parsed.values);
        if (lines.length === 0) {
          throw new CliUsageError(
            "Provide a file or pipe newline-delimited VAT values into stdin."
          );
        }

        const result = await (runtime.validateVatBatch ?? validateVatBatch)(lines, options);

        if (json) {
          writeJsonEnvelope(stdout, {
            ok: true,
            result,
          });
        } else {
          stdout.write(formatBatchResult(result));
        }

        return 0;
      }

      case "--help":
      case "-h":
      case "help":
        stdout.write(`${HELP_TEXT}\n`);
        return 0;

      case "--version":
      case "-v":
        stdout.write(`${getVersion()}\n`);
        return 0;

      default:
        throw new CliUsageError(`Unknown command: ${command}`);
    }
  } catch (error) {
    const normalizedError =
      error instanceof CliError || error instanceof VatValidationError
        ? error
        : new CliRuntimeError(
            error instanceof Error ? error.message : "An unexpected CLI error occurred.",
            error
          );

    if (requestedJson) {
      writeJsonEnvelope(stdout, {
        error: toCliErrorInfo(normalizedError),
        ok: false,
      });
      return 1;
    }

    stderr.write(formatError(normalizedError));
    if (normalizedError instanceof CliUsageError && command !== "--help" && command !== "help") {
      stderr.write(HELP_TEXT.endsWith("\n") ? HELP_TEXT : `${HELP_TEXT}\n`);
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
