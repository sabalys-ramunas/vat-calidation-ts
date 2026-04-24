import { describe, expect, it, vi } from "vitest";

import {
  VatInputError,
  VatMemberStateUnavailableError,
  VatRateLimitError,
  VatServiceUnavailableError,
  VatTimeoutError,
  VatTransportError,
  validateVat,
} from "../src/index";
import { createResponse, createTextResponse, fixture } from "./helpers";

describe("validateVat", () => {
  it("returns a normalized validation result", async () => {
    const result = await validateVat("DE136695976", {
      fetch: vi.fn().mockResolvedValue(createTextResponse(fixture("valid-response.xml"))),
    });

    expect(result.valid).toBe(true);
    expect(result.company.name).toBe("OpenAI Europe GmbH");
    expect(result.company.address.lines).toEqual(["Example Strasse 1", "10115 Berlin"]);
    expect(result.vat).toBe("DE136695976");
  });

  it("maps unsupported countries to a typed input error", async () => {
    await expect(
      validateVat("GB999999973", {
        fetch: vi.fn(),
      })
    ).rejects.toBeInstanceOf(VatInputError);
  });

  it("maps member state SOAP faults", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: vi
          .fn()
          .mockResolvedValue(createTextResponse(fixture("member-state-unavailable.xml"), 500)),
        retries: 0,
      })
    ).rejects.toBeInstanceOf(VatMemberStateUnavailableError);
  });

  it("maps rate limiting SOAP faults", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createTextResponse(fixture("busy.xml"), 500)),
        retries: 0,
      })
    ).rejects.toBeInstanceOf(VatRateLimitError);
  });

  it("classifies non-SOAP 503 responses as service unavailable", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi
          .fn()
          .mockResolvedValue(createResponse("<html><body>down</body></html>", 503, "text/html")),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatServiceUnavailableError);
      expect(error).toMatchObject({
        retryable: true,
      });
    }
  });

  it("classifies non-SOAP 429 responses as rate limited", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createResponse("busy", 429)),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatRateLimitError);
      expect(error).toMatchObject({
        retryable: true,
        serviceFault: "HTTP_429",
      });
    }
  });

  it("classifies empty-body 429 responses as rate limited", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createResponse("", 429)),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatRateLimitError);
      expect(error).toMatchObject({
        retryable: true,
        serviceFault: "HTTP_429",
      });
    }
  });

  it("classifies non-SOAP 400 responses as non-retryable transport errors", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createResponse("bad request", 400)),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatTransportError);
      expect(error).toMatchObject({
        retryable: false,
      });
    }
  });

  it("classifies empty-body 400 responses as non-retryable transport errors", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createResponse("", 400)),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatTransportError);
      expect(error).toMatchObject({
        retryable: false,
      });
    }
  });

  it("classifies empty-body 504 responses as timeouts", async () => {
    try {
      await validateVat("DE136695976", {
        fetch: vi.fn().mockResolvedValue(createResponse("", 504)),
        retries: 0,
      });
      throw new Error("Expected validateVat to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(VatTimeoutError);
      expect(error).toMatchObject({
        retryable: true,
      });
    }
  });

  it("retries retryable failures before succeeding", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(createTextResponse(fixture("busy.xml"), 500))
      .mockResolvedValueOnce(createTextResponse(fixture("valid-response.xml")));

    const result = await validateVat("DE136695976", {
      fetch,
      retries: 1,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
  });

  it("maps transport failures", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: vi.fn().mockRejectedValue(new Error("socket hang up")),
        retries: 0,
      })
    ).rejects.toBeInstanceOf(VatTransportError);
  });

  it("maps timeouts", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: async (_url, _init) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new DOMException("Request aborted", "AbortError");
        },
        retries: 0,
        timeoutMs: 1,
      })
    ).rejects.toBeInstanceOf(VatTimeoutError);
  });

  it("rejects an invalid timeoutMs option", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: vi.fn(),
        timeoutMs: 0,
      })
    ).rejects.toThrow("timeoutMs must be a positive integer.");
  });

  it("rejects an invalid retries option", async () => {
    await expect(
      validateVat("DE136695976", {
        fetch: vi.fn(),
        retries: -1,
      })
    ).rejects.toThrow("retries must be a non-negative integer.");
  });
});
