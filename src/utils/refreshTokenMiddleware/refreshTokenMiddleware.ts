import { NextRequest, NextResponse } from "next/server";

export interface RefreshConfig {
  /**
   * URL of the refresh endpoint
   */
  refreshUrl: string;

  /**
   * Request options for the refresh call (headers, method, etc.)
   * The body will be automatically set with the refresh token
   */
  refreshOptions?: Omit<RequestInit, "body">;

  /**
   * Name of the access token cookie
   * @default 'accessToken'
   */
  accessToken?: string;

  /**
   * Name of the refresh token cookie
   * @default 'refreshToken'
   */
  refreshToken?: string;

  /**
   * Function to check if a token is expired
   * If not provided, will attempt to decode JWT and check exp claim
   */
  isTokenExpired?: (token: string) => boolean;

  /**
   * Function to extract new access token from refresh response
   * @default (data) => data.accessToken
   */
  extractAccessToken?: (responseData: any) => string;

  /**
   * Function to extract new refresh token from refresh response (if it rotates)
   * @default (data) => data.refreshToken
   */
  extractRefreshToken?: (responseData: any) => string | undefined;

  /**
   * Paths that should trigger token refresh check
   * Can be strings, regexes, or a function
   * @default [] (all paths)
   */
  protectedPaths?: (string | RegExp)[] | ((path: string) => boolean);

  /**
   * Where to redirect if refresh fails
   * @default '/login'
   */
  loginPath?: string;

  /**
   * Cookie options for setting new tokens
   */
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    maxAge?: number;
    path?: string;
    domain?: string;
  };
}

/**
 * Default JWT token expiration checker
 * Decodes JWT and checks exp claim against current time
 */
function defaultIsTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true; // If we can't decode it, consider it expired
  }
}

/**
 * Checks if a path should be protected based on the config
 */
function shouldProtectPath(
  path: string,
  protectedPaths?: RefreshConfig["protectedPaths"]
): boolean {
  if (!protectedPaths) return true; // Protect all paths by default

  if (typeof protectedPaths === "function") {
    return protectedPaths(path);
  }

  return protectedPaths.some((pattern) => {
    if (typeof pattern === "string") {
      return path.startsWith(pattern);
    }
    return pattern.test(path);
  });
}

/**
 * Middleware function to handle JWT token refresh
 * Call this from your middleware.ts file
 *
 * @example
 * ```ts
 * import { NextRequest } from 'next/server'
 * import { refreshTokenMiddleware } from 'your-package'
 *
 * export async function middleware(request: NextRequest) {
 *   return refreshTokenMiddleware(request, {
 *     refreshUrl: '/api/auth/refresh',
 *     refreshOptions: {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' }
 *     },
 *     protectedPaths: ['/dashboard', '/profile', /^\/admin/],
 *     cookieOptions: {
 *       httpOnly: true,
 *       secure: process.env.NODE_ENV === 'production',
 *       sameSite: 'lax'
 *     }
 *   })
 * }
 * ```
 */
export async function refreshTokenMiddleware(
  request: NextRequest,
  config: RefreshConfig
): Promise<NextResponse> {
  const {
    refreshUrl,
    refreshOptions = {},
    accessToken = "accessToken",
    refreshToken = "refreshToken",
    isTokenExpired = defaultIsTokenExpired,
    extractAccessToken = (data) => data.accessToken,
    extractRefreshToken = (data) => data.refreshToken,
    protectedPaths,
    loginPath = "/login",
    cookieOptions = {},
  } = config;

  const path = request.nextUrl.pathname;

  if (!shouldProtectPath(path, protectedPaths)) {
    return NextResponse.next();
  }

  if (path === loginPath) {
    return NextResponse.next();
  }

  const newAccessToken = request.cookies.get(accessToken)?.value;

  if (!refreshToken) {
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (newAccessToken && !isTokenExpired(newAccessToken)) {
    return NextResponse.next();
  }

  try {
    const refreshResponse = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...refreshOptions.headers,
      },
      ...refreshOptions,
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshResponse.ok) {
      throw new Error(`Refresh failed: ${refreshResponse.status}`);
    }

    const refreshData = await refreshResponse.json();
    const newAccessToken = extractAccessToken(refreshData);
    const newRefreshToken = extractRefreshToken(refreshData);

    const response = NextResponse.next();

    response.cookies.set(accessToken, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour default
      path: "/",
      ...cookieOptions,
    });

    if (newRefreshToken) {
      response.cookies.set(refreshToken, newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week default
        path: "/",
        ...cookieOptions,
      });
    }
    return response;
  } catch (error) {
    const response = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.delete(accessToken);
    response.cookies.delete(refreshToken);

    return response;
  }
}
