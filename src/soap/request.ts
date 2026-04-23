import type { NormalizedVatInput } from "../types";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildCheckVatEnvelope(input: NormalizedVatInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soap:Body>
    <tns:checkVat>
      <tns:countryCode>${escapeXml(input.countryCode)}</tns:countryCode>
      <tns:vatNumber>${escapeXml(input.vatNumber)}</tns:vatNumber>
    </tns:checkVat>
  </soap:Body>
</soap:Envelope>`;
}
