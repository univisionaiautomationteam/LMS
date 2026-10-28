import { useCallback } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

/**
 * Wraps an async API call with toast notifications.
 * Shows success toast on resolve, error toast on reject.
 * Re-throws the error so callers can still handle it if needed.
 */
export function useApi() {
  const { success, error } = useToast();

  const call = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options?: {
        successTitle?: string;
        successMessage?: string;
        errorTitle?: string;
        errorMessage?: string;
        showSuccess?: boolean;
        silent?: boolean;
      }
    ): Promise<T> => {
      const {
        successTitle = "Success",
        successMessage,
        errorTitle = "Error",
        errorMessage,
        showSuccess = false,
        silent = false,
      } = options ?? {};

      try {
        const result = await fn();
        if (showSuccess) {
          success(successTitle, successMessage);
        }
        return result;
      } catch (err: any) {
        if (!silent) {
          const msg = err?.message ?? errorMessage ?? "Request failed.";
          error(errorTitle, msg);
        }
        throw err;
      }
    },
    [success, error]
  );

  return { call };
}

export default useApi;
