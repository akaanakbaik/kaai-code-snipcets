import { useState, useEffect } from "react";
import { useGetStats, useGetLanguageStats, useGetRecentSnippets } from "@workspace/api-client-react";
import {
  BarChart3, Code2, Users, FileCode, Clock, CheckCircle2, TrendingUp,
  Eye, Copy, RefreshCw, Hash, Award, Star,
} from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { motion } from "framer-motion";
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

function useTopTags(limit = 15) {
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

function useTopViewed(limit = 6) {
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

function useTopCopied(limit = 6) {
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

export default function Stats() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refetchTick, setRefetchTick] = useState(0);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetStats();
  const { data: langStats, isLoading: langStatsLoading, refetch: refetchLang } = useGetLanguageStats();
  const { data: recentSnippets, isLoading: recentLoading, refetch: refetchRecent } = useGetRecentSnippets({ limit: 8 });
  const { data: topAuthors = [], isLoading: authorsLoading, refetch: refetchAuthors } = useTopAuthors(8);
  const { data: topTags = [], isLoading: tagsLoading, refetch: refetchTags } = useTopTags(20);
  const { data: topViewed = [], isLoading: viewedLoading, refetch: refetchViewed } = useTopViewed(6);
  const { data: topCopied = [], isLoading: copiedLoading, refetch: refetchCopied } = useTopCopied(6);

  useEffect(() => {
    const interval = setInterval(() => { setRefetchTick((t) => t + 1); }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refetchTick === 0) return;
    refetchStats();
    refetchLang();
    refetchRecent();
    refetchAuthors();
    refetchTags();
    refetchViewed();
    refetchCopied();
    setLastUpdated(new Date());
  }, [refetchTick]);

  const handleManualRefresh = () => {
    refetchStats();
    refetchLang();
    refetchRecent();
    refetchAuthors();
    refetchTags();
    refetchViewed();
    refetchCopied();
    setLastUpdated(new Date());
  };

  const maxLangCount = langStats && langStats.length > 0 ? langStats[0].count : 1;

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
          <span className="hidden sm:inline">Perbarui otomatis setiap 30 detik</span>
          <span className="opacity-40 hidden sm:inline">·</span>
          <span>Terakhir: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: localeId })}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleManualRefresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Stats grid — 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Snippet", value: stats?.totalSnippets, icon: FileCode, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Disetujui", value: stats?.approvedSnippets, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Bahasa", value: stats?.totalLanguages, icon: Code2, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Kontributor", value: stats?.totalAuthors, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "Total Dilihat", value: stats?.totalViews, icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { label: "Total Disalin", value: stats?.totalCopies, icon: Copy, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card rounded-xl p-3 md:p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/3 rounded-full blur-[20px]" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5 leading-none">{label}</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                    {(value ?? 0).toLocaleString("id-ID")}
                  </div>
                )}
              </div>
              <div className={cn("w-7 h-7 md:w-9 md:h-9 rounded-xl flex items-center justify-center border flex-shrink-0", bg)}>
                <Icon className={cn("w-3.5 h-3.5 md:w-4.5 md:h-4.5", color)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Language Distribution + Recent Activity */}
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
            <div className="space-y-3.5">
              {langStats.map((stat, i) => {
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
            <div className="space-y-2">
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

      {/* Top Authors + Top Tags */}
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
            <div className="space-y-2">
              {topAuthors.map((author, i) => (
                <motion.div
                  key={author.authorName}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/4 transition-colors"
                >
                  <div className={cn(
                    "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border",
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
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {author.totalViews.toLocaleString("id-ID")}</span>
                      <span className="flex items-center gap-0.5"><Copy className="w-2.5 h-2.5" /> {author.totalCopies.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                  <Badge className="text-[10px] py-0 px-1.5 bg-secondary/60 text-muted-foreground border-border/40">
                    {author.snippetCount} snippet
                  </Badge>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada data kontributor.</div>
          )}
        </div>

        {/* Top Tags */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-400" />
            Tag Populer
          </h2>
          {tagsLoading ? (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-lg" />)}
            </div>
          ) : topTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topTags.map((item, i) => {
                const maxTagCount = topTags[0]?.count || 1;
                const relSize = item.count / maxTagCount;
                const textSize = relSize > 0.7 ? "text-sm" : relSize > 0.4 ? "text-xs" : "text-[11px]";
                return (
                  <motion.span
                    key={item.tag}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.025 }}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors cursor-default",
                      "bg-secondary/50 border-border/40 text-foreground/70 hover:border-blue-500/30 hover:text-blue-400",
                      textSize,
                    )}
                  >
                    <Hash className="w-2.5 h-2.5 opacity-60" />
                    {item.tag}
                    <span className="text-[9px] opacity-50 ml-0.5">{item.count}</span>
                  </motion.span>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada tag.</div>
          )}
        </div>
      </div>

      {/* Most Viewed + Most Copied */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most Viewed */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            Paling Banyak Dilihat
          </h2>
          {viewedLoading ? (
            <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : topViewed.length > 0 ? (
            <div className="space-y-2">
              {topViewed.map((snippet, i) => {
                const langConfig = getLanguageBadge(snippet.language);
                return (
                  <Link key={snippet.id} href={`/snippet/${snippet.slug || snippet.id}`}>
                    <div className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-xs font-bold text-muted-foreground/40 w-4 text-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">{snippet.title}</p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">{snippet.authorName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 flex-shrink-0">
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400/80 font-medium">{snippet.viewCount.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada data.</div>
          )}
        </div>

        {/* Most Copied */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Copy className="w-4 h-4 text-pink-400" />
            Paling Banyak Disalin
          </h2>
          {copiedLoading ? (
            <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : topCopied.length > 0 ? (
            <div className="space-y-2">
              {topCopied.map((snippet, i) => {
                return (
                  <Link key={snippet.id} href={`/snippet/${snippet.slug || snippet.id}`}>
                    <div className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-xs font-bold text-muted-foreground/40 w-4 text-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">{snippet.title}</p>
                        <p className="text-[10px] text-muted-foreground/60 truncate">{snippet.authorName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 flex-shrink-0">
                        <Copy className="w-3 h-3 text-pink-400" />
                        <span className="text-pink-400/80 font-medium">{snippet.copyCount.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada data.</div>
          )}
        </div>
      </div>

      {/* Tips */}
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
