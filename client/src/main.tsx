import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

// Check if we're in Railway mode (no Manus OAuth configured)
const isRailwayMode = !import.meta.env.VITE_OAUTH_PORTAL_URL || !import.meta.env.VITE_APP_ID;

// Get API key from localStorage or use default
function getApiKey(): string {
  return localStorage.getItem("storyboard-api-key") || "";
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (isRailwayMode) {
    // In Railway mode, show API key prompt instead of OAuth redirect
    const key = prompt("请输入API Key以访问平台：");
    if (key) {
      localStorage.setItem("storyboard-api-key", key);
      window.location.reload();
    }
  } else {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const headers: Record<string, string> = {};
        
        // In Railway mode, add API key to Authorization header
        if (isRailwayMode) {
          const apiKey = getApiKey();
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers: {
            ...((init as RequestInit)?.headers ?? {}),
            ...headers,
          },
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
