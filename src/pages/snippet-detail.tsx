import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Check, Download, Clock, Tag, Code2, AlertTriangle, Share2, Eye, Lock, KeyRound, EyeOff, Loader2, LockOpen, ShieldOff } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { useGetSnippet, getGetSnippetQueryKey } from "@workspace/api-client-react";
import { getLanguageBadge } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LANG_EXTENSIONS: Record<string, string> = {
  javascript: "js", typescript: "ts", python: "py", go: "go", rust: "rs",
  java: "java", csharp: "cs", cpp: "cpp", php: "php", ruby: "rb",
  swift: "swift", kotlin: "kt", html: "html", css: "css", sql: "sql",
  bash: "sh", json: "json", yaml: "yaml", markdown: "md", other: "txt",
};

const PRISM_LANG_MAP: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", python: "python",
  go: "go", rust: "rust", java: "java", csharp: "csharp", cpp: "cpp",
  php: "php", ruby: "ruby", swift: "swift", kotlin: "kotlin",
  html: "html", css: "css", sql: "sql", bash: "bash", json: "json",
  yaml: "yaml", markdown: "markdown", other: "text",
};

const API_BASE = "";

type FullSnippet = {
  id: string; title: string; description: string; language: string;
  tags: string[]; code: string; authorName: string; status: string;
  viewCount: number; copyCount: number; createdAt: string; updatedAt: string;
  isLocked?: boolean; lockType?: string | null; lockDisabledAt?: string | null;
};

function UnlockModal({
  snippetId,
  lockType,
  onUnlocked,
  onClose,
}: {
  snippetId: string;
  lockType: string | null;
  onUnlocked: (code: string, token: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const isPin = lockType === "pin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/snippets/${snippetId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.message ?? "Password salah.";
        setError(msg);
        if (json.attemptsLeft !== undefined) setAttemptsLeft(json.attemptsLeft);
        return;
      }
      const token: string = json.token;
      sessionStorage.setItem(`unlock_token_${snippetId}`, token);
      const snippetRes = await fetch(`${API_BASE}/api/snippets/${snippetId}`, {
        headers: { "X-Unlock-Token": token },
      });
      if (!snippetRes.ok) throw new Error("Gagal memuat kode");
      const snippetData = await snippetRes.json();
      onUnlocked(snippetData.code ?? "", token);
      toast({ title: "Snippet terbuka!", description: "Kode berhasil diakses.", duration: 2000 });
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-sm glass-card rounded-2xl p-6 space-y-5 border border-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto border border-amber-500/25">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-heading font-bold text-foreground">Snippet Terkunci</h2>
          <p className="text-xs text-muted-foreground">
            Masukkan {isPin ? "PIN" : "password"} untuk melihat kode ini.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              type={showPw ? "text" : (isPin ? "tel" : "password")}
              inputMode={isPin ? "numeric" : undefined}
              pattern={isPin ? "[0-9]*" : undefined}
              placeholder={isPin ? "Masukkan PIN..." : "Masukkan password..."}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              maxLength={isPin ? 10 : 100}
              className="pr-10 bg-background/60"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 flex items-start gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {error}
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <span className="ml-1 text-amber-400">({attemptsLeft} percobaan tersisa)</span>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 text-sm h-9" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" className="flex-1 text-sm h-9" disabled={loading || !password.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span className="ml-1.5">Buka</span>
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DisableLockModal({
  snippetId,
  snippetTitle,
  onDisabled,
  onClose,
}: {
  snippetId: string;
  snippetTitle: string;
  onDisabled: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Masukkan email penulis"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/snippets/${snippetId}/disable-lock/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorEmail: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message ?? "Gagal mengirim OTP"); return; }
      setStep("otp");
      toast({ title: "OTP Terkirim", description: "Cek email penulis untuk kode OTP 3 angka.", duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp.trim()) { setError("Masukkan kode OTP"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/snippets/${snippetId}/disable-lock/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message ?? "OTP salah atau kedaluwarsa"); return; }
      toast({ title: "Kunci Dimatikan!", description: "Kunci snippet berhasil dimatikan secara permanen.", duration: 3000 });
      onDisabled();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-amber-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <ShieldOff className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="font-heading font-bold text-sm text-foreground">Matikan Kunci</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xs p-1">✕</button>
        </div>

        <div className="mb-4 rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-xs text-red-400 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Tindakan ini <strong>permanen</strong> dan tidak bisa dibatalkan. Setelah kunci dimatikan, snippet tidak akan bisa dikunci lagi.</span>
        </div>

        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Masukkan email yang kamu gunakan saat mengupload snippet <strong className="text-foreground">"{snippetTitle}"</strong>:</p>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="bg-background/50 text-sm h-9"
                autoFocus
                disabled={loading}
              />
            </div>
            {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onClose} disabled={loading}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-8 text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20" disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><LockOpen className="w-3.5 h-3.5 mr-1" />Kirim OTP</>}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">OTP 3 angka telah dikirim ke <strong className="text-foreground">{email}</strong>. Masukkan kode tersebut:</p>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={3}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="• • •"
                className="bg-background/50 text-center text-3xl font-bold tracking-[0.5em] h-14 font-mono"
                autoFocus
                disabled={loading}
              />
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">OTP berlaku 3 menit · sekali pakai</p>
            </div>
            {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setStep("email"); setOtp(""); setError(""); }} disabled={loading}>Kembali</Button>
              <Button type="submit" size="sm" className="flex-1 h-8 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" disabled={loading || otp.length !== 3}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ShieldOff className="w-3.5 h-3.5 mr-1" />Matikan Kunci</>}
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function SnippetDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showDisableLock, setShowDisableLock] = useState(false);
  const [lockDisabledLocally, setLockDisabledLocally] = useState(false);
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null);

  const { data: snippet, isLoading, isError } = useGetSnippet(id, {
    query: { enabled: !!id, queryKey: getGetSnippetQueryKey(id) },
  });

  const s = snippet as unknown as FullSnippet | undefined;
  const isLocked = s?.isLocked ?? false;
  const lockIsDisabled = lockDisabledLocally || !!(s?.lockDisabledAt);
  const hasCode = isLocked && !lockIsDisabled ? (unlockedCode !== null) : (!!s?.code);
  const effectivelyLocked = isLocked && !lockIsDisabled;
  const displayCode = effectivelyLocked ? (unlockedCode ?? "") : (s?.code ?? "");

  // Try restoring unlock token from sessionStorage
  useEffect(() => {
    if (!id || !isLocked || unlockedCode !== null) return;
    const cached = sessionStorage.getItem(`unlock_token_${id}`);
    if (!cached) return;
    fetch(`${API_BASE}/api/snippets/${id}`, { headers: { "X-Unlock-Token": cached } })
      .then((r) => r.json())
      .then((d) => { if (d.code) setUnlockedCode(d.code); })
      .catch(() => {});
  }, [id, isLocked]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  const viewTracked = useRef(false);
  useEffect(() => {
    if (!id || !s || viewTracked.current) return;
    viewTracked.current = true;
    fetch(`${API_BASE}/api/snippets/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id, s?.id]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!s) return;
    if (effectivelyLocked && !hasCode) { setShowUnlock(true); return; }
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    fetch(`${API_BASE}/api/snippets/${id}/copy`, { method: "POST" }).catch(() => {});
    toast({ title: "Tersalin!", description: "Kode berhasil disalin.", duration: 1800 });
  };

  const handleDownload = () => {
    if (!s) return;
    if (effectivelyLocked && !hasCode) { setShowUnlock(true); return; }
    const ext = LANG_EXTENSIONS[s.language.toLowerCase()] || "txt";
    const filename = `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;
    const blob = new Blob([displayCode], { type: "text/plain" });
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

  if (isError || !s) {
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

  const langConfig = getLanguageBadge(s.language);
  const ext = LANG_EXTENSIONS[s.language.toLowerCase()] || "txt";
  const filename = `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${ext}`;
  const prismLang = PRISM_LANG_MAP[s.language.toLowerCase()] || "text";

  return (
    <>
      <AnimatePresence>
        {showUnlock && (
          <UnlockModal
            snippetId={id}
            lockType={s.lockType ?? null}
            onUnlocked={(code, _token) => { setUnlockedCode(code); setShowUnlock(false); }}
            onClose={() => setShowUnlock(false)}
          />
        )}
        {showDisableLock && (
          <DisableLockModal
            snippetId={id}
            snippetTitle={s.title}
            onDisabled={() => { setShowDisableLock(false); setLockDisabledLocally(true); }}
            onClose={() => setShowDisableLock(false)}
          />
        )}
      </AnimatePresence>

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

        {/* Header card */}
        <div className="glass-card rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("px-2 py-0.5 rounded-lg border font-medium text-xs", langConfig.color)}>
                  <Code2 className="w-3 h-3 mr-1" />{langConfig.label}
                </Badge>
                {isLocked && lockIsDisabled && (
                  <Badge variant="outline" className="text-xs border gap-1 bg-slate-500/10 text-slate-400 border-slate-500/30">
                    <LockOpen className="w-2.5 h-2.5" /> Kunci Dimatikan
                  </Badge>
                )}
                {effectivelyLocked && (
                  <Badge variant="outline" className={cn("text-xs border gap-1", hasCode
                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  )}>
                    <Lock className="w-2.5 h-2.5" />
                    {hasCode ? "Terbuka" : s.lockType === "pin" ? "Dikunci (PIN)" : "Dikunci (Password)"}
                  </Badge>
                )}
                {s.status === "pending" && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">Menunggu Review</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 ml-auto">
                <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {s.viewCount || 0} dilihat</span>
                <span className="flex items-center gap-0.5"><Copy className="w-3 h-3" /> {s.copyCount || 0} disalin</span>
              </div>
            </div>

            <h1 className="text-lg font-heading font-bold tracking-tight text-foreground leading-snug">
              {s.title}
            </h1>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {s.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] font-bold border border-blue-500/15">
                  {s.authorName.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-foreground/80">{s.authorName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-50" />
                {format(new Date(s.createdAt), "d MMMM yyyy")}
              </div>
              {s.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className="w-3 h-3 opacity-50" />
                  {s.tags.map((tag, i) => (
                    <span key={i} className="bg-secondary/50 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code block or lock placeholder */}
        {effectivelyLocked && !hasCode ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col items-center justify-center py-16 px-4 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground">Kode Dikunci</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Snippet ini dilindungi dengan {s.lockType === "pin" ? "PIN" : "password"}.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setShowUnlock(true)} className="gap-2">
                <KeyRound className="w-4 h-4" /> Buka Kunci
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDisableLock(true)}
                className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                <ShieldOff className="w-4 h-4" /> Matikan Kunci
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-[#1e1e1e] shadow-xl">
            {/* Code toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#252526] border-b border-white/5">
              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1 sm:py-2.5">
                <div className="flex gap-1.5 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs font-mono text-[#858585] ml-1 select-none truncate max-w-[140px] sm:max-w-none">{filename}</span>
                {effectivelyLocked && hasCode && (
                  <span className="text-[10px] text-green-400 flex items-center gap-0.5 ml-2">
                    <Check className="w-2.5 h-2.5" /> Terbuka
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 px-3 pb-2 sm:pb-0 sm:pr-3 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handleOpenRaw}
                  className="h-7 px-2 sm:px-2.5 text-xs text-[#858585] hover:text-[#cccccc] hover:bg-white/5 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Eye className="w-3 h-3" /><span className="hidden xs:inline sm:inline">Raw</span>
                </button>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "h-7 px-2 sm:px-2.5 text-xs rounded transition-colors flex items-center gap-1 flex-shrink-0",
                    copied ? "text-green-400 bg-green-500/10" : "text-[#858585] hover:text-[#cccccc] hover:bg-white/5",
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
                  <Download className="w-3 h-3" /><span className="hidden xs:inline">Download</span>
                </button>
                {effectivelyLocked && hasCode && (
                  <button
                    onClick={() => setShowDisableLock(true)}
                    className="h-7 px-2 sm:px-2.5 text-xs text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/5 rounded transition-colors flex items-center gap-1 flex-shrink-0 border border-amber-500/20"
                    title="Matikan kunci secara permanen"
                  >
                    <ShieldOff className="w-3 h-3" /><span className="hidden sm:inline">Matikan Kunci</span>
                  </button>
                )}
              </div>
            </div>

            {/* Syntax-highlighted code */}
            <div className="overflow-auto max-h-[60vh]" style={{ minHeight: "160px" }}>
              <SyntaxHighlighter
                language={prismLang}
                style={vscDarkPlus}
                showLineNumbers={true}
                lineNumberStyle={{ color: "#4a4a5a", fontSize: "11px", paddingRight: "16px", userSelect: "none", minWidth: "2.5em" }}
                customStyle={{
                  margin: 0, padding: "16px 16px 16px 0", background: "#1e1e1e",
                  fontSize: "13px", lineHeight: "1.6",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  overflowX: "auto", minWidth: "max-content", width: "100%",
                }}
                codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" } }}
                wrapLines={false}
                wrapLongLines={false}
              >
                {displayCode}
              </SyntaxHighlighter>
            </div>

            {/* Code footer */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#007acc] text-white text-[10px] font-mono">
              <span>{langConfig.label}</span>
              <span>{displayCode.split("\n").length} baris &middot; {displayCode.length.toLocaleString()} karakter</span>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
