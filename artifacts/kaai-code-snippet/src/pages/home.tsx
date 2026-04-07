import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Search, Hash, Code2, Clock, Copy, ChevronDown, X, Eye, TrendingUp, AlignLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { useListSnippets, getListSnippetsQueryKey, useGetStats } from "@workspace/api-client-react";
import type { ListSnippetsParams } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLanguageBadge, LANGUAGE_CONFIG } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

const POPULAR_TAGS = ["react", "python", "javascript", "utility"];
const LIMIT_OPTIONS = [5, 10, 15, 20, 50, 100];
const PAGE_WINDOW = 5;
const MIN_TOTAL_FOR_PAGINATION = 5;

type SortBy = "popular" | "latest" | "az";

const SORT_OPTIONS: { value: SortBy; label: string; icon: React.ElementType }[] = [
  { value: "popular", label: "Terpopuler", icon: TrendingUp },
  { value: "latest", label: "Terbaru", icon: CalendarDays },
  { value: "az", label: "A–Z", icon: AlignLeft },
];

function LanguageCatalog({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (lang: string) => void;
  onClose: () => void;
}) {
  const langs = Object.entries(LANGUAGE_CONFIG);

  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full mt-2 left-0 right-0 bg-card border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="max-h-52 overflow-y-auto py-1">
        <button
          onClick={() => { onSelect("all"); onClose(); }}
          className={cn(
            "w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/5 transition-colors",
            selected === "all" && "text-blue-400 bg-blue-500/5",
          )}
        >
          <Code2 className="w-3.5 h-3.5 opacity-50" /> Semua Bahasa
        </button>
        {langs.map(([val, config]) => (
          <button
            key={val}
            onClick={() => { onSelect(val); onClose(); }}
            className={cn(
              "w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/5 transition-colors",
              selected === val && "text-blue-400 bg-blue-500/5",
            )}
          >
            <span className={cn("w-2 h-2 rounded-full inline-block", config.color.split(" ")[0])} />
            {config.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [sortOpen, setSortOpen] = useState(false);
  const [langCatalogOpen, setLangCatalogOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(1);

  const langCatalogRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data: stats } = useGetStats();

  const queryParams: ListSnippetsParams = {
    search: debouncedSearch || undefined,
    language: language !== "all" ? language : undefined,
    tag: activeTag || undefined,
    sortBy,
    page,
    limit,
  };

  const { data, isLoading } = useListSnippets(queryParams, {
    query: { queryKey: getListSnippetsQueryKey(queryParams) },
  });

  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  // Keep page window in sync with current page
  useEffect(() => {
    if (page < windowStart) {
      setWindowStart(Math.max(1, page - PAGE_WINDOW + 1));
    } else if (page >= windowStart + PAGE_WINDOW) {
      setWindowStart(page);
    }
  }, [page, windowStart]);

  // Reset page + window on filter/sort/limit change
  useEffect(() => {
    setPage(1);
    setWindowStart(1);
  }, [debouncedSearch, language, activeTag, sortBy, limit]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langCatalogRef.current && !langCatalogRef.current.contains(e.target as Node)) {
        setLangCatalogOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const clearFilters = () => {
    setSearch("");
    setLanguage("all");
    setActiveTag(null);
    setPage(1);
    setWindowStart(1);
  };

  const navigateTo = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
    // If clicking the last page in the current window, advance window to start there
    const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);
    if (clamped >= windowEnd && clamped < totalPages) {
      setWindowStart(clamped);
    } else if (clamped < windowStart) {
      setWindowStart(Math.max(1, clamped - PAGE_WINDOW + 1));
    }
    // Smooth scroll to top of snippets grid
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setWindowStart(1);
  };

  const hasFilters = search || language !== "all" || activeTag;
  const activeSortOption = SORT_OPTIONS.find((s) => s.value === sortBy)!;

  // Visible page buttons
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);
  const pageButtons = Array.from({ length: Math.max(0, windowEnd - windowStart + 1) }, (_, i) => windowStart + i);

  // Show pagination feature only if enough total snippets
  const showPaginationFeature = total >= MIN_TOTAL_FOR_PAGINATION;
  const showNavigation = showPaginationFeature && totalPages > 1;

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-12">
      {/* Hero — minimal */}
      <section className="relative overflow-hidden rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm px-5 py-4 md:px-7 md:py-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/6 via-transparent to-blue-800/4 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-heading font-bold tracking-tight text-foreground leading-tight">
              Kaai <span className="text-gradient">Code Snippet</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Library kode berkualitas dari developer Indonesia.
            </p>
          </div>

          <div className="flex items-center gap-4 sm:ml-auto text-sm">
            <div className="text-center">
              <div className="text-lg font-bold font-heading text-foreground leading-none">{stats?.approvedSnippets || 0}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Snippets</div>
            </div>
            <div className="w-px h-6 bg-border/60" />
            <div className="text-center">
              <div className="text-lg font-bold font-heading text-foreground leading-none">{stats?.totalLanguages || 0}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Bahasa</div>
            </div>
            <div className="w-px h-6 bg-border/60" />
            <div className="text-center">
              <div className="text-lg font-bold font-heading text-foreground leading-none">{stats?.totalAuthors || 0}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Author</div>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Panel */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari judul, author, bahasa... (cth: aka js)"
              className="pl-10 h-9 bg-background/50 border-border/60 text-sm focus-visible:ring-blue-500/30 focus-visible:border-blue-500/40"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              data-testid="input-search-snippets"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {/* Sort dropdown */}
            <div className="relative w-36" ref={sortRef}>
              <button
                onClick={() => setSortOpen((v) => !v)}
                className={cn(
                  "w-full h-9 px-3 flex items-center justify-between gap-1.5 rounded-lg border text-xs transition-colors",
                  sortOpen
                    ? "bg-blue-500/5 border-blue-500/30 text-foreground"
                    : "bg-background/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                )}
                data-testid="select-sort"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <activeSortOption.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {activeSortOption.label}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", sortOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-1.5 left-0 right-0 bg-card border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-white/5 transition-colors",
                          sortBy === opt.value && "text-blue-400 bg-blue-500/5",
                        )}
                      >
                        <opt.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language catalog */}
            <div className="relative w-40" ref={langCatalogRef}>
              <button
                onClick={() => setLangCatalogOpen((v) => !v)}
                className={cn(
                  "w-full h-9 px-3 flex items-center justify-between gap-1.5 rounded-lg border text-xs transition-colors",
                  langCatalogOpen
                    ? "bg-blue-500/5 border-blue-500/30 text-foreground"
                    : "bg-background/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                )}
                data-testid="select-language-filter"
              >
                <span className="truncate">
                  {language === "all" ? "Semua Bahasa" : LANGUAGE_CONFIG[language]?.label || language}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", langCatalogOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {langCatalogOpen && (
                  <LanguageCatalog
                    selected={language}
                    onSelect={(val) => { setLanguage(val); }}
                    onClose={() => setLangCatalogOpen(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground/60">Tag:</span>
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => { setActiveTag(activeTag === tag ? null : tag); }}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-all",
                activeTag === tag
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  : "bg-background/50 border-border/40 text-muted-foreground/70 hover:border-border hover:text-foreground",
              )}
            >
              <Hash className="w-2.5 h-2.5" /> {tag}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors flex items-center gap-0.5 ml-1">
              <X className="w-3 h-3" /> Hapus
            </button>
          )}
        </div>
      </section>

      {/* Snippets Grid */}
      <section>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(Math.min(limit, 6))].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.data.map((snippet, idx) => {
              const langConfig = getLanguageBadge(snippet.language);
              return (
                <motion.div
                  key={snippet.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.035 }}
                >
                  <Link href={`/snippet/${snippet.id}`}>
                    <div
                      className="group h-full rounded-xl glass-card overflow-hidden hover:border-blue-500/30 hover:glow-blue transition-all duration-200 cursor-pointer"
                      data-testid={`card-snippet-${snippet.id}`}
                    >
                      <div className="p-4 flex flex-col gap-2.5 h-full">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className={cn("px-2 py-0.5 text-[10px] font-medium rounded-md border", langConfig.color)}>
                            {langConfig.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(snippet.createdAt), "d MMM yy")}
                          </span>
                        </div>

                        <div className="flex-1 space-y-1">
                          <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                            {snippet.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {snippet.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {snippet.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="inline-flex items-center text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md">
                              <Hash className="w-2 h-2 mr-0.5 opacity-50" />{tag}
                            </span>
                          ))}
                          {snippet.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md">
                              +{snippet.tags.length - 3}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] font-bold border border-blue-500/15">
                              {snippet.authorName.charAt(0).toUpperCase()}
                            </div>
                            {snippet.authorName}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {(snippet as any).viewCount || 0}</span>
                            <span className="flex items-center gap-0.5"><Copy className="w-2.5 h-2.5" /> {(snippet as any).copyCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border/40 bg-card/10">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-muted-foreground opacity-40" />
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground">Tidak ditemukan</h3>
            <p className="text-muted-foreground mt-1.5 max-w-sm text-xs">
              Tidak ada snippet yang sesuai dengan kriteria pencarian.
            </p>
            {hasFilters && (
              <button
                className="mt-4 text-xs h-7 px-3 rounded-lg border border-border/60 bg-background/50 hover:bg-white/5 text-muted-foreground transition-colors"
                onClick={clearFilters}
              >
                Hapus semua filter
              </button>
            )}
          </div>
        )}
      </section>

      {/* ─── Pagination & Limit Selector ─── */}
      {showPaginationFeature && !isLoading && (
        <section className="flex flex-col gap-3 mt-1">
          {/* Info baris + limit selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
            {/* Info */}
            <p className="text-xs text-muted-foreground">
              {showNavigation
                ? <>Menampilkan <span className="text-foreground font-medium">{startItem}–{endItem}</span> dari <span className="text-foreground font-medium">{total}</span> snippet</>
                : <><span className="text-foreground font-medium">{total}</span> snippet ditemukan</>
              }
            </p>

            {/* Limit catalog */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
              <span className="text-[11px] text-muted-foreground/60 mr-0.5">Per halaman:</span>
              {LIMIT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => changeLimit(opt)}
                  className={cn(
                    "min-w-[30px] h-7 px-2 rounded-lg text-xs font-medium border transition-all",
                    limit === opt
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/35 shadow-[0_0_8px_rgba(59,130,246,0.2)]"
                      : "bg-background/50 text-muted-foreground border-border/50 hover:text-foreground hover:border-border/80 hover:bg-white/5",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation buttons + page number boxes */}
          {showNavigation && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {/* Prev */}
              <button
                onClick={() => navigateTo(page - 1)}
                disabled={page === 1}
                data-testid="btn-prev-page"
                className={cn(
                  "flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs border transition-all",
                  page === 1
                    ? "bg-background/30 border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    : "bg-background/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5",
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Page number boxes */}
              <div className="flex items-center gap-1">
                {/* Show "..." at start if windowStart > 1 */}
                {windowStart > 1 && (
                  <button
                    onClick={() => navigateTo(windowStart - 1)}
                    className="w-8 h-8 rounded-lg text-xs border bg-background/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                  >
                    ···
                  </button>
                )}

                {pageButtons.map((p) => (
                  <button
                    key={p}
                    onClick={() => navigateTo(p)}
                    data-testid={`btn-page-${p}`}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-medium border transition-all",
                      page === p
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/35 shadow-[0_0_8px_rgba(59,130,246,0.2)]"
                        : "bg-background/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-white/5",
                    )}
                  >
                    {p}
                  </button>
                ))}

                {/* Show "..." at end if more pages beyond window */}
                {windowEnd < totalPages && (
                  <button
                    onClick={() => navigateTo(windowEnd + 1)}
                    className="w-8 h-8 rounded-lg text-xs border bg-background/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                  >
                    ···
                  </button>
                )}
              </div>

              {/* Next */}
              <button
                onClick={() => navigateTo(page + 1)}
                disabled={page >= totalPages}
                data-testid="btn-next-page"
                className={cn(
                  "flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs border transition-all",
                  page >= totalPages
                    ? "bg-background/30 border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    : "bg-background/50 border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5",
                )}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
