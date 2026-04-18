import { useState, useEffect, useRef } from "react";
import { useSEO, SITE_URL } from "@/hooks/use-seo";
import { Link } from "wouter";
import {
  Search, Hash, Code2, Clock, Copy, ChevronDown, X, Eye,
  TrendingUp, AlignLeft, CalendarDays, ChevronLeft, ChevronRight,
  Plus, Tag,
} from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";

const LIMIT_OPTIONS = [5, 10, 15, 20, 50, 100];
const PAGE_WINDOW = 5;
const MIN_TOTAL_FOR_PAGINATION = 5;
const TOP_TAGS_LIMIT = 8;

type SortBy = "popular" | "latest" | "az";

const SORT_OPTIONS: { value: SortBy; label: string; icon: React.ElementType }[] = [
  { value: "az", label: "A–Z", icon: AlignLeft },
  { value: "popular", label: "Terpopuler", icon: TrendingUp },
  { value: "latest", label: "Terbaru", icon: CalendarDays },
];

// Fetch tags from API
function usePopularTags(limit = TOP_TAGS_LIMIT) {
  return useQuery<{ tag: string; count: number }[]>({
    queryKey: ["snippets-tags", limit],
    queryFn: async () => {
      const res = await fetch(`/api/snippets/tags?limit=${limit}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function useAllTags() {
  return useQuery<{ tag: string; count: number }[]>({
    queryKey: ["snippets-tags-all"],
    queryFn: async () => {
      const res = await fetch(`/api/snippets/tags`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

// Tags Popup Modal
function TagsModal({
  activeTags,
  onToggleTag,
  onClose,
}: {
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClose: () => void;
}) {
  const { data: allTags = [], isLoading } = useAllTags();
  const [modalSearch, setModalSearch] = useState("");

  const filtered = modalSearch
    ? allTags.filter((t) => t.tag.toLowerCase().includes(modalSearch.toLowerCase()))
    : allTags;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md glass-card rounded-2xl p-5 space-y-4 border border-border/60 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-400" />
            <h3 className="font-heading font-semibold text-sm text-foreground">Semua Tag</h3>
            {allTags.length > 0 && (
              <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                {allTags.length} tag
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            <span className="text-[10px] text-muted-foreground/60">Aktif:</span>
            {activeTags.map((t) => (
              <button
                key={t}
                onClick={() => onToggleTag(t)}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                <Hash className="w-2 h-2" />{t}<X className="w-2 h-2" />
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            placeholder="Cari tag..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-background/50 border border-border/50 rounded-lg outline-none focus:border-blue-500/40 text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-0.5 pr-1">
          {isLoading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Memuat tag...</div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Tag tidak ditemukan</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map(({ tag, count }) => {
                const isActive = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onToggleTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-all",
                      isActive
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                        : "bg-background/50 border-border/40 text-muted-foreground/70 hover:border-border hover:text-foreground",
                    )}
                  >
                    <Hash className="w-2.5 h-2.5" />
                    {tag}
                    <span className={cn(
                      "text-[9px] px-1 rounded-sm",
                      isActive ? "bg-blue-500/20 text-blue-300" : "bg-secondary/60 text-muted-foreground/50",
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeTags.length > 0 && (
          <button
            onClick={() => activeTags.forEach((t) => onToggleTag(t))}
            className="w-full text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center justify-center gap-1 pt-1"
          >
            <X className="w-3 h-3" /> Hapus semua tag aktif
          </button>
        )}
      </motion.div>
    </div>
  );
}

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

// Returns first letter for A-Z section header
function getFirstLetter(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default function Home() {
  useSEO({
    description: "Kumpulan code snippet siap pakai untuk developer Indonesia dan mancanegara. Cari, salin, dan bagikan kode JavaScript, TypeScript, Python, Go, PHP, dan lainnya secara gratis.",
    keywords: "code snippet, kode program gratis, javascript snippet, typescript snippet, python snippet, developer indonesia, open source, share code, programming tools",
    url: "/",
    type: "website",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Kaai Code Snippet",
        "alternateName": ["Kaai Codes", "codes-snippet.kaai"],
        "url": "https://codes-snippet.kaai.my.id",
        "description": "Kumpulan code snippet siap pakai untuk developer Indonesia dan mancanegara.",
        "inLanguage": ["id", "en"],
        "potentialAction": {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": `${SITE_URL}/?search={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Library Code Snippet | Kaai Code Snippet",
        "url": "https://codes-snippet.kaai.my.id",
        "description": "Koleksi code snippet gratis untuk developer Indonesia — JavaScript, TypeScript, Python, Go, PHP, dan lebih banyak lagi.",
        "about": { "@type": "Thing", "name": "Code Snippets", "description": "Koleksi kode program siap pakai" },
      },
    ],
  });

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<SortBy>("az");
  const [sortOpen, setSortOpen] = useState(false);
  const [langCatalogOpen, setLangCatalogOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [windowStart, setWindowStart] = useState(1);
  const [showTagsModal, setShowTagsModal] = useState(false);

  const langCatalogRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data: stats } = useGetStats();
  const { data: popularTags = [], isLoading: tagsLoading } = usePopularTags(TOP_TAGS_LIMIT);

  const queryParams: ListSnippetsParams = {
    search: debouncedSearch || undefined,
    language: language !== "all" ? language : undefined,
    tag: activeTags.length === 1 ? activeTags[0] : undefined,
    tags: activeTags.length > 1 ? activeTags.join(",") : undefined,
    sortBy,
    page,
    limit,
  } as ListSnippetsParams;

  const { data, isLoading } = useListSnippets(queryParams, {
    query: { queryKey: getListSnippetsQueryKey(queryParams) },
  });

  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  useEffect(() => {
    if (page < windowStart) {
      setWindowStart(Math.max(1, page - PAGE_WINDOW + 1));
    } else if (page >= windowStart + PAGE_WINDOW) {
      setWindowStart(page);
    }
  }, [page, windowStart]);

  useEffect(() => {
    setPage(1);
    setWindowStart(1);
  }, [debouncedSearch, language, JSON.stringify(activeTags), sortBy, limit]);

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
    setActiveTags([]);
    setPage(1);
    setWindowStart(1);
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const navigateTo = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
    const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);
    if (clamped >= windowEnd && clamped < totalPages) {
      setWindowStart(clamped);
    } else if (clamped < windowStart) {
      setWindowStart(Math.max(1, clamped - PAGE_WINDOW + 1));
    }
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setWindowStart(1);
  };

  const hasFilters = search || language !== "all" || activeTags.length > 0;
  const activeSortOption = SORT_OPTIONS.find((s) => s.value === sortBy)!;

  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);
  const pageButtons = Array.from({ length: Math.max(0, windowEnd - windowStart + 1) }, (_, i) => windowStart + i);

  const showPaginationFeature = total >= MIN_TOTAL_FOR_PAGINATION;
  const showNavigation = showPaginationFeature && totalPages > 1;

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  // Section separators for A-Z sort
  const isAZMode = sortBy === "az" && !debouncedSearch && !hasFilters;
  const snippets = data?.data ?? [];

  // Build list with section header insertions
  type SnippetItem = { type: "item"; snippet: (typeof snippets)[0] };
  type SectionItem = { type: "section"; letter: string };
  type ListItem = SnippetItem | SectionItem;

  const listItems: ListItem[] = [];
  if (isAZMode) {
    let lastLetter = "";
    for (const snippet of snippets) {
      const letter = getFirstLetter(snippet.title);
      if (letter !== lastLetter) {
        listItems.push({ type: "section", letter });
        lastLetter = letter;
      }
      listItems.push({ type: "item", snippet });
    }
  } else {
    for (const snippet of snippets) {
      listItems.push({ type: "item", snippet });
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-12">
      {/* Tags Modal */}
      <AnimatePresence>
        {showTagsModal && (
          <TagsModal
            activeTags={activeTags}
            onToggleTag={toggleTag}
            onClose={() => setShowTagsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Hero */}
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
              placeholder="Cari judul, author, bahasa, tag... (ID/EN)"
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
            <div className="relative w-32 sm:w-36" ref={sortRef}>
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
            <div className="relative w-36 sm:w-40" ref={langCatalogRef}>
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

        {/* Tag filters — dynamic from API */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground/60 flex-shrink-0">Tag:</span>
          {tagsLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-5 w-14 rounded-md bg-secondary/50 animate-pulse" />
            ))
          ) : (
            popularTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-all",
                  activeTags.includes(tag)
                    ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                    : "bg-background/50 border-border/40 text-muted-foreground/70 hover:border-border hover:text-foreground",
                )}
              >
                <Hash className="w-2.5 h-2.5" />
                {tag}
                <span className="text-[9px] opacity-60 ml-0.5">{count}</span>
              </button>
            ))
          )}

          {/* All tags button */}
          <button
            onClick={() => setShowTagsModal(true)}
            className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md border border-dashed border-border/50 text-muted-foreground/50 hover:border-border hover:text-foreground transition-colors"
            title="Lihat semua tag"
          >
            <Plus className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Lainnya</span>
          </button>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors flex items-center gap-0.5 ml-1">
              <X className="w-3 h-3" /> Hapus
            </button>
          )}
        </div>

        {/* Active tags display */}
        {activeTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">Filter tag:</span>
            {activeTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-colors"
              >
                <Hash className="w-2 h-2" />{tag}<X className="w-2 h-2" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Snippets Grid */}
      <section>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(Math.min(limit, 6))].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : snippets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {listItems.map((item, idx) => {
              if (item.type === "section") {
                return (
                  <div
                    key={`section-${item.letter}-${idx}`}
                    className="col-span-full flex items-center gap-3 pt-2 pb-0.5"
                  >
                    <span className="font-heading font-bold text-lg text-foreground/30 w-7 text-right flex-shrink-0">
                      {item.letter}
                    </span>
                    <div className="flex-1 h-px bg-border/20" />
                  </div>
                );
              }

              const { snippet } = item;
              const langConfig = getLanguageBadge(snippet.language);
              return (
                <motion.div
                  key={snippet.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03 }}
                >
                  <Link href={`/snippet/${(snippet as any).slug || snippet.id}`}>
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

      {/* Pagination & Limit Selector */}
      {showPaginationFeature && !isLoading && (
        <section className="flex flex-col gap-3 mt-1">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
            <p className="text-xs text-muted-foreground">
              {showNavigation
                ? <>Menampilkan <span className="text-foreground font-medium">{startItem}–{endItem}</span> dari <span className="text-foreground font-medium">{total}</span> snippet</>
                : <><span className="text-foreground font-medium">{total}</span> snippet ditemukan</>
              }
            </p>

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

          {showNavigation && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
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

              <div className="flex items-center gap-1">
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

                {windowEnd < totalPages && (
                  <button
                    onClick={() => navigateTo(windowEnd + 1)}
                    className="w-8 h-8 rounded-lg text-xs border bg-background/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                  >
                    ···
                  </button>
                )}
              </div>

              <button
                onClick={() => navigateTo(page + 1)}
                disabled={page === totalPages}
                data-testid="btn-next-page"
                className={cn(
                  "flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs border transition-all",
                  page === totalPages
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
