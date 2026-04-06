import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";

import Layout from "@/components/layout";
import Home from "@/pages/home";
import Upload from "@/pages/upload";
import SnippetDetail from "@/pages/snippet-detail";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import Stats from "@/pages/stats";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import RawView from "@/pages/raw";
import Docs from "@/pages/docs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function WithLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

function Router() {
  return (
    <Switch>
      {/* Raw view — no layout, standalone page */}
      <Route path="/raw/:id" component={RawView} />

      {/* All other routes use the sidebar layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/upload" component={Upload} />
            <Route path="/snippet/:id" component={SnippetDetail} />
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/admin" component={Admin} />
            <Route path="/stats" component={Stats} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/docs" component={Docs} />
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
