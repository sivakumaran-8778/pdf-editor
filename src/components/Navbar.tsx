"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  Combine, 
  Split, 
  FileEdit, 
  Sparkles, 
  Zap, 
  Menu, 
  X, 
  Image as ImageIcon,
  RotateCw,
  ShieldCheck,
  Minimize
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Edit PDF", href: "/tools/edit", icon: FileEdit, badge: "In-Place" },
    { name: "Merge", href: "/tools/merge", icon: Combine },
    { name: "Split", href: "/tools/split", icon: Split },
    { name: "Compress", href: "/tools/compress", icon: Minimize, badge: "Fast" },
    { name: "PDF to JPG", href: "/tools/pdf-to-jpg", icon: ImageIcon },
    { name: "Rotate", href: "/tools/rotate", icon: RotateCw },
  ];

  // In the full-screen editor page, keep navbar hidden to maximize document canvas
  const isEditorPage = pathname === "/tools/edit";

  if (isEditorPage) {
    return null; // The editor page has its own unified studio header to maximize document visibility!
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 shadow-xs">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" prefetch={true} className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-md shadow-red-500/25 group-hover:scale-105 group-hover:shadow-red-500/40 transition-all duration-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  PDF Studio
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  PRO
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium -mt-1 hidden sm:block">
                Professional Document Suite
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-slate-900 text-white font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : link.badge === "In-Place" 
                          ? "bg-blue-500/10 text-blue-600" 
                          : "bg-emerald-500/10 text-emerald-600"
                    }`}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side status & action badges */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-medium shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>100% Private Client-Side Engine</span>
          </div>

          <Link href="/tools/edit" prefetch={true}>
            <Button size="sm" className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 text-white shadow-md shadow-red-500/20 gap-1.5 font-semibold rounded-xl text-xs sm:text-sm h-9 px-4 transition-all">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Launch Studio</span>
            </Button>
          </Link>

          {/* Mobile hamburger menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-slate-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-white/95 backdrop-blur-2xl px-4 py-4 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Zero cloud uploads • 100% client-side privacy</span>
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-slate-900 text-white font-semibold" : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                  <span>{link.name}</span>
                </div>
                {link.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-600"
                  }`}>
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
