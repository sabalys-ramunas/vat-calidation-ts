export const SUPPORTED_VAT_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
] as const;

export type VatCountryCode = (typeof SUPPORTED_VAT_COUNTRY_CODES)[number];

export interface VatInput {
  countryCode: string;
  vatNumber: string;
}

export interface NormalizedVatInput {
  countryCode: VatCountryCode;
  vatNumber: string;
  vat: string;
}

export interface VatAddress {
  raw: string | null;
  lines: string[];
}

export interface VatCompanyInfo {
  name: string | null;
  address: VatAddress;
}

export interface VatRequestMetadata {
  checkedAt: string;
  source: "vies-checkVat";
}

export interface VatValidationResult {
  countryCode: VatCountryCode;
  vatNumber: string;
  vat: string;
  valid: boolean;
  company: VatCompanyInfo;
  request: VatRequestMetadata;
}

export interface ValidateVatOptions {
  endpoint?: string;
  fetch?: typeof fetch;
  retries?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type VatErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_UNAVAILABLE"
  | "MEMBER_STATE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "TRANSPORT_ERROR"
  | "PARSE_ERROR"
  | "SERVICE_ERROR";

export interface VatErrorInfo {
  code: VatErrorCode;
  message: string;
  name: string;
  retryable: boolean;
  serviceFault?: string | undefined;
}

export type VatBatchItemResult =
  | {
      input: string | VatInput;
      ok: true;
      result: VatValidationResult;
    }
  | {
      error: VatErrorInfo;
      input: string | VatInput;
      ok: false;
    };

export interface VatBatchSummary {
  failed: number;
  invalid: number;
  total: number;
  valid: number;
}

export interface VatBatchResult {
  items: VatBatchItemResult[];
  summary: VatBatchSummary;
}

export interface VatBatchOptions extends ValidateVatOptions {
  concurrency?: number;
  stopOnError?: boolean;
}

export interface ParsedVatSuccessPayload {
  address: string | null;
  countryCode: string;
  name: string | null;
  requestDate: string | null;
  valid: boolean;
  vatNumber: string;
}

export interface ParsedVatFault {
  code: string | null;
  detail?: unknown;
  message: string;
}

export type ParsedVatSoapResponse =
  | {
      kind: "fault";
      fault: ParsedVatFault;
    }
  | {
      kind: "success";
      payload: ParsedVatSuccessPayload;
    };
