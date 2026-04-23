import { describe, expect, it } from "vitest";

import { VatRateLimitError, validateVatBatch } from "../src/index";
import { createTextResponse, fixture } from "./helpers";

describe("validateVatBatch", () => {
  it("preserves order and returns summary counts", async () => {
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      const body = String(init?.body);

      if (body.includes("<tns:vatNumber>000000000</tns:vatNumber>")) {
        return createTextResponse(fixture("invalid-response.xml"));
      }

      if (body.includes("<tns:vatNumber>999999999</tns:vatNumber>")) {
        return createTextResponse(fixture("busy.xml"), 500);
      }

      return createTextResponse(fixture("valid-response.xml"));
    };

    const result = await validateVatBatch(["DE136695976", "DE000000000", "DE999999999"], {
      fetch,
      retries: 0,
    });

    expect(result.items.map((item) => item.ok)).toEqual([true, true, false]);
    expect(result.summary).toEqual({
      failed: 1,
      invalid: 1,
      total: 3,
      valid: 1,
    });
  });

  it("respects the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const fetch: typeof globalThis.fetch = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return createTextResponse(fixture("valid-response.xml"));
    };

    await validateVatBatch(["DE1", "DE2", "DE3", "DE4"], {
      concurrency: 2,
      fetch,
      retries: 0,
    });

    expect(maxActive).toBe(2);
  });

  it("can stop on the first error", async () => {
    await expect(
      validateVatBatch(["DE136695976"], {
        concurrency: 1,
        fetch: async () => createTextResponse(fixture("busy.xml"), 500),
        retries: 0,
        stopOnError: true,
      })
    ).rejects.toBeInstanceOf(VatRateLimitError);
  });
});
