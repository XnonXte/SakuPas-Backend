export class ApiError extends Error {
  constructor(status, message, errors = undefined, validation = false, standardResponse = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.validation = validation;
    this.standardResponse = standardResponse;
  }
}

export function fail(status, message, errors) {
  throw new ApiError(status, message, errors);
}

export function validationError(errors) {
  throw new ApiError(422, "The given data was invalid.", errors, true);
}

export function notFound(message = "Not Found") {
  throw new ApiError(404, message, undefined, false, true);
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  if (error instanceof ApiError) {
    return response.status(error.status).json({
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
  }

  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Invalid JSON request body." });
  }

  console.error(JSON.stringify({
    event: "api_error",
    method: request.method,
    path: request.path,
    error: error?.name || "Error",
    code: error?.code || undefined,
  }));

  return response.status(500).json({ message: "Server Error" });
}
