import { useState, useEffect, useRef } from "react";
import { BookOpen, Upload, BarChart3, Menu, X, Shield, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Library", icon: BookOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/docs", label: "API Docs", icon: FileText },
];

const LOGO_URL = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logonobg.png";

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="mx-1 mt-1 mb-3 px-4 py-4 flex items-center gap-3 rounded-2xl skeuo-surface">
        <img
          src={LOGO_URL}
          alt="Kaai"
          className="w-10 h-10 rounded-xl object-contain bg-slate-950/70 border border-cyan-400/20 p-1 shadow-[inset_2px_2px_5px_rgba(0,0,0,.45),2px_2px_5px_rgba(0,0,0,.3)]"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div>
          <span className="font-heading font-bold text-lg tracking-tight text-foreground">Kaai</span>
          <span className="block text-[10px] text-muted-foreground leading-none mt-0.5">Code Snippet</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2 px-2 pt-3 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onItemClick}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-160 cursor-pointer text-sm",
                  isActive
                    ? "bg-cyan-400/10 text-cyan-300 font-medium border border-cyan-300/25 shadow-[inset_3px_3px_7px_rgba(0,0,0,.25),2px_2px_5px_rgba(0,0,0,.25)]"
                    : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground hover:translate-x-0.5",
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-cyan-300")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Admin button at bottom - small */}
      <div className="px-2 pb-3">
        <Link href="/admin" onClick={onItemClick}>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-160 cursor-pointer text-xs",
              location === "/admin" || location.startsWith("/admin")
                ? "bg-cyan-400/10 text-cyan-300 border border-cyan-300/20 shadow-[inset_2px_2px_6px_rgba(0,0,0,.25)]"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/[0.045]",
            )}
            data-testid="nav-admin"
          >
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            Admin Panel
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="mx-1 mb-1 px-4 py-4 rounded-2xl skeuo-inset">
        <div className="flex flex-col gap-2">
          <div className="flex gap-3 text-xs text-muted-foreground/60">
            <Link href="/terms" onClick={onItemClick} className="hover:text-muted-foreground transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy" onClick={onItemClick} className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/docs" onClick={onItemClick} className="hover:text-muted-foreground transition-colors flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />Docs</Link>
          </div>
          <p className="text-[11px] text-muted-foreground/50">
            made by{" "}
            <a href="https://akadev.me" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-muted-foreground transition-colors">
              <span className="text-red-500 font-bold">a</span>
              <span className="font-bold">ka</span>
            </a>{" "}
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const prevLocation = useRef(location);

  // Scroll to top on every route change
  useEffect(() => {
    if (prevLocation.current !== location) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      prevLocation.current = location;
    }
  }, [location]);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 p-3 bg-sidebar/95 border-r border-sidebar-border/70 fixed inset-y-0 z-50 shadow-[14px_0_30px_rgba(0,0,0,.22)]">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 sidebar-blur-overlay md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border/70 md:hidden transition-transform duration-200 shadow-[14px_0_30px_rgba(0,0,0,.3)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-4 p-2 rounded-xl skeuo-button text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent onItemClick={() => setOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 w-full">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 glass-panel sticky top-0 z-40 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-base tracking-tight">Kaai</span>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Mobile Footer */}
        <footer className="md:hidden py-5 px-4 mt-4 border-t border-border/50 text-center text-xs text-muted-foreground/50">
          <div className="flex justify-center gap-4 mb-1">
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/docs" className="hover:text-muted-foreground transition-colors">Docs</Link>
          </div>
          made by{" "}
          <a href="https://akadev.me" target="_blank" rel="noreferrer" className="inline-flex items-center">
            <span className="text-red-500 font-bold">a</span>
            <span className="font-bold text-foreground/70">ka</span>
          </a>{" "}
          &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
