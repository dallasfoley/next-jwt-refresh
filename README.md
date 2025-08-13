# next-jwt-refresh

This repository demonstrates a comprehensive solution for handling JWT token refresh in Next.js applications using Server Actions and the App Router. This package works the same in either case: if you're using a separate backend or Next.js as your backend.

## Aim

When building Next.js applications with JWT authentication, you face a common challenge: **access tokens expire and need to be refreshed transparently, across a few different cases, without disrupting the user experience**. In the modern landscape of Next.js, there is a particularly complex difficulty that arises when a request with an expired token is made from a Server Component. This package aims to abstract away the complexities that come with implementing JWT token refresh in Next.js App Router apps.

## The Key Issue

A fetch wrapper is provided that when given the fetch request URL and options for the fetch request you're wrapping and your refresh endpoint, it will perform the fetch call, run it and check if the access token is expired. If so, it will call the given refresh endpoint, set the new access token and retry the original request. However, the cookies function works differently in different contexts.

As Vercel explains:

cookies is an async function that allows you to read the HTTP incoming request cookies in Server Components, and read/write/delete outgoing request cookies in Server Actions or Route Handlers.

Reading cookies works in Server Components because you're accessing the cookie data that the client's browser sends to the server in the HTTP request headers.

Setting cookies cannot be done directly in a Server Component, even when using a Route Handler or Server Action. This is because cookies are actually stored by the browser, not the server.

This implies that any Server Function, including our fetch wrapper, will not be able to set cookies for our access token if called from a Server Component. For example, if a user navigates to a page that requires data fetching (typically done in a Server Component) but their access token expires, you cannot set cookies after calling your refresh endpoint. So what now?

## Solution

There's a couple ways to go about this.

## Solution Architecture

### 1. Server Action for Token Refresh (`fetch-with-refresh-retry.ts`)

A fetch wrapper that takes the request URL and options for both the fetch request you want to wrap and your refresh endpoint URL and refres .

**Why this works:**
\`\`\`typescript
"use server"
export async function refreshAndRetry(/_ params _/) {
// This runs on the server and can set cookies
const { cookies } = await import('next/headers')

// Refresh the token
const newToken = await refreshAccessToken()

// Set the new cookie - this works because we're on the server
cookies().set('accessToken', newToken, { httpOnly: true })

// Retry the original request with the new token
return await retryOriginalRequest()
}
\`\`\`

AuthProvider (`auth-provider.tsx`)

A client-side React Context that manages authentication state and provides methods for executing authenticated requests.

**Key Features:**

- `executeWithAuth()`: Wraps any async operation with auth error handling
- `refreshAndRetryRequest()`: Calls the Server Action to refresh tokens and retry requests
- Uses `useTransition` for smooth loading states
- Handles routing to login page when refresh fails

### 2. useAuthenticatedFetch Hook (`use-authenticated-fetch.tsx`)

A custom hook that handles authenticated data fetching with automatic retry logic.

**Key Features:**

- Automatically detects 401 responses
- Triggers token refresh and request retry
- Manages loading, error, and success states
- Supports both auto-fetch and manual fetch patterns

### 3.

### 4. Component Wrappers

#### AuthClientComponentWrapper (`auth-client-component-wrapper.tsx`)

Handles UI states (loading, error, success) for client-side authenticated data fetching.

#### AuthServerComponentWrapper (`async-component.tsx`)

Provides fallback to client components when server-side auth fails.

## How It Works

### For Client-Side Requests

1. **Initial Request**: Client component makes an authenticated request
2. **401 Detection**: Hook detects 401 response indicating expired token
3. **Server Action Call**: Client calls the `refreshAndRetry` Server Action
4. **Token Refresh**: Server Action refreshes token and sets new cookies
5. **Request Retry**: Server Action retries the original request with new token
6. **Success**: Updated data is returned to the client

### For Server-Side Requests

1. **Server Fetch**: Server component attempts authenticated request
2. **Auth Failure**: If auth fails, component falls back to client wrapper
3. **Client Handling**: Client wrapper uses the same refresh logic as above

## Usage Examples

### Basic Authenticated Fetch

\`\`\`tsx
const { data, isLoading, error, refetch } = useAuthenticatedFetch({
fetchAction: () => fetchUserProfile(),
refreshUrl: '/api/auth/refresh',
retryUrl: '/api/user/profile',
refreshOptions: { method: 'POST' },
retryOptions: { method: 'GET' }
})
\`\`\`

### Component Wrapper

\`\`\`tsx
<AuthClientComponentWrapper
fetchAction={() => fetchDashboardData()}
refreshUrl="/api/auth/refresh"
retryUrl="/api/dashboard"
refreshOptions={{ method: 'POST' }}
retryOptions={{ method: 'GET' }}
SuccessComponent={DashboardComponent}
/>
\`\`\`

## Key Benefits

1. **Transparent Token Refresh**: Users never see auth errors for expired tokens
2. **Consistent Cookie Handling**: Server Actions ensure cookies are set properly
3. **Flexible Architecture**: Works with both client and server components
4. **Type Safety**: Full TypeScript support with generic types
5. **Error Boundaries**: Graceful handling of auth failures with fallbacks

## File Structure

\`\`\`
├── providers/
│ └── AuthProvider/
│ └── auth-provider.tsx # Main auth context
├── hooks/
│ └── use-authenticated-fetch.tsx # Auth fetch hook
├── components/
│ ├── auth-client-component-wrapper.tsx # Client wrapper
│ └── auth-server-component-wrapper.tsx # Server wrapper
└── utils/
└── fetch-with-refresh-retry.ts # Server Action
\`\`\`

This solution provides a robust, type-safe, and user-friendly approach to handling JWT token refresh in modern Next.js applications.
