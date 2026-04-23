import { XMLParser } from "fast-xml-parser";

import { VatParseError } from "../errors";
import type { ParsedVatFault, ParsedVatSoapResponse, ParsedVatSuccessPayload } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

function normalizeCompanyField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  if (!cleaned || /^-+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function normalizeFault(value: unknown): ParsedVatFault {
  if (!value || typeof value !== "object") {
    throw new VatParseError("SOAP fault payload was missing.");
  }

  const fault = value as Record<string, unknown>;

  return {
    code: typeof fault.faultstring === "string" ? fault.faultstring.trim() : null,
    detail: fault.detail,
    message:
      typeof fault.faultstring === "string" && fault.faultstring.trim()
        ? fault.faultstring.trim()
        : "Unknown SOAP fault",
  };
}

function normalizeSuccessPayload(value: unknown): ParsedVatSuccessPayload {
  if (!value || typeof value !== "object") {
    throw new VatParseError("checkVatResponse payload was missing.");
  }

  const payload = value as Record<string, unknown>;
  const countryCode = typeof payload.countryCode === "string" ? payload.countryCode.trim() : "";
  const vatNumber = typeof payload.vatNumber === "string" ? payload.vatNumber.trim() : "";
  const requestDate = typeof payload.requestDate === "string" ? payload.requestDate.trim() : null;
  const validValue = typeof payload.valid === "string" ? payload.valid.trim().toLowerCase() : null;

  if (!countryCode || !vatNumber) {
    throw new VatParseError("checkVatResponse was missing countryCode or vatNumber.");
  }

  if (validValue !== "true" && validValue !== "false") {
    throw new VatParseError("checkVatResponse was missing a canonical valid boolean.");
  }

  return {
    address: normalizeCompanyField(payload.address),
    countryCode,
    name: normalizeCompanyField(payload.name),
    requestDate,
    valid: validValue === "true",
    vatNumber,
  };
}

export function parseVatSoapResponse(xml: string): ParsedVatSoapResponse {
  let parsed: unknown;

  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new VatParseError("The SOAP XML body could not be parsed.", error);
  }

  const envelope = parsed as Record<string, unknown> | undefined;
  const body = envelope?.Envelope as Record<string, unknown> | undefined;
  const soapBody = body?.Body as Record<string, unknown> | undefined;

  if (!soapBody) {
    throw new VatParseError("SOAP Body was missing from the VIES response.");
  }

  if (soapBody.Fault) {
    return {
      fault: normalizeFault(soapBody.Fault),
      kind: "fault",
    };
  }

  if (!soapBody.checkVatResponse) {
    throw new VatParseError("SOAP Body did not contain checkVatResponse.");
  }

  return {
    kind: "success",
    payload: normalizeSuccessPayload(soapBody.checkVatResponse),
  };
}

export function splitAddressLines(address: string | null): string[] {
  if (!address) {
    return [];
  }

  return address
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}
