import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Code2, Key, Shield, Zap, BookOpen, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  return (
    <pre className="bg-zinc-900/80 border border-border/50 rounded-md p-3 overflow-x-auto text-xs text-zinc-200 font-mono my-1.5">
      <code>{children}</code>
    </pre>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-4 h-4 text-blue-400" />
      <h2 className="text-base font-bold text-foreground">{title}</h2>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-7">
      {/* Back button */}
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 h-8 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Library
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Kaai Code Snippet Public API — integrate snippet library into your bots, tools, or apps.
        </p>
        <div className="flex gap-1.5 mt-2">
          <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px] h-5">v1</Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px] h-5">REST</Badge>
          <Badge variant="outline" className="text-orange-400 border-orange-500/30 text-[10px] h-5">JSON</Badge>
        </div>
      </div>

      <Separator />

      {/* Base URL */}
      <section>
        <SectionTitle icon={Code2} title="Base URL" />
        <CodeBlock>{`https://kaai-code-snipcets.vercel.app/api`}</CodeBlock>
        <p className="text-muted-foreground text-xs mt-1.5">
          All endpoints prefixed with <code className="bg-zinc-900 px-1 rounded text-blue-300">/api</code>.
          Responses are always <code className="bg-zinc-900 px-1 rounded text-blue-300">application/json</code>.
        </p>
      </section>

      {/* Authentication */}
      <section>
        <SectionTitle icon={Key} title="Authentication" />
        <p className="text-muted-foreground text-xs mb-2">
          Public API endpoints require an API key via the <code className="bg-zinc-900 px-1 rounded text-blue-300">X-API-Key</code> header.
          Contact admin to request your key.
        </p>
        <CodeBlock>{`curl -H "X-API-Key: kaai_your_key_here" \\
  https://kaai-code-snipcets.vercel.app/api/snippets`}</CodeBlock>

        <Card className="mt-3 border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-3 pb-3 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Keep your API key private. Do not expose it in client-side code or public repositories.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Rate Limits */}
      <section>
        <SectionTitle icon={Zap} title="Rate Limits" />
        <p className="text-muted-foreground text-xs mb-2">
          Rate limits are applied per API key. Default limits:
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Per Second", value: "10 req/s" },
            { label: "Per Day", value: "1,000" },
            { label: "Per Month", value: "10,000" },
          ].map((item) => (
            <Card key={item.label} className="border-border/50">
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-sm font-bold text-blue-400">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Exceeded limits return <code className="bg-zinc-900 px-1 rounded text-red-300">429 Too Many Requests</code>.
          Higher limits available — contact admin.
        </p>
      </section>

      {/* Endpoints */}
      <section>
        <SectionTitle icon={BookOpen} title="Endpoints" />

        {[
          {
            method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30",
            path: "/api/snippets",
            desc: "List approved snippets with filtering and pagination.",
            extra: (
              <div className="space-y-0.5 text-xs mb-2">
                {[
                  { name: "q", type: "string", desc: "Search title / description / code" },
                  { name: "language", type: "string", desc: "Filter by language" },
                  { name: "tag", type: "string", desc: "Filter by tag" },
                  { name: "sort", type: "newest|popular|copies", desc: "Sort order" },
                  { name: "page", type: "number", desc: "Page (default: 1)" },
                  { name: "limit", type: "number", desc: "Per page, max 50 (default: 12)" },
                ].map((p) => (
                  <div key={p.name} className="flex gap-2">
                    <code className="text-blue-300 w-24 flex-shrink-0">{p.name}</code>
                    <code className="text-orange-300 w-28 flex-shrink-0 text-[10px]">{p.type}</code>
                    <span className="text-muted-foreground text-[10px]">{p.desc}</span>
                  </div>
                ))}
              </div>
            ),
          },
          { method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30", path: "/api/snippets/:id", desc: "Get a single snippet by ID." },
          { method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30", path: "/api/snippets/popular", desc: "Top 6 most viewed + most copied snippets." },
          { method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30", path: "/api/snippets/tags", desc: "Top 10 most used tags." },
          { method: "POST", badge: "bg-blue-600/20 text-blue-400 border-blue-500/30", path: "/api/snippets", desc: "Submit a new snippet for admin review." },
          { method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30", path: "/api/stats", desc: "Global library statistics." },
          { method: "GET", badge: "bg-green-600/20 text-green-400 border-green-500/30", path: "/api/healthz", desc: "Health check — no API key required." },
        ].map((ep) => (
          <Card key={ep.path} className="border-border/50 mb-2">
            <CardHeader className="pb-1 pt-3 px-3">
              <div className="flex items-center gap-2">
                <Badge className={`${ep.badge} text-[10px] h-4 px-1.5`}>{ep.method}</Badge>
                <code className="text-xs font-mono text-foreground">{ep.path}</code>
              </div>
              <CardTitle className="text-xs text-muted-foreground font-normal mt-0.5">{ep.desc}</CardTitle>
            </CardHeader>
            {ep.extra && <CardContent className="px-3 pb-3">{ep.extra}</CardContent>}
          </Card>
        ))}
      </section>

      {/* Error Codes */}
      <section>
        <SectionTitle icon={Shield} title="Error Codes" />
        <div className="space-y-0">
          {[
            { code: "400", error: "VALIDATION_ERROR", desc: "Invalid request parameters" },
            { code: "401", error: "UNAUTHORIZED", desc: "Missing or invalid API key" },
            { code: "403", error: "FORBIDDEN", desc: "API key disabled or IP banned" },
            { code: "404", error: "NOT_FOUND", desc: "Resource not found" },
            { code: "429", error: "RATE_LIMITED", desc: "Rate limit exceeded" },
            { code: "500", error: "SERVER_ERROR", desc: "Internal server error" },
          ].map((e) => (
            <div key={e.code} className="flex items-center gap-2 py-1.5 border-b border-border/30">
              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${e.code.startsWith("4") ? "text-orange-400 border-orange-500/30" : "text-red-400 border-red-500/30"}`}>{e.code}</Badge>
              <code className="text-blue-300 text-xs w-36 flex-shrink-0">{e.error}</code>
              <span className="text-muted-foreground text-xs">{e.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Get API Key */}
      <section>
        <SectionTitle icon={CheckCircle2} title="Get an API Key" />
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">
              API keys are managed by the administrator. To request access:
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground mt-1.5 space-y-0.5">
              <li>Contact the admin at the email listed on the site</li>
              <li>Provide your name, use case, and expected request volume</li>
              <li>Keys are activated within 24 hours</li>
            </ul>
            <p className="text-[10px] text-muted-foreground/60 mt-3">
              Admin endpoints and webhook endpoints are not publicly documented.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
