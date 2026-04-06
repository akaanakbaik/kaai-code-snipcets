import { useState, useEffect, useRef } from "react";
import { BookOpen, Upload, BarChart3, Menu, X, Shield, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Library", icon: BookOpen },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

const LOGO_URL = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logonobg.png";

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border/50">
        <img
          src={LOGO_URL}
          alt="Kaai"
          className="w-9 h-9 rounded-xl object-contain bg-blue-950/40 border border-blue-800/30 p-0.5"
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
      <nav className="flex flex-col gap-1 px-3 pt-5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onItemClick}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer text-sm",
                  isActive
                    ? "bg-blue-600/15 text-blue-400 font-medium border border-blue-500/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-blue-400")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Admin button at bottom - small */}
      <div className="px-3 pb-3">
        <Link href="/admin" onClick={onItemClick}>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer text-xs",
              location === "/admin" || location.startsWith("/admin")
                ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5",
            )}
            data-testid="nav-admin"
          >
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            Admin Panel
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border/50">
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
      <aside className="hidden md:flex flex-col w-60 border-r border-border/50 bg-card/20 backdrop-blur-xl fixed inset-y-0 z-50">
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/50 md:hidden transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent onItemClick={() => setOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-60 w-full">
        {/* Mobile Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40 md:hidden">
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
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Mobile Footer */}
        <footer className="md:hidden py-4 px-4 border-t border-border/50 text-center text-xs text-muted-foreground/50">
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
