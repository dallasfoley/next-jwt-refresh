# next-jwt-refresh

This repository provides a comprehensive solution for handling JWT token refreshes in Next.js App Router applications. This package works the same in either case: if you're using a separate backend or Next.js as your backend.

## Installation

```bash
npm install next-jwt-refresh
```

or

```bash
pnpm add next-jwt-refresh
```

or

```bash
yarn add next-jwt-refresh
```

or

```bash
bun add next-jwt-refresh
```

## API Reference

### **fetchWithRefreshRetry(url, options, refreshUrl, refreshOptions)**

Main fetch wrapper function for making authenticated requests with automatic token refresh. Will attempt a fetch request that requires authentication, and if the token is expired, will call the refresh endpoint, set the new token and retry the original request. This is a Server Function that uses the 'refreshAndRetry' Server Function which is composed of the 'refresh' and 'retry' Server Functions. All Server Functions are exported for modularity.

#### Signature

```typescript
async function fetchWithRefreshRetry(
url: string,
options?: RequestInit,
refreshUrl?: string,
refreshOptions?: RequestInit
): Promise<{
success: boolean;
status?: number;
error?: string;
data?: any;
}>
```

#### Parameters

- `url`: The URL of the API endpoint for the fetch request.
- `options`: The options for the fetch request.
- `refreshUrl`: The URL of the API endpoint for token refresh.
- `refreshOptions`: The options for the token refresh request.

#### Returns

A Promise that resolves to an object containing the success status, status code, error message, and data from the API response.

### **refreshAndRetry(refreshUrl, refreshOptions, retryUrl, retryOptions)**

Function for calling the refresh endpoint and retrying the original request with the new access token. This is a Server Function used in fetchWithRefreshRetry. This Server Function is composed of the 'refresh' and 'retry' Server Functions.

#### Signature

```typescript
async function fetchWithRefreshRetry(
url: string,
options?: RequestInit,
refreshUrl?: string,
refreshOptions?: RequestInit
): Promise<{
success: boolean;
status?: number;
error?: string;
data?: any;
}>
```

#### Parameters

- `url`: The URL of the API endpoint for the fetch request.
- `options`: The options for the fetch request.
- `refreshUrl`: The URL of the API endpoint for token refresh.
- `refreshOptions`: The options for the token refresh request.

#### Returns

A Promise that resolves to an object containing the success status, status code, error message, and data from the API response.

### **refresh(url, options)**

Refreshes access token using refresh token from cookies.

#### Signature

```typescript
async function refresh(
refreshUrl?: string,
refreshOptions?: RequestInit
): Promise<{
success: boolean;
status?: number;
error?: string;
data?: any;
}>
```

#### Parameters

- `refreshUrl`: The URL of the API endpoint for token refresh.
- `refreshOptions`: The options for the token refresh request.

#### Returns

A Promise that resolves to an object containing the success status, status code, error message, and data from the API response.

### **retry(url, options)**

Retries original request with updated access token.

#### Signature

```typescript
async function retry(
url: string,
options?: RequestInit,
): Promise<{
success: boolean;
status?: number;
error?: string;
data?: any;
}>
```

#### Returns

A Promise that resolves to an object containing the success status, status code, error message, and data from the API response.

### **useAuthenticatedFetch**

A React component that wraps your app and provides access to

## Usage Examples

### 1. Middleware Configuration

```typescript
import { NextResponse, NextRequest } from "next/server";
import { refreshTokenMiddleware } from "next-jwt-refresh";

export async function middleware(request: NextRequest) {
const protectedPaths = ["/dashboard", "/account", "/settings"];

if (!protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
return NextResponse.next();
}

await refreshTokenMiddleware(request, {
accessToken: request.cookies.get("accessToken")?.value,
refreshToken: request.cookies.get("refreshToken")?.value,
refreshUrl: `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`,
refreshOptions: {
method: "POST",
headers: {
"Content-Type": "application/json",
Accept: "application/json",
},
},
protectedPaths: ["/admin", "/browse", "/dashboard", "/settings", "/update"],
loginPath: "/login/username",
});

return NextResponse.next();
}
```

### 2. Server Action/Route Handler with Token Refresh

```typescript
"use server";

import { fetchWithRefreshRetry } from "next-jwt-refresh";
import { cookies } from "next/headers";

export async function addUserBook(userBook) {
const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/user_books/${userBook.userId}/${userBook.bookId}`;
const refreshUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`;

try {
const cookieStore = await cookies();
const accessToken = cookieStore.get("accessToken")?.value;
const refreshToken = cookieStore.get("refreshToken")?.value;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(userBook),
    };

    const refreshOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    };

    const response = await fetchWithRefreshRetry(
      url,
      options,
      refreshUrl,
      refreshOptions
    );

    if (!response.success) {
      return {
        success: false,
        message: response.error || "Request failed",
      };
    }

    return {
      success: true,
      message: "Book added successfully!",
      data: response.data,
    };

} catch (error) {
console.error("Error in addUserBook:", error);
return {
success: false,
message: "An unexpected error occurred",
};
}
}
```

## Common Cases

There exists a variety of scenarios where you need to make an authenicated call to your backend, but your access token may have expired. This packages aims to provides the best solution for each case.

### 1. Mutating Data from Client Components

You commonly need to make a call to your backend to mutate data based on some user input, a click or form submission, or some other event. Regardless of whether you're using Next.js as your backend or a separate backend, through a Server Action or Route Handler, you can wrap the fetch call in the fetchWithRefreshRetry function to automatically call your refresh endpoint and retry the request with the new access token. This works because the Server Action or Route Handler would be called from a Client Component, which has access to setting cookies.

### 2. Fetching Data from Server Components

Vercel recommends that data fetching should be done in Server Components. However, if you need to fetch data but your access token may have expired, an issue arises.

As Vercel explains:

"cookies is an async function that allows you to read the HTTP incoming request cookies in Server Components, and read/write/delete outgoing request cookies in Server Actions or Route Handlers.

Reading cookies works in Server Components because you're accessing the cookie data that the client's browser sends to the server in the HTTP request headers.

Setting cookies cannot be done directly in a Server Component, even when using a Route Handler or Server Action. This is because cookies are actually stored by the browser, not the server."

This implies that any Server Function, including our fetch wrapper, will not be able to set cookies to store our new access token if called from a Server Component. For example, if a user navigates to a page that requires data fetching (typically done in a Server Component) but their access token has expired, you cannot set cookies after calling your refresh endpoint.

The solution is to use Middleware, and particularly the _refreshTokenMiddleware_ function, to check if the token is expired before the page is rendered. If it is, the function will call your refresh endpoint
to set the new access token before the page is rendered.

### 3. Fetching Data from Client Components

Although not recommended by Vercel, as you cannot utilize their overloaded fetch wrapper, Data Cache, etc., the _useAuthenticatedFetch_ hook can be used to make authenticated requests from Client Components, and calls the _refreshAndRetry_ function under the hood to automatically handle token refreshes.

## Limitations

Parallel Request Handling: Multiple simultaneous requests with expired tokens may trigger multiple refresh attempts. I'm considering implementing request queuing (I do not currently need it for my use case but may add it if I find it useful or there's any demand).

Long-Running Requests: Tokens may expire during long-running operations like large file uploads.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License Copyright (c) 2025 Dallas Foley

Permission is hereby granted, free
of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice
(including the next paragraph) shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
