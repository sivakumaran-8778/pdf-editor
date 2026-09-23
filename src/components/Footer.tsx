"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  ShieldCheck, 
  Zap, 
  Code2, 
  Heart, 
  ArrowUpRight,
  Lock,
  Layers,
  Sparkles
} from "lucide-react";

export function Footer() {
  const pathname = usePathname();

  // Full-screen studio editor hides the footer to maximize document canvas
  if (pathname === "/tools/edit") {
    return null;
  }

  return (
    <footer className="w-full border-t border-border/60 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" prefetch={true} className="inline-flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform duration-200">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-foreground">
                  PDF Studio
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  PRO
                </span>
              </div>
            </Link>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              The modern, production-grade PDF workstation. Edit existing text in-place, merge documents, convert formats, and compress files with zero server uploads.
            </p>

            {/* Privacy Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>100% Client-Side Execution • Zero Cloud Logging</span>
            </div>
          </div>

          {/* Column 1: Edit & Annotate */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Edit & Annotate
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tools/edit" prefetch={true} className="hover:text-primary transition-colors flex items-center gap-1">
                  <span>In-Place Text Editor</span>
                  <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 px-1 py-0.2 rounded">Pro</span>
                </Link>
              </li>
              <li>
                <Link href="/tools/edit" prefetch={true} className="hover:text-primary transition-colors">
                  Add Text & Fonts
                </Link>
              </li>
              <li>
                <Link href="/tools/edit" prefetch={true} className="hover:text-primary transition-colors">
                  Sign & Freehand Ink
                </Link>
              </li>
              <li>
                <Link href="/tools/edit" prefetch={true} className="hover:text-primary transition-colors">
                  Whiteout & Redact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Organize & Convert */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Organize & Convert
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tools/merge" prefetch={true} className="hover:text-primary transition-colors">
                  Merge PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/split" prefetch={true} className="hover:text-primary transition-colors">
                  Split PDF
                </Link>
              </li>
              <li>
                <Link href="/tools/compress" prefetch={true} className="hover:text-primary transition-colors flex items-center gap-1">
                  <span>Compress PDF</span>
                  <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-1 py-0.2 rounded">Fast</span>
                </Link>
              </li>
              <li>
                <Link href="/tools/rotate" prefetch={true} className="hover:text-primary transition-colors">
                  Rotate Pages
                </Link>
              </li>
              <li>
                <Link href="/tools/pdf-to-jpg" prefetch={true} className="hover:text-primary transition-colors">
                  PDF to JPG
                </Link>
              </li>
              <li>
                <Link href="/tools/jpg-to-pdf" prefetch={true} className="hover:text-primary transition-colors">
                  JPG to PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Security & Code */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Security & Tech
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/tools/protect" prefetch={true} className="hover:text-primary transition-colors">
                  Password Encryption
                </Link>
              </li>
              <li>
                <a 
                  href="https://github.com/sivakumaran-8778/pdf-editor.git" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>GitHub Repository</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </a>
              </li>
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground/80 pt-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Engine: WebAssembly / PDF-Lib</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} PDF Studio PRO. Client-Side High Performance.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <span>Engineered with precision</span>
              <Sparkles className="h-3 w-3 text-amber-500" />
            </span>
            <a 
              href="https://github.com/sivakumaran-8778/pdf-editor.git" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Open Source
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
