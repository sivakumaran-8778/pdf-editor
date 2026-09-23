import React from "react";
import Link from "next/link";
import { ChevronRight, Zap, Sparkles, CheckCircle2 } from "lucide-react";

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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-muted/20 to-muted/40 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Breadcrumb & Header */}
        <div className="space-y-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" prefetch={true} className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/" prefetch={true} className="hover:text-foreground transition-colors">
              Tools
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {title}
                </h1>
                {badge && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
                {description}
              </p>
            </div>

            {/* Performance Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border shadow-xs text-xs text-muted-foreground shrink-0 self-start sm:self-center">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <span>High Speed Processing</span>
            </div>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border/80 overflow-hidden">
          <div className="p-4 sm:p-8">
            {children}
          </div>
        </div>

        {/* Feature Guarantee Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span><strong>Instant Conversion:</strong> Blazing fast processing without queues</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
              <Zap className="h-4 w-4" />
            </div>
            <span><strong>High Performance:</strong> Optimized for heavy documents</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <span><strong>Clean Exports:</strong> Professional high-resolution output</span>
          </div>
        </div>
      </div>
    </div>
  );
}
