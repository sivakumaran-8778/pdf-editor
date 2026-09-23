"use client";

import { useRef, useCallback, useEffect } from "react";
import type { RedactionItem } from "@/workers/mupdf.worker";

export interface TextBlockCoordinate {
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  pageHeight?: number;
}

export interface ReactBoundingBoxCoordinate {
  pageIndex: number;
  vx: number;
  vy: number;
  vWidth: number;
  vHeight: number;
  scale: number;
}

/**
 * Maps standard bottom-left PDF coordinates (as used by PDF.js and pdf-lib)
 * to MuPDF's top-left coordinate system [x0, y0, x1, y1].
 * Includes 1.5pt safety padding to eliminate any edge glyph slivers.
 */
export function mapPdfToMuPdfRect(
  pdfX: number,
  pdfY: number,
  pdfWidth: number,
  pdfHeight: number,
  pageHeight: number = 841.89,
  padding: number = 1.5
): [number, number, number, number] {
  // Standard PDF: y=0 is at page bottom.
  // MuPDF: y=0 is at page top.
  const x0 = Math.max(0, pdfX - padding);
  const y0 = Math.max(0, pageHeight - (pdfY + pdfHeight) - padding);
  const x1 = pdfX + pdfWidth + padding;
  const y1 = pageHeight - pdfY + padding;

  return [
    +x0.toFixed(2),
    +y0.toFixed(2),
    +x1.toFixed(2),
    +y1.toFixed(2),
  ];
}

/**
 * Maps React <div> viewport bounding box (vx, vy, vWidth, vHeight) at current zoom scale
 * to MuPDF's top-left point system [x0, y0, x1, y1].
 * Both systems share top-left (0,0) orientation.
 */
export function mapReactDivToMuPdfRect(
  vx: number,
  vy: number,
  vWidth: number,
  vHeight: number,
  scale: number,
  padding: number = 1.5
): [number, number, number, number] {
  const safeScale = scale > 0 ? scale : 1.0;
  const x0 = Math.max(0, (vx - padding) / safeScale);
  const y0 = Math.max(0, (vy - padding) / safeScale);
  const x1 = (vx + vWidth + padding) / safeScale;
  const y1 = (vy + vHeight + padding) / safeScale;

  return [
    +x0.toFixed(2),
    +y0.toFixed(2),
    +x1.toFixed(2),
    +y1.toFixed(2),
  ];
}

export function useMuPDF() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<
    Map<
      string,
      {
        resolve: (buf: ArrayBuffer) => void;
        reject: (err: Error) => void;
      }
    >
  >(new Map());

  // Lazily spawn worker on first actual demand
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/mupdf.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = (e: MessageEvent) => {
        const { id, success, sanitizedBuffer, error } = e.data;
        const pending = pendingRequestsRef.current.get(id);
        if (!pending) return;
        pendingRequestsRef.current.delete(id);

        if (success && sanitizedBuffer) {
          pending.resolve(sanitizedBuffer);
        } else {
          pending.reject(new Error(error || "MuPDF vector redaction failed."));
        }
      };

      workerRef.current.onerror = (err) => {
        console.error("MuPDF Web Worker runtime error:", err);
        pendingRequestsRef.current.forEach((pending) => {
          pending.reject(new Error(err.message || "Web Worker crashed."));
        });
        pendingRequestsRef.current.clear();
      };
    }
    return workerRef.current;
  }, []);

  // Terminate worker on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRequestsRef.current.clear();
    };
  }, []);

  /**
   * Sanitizes the PDF ArrayBuffer by permanently stripping text and vector operators
   * at the specified page coordinates using the MuPDF WebAssembly engine.
   * Runs in the background Web Worker with zero main-thread UI latency.
   */
  const sanitizePdfStream = useCallback(
    async (
      pdfBuffer: ArrayBuffer,
      redactions: RedactionItem[]
    ): Promise<ArrayBuffer> => {
      if (!pdfBuffer || redactions.length === 0) {
        return pdfBuffer;
      }

      const worker = getWorker();
      const id = `mupdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      return new Promise<ArrayBuffer>((resolve, reject) => {
        pendingRequestsRef.current.set(id, { resolve, reject });

        // Copy buffer to ensure transfer does not detach caller's buffer
        const bufferCopy = pdfBuffer.slice(0);
        worker.postMessage(
          {
            id,
            type: "SANITIZE_AND_REDACT",
            pdfBuffer: bufferCopy,
            redactions,
          },
          [bufferCopy]
        );
      });
    },
    [getWorker]
  );

  return {
    sanitizePdfStream,
    mapPdfToMuPdfRect,
    mapReactDivToMuPdfRect,
  };
}
