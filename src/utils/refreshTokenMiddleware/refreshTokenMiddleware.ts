import { NextRequest, NextResponse } from "next/server";

interface TokenConfig {
  accessTokenName?: string;
  refreshTokenName?: string;
  authHeaderFormat?: "Bearer" | "Token" | ((token: string) => string);
}

export interface RefreshConfig {
  /** URL of the refresh endpoint (required) */
  refreshUrl: string;
  /** Request options for the refresh call */
  refreshOptions?: RequestInit & {
    responseType?: "json" | "cookies";
    tokenNames?: TokenConfig;
  };
  /** Cookie names for tokens (defaults: 'accessToken', 'refreshToken') */
  tokenNames?: TokenConfig;
  /** Path to redirect if refresh fails (default: '/login') */
  loginPath?: string;
  /** Paths that should trigger token refresh check */
  protectedPaths?: (string | RegExp)[];
}

/**
 * Middleware function to handle JWT token refresh
 */
export async function refreshTokenMiddleware(
  request: NextRequest,
  config: RefreshConfig
): Promise<NextResponse> {
  // Set defaults
  const {
    refreshUrl,
    refreshOptions = {},
    tokenNames = {},
    loginPath = "/login",
    protectedPaths = [],
  } = config;

  // Merge token config from both places, refreshOptions takes precedence
  const finalTokenConfig: Required<TokenConfig> = {
    accessTokenName: "accessToken",
    refreshTokenName: "refreshToken",
    authHeaderFormat: "Bearer",
    ...tokenNames,
    ...refreshOptions.tokenNames,
  };

  const {
    responseType = "json",
    tokenNames: _,
    ...fetchOptions
  } = refreshOptions;

  const path = request.nextUrl.pathname;

  // Skip if path is not protected or is login path
  const isProtected =
    protectedPaths.length === 0 ||
    protectedPaths.some((pattern) =>
      typeof pattern === "string"
        ? path.startsWith(pattern)
        : pattern.test(path)
    );

  if (!isProtected || path === loginPath) {
    return NextResponse.next();
  }

  // Check if token is expired (simple check for presence)
  const existingToken = request.cookies.get(
    finalTokenConfig.accessTokenName
  )?.value;
  if (existingToken) {
    return NextResponse.next();
  }

  try {
    // Attempt to refresh the token
    const refreshTokenValue = request.cookies.get(
      finalTokenConfig.refreshTokenName
    )?.value;
    if (!refreshTokenValue) {
      throw new Error("No refresh token available");
    }

    const refreshResponse = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      ...fetchOptions,
      body: JSON.stringify({
        [finalTokenConfig.refreshTokenName]: refreshTokenValue,
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error(`Refresh failed: ${refreshResponse.status}`);
    }

    let newAccessToken: string;
    let newRefreshToken: string | undefined;

    if (responseType === "cookies") {
      // Handle Set-Cookie headers
      const setCookieHeader = refreshResponse.headers.get("set-cookie");
      if (!setCookieHeader) {
        throw new Error("No cookies returned from refresh endpoint");
      }

      const cookies = parseCookieHeader(setCookieHeader);
      newAccessToken = cookies[finalTokenConfig.accessTokenName];
      newRefreshToken = cookies[finalTokenConfig.refreshTokenName];

      if (!newAccessToken) {
        throw new Error(
          `Access token not found in cookies (looking for: ${finalTokenConfig.accessTokenName})`
        );
      }
    } else {
      // Handle JSON response
      const refreshData = await refreshResponse.json();

      // Try multiple common patterns for token extraction
      newAccessToken =
        refreshData[finalTokenConfig.accessTokenName] ||
        refreshData.accessToken ||
        refreshData.token ||
        refreshData.access_token;

      newRefreshToken =
        refreshData[finalTokenConfig.refreshTokenName] ||
        refreshData.refreshToken ||
        refreshData.refresh_token;

      if (!newAccessToken) {
        throw new Error(
          `Access token not found in response (looking for: ${finalTokenConfig.accessTokenName})`
        );
      }
    }

    // Update cookies with new tokens
    const response = NextResponse.next();

    response.cookies.set(finalTokenConfig.accessTokenName, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    if (newRefreshToken) {
      response.cookies.set(finalTokenConfig.refreshTokenName, newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Token refresh failed in middleware:", error);
    // Redirect to login on failure
    const response = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.delete(finalTokenConfig.accessTokenName);
    response.cookies.delete(finalTokenConfig.refreshTokenName);
    return response;
  }
}

// Helper function to parse Set-Cookie header
function parseCookieHeader(setCookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  // Split multiple Set-Cookie headers if they exist
  const cookieStrings = setCookieHeader.split(/,(?=\s*\w+=)/);

  for (const cookieString of cookieStrings) {
    const [nameValue] = cookieString.split(";");
    const [name, value] = nameValue.split("=").map((s) => s.trim());
    if (name && value) {
      cookies[name] = value;
    }
  }

  return cookies;
}
