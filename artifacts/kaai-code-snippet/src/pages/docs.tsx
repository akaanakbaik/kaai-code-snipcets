import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Code2, Key, Shield, Zap, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  return (
    <pre className="bg-zinc-900/80 border border-border/50 rounded-lg p-4 overflow-x-auto text-sm text-zinc-200 font-mono my-2">
      <code>{children}</code>
    </pre>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-blue-400" />
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <h1 className="text-3xl font-bold tracking-tight">API Documentation</h1>
        </div>
        <p className="text-muted-foreground text-base">
          Kaai Code Snippet Public API — integrate our snippet library into your bots, tools, or apps.
        </p>
        <div className="flex gap-2 mt-3">
          <Badge variant="outline" className="text-green-400 border-green-500/30">v1</Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30">REST</Badge>
          <Badge variant="outline" className="text-orange-400 border-orange-500/30">JSON</Badge>
        </div>
      </div>

      <Separator />

      {/* Base URL */}
      <section>
        <SectionTitle icon={Code2} title="Base URL" />
        <CodeBlock>{`https://kaai-code-snipcets.vercel.app/api`}</CodeBlock>
        <p className="text-muted-foreground text-sm mt-2">
          All endpoints are prefixed with <code className="bg-zinc-900 px-1 rounded text-blue-300">/api</code>.
          Responses are always <code className="bg-zinc-900 px-1 rounded text-blue-300">application/json</code>.
        </p>
      </section>

      {/* Authentication */}
      <section>
        <SectionTitle icon={Key} title="Authentication" />
        <p className="text-muted-foreground text-sm mb-3">
          Public API endpoints require an API key sent via the <code className="bg-zinc-900 px-1 rounded text-blue-300">X-API-Key</code> header.
          Contact the admin to request your API key.
        </p>
        <CodeBlock>{`curl -H "X-API-Key: kaai_your_key_here" \\
  https://kaai-code-snipcets.vercel.app/api/snippets`}</CodeBlock>

        <Card className="mt-4 border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Keep your API key private. Do not expose it in client-side code or public repositories.
              If compromised, contact admin immediately.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Rate Limits */}
      <section>
        <SectionTitle icon={Zap} title="Rate Limits" />
        <p className="text-muted-foreground text-sm mb-3">
          Rate limits are applied per API key. Default limits:
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Per Second", value: "10 req/s" },
            { label: "Per Day", value: "1,000 req" },
            { label: "Per Month", value: "10,000 req" },
          ].map((item) => (
            <Card key={item.label} className="border-border/50">
              <CardContent className="pt-4 text-center">
                <p className="text-lg font-bold text-blue-400">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          When a limit is exceeded, the API returns <code className="bg-zinc-900 px-1 rounded text-red-300">429 Too Many Requests</code>.
          Higher limits are available — contact admin.
        </p>
      </section>

      {/* Endpoints */}
      <section>
        <SectionTitle icon={BookOpen} title="Endpoints" />

        {/* GET /snippets */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/snippets</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              List approved code snippets with filtering and pagination.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Query Parameters</p>
            <div className="space-y-1 text-sm mb-3">
              {[
                { name: "search", type: "string", desc: "Search by title, description, author, or language" },
                { name: "language", type: "string", desc: "Filter by programming language" },
                { name: "tag", type: "string", desc: "Filter by tag" },
                { name: "sortBy", type: "popular | latest | az", desc: "Sort order (default: popular)" },
                { name: "page", type: "number", desc: "Page number (default: 1)" },
                { name: "limit", type: "number", desc: "Results per page, max 50 (default: 12)" },
              ].map((p) => (
                <div key={p.name} className="flex gap-2">
                  <code className="text-blue-300 w-28 flex-shrink-0">{p.name}</code>
                  <code className="text-orange-300 w-28 flex-shrink-0 text-xs">{p.type}</code>
                  <span className="text-muted-foreground text-xs">{p.desc}</span>
                </div>
              ))}
            </div>
            <CodeBlock>{`curl -H "X-API-Key: kaai_your_key" \\
  "https://kaai-code-snipcets.vercel.app/api/snippets?language=typescript&sortBy=latest&limit=5"`}</CodeBlock>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2">Response</p>
            <CodeBlock lang="json">{`{
  "data": [
    {
      "id": "12345ABCDE",
      "title": "Debounce Hook",
      "description": "Custom React hook...",
      "language": "TypeScript",
      "tags": ["react", "hooks"],
      "code": "...",
      "authorName": "Developer",
      "status": "approved",
      "viewCount": 42,
      "copyCount": 7,
      "createdAt": "2026-04-01T12:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 12,
  "totalPages": 4
}`}</CodeBlock>
          </CardContent>
        </Card>

        {/* GET /snippets/:id */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/snippets/:id</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Get a single snippet by ID.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`curl -H "X-API-Key: kaai_your_key" \\
  https://kaai-code-snipcets.vercel.app/api/snippets/12345ABCDE`}</CodeBlock>
          </CardContent>
        </Card>

        {/* GET /snippets/popular */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/snippets/popular</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Get most viewed and most copied snippets (top 6 each).
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`curl -H "X-API-Key: kaai_your_key" \\
  https://kaai-code-snipcets.vercel.app/api/snippets/popular`}</CodeBlock>
          </CardContent>
        </Card>

        {/* GET /snippets/tags */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/snippets/tags</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Get the top 10 most used tags.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`curl -H "X-API-Key: kaai_your_key" \\
  https://kaai-code-snipcets.vercel.app/api/snippets/tags`}</CodeBlock>
          </CardContent>
        </Card>

        {/* POST /snippets */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30">POST</Badge>
              <code className="text-sm font-mono text-foreground">/api/snippets</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Submit a new snippet for review.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`curl -X POST \\
  -H "X-API-Key: kaai_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Snippet",
    "description": "A useful utility function",
    "language": "TypeScript",
    "tags": ["typescript", "utility"],
    "code": "export function hello() { return 42; }",
    "authorName": "Your Name",
    "authorEmail": "you@example.com"
  }' \\
  https://kaai-code-snipcets.vercel.app/api/snippets`}</CodeBlock>
          </CardContent>
        </Card>

        {/* GET /stats */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/stats</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Get global library statistics.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock lang="json">{`{
  "totalSnippets": 42,
  "approvedSnippets": 38,
  "pendingSnippets": 4,
  "rejectedSnippets": 0,
  "totalAuthors": 12,
  "totalLanguages": 8
}`}</CodeBlock>
          </CardContent>
        </Card>

        {/* GET /healthz */}
        <Card className="border-border/50 mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">GET</Badge>
              <code className="text-sm font-mono text-foreground">/api/healthz</code>
            </div>
            <CardTitle className="text-sm text-muted-foreground font-normal mt-1">
              Health check — no API key required.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock lang="json">{`{ "status": "ok" }`}</CodeBlock>
          </CardContent>
        </Card>
      </section>

      {/* Error Codes */}
      <section>
        <SectionTitle icon={Shield} title="Error Codes" />
        <div className="space-y-2">
          {[
            { code: "400", error: "VALIDATION_ERROR", desc: "Invalid request parameters" },
            { code: "401", error: "UNAUTHORIZED", desc: "Missing or invalid API key" },
            { code: "403", error: "FORBIDDEN", desc: "API key is disabled" },
            { code: "404", error: "NOT_FOUND", desc: "Resource not found" },
            { code: "409", error: "DUPLICATE_SNIPPET", desc: "Snippet already exists" },
            { code: "429", error: "RATE_LIMITED", desc: "Rate limit exceeded" },
            { code: "500", error: "SERVER_ERROR", desc: "Internal server error" },
          ].map((e) => (
            <div key={e.code} className="flex items-start gap-3 py-2 border-b border-border/30">
              <Badge variant="outline" className={
                e.code.startsWith("4") ? "text-orange-400 border-orange-500/30" : "text-red-400 border-red-500/30"
              }>{e.code}</Badge>
              <code className="text-blue-300 text-sm w-40 flex-shrink-0">{e.error}</code>
              <span className="text-muted-foreground text-sm">{e.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Get API Key */}
      <section>
        <SectionTitle icon={CheckCircle2} title="Get an API Key" />
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              API keys are managed by the administrator. To request access:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Contact the admin at the email listed on the site</li>
              <li>Provide your name, use case, and expected request volume</li>
              <li>Keys are activated within 24 hours</li>
            </ul>
            <p className="text-xs text-muted-foreground/60 mt-4">
              Note: Admin endpoints, webhook endpoints, and internal tools are not publicly documented.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
