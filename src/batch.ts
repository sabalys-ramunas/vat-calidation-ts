import { validateVat } from "./client";
import { normalizeToVatError, toVatErrorInfo } from "./errors";
import type { VatBatchItemResult, VatBatchOptions, VatBatchResult, VatInput } from "./types";

const DEFAULT_BATCH_CONCURRENCY = 3;

function normalizeConcurrency(value?: number): number {
  if (value === undefined) {
    return DEFAULT_BATCH_CONCURRENCY;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("Batch concurrency must be a positive integer.");
  }

  return value;
}

export async function validateVatBatch(
  inputs: Array<string | VatInput>,
  options: VatBatchOptions = {}
): Promise<VatBatchResult> {
  const items: VatBatchItemResult[] = new Array(inputs.length);
  const concurrency = normalizeConcurrency(options.concurrency);
  const stopOnError = options.stopOnError ?? false;
  let cursor = 0;
  let batchError: Error | null = null;

  async function worker(): Promise<void> {
    while (cursor < inputs.length) {
      if (stopOnError && batchError) {
        return;
      }

      const currentIndex = cursor;
      cursor += 1;
      const input = inputs[currentIndex];
      if (input === undefined) {
        return;
      }

      try {
        const result = await validateVat(input, options);
        items[currentIndex] = {
          input,
          ok: true,
          result,
        };
      } catch (error) {
        const normalizedError = normalizeToVatError(error);
        items[currentIndex] = {
          error: toVatErrorInfo(normalizedError),
          input,
          ok: false,
        };

        if (stopOnError) {
          batchError = normalizedError;
          return;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(inputs.length, 1)) }, () => worker())
  );

  if (batchError) {
    throw batchError;
  }

  const summary = items.reduce(
    (accumulator, item) => {
      if (!item) {
        return accumulator;
      }

      accumulator.total += 1;

      if (!item.ok) {
        accumulator.failed += 1;
        return accumulator;
      }

      if (item.result.valid) {
        accumulator.valid += 1;
      } else {
        accumulator.invalid += 1;
      }

      return accumulator;
    },
    {
      failed: 0,
      invalid: 0,
      total: 0,
      valid: 0,
    }
  );

  return {
    items,
    summary,
  };
}
