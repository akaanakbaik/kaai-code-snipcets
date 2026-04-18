import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";

import Layout from "@/components/layout";

// Critical routes — eager loaded (visible on first paint)
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import SnippetDetail from "@/pages/snippet-detail";

// Non-critical routes — lazy loaded (reduces initial bundle ~40%)
const Admin = lazy(() => import("@/pages/admin"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const Stats = lazy(() => import("@/pages/stats"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const RawView = lazy(() => import("@/pages/raw"));
const Docs = lazy(() => import("@/pages/docs"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto w-full">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Raw view — no layout, standalone */}
      <Route path="/raw/:id">
        <Suspense fallback={null}>
          <RawView />
        </Suspense>
      </Route>

      {/* All other routes use the shared layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/upload" component={Upload} />
            <Route path="/snippet/:id" component={SnippetDetail} />
            <Route path="/admin/login">
              <Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>
            </Route>
            <Route path="/admin">
              <Suspense fallback={<PageLoader />}><Admin /></Suspense>
            </Route>
            <Route path="/stats">
              <Suspense fallback={<PageLoader />}><Stats /></Suspense>
            </Route>
            <Route path="/terms">
              <Suspense fallback={<PageLoader />}><Terms /></Suspense>
            </Route>
            <Route path="/privacy">
              <Suspense fallback={<PageLoader />}><Privacy /></Suspense>
            </Route>
            <Route path="/docs">
              <Suspense fallback={<PageLoader />}><Docs /></Suspense>
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="kaai-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
