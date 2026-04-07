import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Shield, Trash2, Ban, Megaphone, Eye,
  AlertCircle, Loader2, Hash, Clock, User, Mail,
  BellRing, BellOff, LogOut, Send, RefreshCw, Volume2, VolumeX,
  Key, Wifi, Activity, Plus, Pencil, ToggleLeft, ToggleRight,
  Copy, CheckCircle2, AlertTriangle, FileText, ChevronDown,
  BarChart3, ShieldOff, Bell, TrendingUp, Download, XCircle, Code2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getLanguageBadge } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const API_BASE = "";
const NOTIF_SOUND_URL = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/AUD-20260405-WA0057.mp3";

type Snippet = {
  id: string; title: string; description: string; language: string;
  tags: string[]; code: string; authorName: string; authorEmail: string;
  status: string; rejectReason?: string; viewCount: number; copyCount: number; createdAt: string;
};

type ApiKey = {
  id: string; keyPrefix: string; name: string; ownerEmail: string; isActive: boolean;
  rateLimitPerSecond: number; rateLimitPerDay: number; rateLimitPerMonth: number;
  totalRequests: number; lastUsedAt: string | null; createdAt: string;
};

type IpEntry = {
  id: string; email: string; ipAddress: string; label: string | null;
  isActive: boolean; createdAt: string;
};

type RequestLog = {
  id: string; ipAddress: string; method: string; path: string;
  statusCode: number | null; apiKeyPrefix: string | null; blocked: boolean;
  blockReason: string | null; responseTimeMs: number | null; userAgent: string | null; createdAt: string;
};

type Tab = "review" | "api-keys" | "ip-whitelist" | "snippets" | "security" | "analytics" | "broadcast-logs" | "ban-manager";
type BroadcastMode = "all" | "one" | null;

function useAdminAuth() {
  const [auth, setAuth] = useState<{ loading: boolean; ok: boolean; email: string }>({ loading: true, ok: false, email: "" });
  const [, setLocation] = useLocation();
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setAuth({ loading: false, ok: true, email: d.email });
        else setLocation("/admin/login");
      })
      .catch(() => setLocation("/admin/login"));
  }, []);
  return auth;
}

// ─── Tab: Review (existing moderation flow) ───────────────────────────────────

function ReviewTab({ auth, setLocation }: { auth: { ok: boolean; email: string }; setLocation: (s: string) => void }) {
  const { toast } = useToast();
  const [pending, setPending] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectId, setRejectId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banEmail, setBanEmail] = useState("");
  const [banReason, setBanReason] = useState("");
  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>(null);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastInitial, setBroadcastInitial] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("admin-notif-sound") !== "off"; } catch { return true; }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIF_SOUND_URL);
    audioRef.current.preload = "none";
  }, []);
  useEffect(() => {
    try { localStorage.setItem("admin-notif-sound", soundEnabled ? "on" : "off"); } catch {}
  }, [soundEnabled]);
  useEffect(() => {
    if (!auth.ok) return;
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, [auth.ok]);

  const playNotifSound = () => {
    if (!soundEnabled || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  const showNotification = (title: string, body: string) => {
    if (notifPermission !== "granted") return;
    playNotifSound();
    try {
      new Notification(title, {
        body,
        icon: "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logo%20bulat%20latar%20hitam.png",
      });
    } catch {}
  };

  const fetchPending = async (showNotif = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending`, { credentials: "include" });
      if (res.status === 401) { setLocation("/admin/login"); return; }
      const data = await res.json();
      const list: Snippet[] = data.data || [];
      setPending(list);
      if (showNotif && list.length > 0) showNotification("Kaai Admin", `${list.length} kode menunggu review`);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (auth.ok) fetchPending(); }, [auth.ok]);

  const handleApprove = async (id: string) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE}/api/admin/snippets/${id}/approve`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error();
      toast({ title: "Kode disetujui ✓", description: "Email notifikasi dikirim ke author." });
      await fetchPending();
    } catch { toast({ title: "Gagal menyetujui", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    setActionLoading(`reject-${rejectId}`);
    try {
      await fetch(`${API_BASE}/api/admin/snippets/${rejectId}/reject`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: rejectReason }) });
      toast({ title: "Kode ditolak", description: "Email alasan dikirim." });
      setRejectDialogOpen(false);
      await fetchPending();
    } catch { toast({ title: "Gagal menolak", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    setActionLoading(`delete-${deleteId}`);
    try {
      await fetch(`${API_BASE}/api/admin/snippets/${deleteId}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Kode dihapus" });
      setDeleteDialogOpen(false);
      await fetchPending();
    } catch { toast({ title: "Gagal menghapus", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleBan = async () => {
    setActionLoading("ban");
    try {
      const res = await fetch(`${API_BASE}/api/admin/ban-email`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: banEmail, reason: banReason || "Diblokir oleh admin" }) });
      const data = await res.json();
      toast({ title: "Email diblokir", description: data.message });
      setBanDialogOpen(false); setBanEmail(""); setBanReason("");
    } catch { toast({ title: "Gagal memblokir", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleBroadcast = async () => {
    setActionLoading("broadcast");
    try {
      const endpoint = broadcastMode === "all" ? "/api/admin/broadcast/all" : "/api/admin/broadcast/one";
      const body: any = { subject: broadcastSubject, message: broadcastMessage, adminInitial: broadcastInitial };
      if (broadcastMode === "one") body.targetEmail = broadcastTarget;
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal kirim email", description: data.message || `Error ${res.status}`, variant: "destructive" });
        return;
      }
      const desc = broadcastMode === "all"
        ? `${data.sent ?? data.recipientCount} terkirim${data.failed ? `, ${data.failed} gagal` : ""}`
        : `Terkirim ke ${broadcastTarget}`;
      toast({ title: "Email berhasil dikirim ✓", description: desc });
      setBroadcastMode(null); setBroadcastSubject(""); setBroadcastMessage(""); setBroadcastInitial(""); setBroadcastTarget("");
    } catch (e: any) {
      toast({ title: "Gagal kirim email", description: e?.message || "Koneksi error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => fetchPending(true)} className="text-xs h-7 px-2.5"><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
        <Button variant="outline" size="sm" onClick={() => setBroadcastMode("all")} className="text-xs h-7 px-2.5 border-blue-500/30 text-blue-400"><Megaphone className="w-3 h-3 mr-1" /> Broadcast</Button>
        <Button variant="outline" size="sm" onClick={() => setBroadcastMode("one")} className="text-xs h-7 px-2.5 border-blue-500/30 text-blue-400"><Send className="w-3 h-3 mr-1" /> Kirim 1 Email</Button>
        <Button variant="outline" size="sm" onClick={() => setBanDialogOpen(true)} className="text-xs h-7 px-2.5 border-red-500/30 text-red-400"><Ban className="w-3 h-3 mr-1" /> Blokir Email</Button>
      </div>

      {/* Notification bar */}
      <div className={cn("flex flex-wrap items-center gap-3 p-3 rounded-xl border text-xs", notifPermission === "granted" ? "bg-green-500/5 border-green-500/15" : "bg-blue-500/5 border-blue-500/15")}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {notifPermission === "granted" ? <BellRing className="w-4 h-4 text-green-400 flex-shrink-0" /> : <BellOff className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          <span className={notifPermission === "granted" ? "text-green-300" : "text-muted-foreground"}>
            {notifPermission === "granted" ? "Notifikasi browser aktif" : notifPermission === "denied" ? "Notifikasi diblokir browser" : "Aktifkan notifikasi browser"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {notifPermission === "granted" && (
            <button onClick={() => setSoundEnabled((v) => !v)} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all", soundEnabled ? "bg-blue-500/10 border-blue-500/25 text-blue-400" : "bg-background/50 border-border/50 text-muted-foreground")}>
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />} Suara {soundEnabled ? "On" : "Off"}
            </button>
          )}
          {notifPermission !== "granted" && notifPermission !== "denied" && (
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-blue-500/30 text-blue-400" onClick={async () => { const p = await Notification.requestPermission(); setNotifPermission(p); }}>Izinkan Notifikasi</Button>
          )}
        </div>
      </div>

      {/* Pending count */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Kode Menunggu Review</h2>
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">{pending.length}</Badge>
      </div>

      {/* Pending list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      ) : pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((snippet) => {
            const langConfig = getLanguageBadge(snippet.language);
            return (
              <motion.div key={snippet.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-card rounded-xl p-4 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("px-2 py-0.5 text-[10px] font-medium rounded-md border", langConfig.color)}>{langConfig.label}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(snippet.createdAt), "d MMM yyyy HH:mm")}</span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{snippet.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{snippet.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{snippet.authorName}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{snippet.authorEmail}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {snippet.tags.map((tag, i) => <span key={i} className="inline-flex items-center text-[10px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-md"><Hash className="w-2.5 h-2.5 mr-0.5 opacity-50" />{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex md:flex-col gap-1.5 md:min-w-[120px] flex-wrap">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7 bg-background/50" onClick={() => setSelectedSnippet(snippet)}><Eye className="w-3 h-3 mr-1" /> Lihat Kode</Button>
                    <Button size="sm" className="flex-1 text-xs h-7 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20" onClick={() => handleApprove(snippet.id)} disabled={actionLoading === `approve-${snippet.id}`}>
                      {actionLoading === `approve-${snippet.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Setujui
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={() => { setRejectId(snippet.id); setRejectReason(""); setRejectDialogOpen(true); }}><X className="w-3 h-3 mr-1" /> Tolak</Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-xs h-7 text-muted-foreground hover:text-red-400" onClick={() => { setDeleteId(snippet.id); setDeleteDialogOpen(true); }}><Trash2 className="w-3 h-3 mr-1" /> Hapus</Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3"><Check className="w-6 h-6 text-blue-400" /></div>
          <h3 className="text-base font-heading font-semibold">Semua beres!</h3>
          <p className="text-muted-foreground mt-1.5 text-sm">Tidak ada kode yang menunggu review.</p>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={!!selectedSnippet} onOpenChange={() => setSelectedSnippet(null)}>
        <DialogContent className="max-w-3xl glass-card max-h-[85vh] overflow-auto">
          {selectedSnippet && (<>
            <DialogHeader>
              <DialogTitle className="font-heading">{selectedSnippet.title}</DialogTitle>
              <DialogDescription><span className="flex flex-wrap gap-3 text-xs mt-1"><span className="flex items-center gap-1"><User className="w-3 h-3" />{selectedSnippet.authorName}</span><span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedSnippet.authorEmail}</span></span></DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedSnippet.description}</p>
              <div className="flex flex-wrap gap-1.5">{selectedSnippet.tags.map((t, i) => <span key={i} className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">#{t}</span>)}</div>
              <div className="rounded-xl overflow-hidden border border-border/50">
                <div className="bg-[#1e1e1e] px-4 py-2 text-xs font-mono text-[#858585] border-b border-white/5">{selectedSnippet.language}</div>
                <pre className="p-4 overflow-auto text-sm font-mono text-blue-100/90 bg-[#1e1e1e] max-h-72 whitespace-pre">{selectedSnippet.code}</pre>
              </div>
            </div>
            <DialogFooter className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setSelectedSnippet(null)}>Tutup</Button>
              <Button size="sm" className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20" onClick={() => { handleApprove(selectedSnippet.id); setSelectedSnippet(null); }}><Check className="w-3.5 h-3.5 mr-1.5" /> Setujui</Button>
              <Button size="sm" variant="outline" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={() => { setRejectId(selectedSnippet.id); setRejectReason(""); setRejectDialogOpen(true); setSelectedSnippet(null); }}><X className="w-3.5 h-3.5 mr-1.5" /> Tolak</Button>
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader><DialogTitle>Tolak Kode</DialogTitle><DialogDescription>Berikan alasan penolakan.</DialogDescription></DialogHeader>
          <Textarea placeholder="Alasan penolakan..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="resize-none h-24 bg-background/50" />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <X className="w-3.5 h-3.5 mr-1.5" />} Tolak & Kirim Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader><DialogTitle className="text-red-400">Hapus Kode</DialogTitle><DialogDescription>Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>{actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />} Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader><DialogTitle>Blokir Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Email yang akan diblokir" value={banEmail} onChange={(e) => setBanEmail(e.target.value)} className="bg-background/50" />
            <Input placeholder="Alasan blokir (opsional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBanDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={handleBan} disabled={!banEmail || !!actionLoading}><Ban className="w-3.5 h-3.5 mr-1.5" /> Blokir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!broadcastMode} onOpenChange={() => setBroadcastMode(null)}>
        <DialogContent className="sm:max-w-lg glass-card">
          <DialogHeader><DialogTitle>{broadcastMode === "all" ? "Broadcast ke Semua Email" : "Kirim ke 1 Email"}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            {broadcastMode === "one" && <Input placeholder="Email tujuan" type="email" value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)} className="bg-background/50" />}
            <Input placeholder="Inisial admin (opsional)" value={broadcastInitial} onChange={(e) => setBroadcastInitial(e.target.value)} className="bg-background/50" />
            <Input placeholder="Subjek email" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} className="bg-background/50" />
            <Textarea placeholder="Isi pesan..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="resize-none h-28 bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBroadcastMode(null)}>Batal</Button>
            <Button size="sm" className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20" onClick={handleBroadcast} disabled={!broadcastSubject || !broadcastMessage || !!actionLoading}>
              {actionLoading === "broadcast" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />} Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", ownerEmail: "", rateLimitPerSecond: "10", rateLimitPerDay: "1000", rateLimitPerMonth: "10000", customKey: "", editNewKey: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/api-keys`, { credentials: "include" });
      const data = await res.json();
      setKeys(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      const body: any = { name: formData.name, ownerEmail: formData.ownerEmail, rateLimitPerSecond: +formData.rateLimitPerSecond, rateLimitPerDay: +formData.rateLimitPerDay, rateLimitPerMonth: +formData.rateLimitPerMonth };
      if (formData.customKey.trim()) body.customKey = formData.customKey.trim();
      const res = await fetch(`${API_BASE}/api/admin/api-keys`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNewKey(data.key);
      setCreateDialogOpen(false);
      setFormData({ name: "", ownerEmail: "", rateLimitPerSecond: "10", rateLimitPerDay: "1000", rateLimitPerMonth: "10000", customKey: "", editNewKey: "" });
      await fetchKeys();
    } catch (e: any) { toast({ title: "Gagal membuat API key", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selectedKey) return;
    setActionLoading(true);
    try {
      const body: any = { name: formData.name, ownerEmail: formData.ownerEmail, rateLimitPerSecond: +formData.rateLimitPerSecond, rateLimitPerDay: +formData.rateLimitPerDay, rateLimitPerMonth: +formData.rateLimitPerMonth };
      if (formData.editNewKey.trim()) body.newKey = formData.editNewKey.trim();
      const res = await fetch(`${API_BASE}/api/admin/api-keys/${selectedKey.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (data.newKey) setNewKey(data.newKey);
      toast({ title: "API key diperbarui ✓" });
      setEditDialogOpen(false);
      await fetchKeys();
    } catch (e: any) { toast({ title: "Gagal update", description: e.message, variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleToggle = async (key: ApiKey) => {
    try {
      await fetch(`${API_BASE}/api/admin/api-keys/${key.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !key.isActive }) });
      toast({ title: !key.isActive ? "Key diaktifkan ✓" : "Key dinonaktifkan" });
      await fetchKeys();
    } catch { toast({ title: "Gagal toggle", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/api/admin/api-keys/${selectedKey.id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "API key dihapus" });
      setDeleteDialogOpen(false);
      await fetchKeys();
    } catch { toast({ title: "Gagal hapus", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const copyKey = (k: string) => {
    navigator.clipboard.writeText(k).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">API Key Manager</h2>
          <p className="text-xs text-muted-foreground">{keys.length} key terdaftar</p>
        </div>
        <Button size="sm" className="text-xs h-8 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30" onClick={() => { setFormData({ name: "", ownerEmail: "", rateLimitPerSecond: "10", rateLimitPerDay: "1000", rateLimitPerMonth: "10000" }); setCreateDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Buat Key Baru
        </Button>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold"><AlertTriangle className="w-4 h-4" /> Simpan key ini sekarang — tidak akan ditampilkan lagi!</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-zinc-900 px-3 py-2 rounded-lg border border-border/50 text-green-300 overflow-x-auto">{newKey}</code>
            <Button size="sm" variant="outline" onClick={() => copyKey(newKey)} className="h-8 px-3">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setNewKey(null)}>Tutup</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Belum ada API key. Buat key pertama.</div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="glass-card rounded-xl p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{key.name}</span>
                  <Badge variant="outline" className={cn("text-[10px]", key.isActive ? "text-green-400 border-green-500/30" : "text-muted-foreground border-border/50")}>{key.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <code className="font-mono text-blue-300">{key.keyPrefix}…</code>
                  <span>{key.ownerEmail}</span>
                  <span>{key.totalRequests.toLocaleString()} req total</span>
                  <span>{key.rateLimitPerDay}/day · {key.rateLimitPerMonth}/mo</span>
                  {key.lastUsedAt && <span>Last: {format(new Date(key.lastUsedAt), "d MMM")}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleToggle(key)} title={key.isActive ? "Nonaktifkan" : "Aktifkan"}>
                  {key.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setSelectedKey(key); setFormData({ name: key.name, ownerEmail: key.ownerEmail, rateLimitPerSecond: String(key.rateLimitPerSecond), rateLimitPerDay: String(key.rateLimitPerDay), rateLimitPerMonth: String(key.rateLimitPerMonth), customKey: "", editNewKey: "" }); setEditDialogOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:text-red-400" onClick={() => { setSelectedKey(key); setDeleteDialogOpen(true); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Buat API Key Baru</DialogTitle>
            <DialogDescription className="text-xs">Kosongkan "Custom Key" untuk generate otomatis (5 angka + 5 huruf kapital)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama (mis: Telegram Bot)" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            <Input placeholder="Email pemilik" type="email" value={formData.ownerEmail} onChange={(e) => setFormData((f) => ({ ...f, ownerEmail: e.target.value }))} className="bg-background/50" />
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Key className="w-3 h-3" /> Custom Key <span className="opacity-50">(opsional — kosong = auto-generate)</span></p>
              <Input
                placeholder="Contoh: 12345ABCDE atau MYKEY123"
                value={formData.customKey}
                onChange={(e) => setFormData((f) => ({ ...f, customKey: e.target.value.toUpperCase() }))}
                className="bg-background/50 font-mono text-sm"
                maxLength={48}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Hanya huruf kapital, angka, - atau _. 6–48 karakter.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className="text-xs text-muted-foreground mb-1">Per Detik</p><Input type="number" value={formData.rateLimitPerSecond} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerSecond: e.target.value }))} className="bg-background/50 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Per Hari</p><Input type="number" value={formData.rateLimitPerDay} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerDay: e.target.value }))} className="bg-background/50 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Per Bulan</p><Input type="number" value={formData.rateLimitPerMonth} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerMonth: e.target.value }))} className="bg-background/50 text-sm" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30" onClick={handleCreate} disabled={!formData.name || !formData.ownerEmail || !!actionLoading}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Key className="w-3.5 h-3.5 mr-1" />} Buat Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>Key saat ini: <code className="font-mono text-blue-300">{selectedKey?.keyPrefix}…</code></DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            <Input placeholder="Email pemilik" value={formData.ownerEmail} onChange={(e) => setFormData((f) => ({ ...f, ownerEmail: e.target.value }))} className="bg-background/50" />
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Key className="w-3 h-3" /> Ganti Key <span className="opacity-50">(opsional — kosong = tidak berubah)</span></p>
              <Input
                placeholder="Key baru custom (mis: NEWKEY123)"
                value={formData.editNewKey}
                onChange={(e) => setFormData((f) => ({ ...f, editNewKey: e.target.value.toUpperCase() }))}
                className="bg-background/50 font-mono text-sm"
                maxLength={48}
              />
              <p className="text-[10px] text-muted-foreground mt-1">⚠️ Jika diisi, key lama langsung tidak berlaku. Simpan key baru setelah disimpan.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className="text-xs text-muted-foreground mb-1">Per Detik</p><Input type="number" value={formData.rateLimitPerSecond} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerSecond: e.target.value }))} className="bg-background/50 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Per Hari</p><Input type="number" value={formData.rateLimitPerDay} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerDay: e.target.value }))} className="bg-background/50 text-sm" /></div>
              <div><p className="text-xs text-muted-foreground mb-1">Per Bulan</p><Input type="number" value={formData.rateLimitPerMonth} onChange={(e) => setFormData((f) => ({ ...f, rateLimitPerMonth: e.target.value }))} className="bg-background/50 text-sm" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleUpdate} disabled={!!actionLoading}>{actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm glass-card">
          <DialogHeader><DialogTitle className="text-red-400">Hapus API Key</DialogTitle><DialogDescription>Key <code>{selectedKey?.keyPrefix}…</code> akan dihapus permanen.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={actionLoading}>{actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />} Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: IP Whitelist ────────────────────────────────────────────────────────

function IpWhitelistTab() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<IpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<IpEntry | null>(null);
  const [form, setForm] = useState({ email: "", ipAddress: "", label: "" });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ip-whitelist`, { credentials: "include" });
      const data = await res.json();
      setEntries(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ip-whitelist`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast({ title: "IP ditambahkan ✓" });
      setCreateOpen(false);
      setForm({ email: "", ipAddress: "", label: "" });
      await fetchEntries();
    } catch { toast({ title: "Gagal menambahkan IP", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ip-whitelist/${selected.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast({ title: "IP diperbarui ✓" });
      setEditOpen(false);
      await fetchEntries();
    } catch { toast({ title: "Gagal update", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleToggle = async (entry: IpEntry) => {
    try {
      await fetch(`${API_BASE}/api/admin/ip-whitelist/${entry.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !entry.isActive }) });
      toast({ title: !entry.isActive ? "IP diaktifkan ✓" : "IP dinonaktifkan" });
      await fetchEntries();
    } catch { toast({ title: "Gagal toggle", variant: "destructive" }); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/api/admin/ip-whitelist/${selected.id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "IP dihapus" });
      setDeleteOpen(false);
      await fetchEntries();
    } catch { toast({ title: "Gagal hapus", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">IP Whitelist Admin</h2>
          <p className="text-xs text-muted-foreground">{entries.length} IP terdaftar</p>
        </div>
        <Button size="sm" className="text-xs h-8 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30" onClick={() => { setForm({ email: "", ipAddress: "", label: "" }); setCreateOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah IP
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Belum ada IP whitelist.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="glass-card rounded-xl p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm text-green-300">{entry.ipAddress}</code>
                  <Badge variant="outline" className={cn("text-[10px]", entry.isActive ? "text-green-400 border-green-500/30" : "text-muted-foreground border-border/50")}>{entry.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  {entry.label && <span className="text-xs text-muted-foreground">{entry.label}</span>}
                </div>
                <div className="text-xs text-muted-foreground">{entry.email} · {format(new Date(entry.createdAt), "d MMM yyyy")}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleToggle(entry)}>
                  {entry.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setSelected(entry); setForm({ email: entry.email, ipAddress: entry.ipAddress, label: entry.label ?? "" }); setEditOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => { setSelected(entry); setDeleteOpen(true); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader><DialogTitle>Tambah IP Whitelist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="IP Address (mis: 123.456.789.0)" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} className="bg-background/50 font-mono" />
            <Input placeholder="Email (opsional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-background/50" />
            <Input placeholder="Label (mis: Telegram Bot Server)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30" onClick={handleCreate} disabled={!form.ipAddress || actionLoading}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wifi className="w-3.5 h-3.5 mr-1" />} Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader><DialogTitle>Edit IP Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="IP Address" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} className="bg-background/50 font-mono" />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-background/50" />
            <Input placeholder="Label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleUpdate} disabled={actionLoading}>{actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm glass-card">
          <DialogHeader><DialogTitle className="text-red-400">Hapus IP</DialogTitle><DialogDescription><code>{selected?.ipAddress}</code> akan dihapus dari whitelist.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={actionLoading}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Snippet Control ─────────────────────────────────────────────────────

function SnippetControlTab() {
  const { toast } = useToast();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selected, setSelected] = useState<Snippet | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", language: "", tags: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSnippets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-snippets?limit=200`, { credentials: "include" });
      const data = await res.json();
      setSnippets(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSnippets(); }, []);

  const filtered = snippets.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.title.toLowerCase().includes(q) || s.authorEmail.toLowerCase().includes(q) || s.language.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats summary
  const stats = {
    total: snippets.length,
    approved: snippets.filter((s) => s.status === "approved").length,
    pending: snippets.filter((s) => s.status === "pending").length,
    rejected: snippets.filter((s) => s.status === "rejected").length,
    totalViews: snippets.reduce((acc, s) => acc + (s.viewCount || 0), 0),
    totalCopies: snippets.reduce((acc, s) => acc + (s.copyCount || 0), 0),
  };

  const handleDelete = async () => {
    if (!selected) return;
    setActionLoading("delete");
    try {
      await fetch(`${API_BASE}/api/admin/snippets/${selected.id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Snippet dihapus" });
      setDeleteOpen(false);
      await fetchSnippets();
    } catch { toast({ title: "Gagal hapus", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setActionLoading("edit");
    try {
      const res = await fetch(`${API_BASE}/api/admin/snippets/${selected.id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editForm.title, description: editForm.description, language: editForm.language, tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Snippet diperbarui ✓" });
      setEditOpen(false);
      await fetchSnippets();
    } catch { toast({ title: "Gagal update", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  // Feature 1: Quick status change
  const handleStatusChange = async (snippet: Snippet, newStatus: "approved" | "rejected" | "pending") => {
    setActionLoading(`status-${snippet.id}`);
    try {
      const endpoint = newStatus === "approved"
        ? `${API_BASE}/api/admin/snippets/${snippet.id}/approve`
        : newStatus === "rejected"
          ? `${API_BASE}/api/admin/snippets/${snippet.id}/reject`
          : `${API_BASE}/api/admin/snippets/${snippet.id}`;
      const method = newStatus === "pending" ? "PUT" : "POST";
      const body = newStatus === "pending" ? JSON.stringify({ status: "pending" }) : undefined;
      await fetch(endpoint, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body });
      toast({ title: `Status diubah → ${newStatus}` });
      await fetchSnippets();
    } catch { toast({ title: "Gagal ubah status", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  // Feature 3: Copy snippet ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast({ title: "ID disalin!" });
    });
  };

  // Feature 4: Export JSON
  const handleExportJson = () => {
    const data = filtered.map((s) => ({
      id: s.id, title: s.title, language: s.language, status: s.status,
      authorEmail: s.authorEmail, tags: s.tags,
      viewCount: s.viewCount, copyCount: s.copyCount,
      createdAt: s.createdAt,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `snippets-${statusFilter}-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `${data.length} snippet diekspor` });
  };

  const statusColors: Record<string, string> = {
    approved: "text-green-400 border-green-500/30",
    pending: "text-amber-400 border-amber-500/30",
    rejected: "text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Snippet Control</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} / {snippets.length} snippet</p>
        </div>
        <div className="flex gap-1.5">
          {/* Feature 4: Export JSON */}
          <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={handleExportJson} disabled={filtered.length === 0} title="Export JSON">
            <Download className="w-3 h-3 mr-1" /> JSON
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchSnippets}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Feature 5: Stats summary */}
      {!loading && snippets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: stats.total, color: "text-blue-400" },
            { label: "Approved", value: stats.approved, color: "text-green-400" },
            { label: "Pending", value: stats.pending, color: "text-amber-400" },
            { label: "Rejected", value: stats.rejected, color: "text-red-400" },
            { label: "Views", value: stats.totalViews.toLocaleString(), color: "text-purple-400" },
            { label: "Copies", value: stats.totalCopies.toLocaleString(), color: "text-cyan-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-lg px-2 py-2 text-center">
              <p className={cn("text-base font-bold font-heading", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Cari judul, email, bahasa, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-background/50 max-w-xs h-8 text-sm" />
        <div className="flex gap-1">
          {["all", "approved", "pending", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-2.5 py-1 rounded-lg text-xs border transition-all", statusFilter === s ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-background/50 text-muted-foreground border-border/50 hover:text-foreground")}>
              {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((snippet) => (
            <div key={snippet.id} className="glass-card rounded-xl px-3 py-2.5 flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground truncate max-w-[200px]">{snippet.title}</span>
                  <Badge variant="outline" className={cn("text-[10px]", statusColors[snippet.status] || "")}>{snippet.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{snippet.language}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{snippet.authorEmail}</span>
                  <span>{snippet.viewCount ?? 0} views · {snippet.copyCount ?? 0} copies</span>
                  <code className="text-[10px] opacity-40">{snippet.id.slice(0, 8)}…</code>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 flex-wrap">
                {/* Feature 1: Quick approve/reject */}
                {snippet.status !== "approved" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-400 hover:bg-green-500/10" title="Approve" onClick={() => handleStatusChange(snippet, "approved")} disabled={actionLoading === `status-${snippet.id}`}>
                    {actionLoading === `status-${snippet.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  </Button>
                )}
                {snippet.status !== "rejected" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10" title="Reject" onClick={() => handleStatusChange(snippet, "rejected")} disabled={actionLoading === `status-${snippet.id}`}>
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                {snippet.status !== "pending" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-400 hover:bg-amber-500/10" title="Set Pending" onClick={() => handleStatusChange(snippet, "pending")} disabled={actionLoading === `status-${snippet.id}`}>
                    <Clock className="w-3.5 h-3.5" />
                  </Button>
                )}
                {/* Feature 2: Code preview */}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-400 hover:bg-blue-500/10" title="Preview kode" onClick={() => { setSelected(snippet); setPreviewOpen(true); }}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {/* Feature 3: Copy ID */}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Salin ID" onClick={() => handleCopyId(snippet.id)}>
                  {copiedId === snippet.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setSelected(snippet); setEditForm({ title: snippet.title, description: snippet.description, language: snippet.language, tags: snippet.tags.join(", ") }); setEditOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:text-red-400" onClick={() => { setSelected(snippet); setDeleteOpen(true); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Tidak ada snippet yang cocok.</div>}
        </div>
      )}

      {/* Feature 2: Code Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl glass-card max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400" />
              {selected?.title}
              <Badge variant="outline" className={cn("text-[10px] ml-1", statusColors[selected?.status || ""] || "")}>{selected?.status}</Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">{selected?.language} · {selected?.authorEmail} · {selected?.viewCount ?? 0} views · {selected?.copyCount ?? 0} copies</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg bg-zinc-950 border border-border/40 p-4">
            <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {selected?.content || <span className="text-muted-foreground italic">Tidak ada konten</span>}
            </pre>
          </div>
          <DialogFooter className="flex-shrink-0 pt-2">
            <Button size="sm" variant="outline" onClick={() => { if (selected?.content) { navigator.clipboard.writeText(selected.content); toast({ title: "Kode disalin!" }); } }}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Salin Kode
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm glass-card">
          <DialogHeader><DialogTitle className="text-red-400">Hapus Snippet</DialogTitle><DialogDescription>"{selected?.title}" akan dihapus permanen.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>{actionLoading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />} Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Edit Metadata Snippet</DialogTitle>
            <DialogDescription className="text-xs flex items-center gap-1">
              ID: <code className="font-mono text-blue-300 select-all">{selected?.id}</code>
              <button type="button" onClick={() => selected && handleCopyId(selected.id)} className="text-muted-foreground hover:text-foreground ml-1">
                {copiedId === selected?.id ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Judul" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="bg-background/50" />
            <Textarea placeholder="Deskripsi" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="bg-background/50 resize-none h-20" />
            <Input placeholder="Bahasa" value={editForm.language} onChange={(e) => setEditForm((f) => ({ ...f, language: e.target.value }))} className="bg-background/50" />
            <Input placeholder="Tags (pisah koma)" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleEdit} disabled={!!actionLoading}>{actionLoading === "edit" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Analytics ──────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData] = useState<{ totals: any; submissionsPerDay: { date: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/analytics`, { credentials: "include" });
      const json = await res.json();
      setData(json);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const chartData = data?.submissionsPerDay.map((d) => ({
    date: d.date.slice(5), // MM-DD
    count: d.count,
  })) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-base font-semibold">Analytics</h2><p className="text-xs text-muted-foreground">Statistik snippet platform</p></div>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchData}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Snippet", value: data?.totals.total ?? 0, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Pending", value: data?.totals.pending ?? 0, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Disetujui", value: data?.totals.approved ?? 0, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Ditolak", value: data?.totals.rejected ?? 0, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn("glass-card rounded-xl p-4 text-center border", bg)}>
                <p className={cn("text-2xl font-bold font-heading", color)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Pengiriman 14 Hari Terakhir
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #222", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#888" }}
                  itemStyle={{ color: "#4a9eff" }}
                  formatter={(v: any) => [v, "Kiriman"]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.count > 0 ? "#3b82f6" : "#1e293b"} fillOpacity={entry.count > 0 ? 0.8 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Broadcast Logs ──────────────────────────────────────────────────────

type BroadcastLog = {
  id: string; adminEmail: string; adminInitial: string | null;
  targetEmail: string | null; subject: string; message: string;
  recipientCount: number; createdAt: string;
};

function BroadcastLogsTab() {
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BroadcastLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/broadcast-logs?limit=100`, { credentials: "include" });
      const json = await res.json();
      setLogs(json.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-base font-semibold">Broadcast Logs</h2><p className="text-xs text-muted-foreground">{logs.length} pesan terkirim</p></div>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchLogs}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Belum ada broadcast.</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <button
              key={log.id}
              onClick={() => setSelected(selected?.id === log.id ? null : log)}
              className={cn("w-full text-left glass-card rounded-xl p-3 space-y-1 transition-all border hover:border-border", selected?.id === log.id ? "border-blue-500/30 bg-blue-500/5" : "border-transparent")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{log.subject}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{format(new Date(log.createdAt), "d MMM HH:mm")}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{log.adminInitial ?? log.adminEmail[0]}...</span>
                <span>{log.targetEmail ? `→ ${log.targetEmail}` : `→ ${log.recipientCount} penerima`}</span>
              </div>
              {selected?.id === log.id && (
                <div className="mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{log.message}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Ban Manager ─────────────────────────────────────────────────────────

type IpBan = { id: string; ipAddress: string; bannedUntil: string; reason: string | null; createdAt: string };
type EmailBan = { id: string; email: string; bannedUntil: string; reason: string | null; createdAt: string };

function BanManagerTab() {
  const { toast } = useToast();
  const [ipBans, setIpBans] = useState<IpBan[]>([]);
  const [emailBans, setEmailBans] = useState<EmailBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [banTab, setBanTab] = useState<"ip" | "email">("ip");

  const fetchBans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/security/bans`, { credentials: "include" });
      const json = await res.json();
      setIpBans(json.ipBans || []);
      setEmailBans(json.emailBans || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchBans(); }, []);

  const removeIpBan = async (id: string) => {
    await fetch(`${API_BASE}/api/admin/security/bans/ip/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "IP ban dihapus ✓" });
    fetchBans();
  };

  const removeEmailBan = async (id: string) => {
    await fetch(`${API_BASE}/api/admin/security/bans/email/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Email ban dihapus ✓" });
    fetchBans();
  };

  const now = new Date();
  const activeIpBans = ipBans.filter((b) => new Date(b.bannedUntil) > now);
  const activeEmailBans = emailBans.filter((b) => new Date(b.bannedUntil) > now);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Ban Manager</h2>
          <p className="text-xs text-muted-foreground">{activeIpBans.length} IP aktif · {activeEmailBans.length} email aktif</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchBans}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      <div className="flex gap-1">
        {(["ip", "email"] as const).map((t) => (
          <button key={t} onClick={() => setBanTab(t)} className={cn("px-3 py-1 rounded-lg text-xs border", banTab === t ? "bg-red-600/20 text-red-400 border-red-500/30" : "bg-background/50 text-muted-foreground border-border/50")}>
            {t === "ip" ? `IP Bans (${activeIpBans.length})` : `Email Bans (${activeEmailBans.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : banTab === "ip" ? (
        activeIpBans.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada IP yang diblokir aktif.</div>
        ) : (
          <div className="space-y-2">
            {activeIpBans.map((ban) => {
              const mins = Math.ceil((new Date(ban.bannedUntil).getTime() - Date.now()) / 60000);
              return (
                <div key={ban.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm text-red-300">{ban.ipAddress}</code>
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{mins > 60 ? `${Math.ceil(mins/60)}j` : `${mins}m`} lagi</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ban.reason ?? "—"}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => removeIpBan(ban.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        activeEmailBans.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada email yang diblokir aktif.</div>
        ) : (
          <div className="space-y-2">
            {activeEmailBans.map((ban) => {
              const mins = Math.ceil((new Date(ban.bannedUntil).getTime() - Date.now()) / 60000);
              return (
                <div key={ban.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-red-300">{ban.email}</span>
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{mins > 60 ? `${Math.ceil(mins/60)}j` : `${mins}m`} lagi</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ban.reason ?? "—"}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => removeEmailBan(ban.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Tab: Security Dashboard ──────────────────────────────────────────────────

function SecurityDashboard() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/request-logs?limit=200${onlyBlocked ? "&blocked=true" : ""}`, { credentials: "include" });
      const data = await res.json();
      setLogs(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [onlyBlocked]);

  const blocked = logs.filter((l) => l.blocked).length;
  const rate429 = logs.filter((l) => l.statusCode === 429).length;

  const statusColor = (code: number | null) => {
    if (!code) return "text-muted-foreground";
    if (code < 300) return "text-green-400";
    if (code < 400) return "text-blue-400";
    if (code < 500) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-base font-semibold">Security Dashboard</h2><p className="text-xs text-muted-foreground">Request logs real-time</p></div>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchLogs}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Logs", value: logs.length, color: "text-blue-400" },
          { label: "Blocked", value: blocked, color: "text-red-400" },
          { label: "Rate Limited", value: rate429, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button onClick={() => setOnlyBlocked(false)} className={cn("px-3 py-1 rounded-lg text-xs border", !onlyBlocked ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-background/50 text-muted-foreground border-border/50")}>Semua</button>
        <button onClick={() => setOnlyBlocked(true)} className={cn("px-3 py-1 rounded-lg text-xs border", onlyBlocked ? "bg-red-600/20 text-red-400 border-red-500/30" : "bg-background/50 text-muted-foreground border-border/50")}>Hanya Blocked</button>
      </div>

      {loading ? (
        <div className="space-y-1">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className={cn("flex flex-wrap gap-2 items-center px-3 py-2 rounded-lg text-xs border", log.blocked ? "bg-red-500/5 border-red-500/15" : "bg-card/20 border-border/30")}>
              <span className={cn("font-mono font-bold w-8", statusColor(log.statusCode))}>{log.statusCode ?? "—"}</span>
              <span className="text-muted-foreground w-10">{log.method}</span>
              <span className="font-mono text-foreground truncate max-w-[200px]">{log.path}</span>
              <span className="text-muted-foreground font-mono">{log.ipAddress}</span>
              {log.apiKeyPrefix && <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30">{log.apiKeyPrefix}…</Badge>}
              {log.blocked && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">{log.blockReason}</Badge>}
              {log.responseTimeMs !== null && <span className="text-muted-foreground/60">{log.responseTimeMs}ms</span>}
              <span className="text-muted-foreground/50 ml-auto">{format(new Date(log.createdAt), "HH:mm:ss")}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Tidak ada log.</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "review", label: "Review", icon: Shield },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "ip-whitelist", label: "IP Whitelist", icon: Wifi },
  { id: "snippets", label: "Snippets", icon: FileText },
  { id: "security", label: "Security", icon: Activity },
  { id: "broadcast-logs", label: "Broadcast", icon: Megaphone },
  { id: "ban-manager", label: "Ban Manager", icon: ShieldOff },
];

export default function Admin() {
  const auth = useAdminAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("review");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");
  const pendingCountRef = useRef<number>(-1);

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm("unsupported");
    }
  }, []);

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      new Notification("Kaai Admin", { body: "Notifikasi snippet baru diaktifkan!", icon: "/favicon.ico" });
    }
  };

  // Poll for new pending snippets every 60s
  useEffect(() => {
    if (notifPerm !== "granted") return;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/pending`, { credentials: "include" });
        const json = await res.json();
        const currentCount = (json.data || []).length;
        if (pendingCountRef.current >= 0 && currentCount > pendingCountRef.current) {
          const diff = currentCount - pendingCountRef.current;
          new Notification("Kaai Code Snippet", {
            body: `Ada ${diff} snippet baru menunggu review! Acc segera ya.`,
            icon: "/favicon.ico",
          });
        }
        pendingCountRef.current = currentCount;
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [notifPerm]);

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/admin/logout`, { method: "POST", credentials: "include" });
    setLocation("/admin/login");
  };

  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        Memeriksa sesi admin...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-12 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Shield className="w-4 h-4 text-blue-400" />
            <h1 className="text-xl font-heading font-bold text-foreground">Panel Admin</h1>
          </div>
          <p className="text-xs text-muted-foreground">Login sebagai <span className="text-blue-400">{auth.email}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {notifPerm === "unsupported" ? null : notifPerm === "granted" ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
              <Bell className="w-3 h-3" /> Notif aktif
            </div>
          ) : notifPerm === "denied" ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 border border-border/50 px-2.5 py-1 rounded-lg" title="Izin notifikasi ditolak. Aktifkan di pengaturan browser.">
              <BellOff className="w-3 h-3" /> Notif diblokir
            </div>
          ) : (
            <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={requestNotifPermission}>
              <BellRing className="w-3 h-3" /> Aktifkan Notif
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs h-7 px-2.5 text-muted-foreground">
            <LogOut className="w-3 h-3 mr-1" /> Keluar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border",
              activeTab === tab.id
                ? "bg-blue-600/15 text-blue-400 border-blue-500/25"
                : "bg-background/50 text-muted-foreground border-border/50 hover:text-foreground hover:bg-white/5",
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {activeTab === "review" && <ReviewTab auth={auth} setLocation={setLocation} />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "api-keys" && <ApiKeysTab />}
          {activeTab === "ip-whitelist" && <IpWhitelistTab />}
          {activeTab === "snippets" && <SnippetControlTab />}
          {activeTab === "security" && <SecurityDashboard />}
          {activeTab === "broadcast-logs" && <BroadcastLogsTab />}
          {activeTab === "ban-manager" && <BanManagerTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
