// Web Worker for MuPDF WebAssembly vector-level text deletion and stream sanitization
// Offloads heavy Wasm computation and memory allocation to a background thread to ensure zero UI latency.

export interface RedactionItem {
  pageIndex: number;
  rect?: [number, number, number, number]; // [x0, y0, x1, y1] in MuPDF top-left coordinate system
  pdfRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WorkerInputMessage {
  id: string;
  type: "SANITIZE_AND_REDACT";
  pdfBuffer: ArrayBuffer;
  redactions: RedactionItem[];
}

export interface WorkerOutputMessage {
  id: string;
  success: boolean;
  sanitizedBuffer?: ArrayBuffer;
  error?: string;
}

// Lazy Wasm loader (compiled and loaded ONLY on demand when the first job arrives)
let mupdfModule: typeof import("mupdf") | null = null;

async function getMuPDF() {
  if (!mupdfModule) {
    if (typeof self !== "undefined") {
      (self as any).$libmupdf_wasm_Module = {
        locateFile: (path: string) => {
          if (path.endsWith(".wasm")) {
            return "/mupdf-wasm.wasm";
          }
          return path;
        },
      };
    }
    mupdfModule = await import("mupdf");
  }
  return mupdfModule;
}

self.onmessage = async (e: MessageEvent<WorkerInputMessage>) => {
  const { id, type, pdfBuffer, redactions } = e.data;

  if (type !== "SANITIZE_AND_REDACT") return;

  let doc: any = null;
  const loadedPages: any[] = [];

  try {
    // 1. Lazy load MuPDF WebAssembly
    const mupdf = await getMuPDF();

    // 2. Open PDF document from byte buffer
    doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const pdfDoc = doc.asPDF();

    if (!pdfDoc) {
      throw new Error("Failed to parse PDF document with MuPDF WebAssembly.");
    }

    // 3. Group redactions by pageIndex
    const redactionsByPage = new Map<number, RedactionItem[]>();
    for (const item of redactions) {
      const list = redactionsByPage.get(item.pageIndex) || [];
      list.push(item);
      redactionsByPage.set(item.pageIndex, list);
    }

    // 4. Apply vector-level redactions page by page
    redactionsByPage.forEach((items, pageIndex) => {
      const page = pdfDoc.loadPage(pageIndex);
      loadedPages.push(page);

      const bounds = page.getBounds();
      const pageHeight = bounds[3];
      const padding = 1.5;

      for (const item of items) {
        let rect = item.rect;
        if (!rect && item.pdfRect) {
          const x0 = Math.max(0, item.pdfRect.x - padding);
          const y0 = Math.max(0, pageHeight - (item.pdfRect.y + item.pdfRect.height) - padding);
          const x1 = item.pdfRect.x + item.pdfRect.width + padding;
          const y1 = pageHeight - item.pdfRect.y + padding;
          rect = [
            +x0.toFixed(2),
            +y0.toFixed(2),
            +x1.toFixed(2),
            +y1.toFixed(2),
          ];
        }
        if (!rect) continue;

        const redact = page.createAnnotation("Redact");
        redact.setRect(rect);
        redact.update();
      }

      // page.applyRedactions(black_boxes, image_method, line_art_method, text_method)
      // black_boxes: false -> permanently strips text operators and glyphs from stream without drawing black boxes
      page.applyRedactions(false, 0, 0, 0);
    });

    // 5. Save the sanitized, vector-cleaned PDF into an independent JS ArrayBuffer
    const cleanBytes = pdfDoc.saveToBuffer("").asUint8Array();
    const cleanCopy = new Uint8Array(cleanBytes.length);
    cleanCopy.set(cleanBytes);
    const cleanBuffer = cleanCopy.buffer;

    // 6. CRITICAL: Free C++ memory pointers to prevent Wasm Out-Of-Memory crashes
    for (const page of loadedPages) {
      try {
        page.destroy();
      } catch (err) {
        console.warn("Failed to destroy page pointer:", err);
      }
    }
    loadedPages.length = 0;

    try {
      doc.destroy();
    } catch (err) {
      console.warn("Failed to destroy doc pointer:", err);
    }
    doc = null;

    // 7. Post the sanitized buffer back using zero-copy Transferable
    (self as unknown as Worker).postMessage(
      {
        id,
        success: true,
        sanitizedBuffer: cleanBuffer,
      },
      [cleanBuffer]
    );
  } catch (err: any) {
    // Ensure memory cleanup even if an error occurs
    for (const page of loadedPages) {
      try {
        page.destroy();
      } catch {}
    }
    if (doc) {
      try {
        doc.destroy();
      } catch {}
    }

    (self as unknown as Worker).postMessage({
      id,
      success: false,
      error: err?.message || String(err),
    });
  }
};
