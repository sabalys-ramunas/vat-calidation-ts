import {
  VatRateLimitError,
  VatServiceUnavailableError,
  VatTimeoutError,
  VatTransportError,
  mapSoapFaultToError,
  normalizeToVatError,
} from "./errors";
import { normalizeVatInput } from "./normalize";
import { parseVatSoapResponse, splitAddressLines } from "./soap/parse";
import { buildCheckVatEnvelope } from "./soap/request";
import type {
  NormalizedVatInput,
  ParsedVatSoapResponse,
  ValidateVatOptions,
  VatValidationResult,
} from "./types";

export const DEFAULT_VIES_ENDPOINT =
  "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 1;

function normalizeTimeoutMs(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("timeoutMs must be a positive integer.");
  }

  return value;
}

function normalizeRetries(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_RETRIES;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("retries must be a non-negative integer.");
  }

  return value;
}

function looksLikeSoapResponse(responseText: string, contentType: string | null): boolean {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return false;
  }

  const normalizedContentType = contentType?.toLowerCase() ?? "";
  if (
    normalizedContentType.includes("xml") ||
    normalizedContentType.includes("soap") ||
    /^<\?xml\b/i.test(trimmed)
  ) {
    return true;
  }

  return /<(?:\w+:)?Envelope\b/i.test(trimmed) || /<(?:\w+:)?Fault\b/i.test(trimmed);
}

function classifyNonSoapResponse(
  status: number,
  responseText: string
): VatTransportError | VatRateLimitError | VatTimeoutError | VatServiceUnavailableError {
  const messageSuffix = responseText.trim()
    ? "with a non-SOAP response body."
    : "with an empty response body.";

  if (status === 429) {
    return new VatRateLimitError(`The VIES service returned HTTP 429 ${messageSuffix}`, "HTTP_429");
  }

  if (status === 408 || status === 504) {
    return new VatTimeoutError(`The VIES service returned HTTP ${status} ${messageSuffix}`);
  }

  if (status >= 500) {
    return new VatServiceUnavailableError(
      `The VIES service returned HTTP ${status} ${messageSuffix}`
    );
  }

  if (status >= 400) {
    return new VatTransportError(
      `The VIES service returned HTTP ${status} ${messageSuffix}`,
      undefined,
      false
    );
  }

  return new VatTransportError(
    "The VIES service returned a non-SOAP success payload.",
    undefined,
    false
  );
}

function createCombinedSignal(
  timeoutMs: number,
  signal?: AbortSignal
): { signal: AbortSignal; timeoutSignal: AbortSignal } {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!signal) {
    return {
      signal: timeoutSignal,
      timeoutSignal,
    };
  }

  return {
    signal: AbortSignal.any([signal, timeoutSignal]),
    timeoutSignal,
  };
}

async function executeRequest(
  normalizedInput: NormalizedVatInput,
  options: ValidateVatOptions
): Promise<VatValidationResult> {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) {
    throw new VatTransportError(
      "A fetch implementation is required to call VIES.",
      undefined,
      false
    );
  }

  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const { signal, timeoutSignal } = createCombinedSignal(timeoutMs, options.signal);
  const envelope = buildCheckVatEnvelope(normalizedInput);

  let response: Response;
  let responseText: string;

  try {
    response = await fetcher(options.endpoint ?? DEFAULT_VIES_ENDPOINT, {
      body: envelope,
      headers: {
        accept: "text/xml",
        "content-type": "text/xml; charset=utf-8",
      },
      method: "POST",
      signal,
    });

    responseText = await response.text();
  } catch (error) {
    if (signal.aborted) {
      if (timeoutSignal.aborted) {
        throw new VatTimeoutError(`The VIES request timed out after ${timeoutMs}ms.`, error);
      }

      if (options.signal?.aborted) {
        throw new VatTransportError("The VIES request was aborted by the caller.", error, false);
      }
    }

    throw new VatTransportError("Unable to reach the VIES service.", error);
  }

  const trimmedResponse = responseText.trim();
  if (!trimmedResponse) {
    throw classifyNonSoapResponse(response.status, responseText);
  }

  let parsed: ParsedVatSoapResponse;
  if (looksLikeSoapResponse(responseText, response.headers.get("content-type"))) {
    parsed = parseVatSoapResponse(responseText);
  } else {
    throw classifyNonSoapResponse(response.status, responseText);
  }

  if (parsed.kind === "fault") {
    throw mapSoapFaultToError(parsed.fault.code ?? parsed.fault.message);
  }

  const countryCode = normalizedInput.countryCode;
  const vatNumber = normalizedInput.vatNumber;

  return {
    company: {
      address: {
        lines: splitAddressLines(parsed.payload.address),
        raw: parsed.payload.address,
      },
      name: parsed.payload.name,
    },
    countryCode,
    request: {
      checkedAt: new Date().toISOString(),
      source: "vies-checkVat",
    },
    valid: parsed.payload.valid,
    vat: `${countryCode}${vatNumber}`,
    vatNumber,
  };
}

export async function validateVat(
  input: string | { countryCode: string; vatNumber: string },
  options: ValidateVatOptions = {}
): Promise<VatValidationResult> {
  let normalizedInput: NormalizedVatInput;

  try {
    normalizedInput = normalizeVatInput(input);
  } catch (error) {
    throw normalizeToVatError(error);
  }

  const retries = normalizeRetries(options.retries);
  let attempt = 0;

  while (true) {
    try {
      return await executeRequest(normalizedInput, options);
    } catch (error) {
      const vatError = normalizeToVatError(error);

      if (!vatError.retryable || attempt >= retries) {
        throw vatError;
      }

      attempt += 1;
    }
  }
}
