import { useState, useEffect } from "react";
import { useSEO, SITE_URL } from "@/hooks/use-seo";
import { useGetStats, useGetLanguageStats, useGetRecentSnippets } from "@workspace/api-client-react";
import {
  BarChart3, Code2, Users, FileCode, Clock, CheckCircle2, TrendingUp,
  Eye, Copy, RefreshCw, Hash, Award, Star, Zap, Activity, Target,
  ArrowUpRight, Flame, Globe, ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { getLanguageBadge } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL = 30_000;

type TopAuthor = { authorName: string; snippetCount: number; totalViews: number; totalCopies: number };
type TopTag = { tag: string; count: number };
type TopSnippet = { id: string; slug?: string; title: string; authorName: string; language: string; viewCount: number; copyCount: number; createdAt: string };
type TimelineEntry = { month: string; total: number; approved: number };
type EngagementData = { totalSnippets: number; avgViews: number; avgCopies: number; totalViews: number; totalCopies: number; engagementRate: number; maxViews: number; maxCopies: number };

function useTopAuthors(limit = 8) {
  return useQuery<TopAuthor[]>({
    queryKey: ["stats-top-authors", limit],
    queryFn: async () => {
      const res = await fetch(`/api/stats/top-authors?limit=${limit}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTopTags(limit = 30) {
  return useQuery<TopTag[]>({
    queryKey: ["stats-top-tags", limit],
    queryFn: async () => {
      const res = await fetch(`/api/stats/tags?limit=${limit}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTopViewed(limit = 8) {
  return useQuery<TopSnippet[]>({
    queryKey: ["stats-top-viewed", limit],
    queryFn: async () => {
      const res = await fetch(`/api/stats/top-viewed?limit=${limit}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTopCopied(limit = 8) {
  return useQuery<TopSnippet[]>({
    queryKey: ["stats-top-copied", limit],
    queryFn: async () => {
      const res = await fetch(`/api/stats/top-copied?limit=${limit}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTimeline() {
  return useQuery<TimelineEntry[]>({
    queryKey: ["stats-timeline"],
    queryFn: async () => {
      const res = await fetch("/api/stats/timeline");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useEngagement() {
  return useQuery<EngagementData>({
    queryKey: ["stats-engagement"],
    queryFn: async () => {
      const res = await fetch("/api/stats/engagement");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTrending(limit = 5) {
  return useQuery<TopSnippet[]>({
    queryKey: ["stats-trending", limit],
    queryFn: async () => {
      const res = await fetch(`/api/stats/trending?limit=${limit}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}

function MonthlyChart({ data }: { data: TimelineEntry[] }) {
  const maxVal = Math.max(...data.map((d) => d.approved), 1);
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {data.map((entry, i) => {
        const monthIdx = parseInt(entry.month.slice(5, 7), 10) - 1;
        const pct = (entry.approved / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border/60 rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap z-10">
              {months[monthIdx]}: {entry.approved}
            </div>
            <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
              <motion.div
                className="w-full rounded-t-sm bg-blue-500/50 hover:bg-blue-500/80 transition-colors"
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              />
            </div>
            <span className="text-[8px] text-muted-foreground/50 mt-0.5">{months[monthIdx]?.slice(0, 1)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Stats() {
  useSEO({
    title: "Statistik Platform",
    description: "Lihat statistik lengkap Kaai Code Snippet — jumlah snippet, snippet terpopuler, penulis aktif, tag trending, dan aktivitas bulanan komunitas developer Indonesia.",
    keywords: "statistik snippet, snippet terpopuler, developer aktif, tag trending, kode snippet indonesia",
    url: "/stats",
    type: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Statistik Platform | Kaai Code Snippet",
      "url": `${SITE_URL}/stats`,
      "description": "Statistik lengkap platform code snippet untuk developer Indonesia.",
    },
  });

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refetchTick, setRefetchTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"viewed" | "copied">("viewed");
  const [showAllTags, setShowAllTags] = useState(false);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetStats();
  const { data: langStats, isLoading: langStatsLoading, refetch: refetchLang } = useGetLanguageStats();
  const { data: recentSnippets, isLoading: recentLoading, refetch: refetchRecent } = useGetRecentSnippets({ limit: 8 });
  const { data: topAuthors = [], isLoading: authorsLoading, refetch: refetchAuthors } = useTopAuthors(8);
  const { data: topTags = [], isLoading: tagsLoading, refetch: refetchTags } = useTopTags(30);
  const { data: topViewed = [], isLoading: viewedLoading, refetch: refetchViewed } = useTopViewed(8);
  const { data: topCopied = [], isLoading: copiedLoading, refetch: refetchCopied } = useTopCopied(8);
  const { data: timeline = [], refetch: refetchTimeline } = useTimeline();
  const { data: engagement, refetch: refetchEngagement } = useEngagement();
  const { data: trending = [], refetch: refetchTrending } = useTrending(5);

  useEffect(() => {
    const interval = setInterval(() => setRefetchTick((t) => t + 1), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refetchTick === 0) return;
    refetchStats(); refetchLang(); refetchRecent(); refetchAuthors();
    refetchTags(); refetchViewed(); refetchCopied(); refetchTimeline();
    refetchEngagement(); refetchTrending();
    setLastUpdated(new Date());
  }, [refetchTick]);

  const handleManualRefresh = () => {
    refetchStats(); refetchLang(); refetchRecent(); refetchAuthors();
    refetchTags(); refetchViewed(); refetchCopied(); refetchTimeline();
    refetchEngagement(); refetchTrending();
    setLastUpdated(new Date());
  };

  const maxLangCount = langStats && langStats.length > 0 ? langStats[0].count : 1;
  const displayedTags = showAllTags ? topTags : topTags.slice(0, 15);

  return (
    <div className="max-w-6xl mx-auto w-full pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Statistik Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wawasan lengkap dan metrik Kaai Code Snippet
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="hidden sm:inline">Auto-refresh 30 detik</span>
          <span className="opacity-40 hidden sm:inline">·</span>
          <span>Terakhir: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: localeId })}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleManualRefresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Main stat cards — 8 items */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Snippet", value: stats?.totalSnippets, icon: FileCode, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Disetujui", value: stats?.approvedSnippets, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Total Dilihat", value: stats?.totalViews, icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { label: "Total Disalin", value: stats?.totalCopies, icon: Copy, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
          { label: "Kontributor", value: stats?.totalAuthors, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Bahasa", value: stats?.totalLanguages, icon: Code2, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Rata Views/Snippet", value: engagement?.avgViews, icon: TrendingUp, color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20", decimal: true },
          { label: "Engagement Rate", value: engagement?.engagementRate, icon: Target, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", percent: true },
        ].map(({ label, value, icon: Icon, color, bg, decimal, percent }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card rounded-xl p-3 md:p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/3 rounded-full blur-[20px]" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-[10px] md:text-[11px] text-muted-foreground mb-1.5 leading-none">{label}</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className="text-xl md:text-2xl font-heading font-bold text-foreground">
                    {percent
                      ? `${(value ?? 0).toLocaleString("id-ID")}%`
                      : decimal
                      ? (value ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      : (value ?? 0).toLocaleString("id-ID")}
                  </div>
                )}
              </div>
              <div className={cn("w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center border flex-shrink-0", bg)}>
                <Icon className={cn("w-3.5 h-3.5", color)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trending Now */}
      {trending.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-orange-500/10">
          <h2 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            Trending Sekarang
            <Badge className="ml-1 text-[10px] py-0 px-2 bg-orange-500/15 text-orange-400 border-orange-500/30">Hot</Badge>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {trending.map((snippet, i) => {
              const langConfig = getLanguageBadge(snippet.language);
              const colorClass = langConfig.color.split(" ").find((c) => c.startsWith("text-")) || "text-blue-400";
              const score = snippet.viewCount + snippet.copyCount * 3;
              return (
                <Link key={snippet.id} href={`/snippet/${snippet.slug || snippet.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="group p-3 rounded-xl border border-border/30 hover:border-orange-500/30 bg-background/30 hover:bg-orange-500/5 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", colorClass)}>{snippet.language}</span>
                      <span className="text-[9px] text-orange-400/60 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{score.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-orange-400 transition-colors leading-snug">{snippet.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 truncate mt-1">{snippet.authorName}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/50">
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{snippet.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Copy className="w-2.5 h-2.5" />{snippet.copyCount}</span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Timeline + Language Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Aktivitas 12 Bulan
          </h2>
          {timeline.length > 0 ? (
            <MonthlyChart data={timeline} />
          ) : (
            <div className="h-28 flex items-center justify-center text-sm text-muted-foreground">
              Belum ada data timeline
            </div>
          )}
          {timeline.length > 0 && (
            <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground/50">
              <span>Total: {timeline.reduce((s, d) => s + d.approved, 0)} snippet</span>
              <span>Puncak: {Math.max(...timeline.map((d) => d.approved))} / bulan</span>
            </div>
          )}
        </div>

        {/* Language Distribution */}
        <div className="lg:col-span-3 glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            Distribusi Bahasa
          </h2>
          {langStatsLoading ? (
            <div className="space-y-3.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3.5 w-12" /></div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : langStats && langStats.length > 0 ? (
            <div className="space-y-3">
              {langStats.slice(0, 8).map((stat, i) => {
                const total = stats?.approvedSnippets || 1;
                const pct = Math.round((stat.count / total) * 100);
                const pctOfMax = Math.round((stat.count / maxLangCount) * 100);
                const langConfig = getLanguageBadge(stat.language);
                const colorClass = langConfig.color.split(" ").find((c) => c.startsWith("text-")) || "text-blue-400";
                const bgClass = colorClass.replace("text-", "bg-");

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="space-y-1"
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", bgClass)} />
                        {langConfig.label}
                      </span>
                      <span className="text-muted-foreground text-[11px]">{stat.count} <span className="opacity-50">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", bgClass)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pctOfMax}%` }}
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
      </div>

      {/* Top Viewed / Copied — Tabbed */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex border-b border-border/40">
          {[
            { key: "viewed", label: "Paling Banyak Dilihat", icon: Eye, color: "text-cyan-400" },
            { key: "copied", label: "Paling Banyak Disalin", icon: Copy, color: "text-pink-400" },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as "viewed" | "copied")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all",
                activeTab === key
                  ? "text-foreground border-b-2 border-blue-500 bg-blue-500/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/3",
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", activeTab === key ? color : "opacity-50")} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{key === "viewed" ? "Dilihat" : "Disalin"}</span>
            </button>
          ))}
        </div>
        <div className="p-5">
          <AnimatePresence mode="wait">
            {activeTab === "viewed" ? (
              <motion.div
                key="viewed"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                {viewedLoading ? (
                  <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {topViewed.map((snippet, i) => (
                      <Link key={snippet.id} href={`/snippet/${snippet.slug || snippet.id}`}>
                        <div className="group flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-cyan-500/20 hover:bg-cyan-500/5 cursor-pointer transition-all">
                          <span className={cn("text-xs font-bold w-5 text-center flex-shrink-0", i < 3 ? "text-cyan-400" : "text-muted-foreground/40")}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate group-hover:text-cyan-400 transition-colors">{snippet.title}</p>
                            <p className="text-[10px] text-muted-foreground/50 truncate">{snippet.authorName}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                            <Eye className="w-3 h-3 text-cyan-400/70" />
                            <span className="text-cyan-400 font-semibold">{snippet.viewCount.toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="copied"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {copiedLoading ? (
                  <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {topCopied.map((snippet, i) => (
                      <Link key={snippet.id} href={`/snippet/${snippet.slug || snippet.id}`}>
                        <div className="group flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-pink-500/20 hover:bg-pink-500/5 cursor-pointer transition-all">
                          <span className={cn("text-xs font-bold w-5 text-center flex-shrink-0", i < 3 ? "text-pink-400" : "text-muted-foreground/40")}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate group-hover:text-pink-400 transition-colors">{snippet.title}</p>
                            <p className="text-[10px] text-muted-foreground/50 truncate">{snippet.authorName}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                            <Copy className="w-3 h-3 text-pink-400/70" />
                            <span className="text-pink-400 font-semibold">{snippet.copyCount.toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top Authors + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Authors */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-400" />
            Top Kontributor
          </h2>
          {authorsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : topAuthors.length > 0 ? (
            <div className="space-y-1.5">
              {topAuthors.map((author, i) => {
                const maxViews = topAuthors[0]?.totalViews || 1;
                const barPct = (author.totalViews / maxViews) * 100;
                return (
                  <motion.div
                    key={author.authorName}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative p-2.5 rounded-xl hover:bg-white/4 transition-colors overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-yellow-500/6 rounded-xl"
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                    />
                    <div className="relative flex items-center gap-3">
                      <div className={cn(
                        "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border",
                        i === 0 ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" :
                        i === 1 ? "border-slate-400/40 bg-slate-400/10 text-slate-300" :
                        i === 2 ? "border-amber-600/40 bg-amber-600/10 text-amber-500" :
                        "border-border/40 bg-secondary/50 text-muted-foreground",
                      )}>
                        {i < 3 ? ["🥇","🥈","🥉"][i] : (i + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{author.authorName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mt-0.5">
                          <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{author.totalViews.toLocaleString("id-ID")}</span>
                          <span className="flex items-center gap-0.5"><Copy className="w-2.5 h-2.5" />{author.totalCopies.toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                      <Badge className="text-[10px] py-0 px-1.5 bg-secondary/60 text-muted-foreground border-border/40 flex-shrink-0">
                        {author.snippetCount}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada data kontributor.</div>
          )}
        </div>

        {/* Recent Snippets */}
        <div className="glass-card rounded-2xl p-6">
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
            <div className="space-y-1.5">
              {recentSnippets.map((snippet) => {
                const langConfig = getLanguageBadge(snippet.language);
                const colorClass = langConfig.color.split(" ").find((c) => c.startsWith("text-")) || "text-blue-400";
                const borderClass = langConfig.color.split(" ").find((c) => c.startsWith("border-")) || "border-blue-500/30";
                const bgClass = colorClass.replace("text-", "bg-");
                return (
                  <Link key={snippet.id} href={`/snippet/${(snippet as any).slug || snippet.id}`}>
                    <div className="group flex gap-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className={cn("w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border", colorClass, borderClass, bgClass + "/10")}>
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
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
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

      {/* Tags Cloud */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-400" />
            Tag Populer
            {topTags.length > 0 && (
              <span className="text-[11px] text-muted-foreground/50 font-normal">({topTags.length} tag)</span>
            )}
          </h2>
          {topTags.length > 15 && (
            <button
              onClick={() => setShowAllTags(!showAllTags)}
              className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              {showAllTags ? "Sembunyikan" : `Lihat semua (${topTags.length})`}
              <ChevronUp className={cn("w-3 h-3 transition-transform", !showAllTags && "rotate-180")} />
            </button>
          )}
        </div>
        {tagsLoading ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-lg" />)}
          </div>
        ) : displayedTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayedTags.map((item, i) => {
              const maxTagCount = topTags[0]?.count || 1;
              const relSize = item.count / maxTagCount;
              const textSize = relSize > 0.7 ? "text-sm" : relSize > 0.4 ? "text-xs" : "text-[11px]";
              const opacity = Math.max(0.5, relSize);
              return (
                <motion.a
                  key={item.tag}
                  href={`/?tags=${encodeURIComponent(item.tag)}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  style={{ opacity }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                    "bg-secondary/40 border-border/30 text-foreground/70 hover:border-blue-500/40 hover:text-blue-400 hover:bg-blue-500/8",
                    textSize,
                  )}
                >
                  <Hash className="w-2.5 h-2.5 opacity-60" />
                  {item.tag}
                  <span className="text-[9px] opacity-50 ml-0.5 tabular-nums">{item.count}</span>
                </motion.a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground text-sm">Belum ada tag.</div>
        )}
      </div>

      {/* Engagement metrics bar */}
      {engagement && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            Metrik Engagement
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Rata-rata Views", value: engagement.avgViews.toLocaleString("id-ID", { minimumFractionDigits: 1 }), sub: "per snippet", color: "text-cyan-400" },
              { label: "Rata-rata Salinan", value: engagement.avgCopies.toLocaleString("id-ID", { minimumFractionDigits: 1 }), sub: "per snippet", color: "text-pink-400" },
              { label: "Engagement Rate", value: `${engagement.engagementRate.toFixed(1)}%`, sub: "salin/lihat", color: "text-amber-400" },
              { label: "Record Views", value: engagement.maxViews.toLocaleString("id-ID"), sub: "snippet terpopuler", color: "text-green-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-secondary/20 border border-border/20">
                <div className={cn("text-lg font-heading font-bold", color)}>{value}</div>
                <div className="text-[11px] text-foreground/70 font-medium mt-0.5">{label}</div>
                <div className="text-[10px] text-muted-foreground/40 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips bar */}
      <div className="glass-card rounded-xl p-4 flex items-start gap-3 text-xs text-muted-foreground border-blue-500/10">
        <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-foreground">Kaai Code Snippets — Platform Sharing Kode untuk Developer Indonesia.</span>
          <p className="opacity-60">Data diperbarui otomatis setiap 30 detik. Klik tag untuk filter snippet, klik judul snippet untuk melihat kode.</p>
        </div>
      </div>
    </div>
  );
}
