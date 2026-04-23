import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/cli";
import { type VatBatchResult, VatTimeoutError, type VatValidationResult } from "../src/index";

function createRecorder() {
  let output = "";

  return {
    output: () => output,
    stream: {
      write(chunk: string) {
        output += chunk;
      },
    },
  };
}

const sampleResult: VatValidationResult = {
  company: {
    address: {
      lines: ["Example Strasse 1", "10115 Berlin"],
      raw: "Example Strasse 1\n10115 Berlin",
    },
    name: "OpenAI Europe GmbH",
  },
  countryCode: "DE",
  request: {
    checkedAt: "2026-04-24T12:00:00.000Z",
    source: "vies-checkVat",
  },
  valid: true,
  vat: "DE136695976",
  vatNumber: "136695976",
};

const sampleBatchResult: VatBatchResult = {
  items: [
    {
      input: "DE136695976",
      ok: true,
      result: sampleResult,
    },
  ],
  summary: {
    failed: 0,
    invalid: 0,
    total: 1,
    valid: 1,
  },
};

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
) as {
  version: string;
};

describe("runCli", () => {
  it("prints JSON for validate", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["validate", "DE136695976", "--json"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
      validateVat: async () => sampleResult,
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.output())).toEqual({
      ok: true,
      result: sampleResult,
    });
    expect(stderr.output()).toBe("");
  });

  it("prints JSON error envelopes for validate failures", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["validate", "DE136695976", "--json"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
      validateVat: async () => {
        throw new VatTimeoutError("timed out");
      },
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.output())).toEqual({
      error: {
        code: "TIMEOUT",
        message: "timed out",
        name: "VatTimeoutError",
        retryable: true,
      },
      ok: false,
    });
    expect(stderr.output()).toBe("");
  });

  it("prints batch output from stdin", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["batch"], {
      readStdin: async () => "DE136695976\n",
      stderr: stderr.stream,
      stdout: stdout.stream,
      validateVatBatch: async () => sampleBatchResult,
    });

    expect(exitCode).toBe(0);
    expect(stdout.output()).toContain("VALID");
    expect(stdout.output()).toContain("Summary:");
    expect(stderr.output()).toBe("");
  });

  it("returns a structured usage error for batch JSON input failures", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["batch", "--json"], {
      readStdin: async () => "",
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.output())).toEqual({
      error: {
        code: "CLI_USAGE_ERROR",
        message: "Provide a file or pipe newline-delimited VAT values into stdin.",
        name: "CliUsageError",
        retryable: false,
      },
      ok: false,
    });
    expect(stderr.output()).toBe("");
  });

  it("rejects --json and --pretty together with a structured usage error", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["validate", "DE136695976", "--json", "--pretty"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.output())).toEqual({
      error: {
        code: "CLI_USAGE_ERROR",
        message: "--json and --pretty cannot be used together.",
        name: "CliUsageError",
        retryable: false,
      },
      ok: false,
    });
    expect(stderr.output()).toBe("");
  });

  it("rejects invalid numeric flags with structured JSON errors", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["validate", "DE136695976", "--json", "--timeout", "0"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.output())).toEqual({
      error: {
        code: "CLI_USAGE_ERROR",
        message: "--timeout must be a positive integer.",
        name: "CliUsageError",
        retryable: false,
      },
      ok: false,
    });
    expect(stderr.output()).toBe("");
  });

  it("returns a usage error when validate receives no input", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["validate"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(exitCode).toBe(1);
    expect(stderr.output()).toContain("CliUsageError: Provide a VAT value or --country/--number.");
  });

  it("prints the package version", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    const exitCode = await runCli(["--version"], {
      stderr: stderr.stream,
      stdout: stdout.stream,
    });

    expect(exitCode).toBe(0);
    expect(stdout.output()).toBe(`${packageJson.version}\n`);
    expect(stderr.output()).toBe("");
  });
});
