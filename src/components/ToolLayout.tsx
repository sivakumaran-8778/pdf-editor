import React from "react";
import Link from "next/link";
import { ChevronRight, Zap, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";

interface ToolLayoutProps {
  title: string;
  description: string;
  badge?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function ToolLayout({ 
  title, 
  description, 
  badge,
  fullWidth = false, 
  children 
}: ToolLayoutProps) {
  if (fullWidth) {
    return (
      <div className="w-full h-full min-h-0 flex-1 flex flex-col bg-slate-50/70 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-50/50 to-slate-100/60 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Breadcrumb & Header */}
        <div className="space-y-4">
          <nav className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-white/80 border border-slate-200/70 px-3 py-1.5 rounded-full shadow-2xs">
            <Link href="/" prefetch={true} className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <Link href="/" prefetch={true} className="hover:text-slate-900 transition-colors">
              Tools
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-slate-900 font-semibold">{title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                  {title}
                </h1>
                {badge && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                {description}
              </p>
            </div>

            {/* Performance Badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/80 shadow-xs text-xs text-slate-700 font-medium shrink-0 self-start sm:self-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>High Speed Engine</span>
            </div>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-white/95 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
          <div className="p-6 sm:p-10">
            {children}
          </div>
        </div>

        {/* Feature Guarantee Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900 block">Instant Processing</span>
              <span>Zero server queues or delays</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900 block">100% Client-Side</span>
              <span>Your files never leave device</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 shadow-2xs">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900 block">Clean Vector Exports</span>
              <span>Professional high-resolution output</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
