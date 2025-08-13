"use server";

import { cookies } from "next/headers";

export async function refresh(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; status: number; error: string; data: any }> {
  try {
    console.log("Server Action: Refreshing token...");

    const refreshToken = (await cookies()).get("refreshToken")?.value;

    // Refresh the token
    const refreshResponse = await fetch(url, {
      ...options,
      body: JSON.stringify({ refreshToken }),
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

    const refreshData = await refreshResponse.json();
    const newAccessToken = refreshData.accessToken;

    const cookieStore = await cookies();
    cookieStore.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    return {
      success: refreshResponse.ok,
      status: refreshResponse.status,
      data: null,
      error: refreshResponse.ok
        ? null
        : refreshData.message || refreshData.error || "Request failed",
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
