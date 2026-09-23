"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

interface PageThumbnailProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}

export function PageThumbnail({
  pdfDoc,
  pageNum,
  isActive,
  onClick,
}: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderThumbnail = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled || !canvasRef.current) return;

        // Compact thumbnail width ~100px
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const thumbScale = 100 / unscaledViewport.width;
        const viewport = page.getViewport({ scale: thumbScale });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderContext: any = {
          canvasContext: ctx,
          viewport: viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn(`Thumbnail render note for page ${pageNum}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    };
  }, [pdfDoc, pageNum]);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg p-1 cursor-pointer transition-all shrink-0 ${
        isActive
          ? "ring-2 ring-blue-600 bg-blue-50/40 shadow-sm"
          : "hover:ring-1 hover:ring-blue-400 bg-white/70 hover:bg-white opacity-85 hover:opacity-100"
      }`}
    >
      <div className="w-full bg-white rounded-md shadow-2xs border border-border/50 overflow-hidden flex items-center justify-center relative">
        {pdfDoc ? (
          <>
            <canvas
              ref={canvasRef}
              className={`w-full h-auto block object-contain transition-opacity duration-150 ${
                rendered ? "opacity-100" : "opacity-0"
              }`}
            />
            {!rendered && (
              <div className="h-16 flex items-center justify-center text-[10px] text-muted-foreground/50 font-medium">
                P.{pageNum}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-16 p-1.5 flex flex-col justify-between bg-white">
            <div className="space-y-1 opacity-25">
              <div className="h-1 bg-slate-400 rounded w-3/4" />
              <div className="h-1 bg-slate-300 rounded w-full" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground text-center">
              {pageNum}
            </span>
          </div>
        )}

        {/* Floating Compact Page Badge */}
        <div className={`absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs ${
          isActive 
            ? "bg-blue-600 text-white" 
            : "bg-slate-900/60 text-white backdrop-blur-xs group-hover:bg-slate-900/80"
        }`}>
          {pageNum}
        </div>
      </div>
    </div>
  );
}
