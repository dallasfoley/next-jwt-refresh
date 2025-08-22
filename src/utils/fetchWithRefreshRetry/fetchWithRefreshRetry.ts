"use server";

import { refreshAndRetry } from "../refreshAndRetry";
import { TokenConfig } from "../retry/retry";

export async function fetchWithRefreshRetry(
  url: string,
  options: RequestInit = {},
  refreshUrl: string,
  refreshOptions: RequestInit & {
    responseType?: "json" | "cookies";
    tokenNames?: TokenConfig;
  } = {}
) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      if (response.status === 401) {
        return await refreshAndRetry(url, options, refreshUrl, refreshOptions);
      } else {
        const data = await response.json();
        if (data.message.includes("expire")) {
          return await refreshAndRetry(
            url,
            options,
            refreshUrl,
            refreshOptions
          );
        }
        return {
          success: false,
          error: "Authentication failed",
          data: null,
        };
      }
    }
    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data: data,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      error: "Authentication failed",
      data: null,
    };
  }
}
