import { cookies } from "next/headers";

export async function retry(url: string, options: RequestInit = {}) {
  try {
    const accessToken = (await cookies()).get("refreshToken")?.value;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
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
