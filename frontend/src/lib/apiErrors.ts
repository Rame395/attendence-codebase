import { toast } from "sonner";

interface ApiErrorShape {
  error?: unknown;
  message?: string;
  data?: { error?: unknown; message?: string };
  response?: { data?: { error?: unknown; message?: string } };
}

// API error bata field-specific messages nikalne (e.g. [{key: "email", msg: "email should be unique"}])
export function getApiFieldErrors(error: unknown): string[] {
  const err = error as ApiErrorShape;
  const details = err?.response?.data?.error ?? err?.data?.error ?? err?.error;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return Object.entries(details as Record<string, string>)
      .filter(([, value]) => typeof value === "string" && value)
      .map(([key, value]) => `${key}: ${value}`);
  }
  return [];
}

export function getApiMessage(error: unknown, fallback = "Something went wrong"): string {
  const err = error as ApiErrorShape;
  return err?.response?.data?.message || err?.data?.message || err?.message || fallback;
}

// toast ma field-anusar error dekhaune; details chaina bhane message matra
export function toastApiErrors(error: unknown, fallback = "Something went wrong") {
  const fieldErrors = getApiFieldErrors(error);
  if (fieldErrors.length > 0) {
    fieldErrors.forEach((fieldError) => toast.error(fieldError));
    return;
  }
  toast.error(getApiMessage(error, fallback));
}

// ek single toast ma matra related field errors combined garera dekhaune (aru errors herdaina)
export function toastSingleApiError(error: unknown, fallback = "Something went wrong") {
  const fieldErrors = getApiFieldErrors(error);
  if (fieldErrors.length > 0) {
    toast.error(fieldErrors.join(", "));
    return;
  }
  toast.error(getApiMessage(error, fallback));
}