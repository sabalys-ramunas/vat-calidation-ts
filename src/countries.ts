import { VatInputError } from "./errors";
import { SUPPORTED_VAT_COUNTRY_CODES } from "./types";
import type { VatCountryCode } from "./types";

const COUNTRY_ALIASES: Record<string, VatCountryCode> = {
  EL: "EL",
  GR: "EL",
  XI: "XI",
};

export const supportedVatCountryCodes = [...SUPPORTED_VAT_COUNTRY_CODES];

export function isSupportedVatCountryCode(value: string): value is VatCountryCode {
  return supportedVatCountryCodes.includes(value as VatCountryCode);
}

export function normalizeCountryCode(value: string): VatCountryCode {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[\s._-]+/g, "");

  if (!/^[A-Z]{2}$/.test(cleaned)) {
    throw new VatInputError(`Unsupported VAT country code: ${value}`);
  }

  const alias = COUNTRY_ALIASES[cleaned];
  if (alias) {
    return alias;
  }

  if (isSupportedVatCountryCode(cleaned)) {
    return cleaned;
  }

  throw new VatInputError(`Unsupported VAT country code: ${value}`);
}
