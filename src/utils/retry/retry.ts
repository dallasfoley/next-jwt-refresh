import { cookies } from "next/headers";

export interface TokenConfig {
  accessTokenName?: string;
  refreshTokenName?: string;
  authHeaderFormat?: "Bearer" | "Token" | ((token: string) => string);
}

interface RetryOptions extends RequestInit {
  tokenNames?: TokenConfig;
}

export async function retry(url: string, options: RetryOptions = {}) {
  try {
    const tokenConfig: Required<TokenConfig> = {
      accessTokenName: "accessToken",
      refreshTokenName: "refreshToken",
      authHeaderFormat: "Bearer",
      ...options.tokenNames,
    };

    const { tokenNames, ...fetchOptions } = options;
    const accessToken = (await cookies()).get(
      tokenConfig.accessTokenName
    )?.value;

    let authHeader: string | undefined;
    if (accessToken) {
      if (typeof tokenConfig.authHeaderFormat === "function") {
        authHeader = tokenConfig.authHeaderFormat(accessToken);
      } else {
        authHeader = `${tokenConfig.authHeaderFormat} ${accessToken}`;
      }
    }
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        ...(authHeader && { Authorization: authHeader }),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      needsRefresh: response.status === 401, // Key flag for frontend
      data: response.ok ? data : null,
      error: response.ok
        ? null
        : data.message || data.error || "Request failed",
    };
  } catch (e) {
    return {
      success: false,
      needsLogin: true,
      error: "Authentication failed",
      data: null,
    };
  }
}
