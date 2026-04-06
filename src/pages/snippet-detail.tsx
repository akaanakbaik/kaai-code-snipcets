import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Download, Clock, Tag, Code2, AlertTriangle, Share2, Eye } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { useGetSnippet, getGetSnippetQueryKey } from "@workspace/api-client-react";
import { getLanguageBadge } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LANG_EXTENSIONS: Record<string, string> = {
  javascript: "js", typescript: "ts", python: "py", go: "go", rust: "rs",
  java: "java", csharp: "cs", cpp: "cpp", php: "php", ruby: "rb",
  swift: "swift", kotlin: "kt", html: "html", css: "css", sql: "sql",
  bash: "sh", json: "json", yaml: "yaml", markdown: "md", other: "txt",
};

// Map our language names to Prism language identifiers
const PRISM_LANG_MAP: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", python: "python",
  go: "go", rust: "rust", java: "java", csharp: "csharp", cpp: "cpp",
  php: "php", ruby: "ruby", swift: "swift", kotlin: "kotlin",
  html: "html", css: "css", sql: "sql", bash: "bash", json: "json",
  yaml: "yaml", markdown: "markdown", other: "text",
};

const API_BASE = "";

export default function SnippetDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: snippet, isLoading, isError } = useGetSnippet(id, {
    query: { enabled: !!id, queryKey: getGetSnippetQueryKey(id) },
  });

  // Scroll to top when opening
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  // Track view once snippet loads (debounced - only fire once per snippet)
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!id || !snippet || viewTracked.current) return;
    viewTracked.current = true;
    fetch(`${API_BASE}/api/snippets/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id, snippet?.id]);

  // Reset copy state
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    fetch(`${API_BASE}/api/snippets/${id}/copy`, { method: "POST" }).catch(() => {});
    toast({ title: "Tersalin!", description: "Kode berhasil disalin.", duration: 1800 });
  };

  const handleDownload = () => {
    if (!snippet) return;
    const ext = LANG_EXTENSIONS[snippet.language.toLowerCase()] || "txt";
    const filename = `${snippet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;
    const blob = new Blob([snippet.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Download dimulai", description: filename });
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: "Link tersalin!", duration: 1800 });
  };

  const handleOpenRaw = () => {
    window.open(`/raw/${id}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <div className="glass-card rounded-xl p-5 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-28" /></div>
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !snippet) {
    return (
      <div className="max-w-3xl mx-auto w-full flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4 opacity-70" />
        <h2 className="text-xl font-heading font-bold text-foreground">Snippet Tidak Ditemukan</h2>
        <p className="text-muted-foreground mt-2 text-sm">Snippet yang kamu cari tidak ada atau sudah dihapus.</p>
        <Button asChild size="sm" className="mt-6">
          <Link href="/">Kembali ke Library</Link>
        </Button>
      </div>
    );
  }

  const langConfig = getLanguageBadge(snippet.language);
  const ext = LANG_EXTENSIONS[snippet.language.toLowerCase()] || "txt";
  const filename = `${snippet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;
  const prismLang = PRISM_LANG_MAP[snippet.language.toLowerCase()] || "text";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-5xl mx-auto w-full pb-10"
    >
      <div className="mb-4">
        <Button variant="ghost" asChild className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground h-8 text-xs">
          <Link href="/"><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Library</Link>
        </Button>
      </div>

      {/* Compact header card */}
      <div className="glass-card rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("px-2 py-0.5 rounded-lg border font-medium text-xs", langConfig.color)}>
                <Code2 className="w-3 h-3 mr-1" />{langConfig.label}
              </Badge>
              {snippet.status === "pending" && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">Menunggu Review</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 ml-auto">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {(snippet as any).viewCount || 0} dilihat</span>
              <span className="flex items-center gap-0.5"><Copy className="w-3 h-3" /> {(snippet as any).copyCount || 0} disalin</span>
            </div>
          </div>

          <h1 className="text-lg font-heading font-bold tracking-tight text-foreground leading-snug">
            {snippet.title}
          </h1>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {snippet.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] font-bold border border-blue-500/15">
                {snippet.authorName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-foreground/80">{snippet.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 opacity-50" />
              {format(new Date(snippet.createdAt), "d MMMM yyyy")}
            </div>
            {snippet.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="w-3 h-3 opacity-50" />
                {snippet.tags.map((tag, i) => (
                  <span key={i} className="bg-secondary/50 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code block */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-[#1e1e1e] shadow-xl">
        {/* Code toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#252526] border-b border-white/5">
          {/* Row 1: traffic lights + filename */}
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-1 sm:py-2.5">
            <div className="flex gap-1.5 flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-xs font-mono text-[#858585] ml-1 select-none truncate max-w-[140px] sm:max-w-none">{filename}</span>
          </div>
          {/* Row 2 (mobile) / same row (sm+): action buttons */}
          <div className="flex items-center gap-0.5 px-3 pb-2 sm:pb-0 sm:pr-3 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleOpenRaw}
              className="h-7 px-2 sm:px-2.5 text-xs text-[#858585] hover:text-[#cccccc] hover:bg-white/5 rounded transition-colors flex items-center gap-1 flex-shrink-0"
              title="Lihat kode mentah"
            >
              <Eye className="w-3 h-3" />
              <span className="hidden xs:inline sm:inline">Raw</span>
            </button>
            <button
              onClick={handleCopy}
              className={cn(
                "h-7 px-2 sm:px-2.5 text-xs rounded transition-colors flex items-center gap-1 flex-shrink-0",
                copied
                  ? "text-green-400 bg-green-500/10"
                  : "text-[#858585] hover:text-[#cccccc] hover:bg-white/5",
              )}
              data-testid="btn-copy-code"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Tersalin" : "Salin"}</span>
            </button>
            <button
              onClick={handleShareLink}
              className={cn(
                "h-7 px-2 sm:px-2.5 text-xs rounded transition-colors flex items-center gap-1 flex-shrink-0",
                linkCopied ? "text-blue-400" : "text-[#858585] hover:text-[#cccccc] hover:bg-white/5",
              )}
            >
              {linkCopied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              <span>{linkCopied ? "Tersalin" : "Bagikan"}</span>
            </button>
            <button
              onClick={handleDownload}
              className="h-7 px-2 sm:px-2.5 text-xs text-[#858585] hover:text-[#cccccc] hover:bg-white/5 rounded transition-colors flex items-center gap-1 flex-shrink-0"
              data-testid="btn-download-code"
            >
              <Download className="w-3 h-3" />
              <span className="hidden xs:inline">Download</span>
            </button>
          </div>
        </div>

        {/* Syntax-highlighted code */}
        <div className="overflow-auto max-h-[60vh]" style={{ minHeight: "160px" }}>
          <SyntaxHighlighter
            language={prismLang}
            style={vscDarkPlus}
            showLineNumbers={true}
            lineNumberStyle={{
              color: "#4a4a5a",
              fontSize: "11px",
              paddingRight: "16px",
              userSelect: "none",
              minWidth: "2.5em",
            }}
            customStyle={{
              margin: 0,
              padding: "16px 16px 16px 0",
              background: "#1e1e1e",
              fontSize: "13px",
              lineHeight: "1.6",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              overflowX: "auto",
              minWidth: "max-content",
              width: "100%",
            }}
            codeTagProps={{
              style: {
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              },
            }}
            wrapLines={false}
            wrapLongLines={false}
          >
            {snippet.code}
          </SyntaxHighlighter>
        </div>

        {/* Code footer */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#007acc] text-white text-[10px] font-mono">
          <span>{langConfig.label}</span>
          <span>{snippet.code.split("\n").length} baris &middot; {snippet.code.length.toLocaleString()} karakter</span>
        </div>
      </div>
    </motion.div>
  );
}
