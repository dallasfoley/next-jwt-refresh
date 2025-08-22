"use server";

import { cookies } from "next/headers";

interface TokenConfig {
  accessTokenName?: string;
  refreshTokenName?: string;
  authHeaderFormat?: "Bearer" | "Token" | ((token: string) => string);
}

interface RefreshOptions extends RequestInit {
  responseType?: "json" | "cookies";
  tokenNames?: TokenConfig;
}

export async function refresh(
  url: string,
  options: RefreshOptions = {}
): Promise<{
  success: boolean;
  status: number;
  error: string | null;
  data: any;
}> {
  try {
    console.log("Server Action: Refreshing token...");

    // Default token configuration
    const tokenConfig: Required<TokenConfig> = {
      accessTokenName: "accessToken",
      refreshTokenName: "refreshToken",
      authHeaderFormat: "Bearer",
      ...options.tokenNames,
    };

    const { responseType = "json", tokenNames, ...fetchOptions } = options;

    const refreshToken = (await cookies()).get(
      tokenConfig.refreshTokenName
    )?.value;

    if (!refreshToken) {
      return {
        success: false,
        status: 401,
        error: "No refresh token available",
        data: null,
      };
    }

    // Make refresh request
    const refreshResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      ...fetchOptions,
      body: JSON.stringify({
        [tokenConfig.refreshTokenName]: refreshToken,
      }),
    });

    if (!refreshResponse.ok) {
      console.error("Token refresh failed");
      return {
        success: false,
        status: refreshResponse.status,
        error: "Token refresh failed",
        data: null,
      };
    }

    let newAccessToken: string;
    let newRefreshToken: string | undefined;

    if (responseType === "cookies") {
      // Handle Set-Cookie headers
      const setCookieHeader = refreshResponse.headers.get("set-cookie");
      if (!setCookieHeader) {
        return {
          success: false,
          status: 500,
          error: "No cookies returned from refresh endpoint",
          data: null,
        };
      }

      // Parse cookies from Set-Cookie header
      const cookies = parseCookieHeader(setCookieHeader);
      newAccessToken = cookies[tokenConfig.accessTokenName];
      newRefreshToken = cookies[tokenConfig.refreshTokenName];

      if (!newAccessToken) {
        return {
          success: false,
          status: 500,
          error: `Access token not found in cookies (looking for: ${tokenConfig.accessTokenName})`,
          data: null,
        };
      }
    } else {
      const refreshData = await refreshResponse.json();

      newAccessToken =
        refreshData[tokenConfig.accessTokenName] ||
        refreshData.accessToken ||
        refreshData.token ||
        refreshData.access_token;

      newRefreshToken =
        refreshData[tokenConfig.refreshTokenName] ||
        refreshData.refreshToken ||
        refreshData.refresh_token;

      if (!newAccessToken) {
        return {
          success: false,
          status: 500,
          error: `Access token not found in response (looking for: ${tokenConfig.accessTokenName})`,
          data: null,
        };
      }
    }

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set(tokenConfig.accessTokenName, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    if (newRefreshToken) {
      cookieStore.set(tokenConfig.refreshTokenName, newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
    }

    return {
      success: true,
      status: refreshResponse.status,
      data: null,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      status: 500,
      data: null,
      error: "Request failed",
    };
  }
}

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
