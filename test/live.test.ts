import { describe, expect, it } from "vitest";

import { isVatValidationError, validateVat } from "../src/index";

const runLiveTests = process.env.RUN_VIES_LIVE_TESTS === "1";
const liveVat = process.env.VIES_LIVE_VAT ?? "DE136695976";

describe.skipIf(!runLiveTests)("live VIES validation", () => {
  it("validates a real VAT number against the VIES endpoint", async (ctx) => {
    try {
      const result = await validateVat(liveVat, {
        retries: 2,
        timeoutMs: 15_000,
      });

      expect(result.vat.length).toBeGreaterThan(2);
      expect(typeof result.valid).toBe("boolean");
    } catch (error) {
      if (isVatValidationError(error) && error.retryable) {
        ctx.skip(
          `VIES live smoke test skipped because the upstream service was unavailable: ${error.code}`
        );
      }

      throw error;
    }
  });
});
