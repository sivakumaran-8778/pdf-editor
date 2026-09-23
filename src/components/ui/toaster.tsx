"use client";

import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t: any) => {
        const isDestructive = t.variant === "destructive";
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
              isDestructive
                ? "bg-red-50/95 border-red-200 text-red-900"
                : "bg-white/95 border-border/80 text-foreground"
            }`}
          >
            {isDestructive ? (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 space-y-0.5 pr-2">
              {t.title && <h5 className="font-bold text-sm">{t.title}</h5>}
              {t.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* 3-Second Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50 overflow-hidden">
              <div
                className={`h-full ${isDestructive ? "bg-red-500" : "bg-emerald-500"}`}
                style={{
                  animation: "toastCountdown 3s linear forwards",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
