// 400/422 ma response.data, aru ma response - duitai shape handle garne
export const getErrorMessage = (
  error: unknown,
  fallback = "Something went wrong",
): string => {
  const err = error as
    | string
    | undefined
    | null
    | {
        message?: string;
        error?: Record<string, unknown>;
        data?: { message?: string };
        response?: { data?: { message?: string } };
      };

  if (typeof err === "string") {
    return err || fallback;
  }

  // { error: {...details}, message, meta } - validation failed huda details bata specific message
  const details = err?.error;
  if (details && typeof details === "object") {
    const first = Object.values(details)[0];
    if (typeof first === "string" && first) {
      return first;
    }
  }

  // interceptor le response.data throw gareko ({message})
  const message = err?.message;
  if (message && typeof message === "string") {
    return message;
  }

  // interceptor le pura axios response throw gareko
  if (err?.data?.message) {
    return err.data.message;
  }

  if (err?.response?.data?.message) {
    return err.response.data.message;
  }

  return fallback;
};
