import { describe, expect, it } from "vitest";

import { VatInputError, normalizeVatInput } from "../src/index";

describe("normalizeVatInput", () => {
  it("normalizes a combined VAT string", () => {
    expect(normalizeVatInput("de 136-695-976")).toEqual({
      countryCode: "DE",
      vat: "DE136695976",
      vatNumber: "136695976",
    });
  });

  it("maps GR to EL and preserves leading zeroes", () => {
    expect(normalizeVatInput("gr 001234567")).toEqual({
      countryCode: "EL",
      vat: "EL001234567",
      vatNumber: "001234567",
    });
  });

  it("accepts XI as a VIES prefix", () => {
    expect(normalizeVatInput("XI123456789")).toEqual({
      countryCode: "XI",
      vat: "XI123456789",
      vatNumber: "123456789",
    });
  });

  it("normalizes structured input", () => {
    expect(
      normalizeVatInput({
        countryCode: "pt",
        vatNumber: " 001 999 888 ",
      })
    ).toEqual({
      countryCode: "PT",
      vat: "PT001999888",
      vatNumber: "001999888",
    });
  });

  it("rejects malformed structured country codes", () => {
    expect(() =>
      normalizeVatInput({
        countryCode: "1de",
        vatNumber: "123",
      })
    ).toThrow(VatInputError);
  });

  it("throws a typed error for too-short VAT input", () => {
    expect(() => normalizeVatInput("DE")).toThrow(VatInputError);
  });

  it("throws a typed error for unsupported countries", () => {
    expect(() => normalizeVatInput("GB999999973")).toThrow(VatInputError);
  });
});
