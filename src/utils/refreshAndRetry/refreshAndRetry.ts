"use server";

import { refresh } from "../refresh";
import { retry } from "../retry";

export async function refreshAndRetry(
  refreshUrl: string,
  refreshOptions: RequestInit = {},
  retryUrl: string,
  retryOptions: RequestInit = {}
) {
  const refreshResult = await refresh(refreshUrl, refreshOptions);

  if (!refreshResult.success) {
    return refreshResult;
  }

  return await retry(retryUrl, retryOptions);
}
