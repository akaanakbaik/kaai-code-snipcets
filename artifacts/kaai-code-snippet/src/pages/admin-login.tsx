import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Mail, KeyRound, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Check if already logged in
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.authenticated) setLocation("/admin"); })
      .catch(() => {});
  }, []);

  // OTP countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Masukkan email terlebih dahulu"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Terjadi kesalahan");
        return;
      }
      setOtpSent(true);
      setStep("otp");
      setCountdown(300); // 5 minutes
      toast({ title: "OTP Terkirim", description: "Cek email anda untuk kode OTP." });
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 5) { setError("OTP harus 5 digit"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "OTP tidak valid");
        return;
      }
      toast({ title: "Login berhasil", description: `Selamat datang, ${data.email}` });
      setLocation("/admin");
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center w-full">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-600/5 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-4 glow-blue">
                <Shield className="w-7 h-7 text-blue-400" />
              </div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Admin Login</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {step === "email" ? "Masukkan email admin anda" : `OTP dikirim ke ${email}`}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === "email" ? (
                <motion.form
                  key="email"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        className="pl-10 bg-background/50 border-border/60 h-11"
                        disabled={loading}
                        autoFocus
                        data-testid="input-admin-email"
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white glow-blue"
                    disabled={loading}
                    data-testid="btn-send-otp"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                    {loading ? "Mengirim OTP..." : "Kirim OTP"}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Kode OTP (5 digit)</label>
                      {countdown > 0 && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(countdown)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        placeholder="00000"
                        value={otp}
                        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                        className="pl-10 bg-background/50 border-border/60 h-11 font-mono text-center tracking-[0.5em] text-lg"
                        disabled={loading}
                        autoFocus
                        data-testid="input-otp"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">OTP berlaku 5 menit dan hanya dapat digunakan 1 kali.</p>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white glow-blue"
                    disabled={loading || otp.length !== 5}
                    data-testid="btn-verify-otp"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    {loading ? "Memverifikasi..." : "Masuk"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Ganti email
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
