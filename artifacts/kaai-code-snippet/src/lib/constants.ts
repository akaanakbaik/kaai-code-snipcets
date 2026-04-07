export const LANGUAGE_CONFIG: Record<string, { label: string, color: string }> = {
  javascript: { label: "JavaScript", color: "bg-yellow-400/20 text-yellow-500 border-yellow-400/30" },
  typescript: { label: "TypeScript", color: "bg-blue-400/20 text-blue-400 border-blue-400/30" },
  python: { label: "Python", color: "bg-green-400/20 text-green-400 border-green-400/30" },
  go: { label: "Go", color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30" },
  rust: { label: "Rust", color: "bg-orange-400/20 text-orange-400 border-orange-400/30" },
  java: { label: "Java", color: "bg-red-400/20 text-red-400 border-red-400/30" },
  csharp: { label: "C#", color: "bg-purple-400/20 text-purple-400 border-purple-400/30" },
  cpp: { label: "C++", color: "bg-indigo-400/20 text-indigo-400 border-indigo-400/30" },
  php: { label: "PHP", color: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30" },
  ruby: { label: "Ruby", color: "bg-rose-400/20 text-rose-400 border-rose-400/30" },
  swift: { label: "Swift", color: "bg-red-500/20 text-red-500 border-red-500/30" },
  kotlin: { label: "Kotlin", color: "bg-violet-400/20 text-violet-400 border-violet-400/30" },
  html: { label: "HTML", color: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
  css: { label: "CSS", color: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  sql: { label: "SQL", color: "bg-sky-400/20 text-sky-400 border-sky-400/30" },
  bash: { label: "Bash", color: "bg-gray-400/20 text-gray-400 border-gray-400/30" },
  json: { label: "JSON", color: "bg-stone-400/20 text-stone-400 border-stone-400/30" },
  yaml: { label: "YAML", color: "bg-stone-500/20 text-stone-500 border-stone-500/30" },
  markdown: { label: "Markdown", color: "bg-neutral-400/20 text-neutral-400 border-neutral-400/30" },
  other: { label: "Other", color: "bg-slate-400/20 text-slate-400 border-slate-400/30" },
};

export const getLanguageBadge = (lang: string) => {
  const normalized = lang.toLowerCase();
  return LANGUAGE_CONFIG[normalized] || LANGUAGE_CONFIG.other;
};
