import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Shield, Trash2, Ban, Megaphone, Eye,
  AlertCircle, Loader2, Hash, Clock, User, Mail,
  BellRing, BellOff, LogOut, Send, RefreshCw, Volume2, VolumeX,
} from "lucide-react";

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
  id: string;
  title: string;
  description: string;
  language: string;
  tags: string[];
  code: string;
  authorName: string;
  authorEmail: string;
  status: string;
  rejectReason?: string;
  viewCount: number;
  copyCount: number;
  createdAt: string;
};

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

export default function Admin() {
  const { toast } = useToast();
  const auth = useAdminAuth();
  const [, setLocation] = useLocation();

  const [pending, setPending] = useState<Snippet[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
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

  // Notification state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("admin-notif-sound") !== "off"; } catch { return true; }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Init audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIF_SOUND_URL);
    audioRef.current.preload = "none";
  }, []);

  // Save sound preference
  useEffect(() => {
    try { localStorage.setItem("admin-notif-sound", soundEnabled ? "on" : "off"); } catch {}
  }, [soundEnabled]);

  // Check notification permission
  useEffect(() => {
    if (!auth.ok) return;
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, [auth.ok]);

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      toast({ title: "Notifikasi diaktifkan", description: "Kamu akan mendapat pemberitahuan saat ada kode baru." });
    }
  };

  const playNotifSound = () => {
    if (!soundEnabled) return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const showNotification = (title: string, body: string) => {
    if (notifPermission !== "granted") return;
    playNotifSound();
    try {
      new Notification(title, {
        body,
        icon: "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logo%20bulat%20latar%20hitam.png",
        badge: "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logo%20bulat%20latar%20hitam.png",
      });
    } catch {}
  };

  const fetchPending = async (showNotif = false) => {
    setLoadingPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/pending`, { credentials: "include" });
      if (res.status === 401) { setLocation("/admin/login"); return; }
      const data = await res.json();
      const snippetList: Snippet[] = data.data || [];
      setPending(snippetList);
      if (showNotif && snippetList.length > 0) {
        showNotification("Kaai Admin", `${snippetList.length} kode menunggu review`);
      }
    } catch {} finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (!auth.ok) return;
    fetchPending();
  }, [auth.ok]);

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/admin/logout`, { method: "POST", credentials: "include" });
    setLocation("/admin/login");
  };

  const handleApprove = async (id: string) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE}/api/admin/snippets/${id}/approve`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error();
      toast({ title: "Kode disetujui", description: "Email notifikasi dikirim ke author." });
      await fetchPending();
    } catch {
      toast({ title: "Gagal menyetujui", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading(`reject-${rejectId}`);
    try {
      const res = await fetch(`${API_BASE}/api/admin/snippets/${rejectId}/reject`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Kode ditolak", description: "Email alasan penolakan dikirim." });
      setRejectDialogOpen(false);
      await fetchPending();
    } catch {
      toast({ title: "Gagal menolak", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading(`delete-${deleteId}`);
    try {
      await fetch(`${API_BASE}/api/admin/snippets/${deleteId}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Kode dihapus" });
      setDeleteDialogOpen(false);
      await fetchPending();
    } catch {
      toast({ title: "Gagal menghapus", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async () => {
    setActionLoading("ban");
    try {
      const res = await fetch(`${API_BASE}/api/admin/ban-email`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: banEmail, reason: banReason || "Diblokir oleh admin" }),
      });
      const data = await res.json();
      toast({ title: "Email diblokir", description: data.message });
      setBanDialogOpen(false); setBanEmail(""); setBanReason("");
    } catch {
      toast({ title: "Gagal memblokir", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBroadcast = async () => {
    setActionLoading("broadcast");
    try {
      const endpoint = broadcastMode === "all" ? "/api/admin/broadcast/all" : "/api/admin/broadcast/one";
      const body: any = { subject: broadcastSubject, message: broadcastMessage, adminInitial: broadcastInitial };
      if (broadcastMode === "one") body.targetEmail = broadcastTarget;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      toast({ title: "Broadcast terkirim", description: broadcastMode === "all" ? `${data.recipientCount} penerima` : `Ke ${broadcastTarget}` });
      setBroadcastMode(null); setBroadcastSubject(""); setBroadcastMessage(""); setBroadcastInitial(""); setBroadcastTarget("");
    } catch {
      toast({ title: "Gagal broadcast", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => fetchPending(true)} className="text-xs h-7 px-2.5">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBroadcastMode("all")} className="text-xs h-7 px-2.5 border-blue-500/30 text-blue-400">
            <Megaphone className="w-3 h-3 mr-1" /> Broadcast
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBroadcastMode("one")} className="text-xs h-7 px-2.5 border-blue-500/30 text-blue-400">
            <Send className="w-3 h-3 mr-1" /> Kirim 1 Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBanDialogOpen(true)} className="text-xs h-7 px-2.5 border-red-500/30 text-red-400">
            <Ban className="w-3 h-3 mr-1" /> Blokir Email
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs h-7 px-2.5 text-muted-foreground">
            <LogOut className="w-3 h-3 mr-1" /> Keluar
          </Button>
        </div>
      </div>

      {/* Notification control bar */}
      <div className={cn(
        "flex flex-wrap items-center gap-3 p-3 rounded-xl border text-xs",
        notifPermission === "granted" ? "bg-green-500/5 border-green-500/15" : "bg-blue-500/5 border-blue-500/15",
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {notifPermission === "granted" ? (
            <BellRing className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : (
            <BellOff className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
          <span className={notifPermission === "granted" ? "text-green-300" : "text-muted-foreground"}>
            {notifPermission === "granted"
              ? "Notifikasi browser aktif"
              : notifPermission === "denied"
              ? "Notifikasi diblokir browser — aktifkan di pengaturan situs"
              : "Aktifkan notifikasi browser untuk menerima pemberitahuan kode baru"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          {notifPermission === "granted" && (
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all",
                soundEnabled
                  ? "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20"
                  : "bg-background/50 border-border/50 text-muted-foreground hover:text-foreground",
              )}
              title={soundEnabled ? "Matikan suara notifikasi" : "Aktifkan suara notifikasi"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              Suara {soundEnabled ? "On" : "Off"}
            </button>
          )}
          {notifPermission !== "granted" && notifPermission !== "denied" && (
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-blue-500/30 text-blue-400" onClick={requestNotifPermission}>
              Izinkan Notifikasi
            </Button>
          )}
          {/* Test sound button */}
          {notifPermission === "granted" && soundEnabled && (
            <button
              onClick={playNotifSound}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border/40 transition-colors"
              title="Test suara"
            >
              <Volume2 className="w-3 h-3" /> Tes
            </button>
          )}
        </div>
      </div>

      {/* Pending heading */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">Kode Menunggu Review</h2>
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
          {pending.length}
        </Badge>
      </div>

      {/* Pending list */}
      {loadingPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((snippet) => {
            const langConfig = getLanguageBadge(snippet.language);
            return (
              <motion.div
                key={snippet.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-card rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("px-2 py-0.5 text-[10px] font-medium rounded-md border", langConfig.color)}>
                        {langConfig.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(snippet.createdAt), "d MMM yyyy HH:mm")}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{snippet.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{snippet.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {snippet.authorName}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {snippet.authorEmail}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {snippet.tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center text-[10px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-md">
                          <Hash className="w-2.5 h-2.5 mr-0.5 opacity-50" />{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-1.5 md:min-w-[120px] flex-wrap">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7 bg-background/50" onClick={() => setSelectedSnippet(snippet)} data-testid={`btn-view-${snippet.id}`}>
                      <Eye className="w-3 h-3 mr-1" /> Lihat Kode
                    </Button>
                    <Button size="sm" className="flex-1 text-xs h-7 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20" onClick={() => handleApprove(snippet.id)} disabled={actionLoading === `approve-${snippet.id}`} data-testid={`btn-approve-${snippet.id}`}>
                      {actionLoading === `approve-${snippet.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                      Setujui
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={() => { setRejectId(snippet.id); setRejectReason(""); setRejectDialogOpen(true); }} data-testid={`btn-reject-${snippet.id}`}>
                      <X className="w-3 h-3 mr-1" /> Tolak
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-xs h-7 text-muted-foreground hover:text-red-400" onClick={() => { setDeleteId(snippet.id); setDeleteDialogOpen(true); }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Hapus
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground">Semua beres!</h3>
          <p className="text-muted-foreground mt-1.5 text-sm">Tidak ada kode yang menunggu review.</p>
        </div>
      )}

      {/* View Code Dialog */}
      <Dialog open={!!selectedSnippet} onOpenChange={() => setSelectedSnippet(null)}>
        <DialogContent className="max-w-3xl glass-card max-h-[85vh] overflow-auto">
          {selectedSnippet && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{selectedSnippet.title}</DialogTitle>
                <DialogDescription>
                  <span className="flex flex-wrap gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{selectedSnippet.authorName}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedSnippet.authorEmail}</span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{selectedSnippet.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSnippet.tags.map((t, i) => <span key={i} className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">#{t}</span>)}
                </div>
                <div className="rounded-xl overflow-hidden border border-border/50">
                  <div className="bg-[#1e1e1e] px-4 py-2 text-xs font-mono text-[#858585] border-b border-white/5">{selectedSnippet.language} — {selectedSnippet.authorEmail}</div>
                  <pre className="p-4 overflow-auto text-sm font-mono text-blue-100/90 bg-[#1e1e1e] max-h-72 whitespace-pre">{selectedSnippet.code}</pre>
                </div>
              </div>
              <DialogFooter className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setSelectedSnippet(null)}>Tutup</Button>
                <Button size="sm" className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20" onClick={() => { handleApprove(selectedSnippet.id); setSelectedSnippet(null); }}>
                  <Check className="w-3.5 h-3.5 mr-1.5" /> Setujui
                </Button>
                <Button size="sm" variant="outline" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={() => { setRejectId(selectedSnippet.id); setRejectReason(""); setRejectDialogOpen(true); setSelectedSnippet(null); }}>
                  <X className="w-3.5 h-3.5 mr-1.5" /> Tolak
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Tolak Kode</DialogTitle>
            <DialogDescription>Berikan alasan penolakan. Email otomatis dikirim ke author.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Alasan penolakan..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="resize-none h-24 bg-background/50" data-testid="input-reject-reason" />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={handleReject} disabled={!!actionLoading} data-testid="btn-confirm-reject">
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <X className="w-3.5 h-3.5 mr-1.5" />}
              Tolak & Kirim Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="text-red-400">Hapus Kode</DialogTitle>
            <DialogDescription>Kode akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Email Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Blokir Email</DialogTitle>
            <DialogDescription>Email yang diblokir tidak dapat mengakses platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Email yang akan diblokir" value={banEmail} onChange={(e) => setBanEmail(e.target.value)} className="bg-background/50" />
            <Input placeholder="Alasan blokir (opsional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBanDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" onClick={handleBan} disabled={!banEmail || !!actionLoading}>
              <Ban className="w-3.5 h-3.5 mr-1.5" /> Blokir Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={!!broadcastMode} onOpenChange={() => setBroadcastMode(null)}>
        <DialogContent className="sm:max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle>{broadcastMode === "all" ? "Broadcast ke Semua Email" : "Kirim ke 1 Email"}</DialogTitle>
            <DialogDescription>
              {broadcastMode === "all" ? "Pesan dikirim ke semua email pengguna yang pernah upload." : "Kirim pesan ke satu email tertentu."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {broadcastMode === "one" && (
              <Input placeholder="Email tujuan" type="email" value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)} className="bg-background/50" />
            )}
            <Input placeholder="Judul / Subject" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} className="bg-background/50" />
            <Textarea placeholder="Isi pesan..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="resize-none h-28 bg-background/50" />
            <Input placeholder="Nama / Inisial admin (opsional)" value={broadcastInitial} onChange={(e) => setBroadcastInitial(e.target.value)} className="bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBroadcastMode(null)}>Batal</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={handleBroadcast} disabled={!broadcastSubject || !broadcastMessage || (broadcastMode === "one" && !broadcastTarget) || !!actionLoading}>
              {actionLoading === "broadcast" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
