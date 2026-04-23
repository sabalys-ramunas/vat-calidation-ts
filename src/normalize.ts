import { normalizeCountryCode } from "./countries";
import { VatInputError } from "./errors";
import type { NormalizedVatInput, VatInput } from "./types";

function stripVatNumberJunk(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeVatInput(input: string | VatInput): NormalizedVatInput {
  if (typeof input === "string") {
    const cleaned = stripVatNumberJunk(input);

    if (cleaned.length < 3) {
      throw new VatInputError("Expected a VAT value like DE136695976.");
    }

    const countryCode = normalizeCountryCode(cleaned.slice(0, 2));
    const vatNumber = stripVatNumberJunk(cleaned.slice(2));

    if (!vatNumber) {
      throw new VatInputError("A VAT number body is required after the country code.");
    }

    return {
      countryCode,
      vat: `${countryCode}${vatNumber}`,
      vatNumber,
    };
  }

  const countryCode = normalizeCountryCode(input.countryCode);
  const vatNumber = stripVatNumberJunk(input.vatNumber);

  if (!vatNumber) {
    throw new VatInputError("A VAT number body is required.");
  }

  return {
    countryCode,
    vat: `${countryCode}${vatNumber}`,
    vatNumber,
  };
}
