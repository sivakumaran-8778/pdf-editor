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
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Edit PDF", href: "/tools/edit", icon: FileEdit, badge: "In-Place" },
    { name: "Merge", href: "/tools/merge", icon: Combine },
    { name: "Split", href: "/tools/split", icon: Split },
    { name: "PDF to JPG", href: "/tools/pdf-to-jpg", icon: ImageIcon },
    { name: "Rotate", href: "/tools/rotate", icon: RotateCw },
  ];

  // In the full-screen editor page, keep navbar ultra-compact or hide to maximize document canvas
  const isEditorPage = pathname === "/tools/edit";

  if (isEditorPage) {
    return null; // The editor page has its own unified studio header to maximize document visibility!
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="w-full px-4 lg:px-8 flex h-16 items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" prefetch={true} className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform duration-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  PDF Studio
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  PRO
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground -mt-1 hidden sm:block">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="text-[9px] font-semibold bg-blue-500/10 text-blue-600 px-1 py-0.2 rounded">
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
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium">
            <Zap className="h-3.5 w-3.5" />
            <span>Fast & Unlimited • High Performance Engine</span>
          </div>

          <Link href="/tools/edit" prefetch={true}>
            <Button size="sm" className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Open Editor</span>
            </Button>
          </Link>

          {/* Mobile hamburger menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 mb-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>Professional document tools for every workflow</span>
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
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{link.name}</span>
                </div>
                {link.badge && (
                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">
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
