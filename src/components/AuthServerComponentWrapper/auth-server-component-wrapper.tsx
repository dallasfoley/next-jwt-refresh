import { Suspense } from "react";

// Simplified response type with generic context
interface ServerResponse<TData, TContext> {
  data: TData | null;
  status: number;
  context: TContext; // Generic context instead of specific user properties
}

interface AuthServerComponentWrapperProps<TData, TContext> {
  // Server fetch function that includes context
  serverFetch: () => Promise<ServerResponse<TData, TContext>>;

  // Client component that can handle auth
  ClientFallback: React.ComponentType<{ context: TContext }>;

  // Server component for successful data fetch
  ServerComponent: React.ComponentType<{
    data: TData;
    context: TContext;
  }>;

  // Optional empty state component
  EmptyComponent?: React.ComponentType<{ context: TContext }>;

  // Optional loading fallback
  loadingFallback?: React.ReactNode;
}

export default async function AuthServerComponentWrapper<
  TData,
  TContext = object // Default to generic object type
>({
  serverFetch,
  ClientFallback,
  ServerComponent,
  EmptyComponent,
  loadingFallback = <div>Loading...</div>,
}: AuthServerComponentWrapperProps<TData, TContext>) {
  try {
    const response = await serverFetch();

    // Auth error - render client component that can refresh tokens
    if (response.status === 401) {
      return (
        <Suspense fallback={loadingFallback}>
          <ClientFallback context={response.context} />
        </Suspense>
      );
    }

    // Handle empty data
    if (
      !response.data ||
      (Array.isArray(response.data) && response.data.length === 0)
    ) {
      if (EmptyComponent) {
        return <EmptyComponent context={response.context} />;
      }
      return <p className="text-zinc-400 text-center">No data available.</p>;
    }

    // Success - render server component
    return <ServerComponent data={response.data} context={response.context} />;
  } catch (error) {
    console.error("Server component error:", error);
    throw error;
  }
}
