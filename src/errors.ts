import type { VatErrorCode, VatErrorInfo } from "./types";

interface VatErrorInit {
  cause?: unknown;
  message: string;
  retryable: boolean;
  serviceFault?: string | undefined;
}

export class VatValidationError extends Error {
  readonly code: VatErrorCode;
  readonly retryable: boolean;
  readonly serviceFault?: string | undefined;

  constructor(code: VatErrorCode, init: VatErrorInit) {
    super(init.message, init.cause ? { cause: init.cause } : undefined);
    this.code = code;
    this.name = new.target.name;
    this.retryable = init.retryable;
    this.serviceFault = init.serviceFault;
  }
}

export class VatInputError extends VatValidationError {
  constructor(message: string, cause?: unknown) {
    super("INVALID_INPUT", {
      cause,
      message,
      retryable: false,
    });
  }
}

export class VatServiceUnavailableError extends VatValidationError {
  constructor(message = "The VIES service is temporarily unavailable.", cause?: unknown) {
    super("SERVICE_UNAVAILABLE", {
      cause,
      message,
      retryable: true,
      serviceFault: "SERVICE_UNAVAILABLE",
    });
  }
}

export class VatMemberStateUnavailableError extends VatValidationError {
  constructor(message = "The member state service is temporarily unavailable.", cause?: unknown) {
    super("MEMBER_STATE_UNAVAILABLE", {
      cause,
      message,
      retryable: true,
      serviceFault: "MS_UNAVAILABLE",
    });
  }
}

export class VatRateLimitError extends VatValidationError {
  constructor(message = "The VIES service is busy or rate limited.", serviceFault?: string) {
    super("RATE_LIMITED", {
      message,
      retryable: true,
      serviceFault,
    });
  }
}

export class VatTimeoutError extends VatValidationError {
  constructor(message = "The VIES request timed out.", cause?: unknown) {
    super("TIMEOUT", {
      cause,
      message,
      retryable: true,
    });
  }
}

export class VatTransportError extends VatValidationError {
  constructor(
    message = "The VIES request failed due to a network or HTTP error.",
    cause?: unknown,
    retryable = true
  ) {
    super("TRANSPORT_ERROR", {
      cause,
      message,
      retryable,
    });
  }
}

export class VatParseError extends VatValidationError {
  constructor(message = "The VIES response could not be parsed.", cause?: unknown) {
    super("PARSE_ERROR", {
      cause,
      message,
      retryable: false,
    });
  }
}

export class VatServiceError extends VatValidationError {
  constructor(message: string, serviceFault?: string, cause?: unknown) {
    super("SERVICE_ERROR", {
      cause,
      message,
      retryable: false,
      serviceFault,
    });
  }
}

export function isVatValidationError(error: unknown): error is VatValidationError {
  return error instanceof VatValidationError;
}

export function toVatErrorInfo(error: unknown): VatErrorInfo {
  if (error instanceof VatValidationError) {
    return {
      code: error.code,
      message: error.message,
      name: error.name,
      retryable: error.retryable,
      serviceFault: error.serviceFault,
    };
  }

  if (error instanceof Error) {
    return {
      code: "SERVICE_ERROR",
      message: error.message,
      name: error.name,
      retryable: false,
    };
  }

  return {
    code: "SERVICE_ERROR",
    message: "An unknown error occurred.",
    name: "Error",
    retryable: false,
  };
}

export function mapSoapFaultToError(faultCode: string): VatValidationError {
  switch (faultCode) {
    case "INVALID_INPUT":
      return new VatInputError("The VAT number was rejected by VIES as invalid input.");
    case "SERVICE_UNAVAILABLE":
      return new VatServiceUnavailableError();
    case "MS_UNAVAILABLE":
      return new VatMemberStateUnavailableError();
    case "TIMEOUT":
      return new VatTimeoutError("The member state did not respond before the VIES timeout.");
    case "GLOBAL_MAX_CONCURRENT_REQ":
    case "MS_MAX_CONCURRENT_REQ":
    case "SERVER_BUSY":
      return new VatRateLimitError(
        "The VIES service is busy and asked the client to retry.",
        faultCode
      );
    default:
      return new VatServiceError(
        `The VIES service returned an unexpected fault: ${faultCode}`,
        faultCode
      );
  }
}

export function normalizeToVatError(error: unknown): VatValidationError {
  if (error instanceof VatValidationError) {
    return error;
  }

  if (error instanceof Error) {
    return new VatServiceError(error.message, undefined, error);
  }

  return new VatServiceError("An unknown VIES error occurred.");
}
