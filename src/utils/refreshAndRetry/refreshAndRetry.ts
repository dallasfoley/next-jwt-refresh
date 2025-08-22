"use server";

import { refresh } from "../refresh";
import { retry } from "../retry";
import { TokenConfig } from "../retry/retry";

export async function refreshAndRetry(
  url: string,
  options: RequestInit & {
    tokenNames?: TokenConfig;
  } = {},
  refreshUrl: string,
  refreshOptions: RequestInit & {
    responseType?: "json" | "cookies";
    tokenNames?: TokenConfig;
  } = {}
) {
  const refreshResult = await refresh(refreshUrl, refreshOptions);

  if (!refreshResult.success) {
    return refreshResult;
  }

  return await retry(url, {
    ...options,
    tokenNames: refreshOptions.tokenNames,
  });
}
