import { useState, useEffect } from "react";
import { useGetStats, useGetLanguageStats, useGetRecentSnippets } from "@workspace/api-client-react";
import { BarChart3, Code2, Users, FileCode, Clock, CheckCircle2, TrendingUp, Eye, Copy, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { motion } from "framer-motion";

import { Skeleton } from "@/components/ui/skeleton";
import { getLanguageBadge } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function Stats() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refetchTick, setRefetchTick] = useState(0);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetStats();
  const { data: langStats, isLoading: langStatsLoading, refetch: refetchLang } = useGetLanguageStats();
  const { data: recentSnippets, isLoading: recentLoading, refetch: refetchRecent } = useGetRecentSnippets({ limit: 8 });

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setRefetchTick((t) => t + 1);
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refetchTick === 0) return;
    refetchStats();
    refetchLang();
    refetchRecent();
    setLastUpdated(new Date());
  }, [refetchTick]);

  const handleManualRefresh = () => {
    refetchStats();
    refetchLang();
    refetchRecent();
    setLastUpdated(new Date());
  };

  return (
    <div className="max-w-6xl mx-auto w-full pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Statistik Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wawasan dan metrik Kaai Code Snippet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Perbarui otomatis setiap 30 detik</span>
          <span className="opacity-40">·</span>
          <span>Terakhir: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: localeId })}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleManualRefresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Snippet", value: stats?.totalSnippets, icon: FileCode, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Disetujui", value: stats?.approvedSnippets, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Bahasa Pemrograman", value: stats?.totalLanguages, icon: Code2, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Kontributor", value: stats?.totalAuthors, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/3 rounded-full blur-[30px]" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs text-muted-foreground mb-2 leading-none">{label}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  <div className="text-3xl font-heading font-bold text-foreground">{value ?? 0}</div>
                )}
              </div>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", bg)}>
                <Icon className={cn("w-4.5 h-4.5", color)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Language Distribution */}
        <div className="lg:col-span-3 glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            Distribusi Bahasa
          </h2>
          {langStatsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3.5 w-12" /></div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : langStats && langStats.length > 0 ? (
            <div className="space-y-4">
              {langStats.map((stat, i) => {
                const total = stats?.approvedSnippets || 1;
                const pct = Math.round((stat.count / total) * 100);
                const langConfig = getLanguageBadge(stat.language);
                const colorClass = langConfig.color.split(" ").find((c) => c.startsWith("text-")) || "text-blue-400";
                const bgClass = colorClass.replace("text-", "bg-");

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", bgClass)} />
                        {langConfig.label}
                      </span>
                      <span className="text-muted-foreground">{stat.count} <span className="opacity-50">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", bgClass)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada data bahasa.</div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Ditambahkan Terbaru
          </h2>
          {recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentSnippets && recentSnippets.length > 0 ? (
            <div className="space-y-3">
              {recentSnippets.map((snippet) => {
                const langConfig = getLanguageBadge(snippet.language);
                const colorClass = langConfig.color.split(" ").find((c) => c.startsWith("text-")) || "text-blue-400";
                const borderClass = langConfig.color.split(" ").find((c) => c.startsWith("border-")) || "border-blue-500/30";
                const bgClass = colorClass.replace("text-", "bg-");
                return (
                  <Link key={snippet.id} href={`/snippet/${snippet.id}`}>
                    <div className="group flex gap-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className={cn("w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border", colorClass, borderClass, bgClass + "/10")}>
                        {snippet.language.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">{snippet.title}</p>
                        <div className="flex items-center text-[10px] text-muted-foreground mt-0.5 gap-1.5">
                          <span className="truncate">{snippet.authorName}</span>
                          <span className="opacity-40">·</span>
                          <span className="shrink-0">{format(new Date(snippet.createdAt), "d MMM")}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada aktivitas.</div>
          )}
        </div>
      </div>

      {/* Quick tips */}
      <div className="glass-card rounded-xl p-4 flex items-start gap-3 text-xs text-muted-foreground border-blue-500/10">
        <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-foreground">Tips:</span> Data statistik diperbarui secara otomatis setiap 30 detik. 
          Klik tombol refresh untuk mendapatkan data terkini sekarang juga.
        </div>
      </div>
    </div>
  );
}
