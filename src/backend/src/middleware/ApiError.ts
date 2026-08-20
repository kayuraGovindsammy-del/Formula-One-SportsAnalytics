export class ApiError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.code = code;
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static validationError(message: string): ApiError {
    return new ApiError(400, "VALIDATION_ERROR", message);
  }

  static unauthenticated(message: string): ApiError {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message: string): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}
