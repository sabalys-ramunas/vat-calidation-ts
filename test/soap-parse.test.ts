import { describe, expect, it } from "vitest";

import { VatParseError, parseVatSoapResponse } from "../src/index";
import { fixture } from "./helpers";

describe("parseVatSoapResponse", () => {
  it("parses a successful VIES response", () => {
    const response = parseVatSoapResponse(fixture("valid-response.xml"));

    expect(response).toEqual({
      kind: "success",
      payload: {
        address: "Example Strasse 1\n10115 Berlin",
        countryCode: "DE",
        name: "OpenAI Europe GmbH",
        requestDate: "2026-04-24+02:00",
        valid: true,
        vatNumber: "136695976",
      },
    });
  });

  it("normalizes placeholder company fields to null", () => {
    const response = parseVatSoapResponse(fixture("invalid-response.xml"));

    expect(response).toEqual({
      kind: "success",
      payload: {
        address: null,
        countryCode: "DE",
        name: null,
        requestDate: "2026-04-24+02:00",
        valid: false,
        vatNumber: "000000000",
      },
    });
  });

  it("parses SOAP faults", () => {
    const response = parseVatSoapResponse(fixture("member-state-unavailable.xml"));

    expect(response).toEqual({
      fault: {
        code: "MS_UNAVAILABLE",
        detail: undefined,
        message: "MS_UNAVAILABLE",
      },
      kind: "fault",
    });
  });

  it("throws a parse error for malformed XML", () => {
    expect(() => parseVatSoapResponse("<broken")).toThrow(VatParseError);
  });

  it("throws a parse error when valid is missing", () => {
    expect(() =>
      parseVatSoapResponse(`<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <checkVatResponse>
      <countryCode>DE</countryCode>
      <vatNumber>136695976</vatNumber>
    </checkVatResponse>
  </soap:Body>
</soap:Envelope>`)
    ).toThrow(VatParseError);
  });

  it("throws a parse error when valid is malformed", () => {
    expect(() =>
      parseVatSoapResponse(`<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <checkVatResponse>
      <countryCode>DE</countryCode>
      <vatNumber>136695976</vatNumber>
      <valid>yes</valid>
    </checkVatResponse>
  </soap:Body>
</soap:Envelope>`)
    ).toThrow(VatParseError);
  });
});
