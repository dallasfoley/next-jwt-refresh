"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../providers/AuthProvider/auth-provider";

export type UseAuthenticatedFetchOptions<T> = {
  fetchAction: () => Promise<T>;
  refreshUrl: string;
  refreshOptions: RequestInit;
  retryUrl: string;
  retryOptions: RequestInit;
  autoFetch?: boolean;
};

export default function useAuthenticatedFetch<T>({
  fetchAction,
  refreshUrl,
  refreshOptions = { method: "PATCH" },
  retryUrl,
  retryOptions = { method: "GET" },
  autoFetch = true,
}: UseAuthenticatedFetchOptions<T>): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  hasInitialized: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { refreshAndRetryRequest, isLoading, error, clearError, isPending } =
    useAuth();

  const refreshOptionsRef = useRef(refreshOptions);
  const refreshUrlRef = useRef(refreshUrl);
  const retryOptionsRef = useRef(retryOptions);
  const retryUrlRef = useRef(retryUrl);

  // Update refs when values change
  useEffect(() => {
    refreshOptionsRef.current = refreshOptions;
  }, [refreshOptions]);

  useEffect(() => {
    refreshUrlRef.current = refreshUrl;
  }, [refreshUrl]);

  useEffect(() => {
    retryOptionsRef.current = retryOptions;
  }, [retryOptions]);

  useEffect(() => {
    retryUrlRef.current = retryUrl;
  }, [retryUrl]);

  const fetchData = useCallback(async () => {
    clearError();

    try {
      console.log("useAuthenticatedFetch: Making initial request");

      // Call the server function first
      const result = await fetchAction();

      // Check if we got a 401 and need to refresh
      if (
        result &&
        typeof result === "object" &&
        "status" in result &&
        result.status === 401
      ) {
        console.log("useAuthenticatedFetch: 401, attempting refresh and retry");

        if (!retryUrl) {
          console.error(
            "useAuthenticatedFetch: No requestUrl provided for refresh and retry"
          );
          setData(null);
          setHasInitialized(true);
          return;
        }

        // Use the refreshAndRetryRequest from context
        const retryResult = await refreshAndRetryRequest(
          refreshUrl,
          retryUrl,
          refreshOptions,
          retryOptions
        );

        if (retryResult) {
          console.log("useAuthenticatedFetch: Refresh and retry successful");
          // The retryResult should be the actual data from the API
          setData({
            success: true,
            data: retryResult,
            message: "Data fetched successfully after token refresh",
          } as T);
        } else {
          console.log("useAuthenticatedFetch: Refresh and retry failed");
          setData(null);
        }
      } else {
        // Initial request was successful or failed for non-auth reasons
        console.log("useAuthenticatedFetch: Initial request completed");
        setData(result);
      }
    } catch (error) {
      console.error("useAuthenticatedFetch: Error in fetchData:", error);
      setData(null);
    } finally {
      setHasInitialized(true);
    }
  }, [fetchAction, refreshAndRetryRequest, clearError]);

  const refetch = useCallback(() => {
    setHasInitialized(false);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    data,
    isLoading: isLoading || isPending || !hasInitialized,
    error,
    refetch,
    hasInitialized,
  };
}
