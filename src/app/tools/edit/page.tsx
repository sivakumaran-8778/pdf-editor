"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Type, 
  MousePointer2, 
  Eraser, 
  Download, 
  Upload,
  PlusCircle, 
  ZoomIn, 
  ZoomOut, 
  Trash2, 
  Check, 
  RotateCcw,
  Bold,
  Italic,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Palette,
  PanelLeftClose,
  PanelLeft,
  FileText,
  Eye,
  FilePlus,
  ArrowLeft,
  Undo2,
  Redo2,
  Minimize2,
  ChevronsLeftRight,
  Highlighter,
  PenTool,
  MessageSquare,
  FormInput,
  Image as ImageIcon,
  Copy,
  Hand,
  CheckCircle2,
  Move,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Shapes,
  Triangle,
  Star,
  ArrowLeftRight,
  X,
  ChevronDown,
  Ban,
  Slash,
  Paintbrush
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Modular editor imports
import { HistoryManager } from "@/lib/pdf-editor/history";
import { findNearestTypography } from "@/lib/pdf-editor/font-matcher";
import { FloatingToolbar, FONT_FAMILIES, COLOR_SWATCHES } from "@/components/editor/FloatingToolbar";
import { TransformBoundingBox } from "@/components/editor/TransformBoundingBox";
import { FreehandCanvas, DrawingStroke } from "@/components/editor/FreehandCanvas";
import { FormPalette, FormFieldItem, FormFieldType } from "@/components/editor/FormPalette";
import { CommentsDrawer, CommentItem } from "@/components/editor/CommentsDrawer";
import { PageThumbnail } from "@/components/editor/PageThumbnail";
import { detectPageImages, DetectedPdfImage } from "@/lib/pdf-editor/image-detector";
import { useMuPDF, mapPdfToMuPdfRect } from "@/hooks/useMuPDF";
import type { RedactionItem } from "@/workers/mupdf.worker";
import { clusterPdfTextItems } from "@/lib/pdf-editor/spatial-clustering";
import { embedCustomOrStandardFont, sanitizeTextForPdf } from "@/lib/pdf-editor/font-registry";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Normalizes raw PDF.js colors (which can be strings, RGB arrays, or objects) into a valid CSS color string.
 */
function normalizeCssColor(color: any): string {
  if (!color) return "";
  if (typeof color === "string") {
    const trimmed = color.trim();
    if (trimmed === "transparent" || trimmed === "rgba(0, 0, 0, 0)") return "";
    return trimmed;
  }
  if (Array.isArray(color) || (typeof color === "object" && color !== null && "length" in color && typeof color[0] === "number")) {
    const arr = Array.from(color as ArrayLike<number>);
    if (arr.length >= 3) {
      const isNormalized = arr.slice(0, 3).every(v => v >= 0 && v <= 1) && arr.slice(0, 3).some(v => v > 0 && v < 1);
      const r = isNormalized ? Math.round(arr[0] * 255) : Math.round(arr[0]);
      const g = isNormalized ? Math.round(arr[1] * 255) : Math.round(arr[1]);
      const b = isNormalized ? Math.round(arr[2] * 255) : Math.round(arr[2]);
      const a = arr.length > 3 ? (arr[3] <= 1 ? arr[3] : arr[3] / 255) : 1;
      return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
    }
  }
  if (typeof color === "object" && color !== null) {
    if ("r" in color && "g" in color && "b" in color) {
      const isNorm = color.r <= 1 && color.g <= 1 && color.b <= 1 && (color.r > 0 || color.g > 0 || color.b > 0);
      const r = isNorm ? Math.round(color.r * 255) : Math.round(color.r);
      const g = isNorm ? Math.round(color.g * 255) : Math.round(color.g);
      const b = isNorm ? Math.round(color.b * 255) : Math.round(color.b);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "";
}

// Convert any color (hex, rgb, named, or raw array/object) to pdf-lib rgb(r, g, b)
function parseColorToRgb(colorInput?: any) {
  if (!colorInput) return rgb(0, 0, 0);
  const colorStr = normalizeCssColor(colorInput) || (typeof colorInput === "string" ? colorInput : "") || "#000000";
  const c = colorStr.trim().toLowerCase();
  if (c === "red") return rgb(0.93, 0.27, 0.27);
  if (c === "blue") return rgb(0.15, 0.39, 0.92);
  if (c === "green") return rgb(0.09, 0.64, 0.29);
  if (c === "gray" || c === "grey") return rgb(0.39, 0.45, 0.55);
  if (c === "black") return rgb(0, 0, 0);
  if (c === "white") return rgb(1, 1, 1);
  if (c.startsWith("rgb")) {
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return rgb(
        parseInt(match[1], 10) / 255 || 0,
        parseInt(match[2], 10) / 255 || 0,
        parseInt(match[3], 10) / 255 || 0
      );
    }
  }
  if (c.startsWith("#")) {
    const hex = c.replace("#", "");
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return rgb(r || 0, g || 0, b || 0);
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return rgb(r || 0, g || 0, b || 0);
    }
  }
  return rgb(0, 0, 0);
}

// Map font family value to CSS style
function getFontFamilyCss(family?: string) {
  const match = FONT_FAMILIES.find(f => f.value === family || f.name === family);
  return match?.css || family || "sans-serif";
}

let measureCanvasCtx: CanvasRenderingContext2D | null = null;

function measureExactVisualWidth(
  text: string,
  fontSize: number,
  fontFamily: string = "sans-serif",
  fontWeight: string = "normal",
  fontStyle: string = "normal"
): number {
  if (!text || text.length === 0) return 0;
  if (text.includes("\n")) {
    const lines = text.split("\n");
    let maxW = 0;
    for (const l of lines) {
      const w = measureExactVisualWidth(l, fontSize, fontFamily, fontWeight, fontStyle);
      if (w > maxW) maxW = w;
    }
    return maxW;
  }
  if (typeof document === "undefined") {
    return text.length * fontSize * 0.55;
  }
  if (!measureCanvasCtx) {
    const canvas = document.createElement("canvas");
    measureCanvasCtx = canvas.getContext("2d");
  }
  if (!measureCanvasCtx) {
    return text.length * fontSize * 0.55;
  }
  const cssFont = getFontFamilyCss(fontFamily);
  measureCanvasCtx.font = `${fontStyle} ${fontWeight} ${Math.max(fontSize, 1)}px ${cssFont}`;
  return measureCanvasCtx.measureText(text).width;
}

function measureExactTextWidth(
  text: string,
  fontSizePx: number,
  fontFamily?: string,
  isBold = false,
  isItalic = false
): number {
  return measureExactVisualWidth(
    text,
    fontSizePx,
    fontFamily || "sans-serif",
    isBold ? "bold" : "normal",
    isItalic ? "italic" : "normal"
  );
}

function computeLetterSpacing(text: string, targetWidth: number, naturalWidth: number): number {
  if (!text || text.length <= 1 || targetWidth <= 0 || naturalWidth <= 0) return 0;
  const delta = targetWidth - naturalWidth;
  const perChar = delta / (text.length - 1);
  if (perChar >= -2.5 && perChar <= 4) {
    return +perChar.toFixed(2);
  }
  return 0;
}

export interface RichTextSpan {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  fontFamily?: string;
  fontSize: number;
}

/**
 * Parse an HTML string generated by contenteditable rich formatting into sequential styled spans
 */
function parseRichTextSpans(
  html: string,
  defaultFontFamily?: string,
  defaultFontSize: number = 12,
  defaultColor: string = "#000000",
  defaultBold: boolean = false,
  defaultItalic: boolean = false
): RichTextSpan[] {
  if (typeof document === "undefined" || !html) {
    return [{
      text: (html || "").replace(/<[^>]*>/g, ""),
      isBold: defaultBold,
      isItalic: defaultItalic,
      color: defaultColor,
      fontFamily: defaultFontFamily,
      fontSize: defaultFontSize,
    }];
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const spans: RichTextSpan[] = [];

  function traverse(node: Node, state: { isBold: boolean; isItalic: boolean; color: string; fontFamily?: string; fontSize: number }) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.length > 0) {
        spans.push({
          text,
          ...state,
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const nextState = { ...state };

      if (tag === "b" || tag === "strong" || el.style.fontWeight === "bold" || parseInt(el.style.fontWeight, 10) >= 600) {
        nextState.isBold = true;
      }
      if (el.style.fontWeight === "normal" || el.style.fontWeight === "400") {
        nextState.isBold = false;
      }
      if (tag === "i" || tag === "em" || el.style.fontStyle === "italic") {
        nextState.isItalic = true;
      }
      if (el.style.fontStyle === "normal") {
        nextState.isItalic = false;
      }
      if (el.style.color) {
        nextState.color = el.style.color;
      } else if (el.getAttribute("color")) {
        nextState.color = el.getAttribute("color")!;
      }
      if (el.style.fontFamily) {
        nextState.fontFamily = el.style.fontFamily;
      } else if (el.getAttribute("face")) {
        nextState.fontFamily = el.getAttribute("face")!;
      }
      if (el.getAttribute("data-pdf-font-size")) {
        const parsed = parseFloat(el.getAttribute("data-pdf-font-size")!);
        if (!isNaN(parsed) && parsed > 0) nextState.fontSize = parsed;
      } else if (el.style.fontSize) {
        const parsed = parseFloat(el.style.fontSize);
        if (!isNaN(parsed) && parsed > 0) nextState.fontSize = parsed;
      }

      if (tag === "br") {
        spans.push({
          text: "\n",
          ...nextState,
        });
        return;
      }

      if ((tag === "div" || tag === "p") && spans.length > 0) {
        const last = spans[spans.length - 1];
        if (last && !last.text.endsWith("\n")) {
          spans.push({
            text: "\n",
            ...nextState,
          });
        }
      }

      node.childNodes.forEach(child => traverse(child, nextState));
    }
  }

  traverse(container, {
    isBold: defaultBold,
    isItalic: defaultItalic,
    color: defaultColor,
    fontFamily: defaultFontFamily,
    fontSize: defaultFontSize,
  });

  return spans.length > 0 ? spans : [{
    text: container.innerText || "",
    isBold: defaultBold,
    isItalic: defaultItalic,
    color: defaultColor,
    fontFamily: defaultFontFamily,
    fontSize: defaultFontSize,
  }];
}

/**
 * Dynamically sample the background color from the active pdf.js canvas.
 * Samples at the vertical center shifted 6px left to capture pure background color free from text antialiasing.
 * Converts average RGB values to a Hex string. Falls back to '#ffffff' if sampling fails or alpha is 0.
 */
function sampleCanvasBackgroundColor(
  canvas: HTMLCanvasElement | null,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  if (!canvas) return "#ffffff";
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
  if (!ctx) return "#ffffff";

  // Account for High-DPI / retina scaling of the canvas bitmap
  const cssWidth = parseFloat(canvas.style.width) || canvas.clientWidth || canvas.width;
  const dpr = canvas.width / (cssWidth || 1);

  // Sample multiple strategic points: inner corners (least likely to hit text glyphs) plus edge borders
  const pointsToSample = [
    { px: Math.max(0, x + 2), py: Math.max(0, y + 2) },
    { px: Math.max(0, x + width - 3), py: Math.max(0, y + 2) },
    { px: Math.max(0, x + 2), py: Math.max(0, y + height - 3) },
    { px: Math.max(0, x + width - 3), py: Math.max(0, y + height - 3) },
    { px: Math.max(0, Math.floor(x - 5)), py: Math.max(0, Math.floor(y + (height / 2))) },
    { px: Math.max(0, Math.floor(x + width + 5)), py: Math.max(0, Math.floor(y + (height / 2))) },
    { px: Math.max(0, Math.floor(x + width / 2)), py: Math.max(0, Math.floor(y - 5)) },
  ];

  const colorCounts: { [hex: string]: { r: number; g: number; b: number; count: number } } = {};
  let totalR = 0, totalG = 0, totalB = 0, totalSamples = 0;

  for (const pt of pointsToSample) {
    const sx = Math.round(pt.px * dpr);
    const sy = Math.round(pt.py * dpr);

    if (sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height) {
      try {
        const pixel = ctx.getImageData(sx, sy, 1, 1).data;
        if (pixel[3] > 40) {
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];
          // Round to nearest 8 to group subtle anti-aliased shades
          const quantKey = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
          if (!colorCounts[quantKey]) {
            colorCounts[quantKey] = { r, g, b, count: 0 };
          }
          colorCounts[quantKey].count++;
          totalR += r;
          totalG += g;
          totalB += b;
          totalSamples++;
        }
      } catch {
        // Fall through gracefully
      }
    }
  }

  // Find dominant background cluster
  let dominantColor: { r: number; g: number; b: number; count: number } | null = null;
  for (const key of Object.keys(colorCounts)) {
    if (!dominantColor || colorCounts[key].count > dominantColor.count) {
      dominantColor = colorCounts[key];
    }
  }

  if (dominantColor && dominantColor.count >= 2) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    return `#${toHex(dominantColor.r)}${toHex(dominantColor.g)}${toHex(dominantColor.b)}`;
  }

  if (totalSamples > 0) {
    const avgR = Math.round(totalR / totalSamples);
    const avgG = Math.round(totalG / totalSamples);
    const avgB = Math.round(totalB / totalSamples);
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    return `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
  }

  return "#ffffff";
}

/**
 * Determine if a hex or rgb color is perceptually dark using standard luminance formula
 */
function isColorDark(colorStr?: string): boolean {
  if (!colorStr) return false;
  let r = 255, g = 255, b = 255;
  if (colorStr.startsWith("#")) {
    const hex = colorStr.replace("#", "");
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) || 0;
      g = parseInt(hex[1] + hex[1], 16) || 0;
      b = parseInt(hex[2] + hex[2], 16) || 0;
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16) || 0;
      g = parseInt(hex.substring(2, 4), 16) || 0;
      b = parseInt(hex.substring(4, 6), 16) || 0;
    }
  } else if (colorStr.startsWith("rgb")) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10) || 0;
      g = parseInt(match[2], 10) || 0;
      b = parseInt(match[3], 10) || 0;
    }
  }
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128;
}

/**
 * Sample the text font color inside the text bounding box against the sampled background color
 * Guaranteed high-contrast fallback so words NEVER disappear on dark or light backgrounds.
 */
function sampleCanvasTextColor(
  canvas: HTMLCanvasElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  bgHex: string
): string {
  const isDarkBg = isColorDark(bgHex);
  const fallbackColor = isDarkBg ? "#ffffff" : "#000000";
  if (!canvas) return fallbackColor;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
  if (!ctx) return fallbackColor;

  const cssWidth = parseFloat(canvas.style.width) || canvas.clientWidth || canvas.width;
  const dpr = canvas.width / (cssWidth || 1);

  // Background RGB
  const bgR = parseInt(bgHex.slice(1, 3), 16) || 255;
  const bgG = parseInt(bgHex.slice(3, 5), 16) || 255;
  const bgB = parseInt(bgHex.slice(5, 7), 16) || 255;

  const sx = Math.max(0, Math.round((x + 1) * dpr));
  const sy = Math.max(0, Math.round((y + 1) * dpr));
  const sw = Math.min(canvas.width - sx, Math.max(1, Math.round((width - 2) * dpr)));
  const sh = Math.min(canvas.height - sy, Math.max(1, Math.round((height - 2) * dpr)));

  if (sw <= 0 || sh <= 0) return fallbackColor;

  try {
    const imgData = ctx.getImageData(sx, sy, sw, sh).data;
    let maxDist = 0;
    let bestR = isDarkBg ? 255 : 0;
    let bestG = isDarkBg ? 255 : 0;
    let bestB = isDarkBg ? 255 : 0;

    for (let i = 0; i < imgData.length; i += 4 * 2) {
      const a = imgData[i + 3];
      if (a < 50) continue;
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
      if (dist > maxDist) {
        maxDist = dist;
        bestR = r;
        bestG = g;
        bestB = b;
      }
    }

    if (maxDist > 65) {
      const hexCandidate = `#${bestR.toString(16).padStart(2, "0")}${bestG.toString(16).padStart(2, "0")}${bestB.toString(16).padStart(2, "0")}`;
      const candidateDark = isColorDark(hexCandidate);
      // Ensure candidate has proper contrast with background:
      if (isDarkBg && !candidateDark) return hexCandidate; // light text on dark bg
      if (!isDarkBg && candidateDark) return hexCandidate; // dark text on light bg
    }
  } catch {
    // Fallback on error
  }

  return fallbackColor;
}

// Extracted text block from existing PDF
interface ExistingTextBlock {
  id: string;
  pageIndex: number;
  originalText: string;
  currentText: string;
  origPdfX?: number;
  origPdfY?: number;
  origPdfWidth?: number;
  origPdfHeight?: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  fontSize: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  fontWeight?: "bold" | "normal" | string;
  fontStyle?: "italic" | "normal" | string;
  color?: string;
  alignment?: "left" | "center" | "right";
  textAlign?: "left" | "center" | "right";
  zIndex?: number;
  isModified: boolean;
  isDeleted: boolean;
  isManuallyResized?: boolean;
  vx: number;
  vy: number;
  vWidth: number;
  vHeight: number;
  origVx?: number;
  origVy?: number;
  origVWidth?: number;
  origVHeight?: number;
  letterSpacing?: number;
  bgColor?: string;
  maskColor?: string;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  firstLinePdfY?: number;
  lineCount?: number;
  rotation?: number;
  richHtml?: string;
  children?: { x: number; y: number; width: number; height: number; text: string }[];
  origFontFamily?: string;
  origFontSize?: number;
  origIsBold?: boolean;
  origIsItalic?: boolean;
  origColor?: string;
}

// Static Mask for Original PDF Text ("Static Mask + Transparent Overlay" Pattern)
export interface OriginalTextMask {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

/**
 * Accurately determines if an existing text block has been modified by the user.
 * Guards against false positives from detected PDF bold/italic/color flags.
 */
function checkIsBlockModified(block: ExistingTextBlock): boolean {
  if (block.isDeleted) return true;
  if (block.currentText !== block.originalText) return true;

  // Position change check (PDF coordinates)
  if (block.origPdfX !== undefined && Math.abs(block.pdfX - block.origPdfX) > 2) return true;
  if (block.origPdfY !== undefined && Math.abs(block.pdfY - block.origPdfY) > 2) return true;

  // Explicit user resizing
  if (block.isManuallyResized) return true;

  // Font size change
  if (block.origFontSize !== undefined && Math.abs(block.fontSize - block.origFontSize) > 0.5) return true;

  // Font family change
  if (block.origFontFamily !== undefined && block.fontFamily !== block.origFontFamily) return true;

  // Bold formatting change
  const curIsBold = block.fontWeight === "bold" || !!block.isBold;
  if (block.origIsBold !== undefined && curIsBold !== !!block.origIsBold) return true;

  // Italic formatting change
  const curIsItalic = block.fontStyle === "italic" || !!block.isItalic;
  if (block.origIsItalic !== undefined && curIsItalic !== !!block.origIsItalic) return true;

  // Color change
  if (block.origColor !== undefined && block.color) {
    const curNorm = normalizeCssColor(block.color);
    const origNorm = normalizeCssColor(block.origColor);
    if (curNorm && origNorm && curNorm !== origNorm) return true;
  }

  // Rich HTML change
  if (block.richHtml && block.richHtml !== block.originalText && block.richHtml !== block.currentText) {
    if (/<(b|strong|i|em|span|font|mark)\b/i.test(block.richHtml)) return true;
  }

  // Fallback if orig values were not captured
  if (block.origFontSize === undefined && block.isModified) return true;

  return false;
}

// Floating custom element (Text, Image, Redaction, Highlight, Shapes, Arrows)
interface CustomElement {
  id: string;
  pageIndex: number;
  type: "text" | "image" | "redaction" | "highlight" | "whiteout" | "rect" | "rounded-rect" | "circle" | "triangle" | "star" | "line" | "arrow" | "double-arrow" | "callout" | "check" | "cross";
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  rotation: number;
  zIndex: number;
  // Specific data
  text?: string;
  currentText?: string;
  richHtml?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
  isBold?: boolean;
  isItalic?: boolean;
  alignment?: "left" | "center" | "right";
  textAlign?: "left" | "center" | "right";
  imageUrl?: string;
  aspectRatioLocked?: boolean;
  startPdfX?: number;
  startPdfY?: number;
  endPdfX?: number;
  endPdfY?: number;
}

// High-fidelity in-place text editor (Sejda / PDFgear grade zero-shift contenteditable)
function InPlaceTextEditor({
  block,
  scale,
  isEditing = false,
  onCommit,
  onCancel,
  onStartDrag,
  onStartEditing,
  onTextChange,
}: {
  block: ExistingTextBlock;
  scale: number;
  isEditing?: boolean;
  onCommit: (text: string) => void;
  onCancel: () => void;
  onStartDrag?: (e: React.PointerEvent) => void;
  onStartEditing?: () => void;
  onTextChange?: (newText: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<string>(block.currentText);

  // Auto-focus and place caret cleanly at the end without jumping when actively editing
  const prevIsEditingRef = useRef(false);
  const prevBlockIdRef = useRef(block.id);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const justStartedEditing = isEditing && !prevIsEditingRef.current;
    const blockChanged = block.id !== prevBlockIdRef.current;
    prevIsEditingRef.current = !!isEditing;
    prevBlockIdRef.current = block.id;

    if (justStartedEditing || blockChanged) {
      if (block.richHtml) {
        el.innerHTML = block.richHtml;
      } else {
        el.innerText = block.currentText;
      }
      textRef.current = block.currentText;
      el.focus();
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {}
    } else if (!isEditing) {
      if (block.richHtml) {
        el.innerHTML = block.richHtml;
      } else {
        el.innerText = block.currentText;
      }
      textRef.current = block.currentText;
    }
  }, [block.id, block.richHtml, isEditing]);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  // Keep DOM text synced when block.currentText or block.richHtml changes while NOT editing (undo/redo, typography)
  useEffect(() => {
    if (!isEditing && editorRef.current) {
      if (block.richHtml) {
        editorRef.current.innerHTML = block.richHtml;
      } else {
        editorRef.current.innerText = block.currentText;
      }
      textRef.current = block.currentText;
    }
  }, [block.currentText, block.richHtml, isEditing]);
  // Keystrokes are synced live via handleInput, and committed on handleBlur or Enter.

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    const html = e.currentTarget.innerHTML;
    textRef.current = text;
    block.currentText = text;
    if (html && /<(b|strong|i|em|span|font|mark)\b/i.test(html)) {
      block.richHtml = html;
    } else {
      block.richHtml = undefined;
    }
    block.isModified = true;

    // Dynamically expand width while typing if not manually resized to prevent premature wrapping
    if (!block.isManuallyResized) {
      const effectiveSizePx = block.fontSize * scale;
      const fontWeight = block.fontWeight || (block.isBold ? "bold" : "normal");
      const fontStyle = block.fontStyle || (block.isItalic ? "italic" : "normal");
      const visualWidth = measureExactVisualWidth(
        text,
        effectiveSizePx,
        block.fontFamily,
        fontWeight,
        fontStyle
      );
      const dynamicBleed = Math.max(effectiveSizePx * 0.2, 8);
      const newW = Math.max(visualWidth + dynamicBleed, block.origVWidth || 0, 16);
      block.vWidth = newW;
      block.pdfWidth = newW / scale;
      if (containerRef.current) {
        containerRef.current.style.width = `${newW}px`;
      }
      if (editorRef.current) {
        editorRef.current.style.width = `${newW}px`;
      }
    }

    if (editorRef.current && containerRef.current) {
      const scrollH = editorRef.current.scrollHeight;
      const newH = Math.max(scrollH, block.vHeight, 16);
      containerRef.current.style.height = `${newH}px`;
      editorRef.current.style.minHeight = `${newH}px`;
      block.vHeight = newH;
      block.pdfHeight = newH / scale;
    }

    onTextChange?.(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const text = editorRef.current?.innerText ?? textRef.current;
      const html = editorRef.current?.innerHTML;
      if (html && /<(b|strong|i|em|span|font|mark)\b/i.test(html)) {
        block.richHtml = html;
      } else {
        block.richHtml = undefined;
      }
      onCommit(text);
    } else if (e.key === "Enter" && !e.shiftKey && !block.currentText.includes("\n")) {
      e.preventDefault();
      const text = editorRef.current?.innerText ?? textRef.current;
      const html = editorRef.current?.innerHTML;
      if (html && /<(b|strong|i|em|span|font|mark)\b/i.test(html)) {
        block.richHtml = html;
      } else {
        block.richHtml = undefined;
      }
      onCommit(text);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const text = editorRef.current?.innerText ?? textRef.current;
    const html = editorRef.current?.innerHTML;
    if (html && /<(b|strong|i|em|span|font|mark)\b/i.test(html)) {
      block.richHtml = html;
    } else {
      block.richHtml = undefined;
    }
    onCommit(text);
  };

  // Reflow height whenever block.vWidth changes (from TransformBoundingBox handle dragging)
  useEffect(() => {
    if (editorRef.current && containerRef.current) {
      const scrollH = editorRef.current.scrollHeight;
      if (scrollH > block.vHeight) {
        containerRef.current.style.height = `${scrollH}px`;
        block.vHeight = scrollH;
        block.pdfHeight = scrollH / scale;
      }
    }
  }, [block.vWidth, block.currentText, scale]);

  const isDarkMask = block.maskColor ? isColorDark(block.maskColor) : false;
  const rawColor = normalizeCssColor(block.color);
  let safeColor = (rawColor && rawColor !== "transparent" && rawColor !== "rgba(0, 0, 0, 0)")
    ? rawColor
    : (isDarkMask ? "#ffffff" : "#000000");

  // Strict Contrast Guard: Ensure words never disappear on dark or light masks
  if (isDarkMask && isColorDark(safeColor)) {
    safeColor = "#ffffff";
  } else if (!isDarkMask && !isColorDark(safeColor)) {
    safeColor = "#000000";
  }

  return (
    <div
      ref={containerRef}
      data-block-id={block.id}
      className={`w-full h-full relative flex items-start bg-transparent ${
        isEditing ? "pointer-events-auto select-text" : "pointer-events-none select-none"
      }`}
      style={{
        width: `${block.vWidth}px`,
        minHeight: `${block.vHeight}px`,
        backgroundColor: "transparent",
        textAlign: block.textAlign || block.alignment || "left",
        zIndex: block.zIndex || 10,
      }}
      onClick={(e) => {
        if (isEditing) e.stopPropagation();
      }}
      onPointerDown={(e) => {
        if (isEditing) e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEditing?.();
      }}
    >
      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
        spellCheck={false}
        onPointerDown={(e) => {
          if (isEditing) e.stopPropagation();
        }}
        onClick={(e) => {
          if (isEditing) e.stopPropagation();
        }}
        onInput={handleInput}
        onKeyDown={(e) => {
          e.stopPropagation();
          handleKeyDown(e);
        }}
        onBlur={handleBlur}
        className={`w-full h-full border-none focus:outline-none bg-transparent p-0 m-0 ${
          isEditing 
            ? "cursor-text select-text pointer-events-auto" 
            : "cursor-default select-none pointer-events-none"
        }`}
        style={{
          width: `${block.vWidth}px`,
          minHeight: `${block.vHeight}px`,
          fontSize: `${block.fontSize * scale}px`,
          fontFamily: getFontFamilyCss(block.fontFamily),
          color: safeColor,
          fontWeight: (block.fontWeight === "bold" || block.isBold) ? "bold" : "normal",
          fontStyle: (block.fontStyle === "italic" || block.isItalic) ? "italic" : "normal",
          textAlign: block.textAlign || block.alignment || "left",
          zIndex: block.zIndex || 10,
          whiteSpace: (!block.isManuallyResized && !block.currentText.includes("\n")) ? "nowrap" : "pre-wrap",
          wordWrap: "break-word",
          overflowWrap: "break-word",
          lineHeight: 1.25,
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
          letterSpacing: block.letterSpacing ? `${block.letterSpacing}px` : "normal",
          paddingLeft: "1px",
          paddingRight: "1px",
        }}
      />
    </div>
  );
}

export default function EditTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("document.pdf");
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"pages" | "forms" | "comments">("pages");
  const [previewMode, setPreviewMode] = useState(false);
  
  // Tool Modes
  const [activeTool, setActiveTool] = useState<
    "select" | "hand" | "edit" | "addText" | "draw" | "highlight" | "whiteout" | "redact" | "comment" | "rect" | "rounded-rect" | "circle" | "triangle" | "star" | "line" | "arrow" | "double-arrow" | "callout" | "check" | "cross"
  >("edit");

  // Shape Library & Customization State
  const [activeShape, setActiveShape] = useState<"rect" | "rounded-rect" | "circle" | "triangle" | "star" | "line" | "arrow" | "double-arrow" | "callout" | "check" | "cross">("rect");
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const [activeFillColor, setActiveFillColor] = useState<string>("transparent");
  const [activeStrokeStyle, setActiveStrokeStyle] = useState<"solid" | "dashed">("solid");

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isDetectingFields, setIsDetectingFields] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  // Free-form Zoom state
  const [zoomInputFocused, setZoomInputFocused] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("");

  // PDF Export Live Preview State
  const [exportPreviewData, setExportPreviewData] = useState<{
    url: string;
    blob: Blob;
    fileName: string;
    sizeKb: number;
    pageCount: number;
  } | null>(null);

  // MuPDF WebAssembly Vector Redaction Engine (Runs in background Web Worker ONLY during export)
  const { sanitizePdfStream } = useMuPDF();

  // Selection & Elements State
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const editingBlockIdRef = useRef<string | null>(editingBlockId);
  editingBlockIdRef.current = editingBlockId;
  const selectedElementIdRef = useRef<string | null>(selectedElementId);
  selectedElementIdRef.current = selectedElementId;
  const [pageTextBlocks, setPageTextBlocks] = useState<Record<number, ExistingTextBlock[]>>({});
  const [customElements, setCustomElements] = useState<CustomElement[]>([]);
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [formFields, setFormFields] = useState<FormFieldItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);

  // Detected Images & Masks
  const [detectedImages, setDetectedImages] = useState<Record<number, DetectedPdfImage[]>>({});
  const [maskedImageIds, setMaskedImageIds] = useState<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const openDocInputRef = useRef<HTMLInputElement>(null);

  // Active Styling Options
  const [activeFontSize, setActiveFontSize] = useState<number>(14);
  const [activeFontFamily, setActiveFontFamily] = useState<string>("Helvetica");
  const [activeColor, setActiveColor] = useState<string>("#000000");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(3);
  const [activeIsBold, setActiveIsBold] = useState<boolean>(false);
  const [activeIsItalic, setActiveIsItalic] = useState<boolean>(false);

  // Hand tool / Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Drag-to-create shape state for Whiteout, Redact, Highlight, Shapes & Arrows
  const [dragShape, setDragShape] = useState<{
    tool: "whiteout" | "redact" | "highlight" | "rect" | "rounded-rect" | "circle" | "triangle" | "star" | "line" | "arrow" | "double-arrow" | "callout" | "check" | "cross";
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const rawTextCacheRef = useRef<Record<number, any[]>>({});
  const rawPageSizeRef = useRef<{ width: number; height: number }>({ width: 595.28, height: 841.89 });
  const hasAutoFittedRef = useRef<boolean>(false);
  
  // State Refs for Synchronous History Snapshot Creation (Eliminates stale closure bugs)
  const pageTextBlocksRef = useRef(pageTextBlocks);
  pageTextBlocksRef.current = pageTextBlocks;
  const customElementsRef = useRef(customElements);
  customElementsRef.current = customElements;
  const drawingStrokesRef = useRef(drawingStrokes);
  drawingStrokesRef.current = drawingStrokes;
  const formFieldsRef = useRef(formFields);
  formFieldsRef.current = formFields;
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const maskedImageIdsRef = useRef(maskedImageIds);
  maskedImageIdsRef.current = maskedImageIds;

  // Track highlighted word/character selection inside contenteditable text blocks
  const savedSelectionRef = useRef<{ blockId: string; range: Range; text: string } | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const activeEl = document.activeElement;
      const editable = activeEl?.closest('[contenteditable="true"]') || (range.commonAncestorContainer as any)?.parentElement?.closest('[contenteditable="true"]');
      if (editable) {
        const blockContainer = editable.closest('[data-block-id]') || editable.closest('[data-custom-id]');
        const blockId = blockContainer?.getAttribute("data-block-id") || blockContainer?.getAttribute("data-custom-id");
        if (blockId) {
          savedSelectionRef.current = {
            blockId,
            range: range.cloneRange(),
            text: sel.toString(),
          };
        }
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  // History Manager for Undo / Redo
  const historyManager = useMemo(() => new HistoryManager<any>(40), []);
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const { toast } = useToast();

  // Record undo state snapshot with deep cloning and immediate ref synchronization
  const saveSnapshot = useCallback((
    description: string = "Edit", 
    overrides?: Record<number, ExistingTextBlock[]> | {
      pageTextBlocks?: Record<number, ExistingTextBlock[]>;
      customElements?: CustomElement[];
      drawingStrokes?: DrawingStroke[];
      formFields?: FormFieldItem[];
      comments?: CommentItem[];
      maskedImageIds?: string[];
    }
  ) => {
    let customBlocks: Record<number, ExistingTextBlock[]> | undefined;
    if (overrides) {
      if ("pageTextBlocks" in overrides || "customElements" in overrides || "drawingStrokes" in overrides || "formFields" in overrides || "comments" in overrides || "maskedImageIds" in overrides) {
        const o = overrides as any;
        if (o.pageTextBlocks) pageTextBlocksRef.current = o.pageTextBlocks;
        if (o.customElements) customElementsRef.current = o.customElements;
        if (o.drawingStrokes) drawingStrokesRef.current = o.drawingStrokes;
        if (o.formFields) formFieldsRef.current = o.formFields;
        if (o.comments) commentsRef.current = o.comments;
        if (o.maskedImageIds) maskedImageIdsRef.current = new Set(o.maskedImageIds);
      } else {
        // Direct map of text blocks passed
        customBlocks = overrides as Record<number, ExistingTextBlock[]>;
        pageTextBlocksRef.current = customBlocks;
      }
    }

    const blocksToSave = customBlocks 
      ? JSON.parse(JSON.stringify(customBlocks)) 
      : JSON.parse(JSON.stringify(pageTextBlocksRef.current));

    historyManager.pushState({
      pageTextBlocks: blocksToSave,
      customElements: JSON.parse(JSON.stringify(customElementsRef.current)),
      drawingStrokes: JSON.parse(JSON.stringify(drawingStrokesRef.current)),
      formFields: JSON.parse(JSON.stringify(formFieldsRef.current)),
      comments: JSON.parse(JSON.stringify(commentsRef.current)),
      maskedImageIds: Array.from(maskedImageIdsRef.current),
    }, description);
    setSaveStatus("saved");
    setHistoryVersion(v => v + 1);
  }, [historyManager]);

  // Centralized State Update for Existing Text Blocks (with Deep Copy Commit & isManuallyResized Guard)
  const updateBlock = useCallback((id: string, updates: Partial<ExistingTextBlock>, actionDescription?: string) => {
    let foundPageIdx: number | null = null;
    const prev = pageTextBlocksRef.current;
    for (const pIdxStr of Object.keys(prev)) {
      const pIdx = parseInt(pIdxStr, 10);
      if ((prev[pIdx] || []).some(b => b.id === id)) {
        foundPageIdx = pIdx;
        break;
      }
    }

    if (foundPageIdx === null) return;

    const blocks = prev[foundPageIdx] || [];
    const updatedBlocks = blocks.map(block => {
      if (block.id !== id) return block;

      const target: ExistingTextBlock = { ...block };
      target.isModified = true;

      // Copy non-typography/layout updates
      if (updates.vx !== undefined) target.vx = updates.vx;
      if (updates.vy !== undefined) target.vy = updates.vy;
      if (updates.vWidth !== undefined) target.vWidth = updates.vWidth;
      if (updates.vHeight !== undefined) target.vHeight = updates.vHeight;
      if (updates.origVx !== undefined) target.origVx = updates.origVx;
      if (updates.origVy !== undefined) target.origVy = updates.origVy;
      if (updates.origVWidth !== undefined) target.origVWidth = updates.origVWidth;
      if (updates.origVHeight !== undefined) target.origVHeight = updates.origVHeight;
      if (updates.pdfX !== undefined) target.pdfX = updates.pdfX;
      if (updates.pdfY !== undefined) target.pdfY = updates.pdfY;
      if (updates.pdfWidth !== undefined) target.pdfWidth = updates.pdfWidth;
      if (updates.pdfHeight !== undefined) target.pdfHeight = updates.pdfHeight;
      if (updates.origPdfX !== undefined) target.origPdfX = updates.origPdfX;
      if (updates.origPdfY !== undefined) target.origPdfY = updates.origPdfY;
      if (updates.origPdfWidth !== undefined) target.origPdfWidth = updates.origPdfWidth;
      if (updates.origPdfHeight !== undefined) target.origPdfHeight = updates.origPdfHeight;
      if (updates.rotation !== undefined) target.rotation = updates.rotation;
      if (updates.isManuallyResized !== undefined) target.isManuallyResized = updates.isManuallyResized;
      if (updates.maskColor !== undefined) target.maskColor = updates.maskColor;
      if (updates.isDeleted !== undefined) target.isDeleted = updates.isDeleted;
      if (updates.richHtml !== undefined) target.richHtml = updates.richHtml;

      const newText = updates.currentText !== undefined ? updates.currentText : (updates as any).text;
      if (newText !== undefined) {
        target.currentText = newText;
      }

      if (target.origPdfX === undefined) {
        target.origPdfX = target.pdfX;
        target.origPdfY = target.pdfY;
        target.origPdfWidth = target.pdfWidth;
        target.origPdfHeight = target.pdfHeight;
        target.origVx = target.vx;
        target.origVy = target.vy;
        target.origVWidth = target.vWidth;
        target.origVHeight = target.vHeight;
      }

      // Check if user has selected specific word(s) inside contenteditable editor
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const editorEl = typeof document !== "undefined" 
        ? document.querySelector(`[data-block-id="${id}"] [contenteditable="true"]`) as HTMLElement | null
        : null;
      let isSelectionInEditor = !!(
        sel && 
        !sel.isCollapsed && 
        editorEl && 
        sel.rangeCount > 0 && 
        editorEl.contains(sel.anchorNode) &&
        editorEl.contains(sel.focusNode)
      );

      // Restore selection if blurred by toolbar click
      if (!isSelectionInEditor && savedSelectionRef.current && savedSelectionRef.current.blockId === id && editorEl) {
        try {
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(savedSelectionRef.current.range);
            isSelectionInEditor = !sel.isCollapsed && sel.rangeCount > 0;
          }
        } catch {}
      }

      if (isSelectionInEditor && editorEl) {
        if (updates.isBold !== undefined) {
          document.execCommand("bold", false);
        }
        if (updates.isItalic !== undefined) {
          document.execCommand("italic", false);
        }
        if (updates.color !== undefined) {
          const norm = normalizeCssColor(updates.color) || updates.color;
          document.execCommand("foreColor", false, norm);
        }
        if (updates.fontFamily !== undefined) {
          const fontCss = getFontFamilyCss(updates.fontFamily);
          document.execCommand("fontName", false, fontCss);
          editorEl.querySelectorAll('font[face]').forEach(f => {
            const face = f.getAttribute("face");
            if (face) (f as HTMLElement).style.fontFamily = face;
          });
        }
        if (updates.fontSize !== undefined) {
          const targetPx = updates.fontSize * scale;
          document.execCommand("fontSize", false, "7");
          editorEl.querySelectorAll('font[size="7"]').forEach(f => {
            const span = document.createElement("span");
            span.style.fontSize = `${targetPx}px`;
            span.setAttribute("data-pdf-font-size", `${updates.fontSize}`);
            span.style.lineHeight = "1.25";
            while (f.firstChild) {
              span.appendChild(f.firstChild);
            }
            f.parentNode?.replaceChild(span, f);
          });
        }

        // Keep savedSelectionRef updated with the active range
        if (sel && sel.rangeCount > 0) {
          savedSelectionRef.current = {
            blockId: id,
            range: sel.getRangeAt(0).cloneRange(),
            text: sel.toString(),
          };
        }

        target.richHtml = editorEl.innerHTML;
        target.currentText = editorEl.innerText;
        target.isModified = true;

        const scrollW = editorEl.scrollWidth;
        if (scrollW > target.vWidth && !target.isManuallyResized) {
          target.vWidth = scrollW + 12;
          target.pdfWidth = target.vWidth / scale;
        }
      } else {
        // If formatting the entire block without an active selection, clear any partial richHtml
        if (updates.isBold !== undefined || updates.fontFamily !== undefined || updates.fontSize !== undefined || updates.color !== undefined) {
          target.richHtml = undefined;
        }

        // Sync fontWeight and fontStyle with isBold and isItalic
        if (updates.isBold !== undefined) {
          target.isBold = updates.isBold;
          target.fontWeight = updates.isBold ? "bold" : "normal";
          setActiveIsBold(updates.isBold);
        } else if (updates.fontWeight !== undefined) {
          target.fontWeight = updates.fontWeight;
          target.isBold = updates.fontWeight === "bold";
          setActiveIsBold(target.isBold);
        }

        if (updates.isItalic !== undefined) {
          target.isItalic = updates.isItalic;
          target.fontStyle = updates.isItalic ? "italic" : "normal";
          setActiveIsItalic(updates.isItalic);
        } else if (updates.fontStyle !== undefined) {
          target.fontStyle = updates.fontStyle;
          target.isItalic = updates.fontStyle === "italic";
          setActiveIsItalic(target.isItalic);
        }

        if (updates.fontFamily !== undefined) {
          target.fontFamily = updates.fontFamily;
          setActiveFontFamily(updates.fontFamily);
        }

        if (updates.fontSize !== undefined) {
          target.fontSize = updates.fontSize;
          setActiveFontSize(updates.fontSize);
        }

        if (updates.color !== undefined) {
          const norm = normalizeCssColor(updates.color);
          target.color = norm || updates.color;
          setActiveColor(target.color);
        }
      }

      if (updates.alignment !== undefined || updates.textAlign !== undefined) {
        const align = updates.textAlign || updates.alignment;
        target.alignment = align;
        target.textAlign = align;
      }

      if (updates.zIndex !== undefined) {
        target.zIndex = updates.zIndex;
      }

      // Guard Clause: If isManuallyResized is true, disable the automatic measureExactTextWidth recalculation!
      if (!target.isManuallyResized) {
        const effectiveSizePx = target.fontSize * scale;
        const fontWeight = target.fontWeight || (target.isBold ? "bold" : "normal");
        const fontStyle = target.fontStyle || (target.isItalic ? "italic" : "normal");
        const visualWidth = measureExactVisualWidth(
          target.currentText,
          effectiveSizePx,
          target.fontFamily,
          fontWeight,
          fontStyle
        );
        const dynamicBleed = Math.max(effectiveSizePx * 0.2, 8);
        target.vWidth = Math.max(visualWidth + dynamicBleed, 16);
        target.pdfWidth = target.vWidth / scale;
      }

      const lineCount = (target.currentText.split("\n").length) || target.lineCount || 1;
      target.vHeight = Math.max(target.vHeight, lineCount * target.fontSize * scale * 1.25, 14);
      target.pdfHeight = target.vHeight / scale;

      return target;
    });

    const nextMap: Record<number, ExistingTextBlock[]> = {
      ...prev,
      [foundPageIdx]: updatedBlocks,
    };

    pageTextBlocksRef.current = nextMap;
    setPageTextBlocks(nextMap);
    if (actionDescription) {
      saveSnapshot(actionDescription, nextMap);
    } else {
      setSaveStatus("unsaved");
    }
  }, [saveSnapshot, scale]);

  // Unified State Updating for Both Custom Elements and Existing Text Blocks
  const updateElement = useCallback((id: string, updates: any, actionDescription?: string) => {
    // 1. Check customElements
    const customIdx = customElementsRef.current.findIndex(e => e.id === id);
    if (customIdx !== -1) {
      const copy = JSON.parse(JSON.stringify(customElementsRef.current));
      const target = copy[customIdx];

      // Check if user has selected specific word(s) inside contenteditable custom text box
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const editorEl = typeof document !== "undefined" 
        ? document.querySelector(`[data-custom-id="${id}"][contenteditable="true"], [data-custom-id="${id}"] [contenteditable="true"]`) as HTMLElement | null
        : null;

      let isSelectionInEditor = !!(
        sel && 
        !sel.isCollapsed && 
        editorEl && 
        sel.rangeCount > 0 && 
        editorEl.contains(sel.anchorNode) &&
        editorEl.contains(sel.focusNode)
      );

      if (!isSelectionInEditor && savedSelectionRef.current && savedSelectionRef.current.blockId === id && editorEl) {
        try {
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(savedSelectionRef.current.range);
            isSelectionInEditor = !sel.isCollapsed && sel.rangeCount > 0;
          }
        } catch {}
      }

      if (isSelectionInEditor && editorEl && target.type === "text") {
        if (updates.isBold !== undefined) document.execCommand("bold", false);
        if (updates.isItalic !== undefined) document.execCommand("italic", false);
        if (updates.color !== undefined) {
          const norm = normalizeCssColor(updates.color) || updates.color;
          document.execCommand("foreColor", false, norm);
        }
        if (updates.fontFamily !== undefined) {
          const fontCss = getFontFamilyCss(updates.fontFamily);
          document.execCommand("fontName", false, fontCss);
          editorEl.querySelectorAll('font[face]').forEach(f => {
            const face = f.getAttribute("face");
            if (face) (f as HTMLElement).style.fontFamily = face;
          });
        }
        if (updates.fontSize !== undefined) {
          const targetPx = updates.fontSize * scale;
          document.execCommand("fontSize", false, "7");
          editorEl.querySelectorAll('font[size="7"]').forEach(f => {
            const span = document.createElement("span");
            span.style.fontSize = `${targetPx}px`;
            span.setAttribute("data-pdf-font-size", `${updates.fontSize}`);
            span.style.lineHeight = "1.25";
            while (f.firstChild) span.appendChild(f.firstChild);
            f.parentNode?.replaceChild(span, f);
          });
        }

        if (sel && sel.rangeCount > 0) {
          savedSelectionRef.current = {
            blockId: id,
            range: sel.getRangeAt(0).cloneRange(),
            text: sel.toString(),
          };
        }

        target.richHtml = editorEl.innerHTML;
        target.text = editorEl.innerText;
        target.currentText = editorEl.innerText;
        copy[customIdx] = target;
        customElementsRef.current = copy;
        setCustomElements(copy);
        if (actionDescription) {
          saveSnapshot(actionDescription, { customElements: copy });
        }
        return;
      }

      const newText = updates.currentText !== undefined ? updates.currentText : updates.text;
      const elem = { 
        ...copy[customIdx], 
        ...updates,
        ...(newText !== undefined ? { text: newText, currentText: newText } : {})
      };
      if (updates.textAlign !== undefined || updates.alignment !== undefined) {
        const align = updates.textAlign || updates.alignment;
        elem.alignment = align;
        elem.textAlign = align;
      }
      if (updates.fontSize && elem.type === "text") {
        const minH = updates.fontSize * 1.4;
        if (elem.pdfHeight < minH) elem.pdfHeight = minH;
      }
      copy[customIdx] = elem;
      customElementsRef.current = copy;
      setCustomElements(copy);
      if (actionDescription) {
        saveSnapshot(actionDescription, { customElements: copy });
      } else {
        setSaveStatus("unsaved");
      }
      return;
    }

    // 2. Check pageTextBlocks
    updateBlock(id, updates, actionDescription);
  }, [updateBlock, saveSnapshot]);

  // Centralized keystroke handler routing directly into updateElement
  const handleTextChange = useCallback((id: string, newText: string) => {
    updateElement(id, { currentText: newText, text: newText });
  }, [updateElement]);

  // Layering: Bring to Front (Move to end of array and set highest zIndex on current page)
  const handleBringToFront = useCallback((id: string) => {
    const pageIdx = currentPage - 1;
    const customIdx = customElementsRef.current.findIndex(e => e.id === id);

    if (customIdx !== -1) {
      const arr = [...customElementsRef.current];
      const [elem] = arr.splice(customIdx, 1);
      arr.push(elem);
      let zCounter = 10;
      arr.forEach(el => {
        if (el.pageIndex === pageIdx) {
          el.zIndex = zCounter++;
        }
      });
      customElementsRef.current = arr;
      setCustomElements(arr);
      saveSnapshot("Bring to Front", { customElements: arr });
      toast({ title: "Layering", description: "Brought to front." });
      return;
    }

    const currentBlocks = pageTextBlocksRef.current[pageIdx] || [];
    const currentElements = customElementsRef.current.filter(e => e.pageIndex === pageIdx);
    const allZ = [
      ...currentBlocks.map(b => b.zIndex ?? 10),
      ...currentElements.map(e => e.zIndex ?? 10),
    ];
    const maxZ = allZ.length > 0 ? Math.max(...allZ) : 10;
    const newZ = maxZ + 1;

    updateElement(id, { zIndex: newZ }, "Bring to Front");
    toast({ title: "Layering", description: "Brought to front." });
  }, [currentPage, updateElement, saveSnapshot, toast]);

  // Layering: Send to Back (Move to beginning of current page elements and set zIndex >= 6 above mask layer 5)
  const handleSendToBack = useCallback((id: string) => {
    const pageIdx = currentPage - 1;
    const customIdx = customElementsRef.current.findIndex(e => e.id === id);

    if (customIdx !== -1) {
      const arr = [...customElementsRef.current];
      const [elem] = arr.splice(customIdx, 1);
      const otherPages = arr.filter(el => el.pageIndex !== pageIdx);
      const thisPageOthers = arr.filter(el => el.pageIndex === pageIdx);
      const reorderedThisPage = [elem, ...thisPageOthers];
      let zCounter = 6;
      reorderedThisPage.forEach(el => {
        el.zIndex = zCounter++;
      });
      const finalArr = [...otherPages, ...reorderedThisPage];
      customElementsRef.current = finalArr;
      setCustomElements(finalArr);
      saveSnapshot("Send to Back", { customElements: finalArr });
      toast({ title: "Layering", description: "Sent to back." });
      return;
    }

    updateElement(id, { zIndex: 6 }, "Send to Back");
    toast({ title: "Layering", description: "Sent to back." });
  }, [currentPage, updateElement, saveSnapshot, toast]);

  // State Commitment for In-Place Text Editing (Optimistic UI Staging - Commit on blur)
  const handleCommitText = useCallback((blk: ExistingTextBlock, newText: string) => {
    const trimmed = newText.replace(/\r\n/g, "\n").trimEnd();
    const textChanged = trimmed !== blk.originalText;
    blk.currentText = trimmed;
    blk.lineCount = trimmed.split("\n").length;
    if (blk.richHtml && !/<(b|strong|i|em|span|font|mark)\b/i.test(blk.richHtml)) {
      blk.richHtml = undefined;
    }
    const isMoved = blk.origPdfX !== undefined && (
      Math.abs(blk.pdfX - blk.origPdfX) > 2 || 
      Math.abs(blk.pdfY - (blk.origPdfY ?? blk.pdfY)) > 2
    );
    blk.isModified = textChanged || isMoved || !!blk.isDeleted;

    // Ensure baseline original coordinates are recorded permanently
    if (blk.origPdfX === undefined) {
      blk.origPdfX = blk.pdfX;
      blk.origPdfY = blk.pdfY;
      blk.origPdfWidth = blk.pdfWidth;
      blk.origPdfHeight = blk.pdfHeight;
      blk.origVx = blk.vx;
      blk.origVy = blk.vy;
      blk.origVWidth = blk.vWidth;
      blk.origVHeight = blk.vHeight;
    }

    // Guard Clause: If isManuallyResized is true, disable the automatic measureExactTextWidth recalculation!
    if (!blk.isManuallyResized) {
      const effectiveSizePx = blk.fontSize * scale;
      const fontWeight = blk.fontWeight || (blk.isBold ? "bold" : "normal");
      const fontStyle = blk.fontStyle || (blk.isItalic ? "italic" : "normal");
      const visualWidth = measureExactVisualWidth(
        blk.currentText,
        effectiveSizePx,
        blk.fontFamily,
        fontWeight,
        fontStyle
      );
      const dynamicBleed = Math.max(effectiveSizePx * 0.2, 8);
      blk.vWidth = Math.max(visualWidth + dynamicBleed, 16);
      blk.pdfWidth = blk.vWidth / scale;
    }

    const lineCount = (blk.currentText.split("\n").length) || blk.lineCount || 1;
    blk.vHeight = Math.max(blk.vHeight, lineCount * blk.fontSize * scale * 1.25, 14);
    blk.pdfHeight = blk.vHeight / scale;

    const pageIdx = blk.pageIndex;
    const currentBlocks = pageTextBlocksRef.current[pageIdx] || [];
    const updated = currentBlocks.map(b => (b.id === blk.id ? { ...blk } : b));
    const nextMap = {
      ...pageTextBlocksRef.current,
      [pageIdx]: updated,
    };
    pageTextBlocksRef.current = nextMap;
    setPageTextBlocks(nextMap);
    if (blk.isModified) {
      saveSnapshot("Edit Text", nextMap);
    }
  }, [saveSnapshot, scale]);

  // Undo Handler (Forceful state restoration from deep copy snapshot)
  const handleUndo = useCallback(() => {
    const previous = historyManager.undo();
    if (previous) {
      const restoredBlocks = previous.state.pageTextBlocks 
        ? JSON.parse(JSON.stringify(previous.state.pageTextBlocks)) 
        : {};
      const restoredElements = previous.state.customElements 
        ? JSON.parse(JSON.stringify(previous.state.customElements)) 
        : [];
      const restoredStrokes = previous.state.drawingStrokes 
        ? JSON.parse(JSON.stringify(previous.state.drawingStrokes)) 
        : [];
      const restoredFields = previous.state.formFields 
        ? JSON.parse(JSON.stringify(previous.state.formFields)) 
        : [];
      const restoredComments = previous.state.comments 
        ? JSON.parse(JSON.stringify(previous.state.comments)) 
        : [];
      const restoredMasked = new Set<string>(previous.state.maskedImageIds || []);

      // Synchronously update all refs
      pageTextBlocksRef.current = restoredBlocks;
      customElementsRef.current = restoredElements;
      drawingStrokesRef.current = restoredStrokes;
      formFieldsRef.current = restoredFields;
      commentsRef.current = restoredComments;
      maskedImageIdsRef.current = restoredMasked;

      // Update React states
      setPageTextBlocks(restoredBlocks);
      setCustomElements(restoredElements);
      setDrawingStrokes(restoredStrokes);
      setFormFields(restoredFields);
      setComments(restoredComments);
      setMaskedImageIds(restoredMasked);
      setSelectedElementId(null);
      setEditingBlockId(null);
      setHistoryVersion(v => v + 1);

      toast({ title: "Undo", description: previous.description || "Action reverted." });
    }
  }, [historyManager, toast]);

  // Redo Handler (Forceful state restoration from deep copy snapshot)
  const handleRedo = useCallback(() => {
    const next = historyManager.redo();
    if (next) {
      const restoredBlocks = next.state.pageTextBlocks 
        ? JSON.parse(JSON.stringify(next.state.pageTextBlocks)) 
        : {};
      const restoredElements = next.state.customElements 
        ? JSON.parse(JSON.stringify(next.state.customElements)) 
        : [];
      const restoredStrokes = next.state.drawingStrokes 
        ? JSON.parse(JSON.stringify(next.state.drawingStrokes)) 
        : [];
      const restoredFields = next.state.formFields 
        ? JSON.parse(JSON.stringify(next.state.formFields)) 
        : [];
      const restoredComments = next.state.comments 
        ? JSON.parse(JSON.stringify(next.state.comments)) 
        : [];
      const restoredMasked = new Set<string>(next.state.maskedImageIds || []);

      // Synchronously update all refs
      pageTextBlocksRef.current = restoredBlocks;
      customElementsRef.current = restoredElements;
      drawingStrokesRef.current = restoredStrokes;
      formFieldsRef.current = restoredFields;
      commentsRef.current = restoredComments;
      maskedImageIdsRef.current = restoredMasked;

      // Update React states
      setPageTextBlocks(restoredBlocks);
      setCustomElements(restoredElements);
      setDrawingStrokes(restoredStrokes);
      setFormFields(restoredFields);
      setComments(restoredComments);
      setMaskedImageIds(restoredMasked);
      setSelectedElementId(null);
      setEditingBlockId(null);
      setHistoryVersion(v => v + 1);

      toast({ title: "Redo", description: next.description || "Action reapplied." });
    }
  }, [historyManager, toast]);

  // Dragging & Moving Existing Text Blocks (Window-level pointer listeners with exact PDF baseline math)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  // Helper to select an existing text block
  const selectTextBlock = useCallback((blk: ExistingTextBlock) => {
    const canvas = canvasRef.current;
    if (canvas && (!blk.maskColor || blk.maskColor === "#ffffff")) {
      const sampledBg = sampleCanvasBackgroundColor(
        canvas,
        blk.origVx ?? blk.vx,
        blk.origVy ?? blk.vy,
        blk.origVWidth ?? blk.vWidth,
        blk.origVHeight ?? blk.vHeight
      );
      blk.maskColor = sampledBg;

      // Preserve/detect original text font color if not explicitly modified
      if (!blk.color || blk.color === "#000000" || blk.color === "#ffffff") {
        const sampledTextColor = sampleCanvasTextColor(
          canvas,
          blk.origVx ?? blk.vx,
          blk.origVy ?? blk.vy,
          blk.origVWidth ?? blk.vWidth,
          blk.origVHeight ?? blk.vHeight,
          sampledBg
        );
        blk.color = sampledTextColor;
      }
    }

    // Always enforce contrast between blk.color and blk.maskColor
    const isDarkBg = isColorDark(blk.maskColor || "#ffffff");
    if (blk.color) {
      const colorIsDark = isColorDark(blk.color);
      if (isDarkBg && colorIsDark) {
        blk.color = "#ffffff";
      } else if (!isDarkBg && !colorIsDark) {
        blk.color = "#000000";
      }
    } else {
      blk.color = isDarkBg ? "#ffffff" : "#000000";
    }

    setActiveFontSize(blk.fontSize);
    if (blk.fontFamily) setActiveFontFamily(blk.fontFamily);
    if (blk.color) setActiveColor(blk.color);
    setActiveIsBold(blk.fontWeight === "bold" || !!blk.isBold);
    setActiveIsItalic(blk.fontStyle === "italic" || !!blk.isItalic);
    setSelectedElementId(blk.id);
  }, []);

  const handleStartBlockDrag = (e: React.PointerEvent, blk: ExistingTextBlock) => {
    e.stopPropagation();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initVx = blk.vx;
    const initVy = blk.vy;
    const rawPageH = rawPageSizeRef.current.height || 841.89;
    const ascent = blk.fontSize * scale * 0.85;

    // Ensure baseline original coordinates are recorded if not already present
    if (blk.origPdfX === undefined) {
      blk.origPdfX = blk.pdfX;
      blk.origPdfY = blk.pdfY;
      blk.origPdfWidth = blk.pdfWidth;
      blk.origPdfHeight = blk.pdfHeight;
      blk.origVx = blk.vx;
      blk.origVy = blk.vy;
      blk.origVWidth = blk.vWidth;
      blk.origVHeight = blk.vHeight;
    }

    if (canvasRef.current && (!blk.maskColor || blk.maskColor === "#ffffff")) {
      blk.maskColor = sampleCanvasBackgroundColor(
        canvasRef.current,
        blk.origVx ?? blk.vx,
        blk.origVy ?? blk.vy,
        blk.origVWidth ?? blk.vWidth,
        blk.origVHeight ?? blk.vHeight
      );
    }

    let hasMoved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;

      // Threshold of at least 6px before drag activates (prevents natural click tremors from triggering drag)
      if (!hasMoved && Math.hypot(dx, dy) > 6) {
        hasMoved = true;
        setDraggingBlockId(blk.id);
      }

      if (hasMoved) {
        const newVx = Math.max(0, initVx + dx);
        const newVy = Math.max(0, initVy + dy);

        blk.vx = newVx;
        blk.vy = newVy;
        blk.pdfX = (blk.origPdfX ?? blk.pdfX) + dx / scale;
        blk.pdfY = (blk.origPdfY ?? blk.pdfY) - dy / scale;
        blk.isModified = true;

        setPageTextBlocks(prev => ({ ...prev }));
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (hasMoved) {
        setDraggingBlockId(null);
        // Only mark modified and record snapshot if displaced by more than 4px
        const movedDist = Math.hypot(blk.vx - initVx, blk.vy - initVy);
        if (movedDist > 4) {
          blk.isModified = true;
          selectTextBlock(blk);
          saveSnapshot("Move Text Block");
        } else {
          // Revert micro-movement
          blk.vx = initVx;
          blk.vy = initVy;
          blk.pdfX = blk.origPdfX ?? (initVx / scale);
          blk.pdfY = blk.origPdfY ?? (rawPageH - (initVy + ascent) / scale);
          blk.isModified = (blk.currentText !== blk.originalText) || blk.isDeleted;
          selectTextBlock(blk);
          setPageTextBlocks(prev => ({ ...prev }));
        }
      } else {
        selectTextBlock(blk);
        if (activeTool === "edit") {
          setEditingBlockId(blk.id);
        }
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Spacebar Pan)
  useEffect(() => {
    const isTypingActive = (e: KeyboardEvent) => {
      if (editingBlockIdRef.current !== null) return true;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl && (
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable ||
          Boolean(activeEl.closest?.('[contenteditable="true"]')) ||
          Boolean(activeEl.closest?.('input, textarea'))
        )
      ) {
        return true;
      }
      const target = e.target as HTMLElement | null;
      if (
        target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')) ||
          Boolean(target.closest?.('input, textarea'))
        )
      ) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingActive(e)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.code === "Space" && activeTool !== "hand") {
        e.preventDefault();
        setActiveTool("hand");
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedElementIdRef.current && !editingBlockIdRef.current) {
        e.preventDefault();
        const currentSelId = selectedElementIdRef.current;
        const targetCustom = customElements.find(el => el.id === currentSelId);
        if (targetCustom) {
          setCustomElements(prev => prev.filter(el => el.id !== currentSelId));
          setSelectedElementId(null);
          saveSnapshot("Delete Element");
        } else {
          Object.keys(pageTextBlocks).forEach(pStr => {
            const pIdx = parseInt(pStr, 10);
            const blk = (pageTextBlocks[pIdx] || []).find(b => b.id === currentSelId);
            if (blk) {
              blk.isDeleted = true;
              blk.isModified = true;
              setPageTextBlocks(prev => ({ ...prev }));
              setSelectedElementId(null);
              saveSnapshot("Delete Text Block");
            }
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isTypingActive(e)) {
        return;
      }

      if (e.code === "Space" && activeTool === "hand") {
        setActiveTool("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleUndo, handleRedo, activeTool]);

  // Smooth Ctrl + Wheel / Trackpad Pinch Zoom
  useEffect(() => {
    const container = viewportContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        setScale(prev => Math.min(4.0, Math.max(0.25, +(prev + delta).toFixed(2))));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Calculate Fit-to-Screen Scale
  const getFitPageScale = useCallback((pWidth: number, pHeight: number) => {
    const container = viewportContainerRef.current;
    if (!container || !pWidth || !pHeight) return 0.9;
    const availWidth = Math.max(container.clientWidth - 48, 200);
    const availHeight = Math.max(container.clientHeight - 48, 200);
    const fitScale = Math.min(availWidth / pWidth, availHeight / pHeight);
    return Math.max(0.35, Math.min(+(fitScale.toFixed(2)), 1.8));
  }, []);

  const handleFitPage = useCallback(() => {
    const width = rawPageSizeRef.current?.width || 595.28;
    const height = rawPageSizeRef.current?.height || 841.89;
    const fitScale = getFitPageScale(width, height);
    setScale(fitScale);
  }, [getFitPageScale]);

  const handleFitWidth = useCallback(() => {
    const container = viewportContainerRef.current;
    if (!container) return;
    const availWidth = Math.max(container.clientWidth - 48, 200);
    const pageWidth = rawPageSizeRef.current?.width || 595.28;
    const fitScale = Math.max(0.4, Math.min(+((availWidth / pageWidth).toFixed(2)), 2.5));
    setScale(fitScale);
  }, []);

  // Files selected
  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      const selected = newFiles[0];
      setFile(selected);
      setFileName(selected.name);
      setPageTextBlocks({});
      setCustomElements([]);
      setDrawingStrokes([]);
      setFormFields([]);
      setComments([]);
      setMaskedImageIds(new Set());
      setSelectedElementId(null);
      rawTextCacheRef.current = {};
      hasAutoFittedRef.current = false;
      historyManager.clear();
    }
  };

  // Create Blank Document
  const handleCreateNew = async () => {
    try {
      const doc = await PDFDocument.create();
      doc.addPage([595.28, 841.89]);
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const newFile = new File([blob], "blank_document.pdf", { type: "application/pdf" });
      setFile(newFile);
      setFileName("blank_document.pdf");
      setPageTextBlocks({});
      setCustomElements([]);
      setDrawingStrokes([]);
      setFormFields([]);
      setComments([]);
      setMaskedImageIds(new Set());
      setSelectedElementId(null);
      rawTextCacheRef.current = {};
      hasAutoFittedRef.current = false;
      historyManager.init({
        pageTextBlocks: {},
        customElements: [],
        drawingStrokes: [],
        formFields: [],
        comments: [],
        maskedImageIds: [],
      });
      toast({ title: "Blank Canvas Created", description: "Click anywhere to type or draw." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to create document", variant: "destructive" });
    }
  };

  // Initialize and load PDF document when file changes
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      return;
    }
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        setIsLoadingPage(true);
        const buffer = await file.arrayBuffer();
        if (isCancelled) return;
        // Slice a copy so PDF.js worker doesn't detach caller's buffer
        const bufferCopy = buffer.slice(0);
        const loadedPdf = await pdfjsLib.getDocument({ data: bufferCopy }).promise;
        if (isCancelled) return;

        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);

        if (!hasAutoFittedRef.current) {
          try {
            const firstPage = await loadedPdf.getPage(1);
            const unscaled = firstPage.getViewport({ scale: 1.0 });
            rawPageSizeRef.current = { width: unscaled.width, height: unscaled.height };
            const initialScale = getFitPageScale(unscaled.width, unscaled.height);
            setScale(initialScale);
          } catch (e) {
            console.error("Initial fit scale calculation error", e);
          }
          hasAutoFittedRef.current = true;
          setCurrentPage(1);
          setMaskedImageIds(new Set());
          historyManager.init({
            pageTextBlocks: {},
            customElements: [],
            drawingStrokes: [],
            formFields: [],
            comments: [],
            maskedImageIds: [],
          });
        }
      } catch (err) {
        console.error("Failed loading PDF into PDF.js:", err);
        toast({ title: "Error", description: "Could not read or parse PDF file", variant: "destructive" });
      } finally {
        if (!isCancelled) setIsLoadingPage(false);
      }
    };

    loadPdf();
    return () => { isCancelled = true; };
  }, [file, getFitPageScale, toast]);

// Helper function to auto-detect font details from PDF item fontName and styles
function detectFontDetails(fontName?: string, styleObj?: any) {
  const combined = `${fontName || ""} ${styleObj?.fontFamily || ""}`.toLowerCase();
  
  let isBold = false;
  let isItalic = false;
  let fontFamily = "Helvetica";

  // Check Bold
  if (
    combined.includes("bold") || 
    combined.includes("heavy") || 
    combined.includes("black") || 
    combined.includes("700") || 
    combined.includes("800") || 
    combined.includes("900") || 
    combined.includes("w7") || 
    combined.includes("w8")
  ) {
    isBold = true;
  }

  // Check Italic
  if (combined.includes("italic") || combined.includes("oblique") || combined.includes("slant")) {
    isItalic = true;
  }

  // Check Font Family
  if (combined.includes("calibri")) {
    fontFamily = "Calibri";
  } else if (combined.includes("segoe")) {
    fontFamily = "Segoe UI";
  } else if (combined.includes("arial") || combined.includes("arialmt")) {
    fontFamily = "Arial";
  } else if (combined.includes("cambria")) {
    fontFamily = "Cambria";
  } else if (combined.includes("times") || combined.includes("roman") || combined.includes("minion")) {
    fontFamily = "Times";
  } else if (combined.includes("georgia")) {
    fontFamily = "Georgia";
  } else if (combined.includes("garamond")) {
    fontFamily = "Garamond";
  } else if (combined.includes("trebuchet")) {
    fontFamily = "Trebuchet MS";
  } else if (combined.includes("verdana")) {
    fontFamily = "Verdana";
  } else if (combined.includes("playfair")) {
    fontFamily = "Playfair Display";
  } else if (combined.includes("merriweather")) {
    fontFamily = "Merriweather";
  } else if (combined.includes("courier") || combined.includes("consolas") || combined.includes("mono") || combined.includes("code") || combined.includes("menlo")) {
    fontFamily = "Courier";
  } else if (combined.includes("roboto")) {
    fontFamily = "Roboto";
  } else if (combined.includes("poppins")) {
    fontFamily = "Poppins";
  } else if (combined.includes("montserrat")) {
    fontFamily = "Montserrat";
  } else if (combined.includes("open sans")) {
    fontFamily = "Open Sans";
  } else if (combined.includes("lato")) {
    fontFamily = "Lato";
  } else if (combined.includes("inter")) {
    fontFamily = "Inter";
  } else if (combined.includes("serif") && !combined.includes("sans")) {
    fontFamily = "Times";
  } else {
    fontFamily = "Helvetica";
  }

  return { fontFamily, isBold, isItalic };
}

  // Extract text items from PDF page
  const extractPageText = useCallback(async (page: pdfjsLib.PDFPageProxy, pageIdx: number, viewport: pdfjsLib.PageViewport) => {
    try {
      let rawItems = rawTextCacheRef.current[pageIdx];
      let fontStyles: Record<string, any> = {};
      if (!rawItems) {
        const textContent = await page.getTextContent();
        rawItems = (textContent.items as any[]).filter(item => item.str && item.str.trim().length > 0);
        fontStyles = textContent.styles || {};
        rawTextCacheRef.current[pageIdx] = rawItems;
      }

      const clustered = clusterPdfTextItems(rawItems, fontStyles, pageIdx, detectFontDetails);

      const updatedLines: ExistingTextBlock[] = clustered.map(block => {
        // Convert top-left (minX, maxY) and bottom-right (maxX, minY) from PDF space to screen viewport
        const [vx, vTop] = viewport.convertToViewportPoint(block.minX, block.maxY);
        const [vRight, vBottom] = viewport.convertToViewportPoint(block.maxX, block.minY);

        const pdfWidth = (block.maxX - block.minX) * scale;
        const effectiveSizePx = block.fontSize * scale;
        const fontWeight = block.fontWeight || (block.isBold ? "bold" : "normal");
        const fontStyle = block.fontStyle || (block.isItalic ? "italic" : "normal");
        const visualWidth = measureExactVisualWidth(
          block.currentText,
          effectiveSizePx,
          block.fontFamily,
          fontWeight,
          fontStyle
        );

        // The Dynamic Bleed: 20% of font size (at least 8px) to account for italics, wide kerning, and large/bold fonts
        const dynamicBleed = Math.max(effectiveSizePx * 0.2, 8);
        const calculatedVWidth = Math.max(pdfWidth, visualWidth) + dynamicBleed;

        const lineCount = block.currentText.split("\n").length || block.lineCount || 1;
        const dynamicH = Math.max(vBottom - vTop, lineCount * effectiveSizePx * 1.25, 14);

        const calculatedPdfH = dynamicH / scale;

        return {
          ...block,
          children: block.children,
          origFontFamily: block.fontFamily,
          origFontSize: block.fontSize,
          origIsBold: !!block.isBold,
          origIsItalic: !!block.isItalic,
          origColor: block.color || "#000000",
          pdfHeight: calculatedPdfH,
          origPdfX: block.pdfX,
          origPdfY: block.pdfY,
          origPdfWidth: calculatedVWidth / scale,
          origPdfHeight: calculatedPdfH,
          vx,
          vy: vTop,
          vWidth: calculatedVWidth,
          vHeight: dynamicH,
          origVx: vx,
          origVy: vTop,
          origVWidth: calculatedVWidth,
          origVHeight: dynamicH,
          letterSpacing: 0,
          bgColor: "#ffffff",
        };
      });

      const nextBlocks = {
        ...pageTextBlocksRef.current,
        [pageIdx]: updatedLines,
      };
      pageTextBlocksRef.current = nextBlocks;
      setPageTextBlocks(nextBlocks);

      if (!historyManager.canUndo()) {
        historyManager.init({
          pageTextBlocks: nextBlocks,
          customElements: customElementsRef.current,
          drawingStrokes: drawingStrokesRef.current,
          formFields: formFieldsRef.current,
          comments: commentsRef.current,
          maskedImageIds: Array.from(maskedImageIdsRef.current),
        });
        setHistoryVersion(v => v + 1);
      }
    } catch (err) {
      console.error("Text extraction error:", err);
    }
  }, [scale]);

  // Render current PDF page on canvas (Runs ONLY when page or scale changes, NO loops)
  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const unscaled = page.getViewport({ scale: 1.0 });
        rawPageSizeRef.current = { width: unscaled.width, height: unscaled.height };

        // Ensure newly loaded document page fits completely on screen without initial scrolling
        if (!hasAutoFittedRef.current && viewportContainerRef.current) {
          const fitScale = getFitPageScale(unscaled.width, unscaled.height);
          if (fitScale && Math.abs(fitScale - scale) > 0.03) {
            hasAutoFittedRef.current = true;
            setScale(fitScale);
            return;
          }
          hasAutoFittedRef.current = true;
        }

        const dpr = Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        // High-DPI canvas buffer allocation for crystal-sharp text
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isCancelled) return;

        const pageIdx = currentPage - 1;

        // Detect images embedded in PDF page
        if (!detectedImages[pageIdx]) {
          try {
            const imgs = await detectPageImages(page, pageIdx, viewport, scale, canvasRef.current);
            if (!isCancelled && imgs.length > 0) {
              setDetectedImages(prev => ({ ...prev, [pageIdx]: imgs }));
            }
          } catch (imgErr) {
            console.warn("Failed detecting page images", imgErr);
          }
        } else {
          setDetectedImages(prev => {
            const curImgs = prev[pageIdx] || [];
            const updated = curImgs.map(img => {
              const [vx, vy] = viewport.convertToViewportPoint(img.pdfX, img.pdfY + img.pdfHeight);
              return {
                ...img,
                vx,
                vy,
                vWidth: img.pdfWidth * scale,
                vHeight: img.pdfHeight * scale,
              };
            });
            return { ...prev, [pageIdx]: updated };
          });
        }

        if (!pageTextBlocks[pageIdx]) {
          await extractPageText(page, pageIdx, viewport);
        } else {
          setPageTextBlocks(prev => {
            const currentBlocks = prev[pageIdx] || [];
            const updated = currentBlocks.map(line => {
              const minX = line.minX !== undefined ? line.minX : line.pdfX;
              const maxX = line.maxX !== undefined ? line.maxX : (line.pdfX + line.pdfWidth);
              const minY = line.minY !== undefined ? line.minY : (line.pdfY - line.pdfHeight);
              const maxY = line.maxY !== undefined ? line.maxY : line.pdfY;

              const [baseVx, baseVTop] = viewport.convertToViewportPoint(minX, maxY);
              const [baseVRight, baseVBottom] = viewport.convertToViewportPoint(maxX, minY);

              const origPdfX = line.origPdfX !== undefined ? line.origPdfX : minX;
              const origPdfY = line.origPdfY !== undefined ? line.origPdfY : line.pdfY;
              const origPdfW = line.origPdfWidth !== undefined ? line.origPdfWidth : (maxX - minX);

              const moveDx = ((line.pdfX - origPdfX) || 0) * scale;
              const moveDy = -((line.pdfY - origPdfY) || 0) * scale;

              const vx = baseVx + moveDx;
              const vy = baseVTop + moveDy;

              const pdfWidth = (maxX - minX) * scale;
              const effectiveSizePx = line.fontSize * scale;
              const fontWeight = line.fontWeight || (line.isBold ? "bold" : "normal");
              const fontStyle = line.fontStyle || (line.isItalic ? "italic" : "normal");
              const visualWidth = measureExactVisualWidth(
                line.currentText,
                effectiveSizePx,
                line.fontFamily,
                fontWeight,
                fontStyle
              );
              const dynamicBleed = Math.max(effectiveSizePx * 0.2, 8);
              const calculatedVWidth = line.isManuallyResized 
                ? Math.max(line.pdfWidth * scale, 16) 
                : Math.max(pdfWidth, visualWidth) + dynamicBleed;

              const lineCount = (line.currentText.split("\n").length) || line.lineCount || 1;
              const dynamicH = line.isManuallyResized 
                ? Math.max(line.pdfHeight * scale, 14) 
                : Math.max(baseVBottom - baseVTop, lineCount * effectiveSizePx * 1.25, 14);

              const origVisualWidth = measureExactVisualWidth(
                line.originalText,
                effectiveSizePx,
                line.fontFamily,
                fontWeight,
                fontStyle
              );
              const origCalculatedVWidth = Math.max(origPdfW * scale, origVisualWidth) + dynamicBleed;

              return {
                ...line,
                vx,
                vy,
                vWidth: calculatedVWidth,
                vHeight: dynamicH,
                origVx: baseVx,
                origVy: baseVTop,
                origVWidth: origCalculatedVWidth,
                origVHeight: dynamicH,
                letterSpacing: 0,
                bgColor: "#ffffff",
              };
            });
            return { ...prev, [pageIdx]: updated };
          });
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, extractPageText]);

  // Select an existing image detected in the PDF so user can move, resize, rotate, or delete it
  const handleSelectDetectedImage = (img: DetectedPdfImage) => {
    // 1. Mask original detected image on screen and export
    const nextMasked = new Set(maskedImageIdsRef.current);
    nextMasked.add(img.id);
    maskedImageIdsRef.current = nextMasked;
    setMaskedImageIds(nextMasked);

    // 2. Create interactive CustomElement
    const newElem: CustomElement = {
      id: `img_detected_${Date.now()}`,
      pageIndex: img.pageIndex,
      type: "image",
      pdfX: img.pdfX,
      pdfY: img.pdfY,
      pdfWidth: img.pdfWidth,
      pdfHeight: img.pdfHeight,
      rotation: 0,
      zIndex: customElementsRef.current.length + 10,
      imageUrl: img.imgUrl,
      aspectRatioLocked: false,
    };

    const nextElements = [...customElementsRef.current, newElem];
    customElementsRef.current = nextElements;
    setCustomElements(nextElements);
    setSelectedElementId(newElem.id);
    saveSnapshot("Select Detected Image", {
      customElements: nextElements,
      maskedImageIds: Array.from(nextMasked),
    });
    toast({
      title: "Image Selected",
      description: "Drag to move or use handles to resize.",
    });
  };

  // Click or Drag an existing image detected in the PDF (Sejda / PDFgear instant interaction)
  const handleStartDetectedImageDrag = (e: React.PointerEvent, img: DetectedPdfImage) => {
    e.stopPropagation();
    e.preventDefault();

    // 1. Mask original detected image on screen and export
    const nextMasked = new Set(maskedImageIdsRef.current);
    nextMasked.add(img.id);
    maskedImageIdsRef.current = nextMasked;
    setMaskedImageIds(nextMasked);

    // 2. Create interactive CustomElement
    const newElem: CustomElement = {
      id: `img_detected_${Date.now()}`,
      pageIndex: img.pageIndex,
      type: "image",
      pdfX: img.pdfX,
      pdfY: img.pdfY,
      pdfWidth: img.pdfWidth,
      pdfHeight: img.pdfHeight,
      rotation: 0,
      zIndex: customElementsRef.current.length + 10,
      imageUrl: img.imgUrl,
      aspectRatioLocked: false,
    };

    const nextElements = [...customElementsRef.current, newElem];
    customElementsRef.current = nextElements;
    setCustomElements(nextElements);
    setSelectedElementId(newElem.id);

    // 3. Initiate immediate real-time drag
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initPdfX = img.pdfX;
    const initPdfY = img.pdfY;
    let hasMoved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;

      if (!hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMoved = true;
      }

      if (hasMoved) {
        newElem.pdfX = initPdfX + (dx / scale);
        newElem.pdfY = initPdfY - (dy / scale);
        const updated = [...nextElements];
        customElementsRef.current = updated;
        setCustomElements(updated);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      saveSnapshot(hasMoved ? "Move Detected Image" : "Select Detected Image", {
        customElements: [...customElementsRef.current],
        maskedImageIds: Array.from(nextMasked),
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Add a new image file from user's device
  const handleAddImageFile = (imgFile: File, dropCoords?: { pdfX: number; pdfY: number }) => {
    if (!imgFile.type.startsWith("image/")) {
      toast({ title: "Unsupported Format", description: "Please upload a PNG, JPG, WebP, or SVG image.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const imgObj = new Image();
      imgObj.onload = () => {
        const aspect = imgObj.width / Math.max(imgObj.height, 1);
        const maxDim = 200;
        let w = imgObj.width > maxDim ? maxDim : imgObj.width;
        let h = Math.round(w / aspect);

        // Convert image to clean PNG data URL via canvas to guarantee 100% pdf-lib embed compatibility
        let safeDataUrl = dataUrl;
        try {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = imgObj.naturalWidth || imgObj.width;
          tempCanvas.height = imgObj.naturalHeight || imgObj.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            tempCtx.drawImage(imgObj, 0, 0);
            safeDataUrl = tempCanvas.toDataURL("image/png");
          }
        } catch {
          safeDataUrl = dataUrl;
        }

        const paperH = rawPageSizeRef.current.height || 841.89;
        const paperW = rawPageSizeRef.current.width || 595.28;

        const pdfX = dropCoords ? dropCoords.pdfX : (paperW / 2) - (w / 2);
        const pdfY = dropCoords ? dropCoords.pdfY : (paperH / 2) - (h / 2);

        const newElem: CustomElement = {
          id: `img_user_${Date.now()}`,
          pageIndex: currentPage - 1,
          type: "image",
          imageUrl: safeDataUrl,
          pdfX,
          pdfY,
          pdfWidth: w,
          pdfHeight: h,
          rotation: 0,
          zIndex: customElementsRef.current.length + 10,
          aspectRatioLocked: false,
        };

        const nextElements = [...customElementsRef.current, newElem];
        customElementsRef.current = nextElements;
        setCustomElements(nextElements);
        setSelectedElementId(newElem.id);
        saveSnapshot("Add Image", { customElements: nextElements });
        toast({ title: "Image Added", description: "Use corner handles to resize, or drag to position." });
      };
      imgObj.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
  };

  // Pointer down on paper for drag-to-draw or click-to-place (Whiteout, Redact, Highlight, Shapes & Arrows)
  const handlePaperPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isShapeTool = [
      "rect", "rounded-rect", "circle", "triangle", "star",
      "line", "arrow", "double-arrow", "callout", "check", "cross"
    ].includes(activeTool);

    if (activeTool !== "whiteout" && activeTool !== "redact" && activeTool !== "highlight" && !isShapeTool) return;
    if (!paperRef.current || !pdfDoc) return;

    // Don't intercept if clicking an already active transform handle or button
    const target = e.target as HTMLElement;
    if (target.closest(".transform-bounding-box") || target.closest("button") || target.closest("input")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const paper = paperRef.current;
    const rect = paper.getBoundingClientRect();
    const startX = Math.max(0, Math.min(paper.offsetWidth, e.clientX - rect.left));
    const startY = Math.max(0, Math.min(paper.offsetHeight, e.clientY - rect.top));

    setDragShape({
      tool: activeTool as any,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });

    const onPointerMove = (moveEvt: PointerEvent) => {
      const curX = Math.max(0, Math.min(paper.offsetWidth, moveEvt.clientX - rect.left));
      const curY = Math.max(0, Math.min(paper.offsetHeight, moveEvt.clientY - rect.top));
      setDragShape(prev => prev ? { ...prev, currentX: curX, currentY: curY } : null);
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      const endX = Math.max(0, Math.min(paper.offsetWidth, upEvt.clientX - rect.left));
      const endY = Math.max(0, Math.min(paper.offsetHeight, upEvt.clientY - rect.top));
      const dragW = Math.abs(endX - startX);
      const dragH = Math.abs(endY - startY);
      const minX = Math.min(startX, endX);
      const maxY = Math.max(startY, endY);
      const pageIdx = currentPage - 1;
      const rawPageH = rawPageSizeRef.current?.height || 841.89;

      const isRedact = activeTool === "redact";
      const isWhiteout = activeTool === "whiteout";
      const isHl = activeTool === "highlight";

      setDragShape(null);

      let elemType: CustomElement["type"] = "rect";
      let prefix = "shape";
      let actionLabel = "Add Shape";

      if (isWhiteout) {
        elemType = "whiteout";
        prefix = "whiteout";
        actionLabel = "Add Whiteout";
      } else if (isRedact) {
        elemType = "redaction";
        prefix = "mask";
        actionLabel = "Add Redaction";
      } else if (isHl) {
        elemType = "highlight";
        prefix = "hl";
        actionLabel = "Add Highlight";
      } else {
        elemType = activeTool as CustomElement["type"];
        prefix = activeTool;
        actionLabel = `Add ${activeTool}`;
      }

      const isLineLike = elemType === "line" || elemType === "arrow" || elemType === "double-arrow";
      const isIconLike = elemType === "check" || elemType === "cross";

      if (isLineLike) {
        let startPdfX = startX / scale;
        let startPdfY = rawPageH - (startY / scale);
        let endPdfX = endX / scale;
        let endPdfY = rawPageH - (endY / scale);

        // If clicked without dragging, default to a 140pt horizontal arrow pointing right
        if (Math.hypot(endX - startX, endY - startY) < 10) {
          endPdfX = startPdfX + 140;
          endPdfY = startPdfY;
        }

        const minPdfX = Math.min(startPdfX, endPdfX);
        const minPdfY = Math.min(startPdfY, endPdfY);
        const pdfW = Math.max(0.1, Math.abs(endPdfX - startPdfX));
        const pdfH = Math.max(0.1, Math.abs(endPdfY - startPdfY));

        const newElem: CustomElement = {
          id: `${prefix}_${Date.now()}`,
          pageIndex: pageIdx,
          type: elemType,
          pdfX: minPdfX,
          pdfY: minPdfY,
          pdfWidth: pdfW,
          pdfHeight: pdfH,
          startPdfX,
          startPdfY,
          endPdfX,
          endPdfY,
          rotation: 0,
          zIndex: customElementsRef.current.length + 1,
          color: activeColor || "#000000",
          strokeWidth: activeStrokeWidth || 2,
          fillColor: activeFillColor || "transparent",
          strokeStyle: activeStrokeStyle || "solid",
        };

        const nextElements = [...customElementsRef.current, newElem];
        customElementsRef.current = nextElements;
        setCustomElements(nextElements);
        setSelectedElementId(newElem.id);
        saveSnapshot(actionLabel, { customElements: nextElements });
        return;
      }

      if (dragW >= 8 && dragH >= 8) {
        // User dragged a custom-sized element
        const pdfX = minX / scale;
        const pdfY = rawPageH - (maxY / scale);
        const pdfWidth = dragW / scale;
        const pdfHeight = dragH / scale;

        const newElem: CustomElement = {
          id: `${prefix}_${Date.now()}`,
          pageIndex: pageIdx,
          type: elemType,
          pdfX,
          pdfY,
          pdfWidth,
          pdfHeight,
          rotation: 0,
          zIndex: customElementsRef.current.length + 1,
          color: isHl ? (activeColor === "black" ? "#fef08a" : activeColor) : activeColor || "#000000",
          strokeWidth: activeStrokeWidth || 2,
          fillColor: isHl || isWhiteout || isRedact ? "transparent" : (activeFillColor || "transparent"),
          strokeStyle: activeStrokeStyle || "solid",
        };

        const nextElements = [...customElementsRef.current, newElem];
        customElementsRef.current = nextElements;
        setCustomElements(nextElements);
        setSelectedElementId(newElem.id);
        saveSnapshot(actionLabel, { customElements: nextElements });
      } else {
        // User clicked -> default size
        const w = isHl ? 150 : (isWhiteout || isRedact ? 140 : (isIconLike ? 60 : 120));
        const h = isHl ? 18 : (isWhiteout || isRedact ? 24 : (isIconLike ? 60 : 90));
        const pdfX = startX / scale;
        const pdfY = rawPageH - (startY / scale) - h;

        const newElem: CustomElement = {
          id: `${prefix}_${Date.now()}`,
          pageIndex: pageIdx,
          type: elemType,
          pdfX,
          pdfY,
          pdfWidth: w,
          pdfHeight: h,
          rotation: 0,
          zIndex: customElementsRef.current.length + 1,
          color: isHl ? (activeColor === "black" ? "#fef08a" : activeColor) : activeColor || "#000000",
          strokeWidth: activeStrokeWidth || 2,
          fillColor: isHl || isWhiteout || isRedact ? "transparent" : (activeFillColor || "transparent"),
          strokeStyle: activeStrokeStyle || "solid",
        };

        const nextElements = [...customElementsRef.current, newElem];
        customElementsRef.current = nextElements;
        setCustomElements(nextElements);
        setSelectedElementId(newElem.id);
        saveSnapshot(actionLabel, { customElements: nextElements });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Click-to-Type Everywhere & Canvas Interaction
  const handleCanvasContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const paper = paperRef.current;
    if (!paper || !pdfDoc) return;

    const rect = paper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pageIdx = currentPage - 1;

    // PDF Coordinate mapping (Y from bottom)
    const pdfX = clickX / scale;
    const pdfY = (paper.offsetHeight - clickY) / scale;

    if (activeTool === "hand") return;

    // Whiteout, redact, highlight, shapes and arrows are handled in handlePaperPointerDown
    if (
      activeTool === "whiteout" || 
      activeTool === "redact" || 
      activeTool === "highlight" ||
      [
        "rect", "rounded-rect", "circle", "triangle", "star",
        "line", "arrow", "double-arrow", "callout", "check", "cross"
      ].includes(activeTool)
    ) {
      return;
    }

    // Strict Guard Clause: If something is selected, the user is clicking away to deselect.
    // Deselect it and STOP. Do NOT create a new text block or place new elements.
    if (selectedElementId) {
      setSelectedElementId(null);
      setEditingBlockId(null);
      return;
    }

    if (activeTool === "comment") {
      // Place comment pin
      const newComment: CommentItem = {
        id: `comment_${Date.now()}`,
        pageIndex: pageIdx,
        pdfX,
        pdfY,
        author: "Reviewer",
        text: "Add your review notes here...",
        createdAt: "Just now",
        color: "#f59e0b",
      };
      const nextComments = [...commentsRef.current, newComment];
      commentsRef.current = nextComments;
      setComments(nextComments);
      setSidebarTab("comments");
      setShowSidebar(true);
      saveSnapshot("Add Comment", { comments: nextComments });
      return;
    }

    // CLICK-TO-TYPE:
    // Only in "addText" mode does clicking on empty space create a new text box.
    // In "select" or "edit" mode, clicking empty space deselects so the page displays clean like preview!
    if (activeTool === "addText") {
      // Auto-match font properties from nearest extracted text
      const currentBlocks = pageTextBlocks[pageIdx] || [];
      const matched = findNearestTypography(pdfX, pdfY, currentBlocks);
      const fSize = matched.fontSize || activeFontSize || 14;
      const w = 160;
      const h = Math.max(28, fSize * 1.5);

      const newElem: CustomElement = {
        id: `txt_${Date.now()}`,
        pageIndex: pageIdx,
        type: "text",
        text: "Type text here",
        currentText: "Type text here",
        pdfX,
        pdfY: pdfY - h,
        pdfWidth: w,
        pdfHeight: h,
        rotation: 0,
        zIndex: customElementsRef.current.length + 1,
        fontSize: fSize,
        fontFamily: matched.fontFamily || activeFontFamily,
        color: matched.color || activeColor,
        isBold: matched.isBold ?? activeIsBold,
        isItalic: matched.isItalic ?? activeIsItalic,
        alignment: "left",
        textAlign: "left",
      };

      const nextElements = [...customElementsRef.current, newElem];
      customElementsRef.current = nextElements;
      setCustomElements(nextElements);
      setSelectedElementId(newElem.id);
      setEditingBlockId(newElem.id);
      saveSnapshot("Add Text Box", { customElements: nextElements });
    } else {
      // Deselect active element to return to normal preview
      setSelectedElementId(null);
    }
  };

  // Drag and Drop Desktop Files onto Canvas (Images, Signatures)
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const paper = paperRef.current;
    if (!paper || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Drop PNG or JPG images onto the document." });
      return;
    }

    const rect = paper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pageIdx = currentPage - 1;
    const rawPageH = rawPageSizeRef.current.height || 841.89;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / Math.max(img.height, 1);
        const w = 160;
        const h = Math.round(w / aspect);

        const newElem: CustomElement = {
          id: `img_${Date.now()}`,
          pageIndex: pageIdx,
          type: "image",
          imageUrl: event.target?.result as string,
          pdfX: clickX / scale,
          pdfY: (rawPageH - (clickY / scale)) - h,
          pdfWidth: w,
          pdfHeight: h,
          rotation: 0,
          zIndex: customElements.length + 1,
          aspectRatioLocked: false,
        };

        setCustomElements(prev => [...prev, newElem]);
        setSelectedElementId(newElem.id);
        saveSnapshot("Drop Image");
        toast({ title: "Image Placed", description: "Use corner handles to resize or rotate." });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(droppedFile);
  };

  // Auto-Detect Form Fields
  const handleAutoDetectFields = async () => {
    try {
      setIsDetectingFields(true);
      const pageIdx = currentPage - 1;
      const blocks = pageTextBlocks[pageIdx] || [];
      const newDetectedFields: FormFieldItem[] = [];

      for (const block of blocks) {
        const lower = block.originalText.toLowerCase();
        // Check for signature line, date line, or underlined blanks
        if (lower.includes("signature") || lower.includes("sign here") || lower.includes("signed")) {
          newDetectedFields.push({
            id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            pageIndex: pageIdx,
            type: "signature",
            name: "Signature",
            pdfX: block.pdfX + block.pdfWidth + 8,
            pdfY: block.pdfY - 8,
            pdfWidth: 150,
            pdfHeight: 32,
          });
        } else if (lower.includes("date") || lower.includes("dated")) {
          newDetectedFields.push({
            id: `date_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            pageIndex: pageIdx,
            type: "date",
            name: "Date",
            pdfX: block.pdfX + block.pdfWidth + 8,
            pdfY: block.pdfY - 4,
            pdfWidth: 120,
            pdfHeight: 24,
          });
        } else if (block.originalText.includes("_____") || block.originalText.endsWith(":")) {
          newDetectedFields.push({
            id: `txt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            pageIndex: pageIdx,
            type: "text",
            name: block.originalText.replace(/[:_]/g, "").trim() || "Field",
            pdfX: block.pdfX + block.pdfWidth + 6,
            pdfY: block.pdfY - 4,
            pdfWidth: 140,
            pdfHeight: 24,
          });
        }
      }

      if (newDetectedFields.length > 0) {
        setFormFields(prev => [...prev, ...newDetectedFields]);
        saveSnapshot("Auto-Detect Fields");
        toast({ title: "Fields Detected!", description: `Placed ${newDetectedFields.length} interactive form fields.` });
      } else {
        toast({ title: "No Blanks Found", description: "Use the Form Palette to place fields manually." });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDetectingFields(false);
    }
  };

  // Add Form Field manually
  const handleAddFormField = (type: FormFieldType) => {
    const pageIdx = currentPage - 1;
    const newField: FormFieldItem = {
      id: `field_${Date.now()}`,
      pageIndex: pageIdx,
      type,
      name: `${type.toUpperCase()}_FIELD`,
      pdfX: 60,
      pdfY: 700,
      pdfWidth: type === "checkbox" || type === "radio" ? 22 : 140,
      pdfHeight: type === "checkbox" || type === "radio" ? 22 : 28,
    };
    setFormFields(prev => [...prev, newField]);
    saveSnapshot(`Add ${type} field`);
    toast({ title: "Field Added", description: "Drag field to desired position on document." });
  };

  // Hand Tool Pan Handlers
  const handlePanPointerDown = (e: React.PointerEvent) => {
    if (activeTool !== "hand") return;
    const container = viewportContainerRef.current;
    if (!container) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePanPointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current || !viewportContainerRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    viewportContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    viewportContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handlePanPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  };

  // Layer Ordering (Z-Index)
  const handleBringForward = (id: string) => {
    setCustomElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
    saveSnapshot("Bring Forward");
  };

  const handleSendBackward = (id: string) => {
    setCustomElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
    saveSnapshot("Send Backward");
  };

  // Save / Export PDF
  const handleSave = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      let workingBuffer = await file.arrayBuffer();

      // 1. Gather all vector redactions for modified, moved, or deleted existing text blocks & images
      const remainingRedactions: RedactionItem[] = [];

      Object.keys(pageTextBlocks).forEach(pageStr => {
        const pIdx = parseInt(pageStr, 10);
        const blocks = pageTextBlocks[pIdx] || [];
        for (const block of blocks) {
          const isModified = checkIsBlockModified(block);

          if (isModified) {
            // Generate tight per-line redaction rectangles to completely avoid collateral erasure
            if (block.children && block.children.length > 0) {
              for (const child of block.children) {
                const fSize = child.height || block.fontSize || 12;
                remainingRedactions.push({
                  pageIndex: pIdx,
                  pdfRect: {
                    x: child.x,
                    y: child.y - (fSize * 0.05),
                    width: child.width,
                    height: fSize * 0.81,
                  },
                });
              }
            } else {
              const origX = block.origPdfX !== undefined ? block.origPdfX : block.pdfX;
              const origY = block.origPdfY !== undefined ? block.origPdfY : block.pdfY;
              const origW = block.origPdfWidth !== undefined ? block.origPdfWidth : block.pdfWidth;
              const origH = block.origPdfHeight !== undefined ? block.origPdfHeight : block.pdfHeight;
              const fSize = block.fontSize || 12;
              const redactY = block.minY !== undefined
                ? block.minY - (fSize * 0.05)
                : (origY - (fSize * 0.05));
              const redactH = (block.minY !== undefined && block.maxY !== undefined)
                ? (block.maxY - block.minY) + (fSize * 0.05)
                : Math.min(origH, fSize * 0.81);
              const redactX = (block.minX !== undefined ? block.minX : origX);
              const redactW = Math.max(origW, (block.maxX !== undefined && block.minX !== undefined) ? (block.maxX - block.minX) : origW);

              remainingRedactions.push({
                pageIndex: pIdx,
                pdfRect: {
                  x: redactX,
                  y: redactY,
                  width: redactW,
                  height: redactH,
                },
              });
            }
          }
        }
      });

      // Masked original detected images that were moved or deleted by the user
      maskedImageIds.forEach(id => {
        Object.values(detectedImages).flat().forEach(img => {
          if (img.id === id) {
            remainingRedactions.push({
              pageIndex: img.pageIndex,
              pdfRect: {
                x: img.pdfX,
                y: img.pdfY,
                width: img.pdfWidth,
                height: img.pdfHeight,
              },
            });
          }
        });
      });

      // 2. Offload MuPDF WebAssembly vector text deletion & stream sanitization to Web Worker
      // This permanently strips the text/image operators from the PDF stream at the Wasm level.
      // Eliminates phantom text, prevents search/screen-reader leaks, and avoids ugly whiteout boxes.
      if (remainingRedactions.length > 0) {
        try {
          workingBuffer = await sanitizePdfStream(workingBuffer, remainingRedactions);
        } catch (workerErr) {
          console.warn("MuPDF vector redaction fallback notice:", workerErr);
        }
      }

      // 3. Load the sanitized PDF stream into pdf-lib to insert replacement / new vector text
      const doc = await PDFDocument.load(workingBuffer);
      
      // Lazy font cache to avoid embedding unused fonts and speed up export compilation drastically
      const fontCache = new Map<string, any>();
      const pickFontAsync = async (family?: string, bold?: boolean, italic?: boolean) => {
        return embedCustomOrStandardFont(doc, fontCache, family, bold, italic);
      };

      const pages = doc.getPages();

      // 4. Native Vector Text Pass: Draw modified/moved text at updated coordinates using page.drawText()
      // MuPDF has already permanently scrubbed the old text from the stream, so no whiteout boxes are needed!
      for (const pageStr of Object.keys(pageTextBlocks)) {
        const pIdx = parseInt(pageStr, 10);
        const page = pages[pIdx];
        if (!page) continue;

        const blocks = pageTextBlocks[pIdx] || [];
        for (const block of blocks) {
          const isModified = checkIsBlockModified(block);

          // Only draw if modified, NOT deleted, and has non-empty text
          if (isModified && !block.isDeleted && block.currentText.trim().length > 0) {
            // Fail-safe PDF background mask: Draw tight per-line solid rectangles over original text area
            // ensuring zero ghosting or character overlap even if MuPDF stream sanitization misses.
            if (block.children && block.children.length > 0) {
              for (const child of block.children) {
                const fSize = child.height || block.fontSize || 12;
                page.drawRectangle({
                  x: child.x,
                  y: child.y - (fSize * 0.05),
                  width: child.width,
                  height: fSize * 0.81,
                  color: parseColorToRgb(block.maskColor || "#ffffff"),
                });
              }
            } else {
              const origX = block.origPdfX !== undefined ? block.origPdfX : block.pdfX;
              const origY = block.origPdfY !== undefined ? block.origPdfY : block.pdfY;
              const origW = block.origPdfWidth !== undefined ? block.origPdfWidth : block.pdfWidth;
              const origH = block.origPdfHeight !== undefined ? block.origPdfHeight : block.pdfHeight;
              const fSize = block.fontSize || 12;
              const redactY = block.minY !== undefined
                ? block.minY - (fSize * 0.05)
                : (origY - (fSize * 0.05));
              const redactH = (block.minY !== undefined && block.maxY !== undefined)
                ? (block.maxY - block.minY) + (fSize * 0.05)
                : Math.min(origH, fSize * 0.81);
              const redactX = (block.minX !== undefined ? block.minX : origX);
              const redactW = Math.max(origW, (block.maxX !== undefined && block.minX !== undefined) ? (block.maxX - block.minX) : origW);

              page.drawRectangle({
                x: redactX,
                y: redactY,
                width: redactW,
                height: redactH,
                color: parseColorToRgb(block.maskColor || "#ffffff"),
              });
            }

            if (block.richHtml && block.richHtml !== block.currentText && /<(b|strong|i|em|span|font|mark)\b/i.test(block.richHtml)) {
              const spans = parseRichTextSpans(
                block.richHtml,
                block.fontFamily,
                block.fontSize || 12,
                block.color || "#000000",
                block.fontWeight === "bold" || !!block.isBold,
                block.fontStyle === "italic" || !!block.isItalic
              );

              let currentX = block.pdfX;
              let currentY = block.pdfY;
              const defaultLineHeight = (block.fontSize || 12) * 1.25;

              for (const span of spans) {
                const { font: spanFont, isCustom } = await pickFontAsync(span.fontFamily || block.fontFamily, span.isBold, span.isItalic);
                const spanColor = parseColorToRgb(span.color || block.color);
                const spanSize = span.fontSize || block.fontSize || 12;

                const lines = span.text.split("\n");
                for (let li = 0; li < lines.length; li++) {
                  if (li > 0) {
                    currentX = block.pdfX;
                    currentY -= defaultLineHeight;
                  }
                  const chunk = sanitizeTextForPdf(lines[li], isCustom);
                  if (chunk.length > 0) {
                    page.drawText(chunk, {
                      x: currentX,
                      y: currentY,
                      size: spanSize,
                      font: spanFont,
                      color: spanColor,
                    });
                    try {
                      currentX += spanFont.widthOfTextAtSize(chunk, spanSize);
                    } catch {
                      currentX += chunk.length * spanSize * 0.55;
                    }
                  }
                }
              }
            } else {
              const lines = block.currentText.split('\n');
              const textColor = parseColorToRgb(block.color);
              const isBold = block.fontWeight === "bold" || !!block.isBold;
              const isItalic = block.fontStyle === "italic" || !!block.isItalic;
              const { font, isCustom } = await pickFontAsync(block.fontFamily, isBold, isItalic);
              const size = block.fontSize || 12;

              // Calculate movement delta from origPdfX/origPdfY
              const origBaseX = block.origPdfX !== undefined ? block.origPdfX : block.pdfX;
              const origBaseY = block.origPdfY !== undefined ? block.origPdfY : block.pdfY;
              const moveDx = block.pdfX - origBaseX;
              const moveDy = block.pdfY - origBaseY;

              // Calculate measured line height from children if available
              let measuredLineHeight = size * 1.25;
              if (block.children && block.children.length >= 2) {
                const diff = Math.abs(block.children[0].y - block.children[1].y);
                if (diff > 0.5) {
                  measuredLineHeight = diff;
                }
              }

              lines.forEach((line, index) => {
                const safeText = sanitizeTextForPdf(line, isCustom);
                if (safeText.length === 0) return;

                // If child coordinates exist for this line index, use child's exact baseline and X indent!
                let lineX = block.pdfX;
                let lineY = block.pdfY - (index * measuredLineHeight);

                if (block.children && block.children[index]) {
                  lineX = block.children[index].x + moveDx;
                  lineY = block.children[index].y + moveDy;
                } else if (index > 0 && block.children && block.children[index - 1]) {
                  lineY = (block.children[index - 1].y + moveDy) - measuredLineHeight;
                }

                page.drawText(safeText, {
                  x: lineX,
                  y: lineY,
                  size,
                  font,
                  color: textColor,
                });
              });
            }
          }
        }
      }

      // Fail-safe whiteout rectangle for moved or deleted detected images
      maskedImageIds.forEach(id => {
        Object.values(detectedImages).flat().forEach(img => {
          if (img.id === id) {
            const page = pages[img.pageIndex];
            if (page) {
              page.drawRectangle({
                x: img.pdfX,
                y: img.pdfY,
                width: img.pdfWidth,
                height: img.pdfHeight,
                color: rgb(1, 1, 1),
              });
            }
          }
        });
      });

      // 2. Process Custom Elements (Text, Images, Redactions, Highlights, Whiteouts)
      // Sort by zIndex so painter's algorithm renders in strict visual layer order
      const sortedElements = [...customElements].sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10));
      for (const elem of sortedElements) {
        const page = pages[elem.pageIndex];
        if (!page) continue;

        if (elem.type === "redaction") {
          // Blackout redaction: permanent scrub
          page.drawRectangle({
            x: elem.pdfX,
            y: elem.pdfY,
            width: elem.pdfWidth,
            height: elem.pdfHeight,
            color: rgb(0, 0, 0),
          });
        } else if (elem.type === "whiteout") {
          // Whiteout: permanent opaque white cover
          page.drawRectangle({
            x: elem.pdfX,
            y: elem.pdfY,
            width: elem.pdfWidth,
            height: elem.pdfHeight,
            color: rgb(1, 1, 1),
          });
        } else if (elem.type === "highlight") {
          // Semi-transparent yellow highlight
          page.drawRectangle({
            x: elem.pdfX,
            y: elem.pdfY,
            width: elem.pdfWidth,
            height: elem.pdfHeight,
            color: parseColorToRgb(elem.color || "#fef08a"),
            opacity: 0.45,
          });
        } else if (elem.type === "rect" || elem.type === "rounded-rect") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const fillColor = elem.fillColor && elem.fillColor !== "transparent" ? parseColorToRgb(elem.fillColor) : undefined;
          const isDashed = elem.strokeStyle === "dashed";
          page.drawRectangle({
            x: elem.pdfX,
            y: elem.pdfY,
            width: elem.pdfWidth,
            height: elem.pdfHeight,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 2,
            color: fillColor,
            borderDashArray: isDashed ? [4, 4] : undefined,
          });
        } else if (elem.type === "circle") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const fillColor = elem.fillColor && elem.fillColor !== "transparent" ? parseColorToRgb(elem.fillColor) : undefined;
          const isDashed = elem.strokeStyle === "dashed";
          page.drawEllipse({
            x: elem.pdfX + elem.pdfWidth / 2,
            y: elem.pdfY + elem.pdfHeight / 2,
            xScale: elem.pdfWidth / 2,
            yScale: elem.pdfHeight / 2,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 2,
            color: fillColor,
            borderDashArray: isDashed ? [4, 4] : undefined,
          });
        } else if (elem.type === "triangle") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const thickness = elem.strokeWidth || 2;
          const dashArray = elem.strokeStyle === "dashed" ? [4, 4] : undefined;
          const p1 = { x: elem.pdfX + elem.pdfWidth / 2, y: elem.pdfY + elem.pdfHeight };
          const p2 = { x: elem.pdfX + elem.pdfWidth, y: elem.pdfY };
          const p3 = { x: elem.pdfX, y: elem.pdfY };
          page.drawLine({ start: p1, end: p2, thickness, color: strokeColor, dashArray });
          page.drawLine({ start: p2, end: p3, thickness, color: strokeColor, dashArray });
          page.drawLine({ start: p3, end: p1, thickness, color: strokeColor, dashArray });
        } else if (elem.type === "star") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const thickness = elem.strokeWidth || 2;
          const dashArray = elem.strokeStyle === "dashed" ? [4, 4] : undefined;
          const cx = elem.pdfX + elem.pdfWidth / 2;
          const cy = elem.pdfY + elem.pdfHeight / 2;
          const rx = elem.pdfWidth / 2;
          const ry = elem.pdfHeight / 2;
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i < 10; i++) {
            const r = (i % 2 === 0) ? 1 : 0.42;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            pts.push({ x: cx + rx * r * Math.cos(a), y: cy - ry * r * Math.sin(a) });
          }
          for (let i = 0; i < 10; i++) {
            page.drawLine({ start: pts[i], end: pts[(i + 1) % 10], thickness, color: strokeColor, dashArray });
          }
        } else if (elem.type === "line") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const isDashed = elem.strokeStyle === "dashed";
          const startPt = {
            x: elem.startPdfX !== undefined ? elem.startPdfX : elem.pdfX,
            y: elem.startPdfY !== undefined ? elem.startPdfY : (elem.pdfY + elem.pdfHeight),
          };
          const endPt = {
            x: elem.endPdfX !== undefined ? elem.endPdfX : (elem.pdfX + elem.pdfWidth),
            y: elem.endPdfY !== undefined ? elem.endPdfY : elem.pdfY,
          };
          page.drawLine({
            start: startPt,
            end: endPt,
            thickness: elem.strokeWidth || 2,
            color: strokeColor,
            dashArray: isDashed ? [4, 4] : undefined,
          });
        } else if (elem.type === "arrow" || elem.type === "double-arrow") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const startPt = {
            x: elem.startPdfX !== undefined ? elem.startPdfX : elem.pdfX,
            y: elem.startPdfY !== undefined ? elem.startPdfY : (elem.pdfY + elem.pdfHeight),
          };
          const endPt = {
            x: elem.endPdfX !== undefined ? elem.endPdfX : (elem.pdfX + elem.pdfWidth),
            y: elem.endPdfY !== undefined ? elem.endPdfY : elem.pdfY,
          };
          const thickness = elem.strokeWidth || 2;
          const isDashed = elem.strokeStyle === "dashed";
          page.drawLine({
            start: startPt,
            end: endPt,
            thickness,
            color: strokeColor,
            dashArray: isDashed ? [4, 4] : undefined,
          });
          const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
          const headLen = Math.max(9, thickness * 3.5);
          page.drawLine({
            start: endPt,
            end: {
              x: endPt.x - headLen * Math.cos(angle - Math.PI / 6),
              y: endPt.y - headLen * Math.sin(angle - Math.PI / 6),
            },
            thickness,
            color: strokeColor,
          });
          page.drawLine({
            start: endPt,
            end: {
              x: endPt.x - headLen * Math.cos(angle + Math.PI / 6),
              y: endPt.y - headLen * Math.sin(angle + Math.PI / 6),
            },
            thickness,
            color: strokeColor,
          });
          if (elem.type === "double-arrow") {
            const startAngle = Math.atan2(startPt.y - endPt.y, startPt.x - endPt.x);
            page.drawLine({
              start: startPt,
              end: {
                x: startPt.x - headLen * Math.cos(startAngle - Math.PI / 6),
                y: startPt.y - headLen * Math.sin(startAngle - Math.PI / 6),
              },
              thickness,
              color: strokeColor,
            });
            page.drawLine({
              start: startPt,
              end: {
                x: startPt.x - headLen * Math.cos(startAngle + Math.PI / 6),
                y: startPt.y - headLen * Math.sin(startAngle + Math.PI / 6),
              },
              thickness,
              color: strokeColor,
            });
          }
        } else if (elem.type === "callout") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const fillColor = elem.fillColor && elem.fillColor !== "transparent" ? parseColorToRgb(elem.fillColor) : undefined;
          const thickness = elem.strokeWidth || 2;
          const bodyH = elem.pdfHeight * 0.75;
          page.drawRectangle({
            x: elem.pdfX,
            y: elem.pdfY + (elem.pdfHeight - bodyH),
            width: elem.pdfWidth,
            height: bodyH,
            borderColor: strokeColor,
            borderWidth: thickness,
            color: fillColor,
          });
          // Tail
          const tailP1 = { x: elem.pdfX + elem.pdfWidth * 0.25, y: elem.pdfY + (elem.pdfHeight - bodyH) };
          const tailTip = { x: elem.pdfX + elem.pdfWidth * 0.15, y: elem.pdfY };
          const tailP2 = { x: elem.pdfX + elem.pdfWidth * 0.45, y: elem.pdfY + (elem.pdfHeight - bodyH) };
          page.drawLine({ start: tailP1, end: tailTip, thickness, color: strokeColor });
          page.drawLine({ start: tailTip, end: tailP2, thickness, color: strokeColor });
        } else if (elem.type === "check") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const thickness = (elem.strokeWidth || 2) * 1.4;
          const p1 = { x: elem.pdfX + elem.pdfWidth * 0.15, y: elem.pdfY + elem.pdfHeight * 0.45 };
          const p2 = { x: elem.pdfX + elem.pdfWidth * 0.4, y: elem.pdfY + elem.pdfHeight * 0.2 };
          const p3 = { x: elem.pdfX + elem.pdfWidth * 0.85, y: elem.pdfY + elem.pdfHeight * 0.8 };
          page.drawLine({ start: p1, end: p2, thickness, color: strokeColor });
          page.drawLine({ start: p2, end: p3, thickness, color: strokeColor });
        } else if (elem.type === "cross") {
          const strokeColor = parseColorToRgb(elem.color || "#000000");
          const thickness = (elem.strokeWidth || 2) * 1.4;
          page.drawLine({
            start: { x: elem.pdfX + elem.pdfWidth * 0.15, y: elem.pdfY + elem.pdfHeight * 0.85 },
            end: { x: elem.pdfX + elem.pdfWidth * 0.85, y: elem.pdfY + elem.pdfHeight * 0.15 },
            thickness,
            color: strokeColor,
          });
          page.drawLine({
            start: { x: elem.pdfX + elem.pdfWidth * 0.15, y: elem.pdfY + elem.pdfHeight * 0.15 },
            end: { x: elem.pdfX + elem.pdfWidth * 0.85, y: elem.pdfY + elem.pdfHeight * 0.85 },
            thickness,
            color: strokeColor,
          });
        } else if (elem.type === "text" && ((elem.text || elem.currentText || "").trim().length > 0)) {
          const rawText = elem.text || elem.currentText || "";
          if (elem.richHtml && elem.richHtml !== rawText) {
            const spans = parseRichTextSpans(
              elem.richHtml,
              elem.fontFamily,
              elem.fontSize || 14,
              elem.color || "#000000",
              !!elem.isBold,
              !!elem.isItalic
            );

            let currentX = elem.pdfX;
            let currentY = elem.pdfY;
            const defaultLineHeight = (elem.fontSize || 14) * 1.25;

            for (const span of spans) {
              const { font: spanFont, isCustom } = await pickFontAsync(span.fontFamily || elem.fontFamily, span.isBold, span.isItalic);
              const spanColor = parseColorToRgb(span.color || elem.color);
              const spanSize = span.fontSize || elem.fontSize || 14;

              const lines = span.text.split("\n");
              for (let li = 0; li < lines.length; li++) {
                if (li > 0) {
                  currentX = elem.pdfX;
                  currentY -= defaultLineHeight;
                }
                const chunk = sanitizeTextForPdf(lines[li], isCustom);
                if (chunk.length > 0) {
                  page.drawText(chunk, {
                    x: currentX,
                    y: currentY,
                    size: spanSize,
                    font: spanFont,
                    color: spanColor,
                  });
                  try {
                    currentX += spanFont.widthOfTextAtSize(chunk, spanSize);
                  } catch {
                    currentX += chunk.length * spanSize * 0.55;
                  }
                }
              }
            }
          } else {
            const textColor = parseColorToRgb(elem.color);
            const { font: textFont, isCustom } = await pickFontAsync(elem.fontFamily, elem.isBold, elem.isItalic);
            const safeText = sanitizeTextForPdf(rawText, isCustom);

            page.drawText(safeText, {
              x: elem.pdfX,
              y: elem.pdfY,
              size: elem.fontSize || 14,
              font: textFont,
              color: textColor,
            });
          }
        } else if (elem.type === "image" && elem.imageUrl) {
          try {
            const imageBytes = await (await fetch(elem.imageUrl)).arrayBuffer();
            let embeddedImg;
            try {
              embeddedImg = await doc.embedPng(imageBytes);
            } catch {
              embeddedImg = await doc.embedJpg(imageBytes);
            }

            page.drawImage(embeddedImg, {
              x: elem.pdfX,
              y: elem.pdfY,
              width: elem.pdfWidth,
              height: elem.pdfHeight,
            });
          } catch (imgErr) {
            console.error("Failed to embed image:", imgErr);
          }
        }
      }

      // 2.5 Process Freehand Drawing Ink Strokes
      if (drawingStrokes.length > 0) {
        const rawPageH = rawPageSizeRef.current.height || 841.89;
        for (const stroke of drawingStrokes) {
          const page = pages[stroke.pageIndex];
          if (!page || !stroke.points || stroke.points.length < 2) continue;
          const strokeColor = parseColorToRgb(stroke.color);
          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            page.drawLine({
              start: { x: p1.x, y: rawPageH - p1.y },
              end: { x: p2.x, y: rawPageH - p2.y },
              thickness: stroke.strokeWidth || 2,
              color: strokeColor,
              opacity: stroke.opacity || 1,
            });
          }
        }
      }

      // 3. Process Native Form Fields
      if (formFields.length > 0) {
        try {
          const form = doc.getForm();
          for (const ff of formFields) {
            const page = pages[ff.pageIndex];
            if (!page) continue;

            if (ff.type === "text") {
              const textField = form.createTextField(ff.name);
              textField.setText(ff.value || "");
              textField.addToPage(page, {
                x: ff.pdfX,
                y: ff.pdfY,
                width: ff.pdfWidth,
                height: ff.pdfHeight,
              });
            } else if (ff.type === "checkbox") {
              const checkBox = form.createCheckBox(ff.name);
              if (ff.isChecked) checkBox.check();
              checkBox.addToPage(page, {
                x: ff.pdfX,
                y: ff.pdfY,
                width: ff.pdfWidth,
                height: ff.pdfHeight,
              });
            }
          }
        } catch (formErr) {
          console.error("Form field embed error:", formErr);
        }
      }

      const pdfBytes = await doc.save({ useObjectStreams: true });
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const downloadName = fileName.endsWith(".pdf") ? `edited_${fileName}` : `${fileName}.pdf`;
      const sizeKb = Math.max(1, Math.round(blob.size / 1024));

      setExportPreviewData({
        url,
        blob,
        fileName: downloadName,
        sizeKb,
        pageCount: pages.length,
      });

      setIsProcessing(false);
      toast({
        title: "Export Compiled! 🎉",
        description: "Preview your PDF before downloading.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: "Could not compile PDF changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExportedPdf = () => {
    if (!exportPreviewData) return;
    const link = document.createElement("a");
    link.href = exportPreviewData.url;
    link.download = exportPreviewData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Download Complete! 🎉",
      description: `Saved ${exportPreviewData.fileName} to your device.`,
    });
  };

  const handleCloseExportPreview = () => {
    if (exportPreviewData?.url) {
      URL.revokeObjectURL(exportPreviewData.url);
    }
    setExportPreviewData(null);
  };

  const pageIdx = currentPage - 1;
  const currentPageBlocks = pageTextBlocks[pageIdx] || [];
  const currentPageElements = customElements.filter(e => e.pageIndex === pageIdx);
  const selectedCustomElement = customElements.find(e => e.id === selectedElementId);
  const selectedExistingBlock = currentPageBlocks.find(b => b.id === selectedElementId);

  // Synchronize Top Ribbon Controls with Selected Text Element or Block
  useEffect(() => {
    if (!selectedElementId) return;

    if (selectedExistingBlock) {
      if (selectedExistingBlock.fontSize) setActiveFontSize(selectedExistingBlock.fontSize);
      if (selectedExistingBlock.fontFamily) setActiveFontFamily(selectedExistingBlock.fontFamily);
      if (selectedExistingBlock.color) setActiveColor(selectedExistingBlock.color);
      setActiveIsBold(selectedExistingBlock.fontWeight === "bold" || !!selectedExistingBlock.isBold);
      setActiveIsItalic(selectedExistingBlock.fontStyle === "italic" || !!selectedExistingBlock.isItalic);
      return;
    }

    if (selectedCustomElement) {
      if (selectedCustomElement.fontSize) setActiveFontSize(selectedCustomElement.fontSize);
      if (selectedCustomElement.fontFamily) setActiveFontFamily(selectedCustomElement.fontFamily);
      if (selectedCustomElement.color) setActiveColor(selectedCustomElement.color);
      if (selectedCustomElement.strokeWidth) setActiveStrokeWidth(selectedCustomElement.strokeWidth);
      if (selectedCustomElement.strokeStyle) setActiveStrokeStyle(selectedCustomElement.strokeStyle);
      if (selectedCustomElement.fillColor) setActiveFillColor(selectedCustomElement.fillColor);
      if (selectedCustomElement.isBold !== undefined) setActiveIsBold(selectedCustomElement.isBold);
      if (selectedCustomElement.isItalic !== undefined) setActiveIsItalic(selectedCustomElement.isItalic);
    }
  }, [selectedElementId, selectedExistingBlock, selectedCustomElement]);

  const isCurrentShapeActive = [
    "rect", "rounded-rect", "circle", "triangle", "star", 
    "line", "arrow", "double-arrow", "callout", "check", "cross"
  ].includes(activeTool) || (
    !!selectedCustomElement && [
      "rect", "rounded-rect", "circle", "triangle", "star", 
      "line", "arrow", "double-arrow", "callout", "check", "cross"
    ].includes(selectedCustomElement.type)
  );

  return (
    <ToolLayout 
      title="PDF Editor Studio" 
      description="Desktop-grade PDF document studio with in-place text reflow, transform handles, forms, and drawing."
      fullWidth={true}
    >
      {!file ? (
        // Empty Upload State with Studio Launchpad Styling
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen bg-slate-50/80 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.06),rgba(255,255,255,0))] relative">
          {/* Top Return Navigation */}
          <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
            <Link href="/" prefetch={true} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/80 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs hover:bg-slate-50 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to All Tools</span>
            </Link>
          </div>

          <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl shadow-slate-200/50 rounded-3xl p-8 sm:p-12 space-y-8">
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Desktop Studio PDF Suite</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                Open any PDF to edit text directly
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
                Upload your contract, certificate, resume, or document. Click to type anywhere, edit in-place, add signatures, or draw.
              </p>
            </div>

            <FileUpload onFilesSelected={handleFilesSelected} multiple={false} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200/80" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Or start with a clean page</span>
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                size="lg" 
                variant="outline" 
                onClick={handleCreateNew} 
                className="gap-2 rounded-2xl font-bold border-slate-200/90 hover:bg-slate-100/80 text-slate-800 shadow-xs h-11 px-6"
              >
                <PlusCircle className="h-4 w-4 text-rose-600" /> 
                <span>Create Blank A4 Document</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Full Desktop Studio Workspace with Precision Dot Matrix Grid
        <div className="fixed inset-0 z-40 flex flex-col h-screen w-screen overflow-hidden bg-slate-100/90 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]">
          {/* Row 1: Unified Document & Navigation Header */}
          <div className="h-12 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 px-3.5 flex items-center justify-between gap-2 shrink-0 z-30 shadow-2xs">
            {/* Left: Navigation & Document Rename */}
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <Link href="/" prefetch={true}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl shrink-0" title="Back to All Tools">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="h-4 w-4 text-rose-600 shrink-0" />
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="h-7.5 font-bold text-xs sm:text-sm w-32 sm:w-44 md:w-52 border border-transparent hover:border-slate-200 focus-visible:border-slate-400 rounded-lg bg-transparent px-1.5 shadow-none truncate transition-colors"
                  title="Click to rename document"
                />
              </div>

              {/* Auto-Save Indicator */}
              <div className="hidden xl:flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Saved</span>
              </div>
            </div>

            {/* Center: History, Viewing & Zoom Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Undo / Redo Buttons */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7.5 w-7.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  onClick={handleUndo}
                  disabled={!historyManager.canUndo()}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7.5 w-7.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  onClick={handleRedo}
                  disabled={!historyManager.canRedo()}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Fit Controls */}
              <div className="flex items-center gap-1 border-l border-slate-200/80 pl-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitPage}
                  className="h-7.5 px-2.5 text-[11px] font-semibold gap-1 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-700"
                  title="Fit entire page to screen"
                >
                  <Minimize2 className="h-3 w-3 text-rose-600" />
                  <span className="hidden md:inline">Fit Page</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitWidth}
                  className="h-7.5 px-2.5 text-[11px] font-semibold gap-1 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-700"
                  title="Fit width of document"
                >
                  <ChevronsLeftRight className="h-3 w-3 text-slate-600" />
                  <span className="hidden md:inline">Fit Width</span>
                </Button>
              </div>

              {/* Free-form Zoom Suite (Slider, Editable Input, Stepper) */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-xl bg-slate-50/80 h-7.5 px-1.5 shadow-2xs">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 rounded-md p-0 text-slate-500 hover:text-slate-900"
                  onClick={() => setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)))}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <input 
                  type="range"
                  min="25"
                  max="400"
                  step="5"
                  value={Math.round(scale * 100)}
                  onChange={(e) => setScale(+(Number(e.target.value) / 100).toFixed(2))}
                  className="w-14 md:w-20 h-1.5 accent-rose-600 cursor-pointer hidden sm:inline-block"
                  title="Free Zoom Slider (25% - 400%)"
                />
                <input
                  type="text"
                  value={zoomInputFocused ? zoomInputValue : `${Math.round(scale * 100)}%`}
                  onFocus={() => {
                    setZoomInputFocused(true);
                    setZoomInputValue(String(Math.round(scale * 100)));
                  }}
                  onChange={(e) => setZoomInputValue(e.target.value)}
                  onBlur={() => {
                    setZoomInputFocused(false);
                    const val = parseInt(zoomInputValue.replace(/[^0-9]/g, ""), 10);
                    if (!isNaN(val) && val >= 25 && val <= 400) {
                      setScale(+(val / 100).toFixed(2));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-11 text-center text-[11px] font-mono font-bold bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-rose-500 rounded px-0.5 text-slate-800"
                  title="Click to type custom zoom %"
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 rounded-md p-0 text-slate-500 hover:text-slate-900"
                  onClick={() => setScale(s => Math.min(4.0, +(s + 0.1).toFixed(2)))}
                  title="Zoom In"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              {/* Preview Toggle Button */}
              <Button
                variant={previewMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPreviewMode(!previewMode);
                  setSelectedElementId(null);
                }}
                className={`h-7.5 px-2.5 text-[11px] font-semibold gap-1 rounded-lg transition-all ${
                  previewMode 
                    ? "bg-slate-900 text-white hover:bg-slate-800 shadow-xs" 
                    : "border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
                title="Toggle clean preview mode"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{previewMode ? "Edit Mode" : "Preview"}</span>
              </Button>
            </div>

            {/* Right: Actions & Export */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-100 flex gap-1 px-2.5 rounded-lg font-medium"
                onClick={() => openDocInputRef.current?.click()}
                title="Open a different PDF document"
              >
                <Upload className="h-3.5 w-3.5 text-rose-600" />
                <span className="hidden lg:inline">Open PDF</span>
              </Button>
              <input
                ref={openDocInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7.5 text-xs text-slate-500 hover:text-rose-600 rounded-lg flex gap-1 px-2"
                onClick={() => {
                  setPageTextBlocks({});
                  setCustomElements([]);
                  setDrawingStrokes([]);
                  setFormFields([]);
                  setComments([]);
                  toast({ title: "Reset", description: "Reverted document modifications." });
                }}
                title="Discard all edits"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden lg:inline">Reset</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
                className="h-7.5 w-7.5 rounded-lg text-slate-500 hover:text-slate-900 flex"
                title="Toggle Sidebar"
              >
                {showSidebar ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isProcessing}
                className="h-8 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-md shadow-red-500/25 gap-1.5 px-3.5 rounded-xl text-xs hover:-translate-y-0.5 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isProcessing ? "Compiling..." : "Export PDF"}</span>
              </Button>
            </div>
          </div>

          {/* Row 2: Studio Tools & Active Properties Ribbon (Zero-Scroll Compact Layout) */}
          <div className="h-11 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3.5 flex items-center justify-between gap-2 shrink-0 z-20 select-none shadow-2xs">
            {/* Left: Primary Action Tools Group */}
            <div className="flex items-center gap-1 shrink-0">
              {/* In-Place Text */}
              <Button
                variant={activeTool === "edit" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("edit"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "edit" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="In-Place Text: Click any existing text to edit directly"
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit Text</span>
              </Button>

              {/* Click to Type */}
              <Button
                variant={activeTool === "addText" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("addText"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "addText" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Add Text: Click anywhere on page to type"
              >
                <Type className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Text</span>
              </Button>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* Freehand Ink */}
              <Button
                variant={activeTool === "draw" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("draw"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-1.5 md:px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "draw" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Freehand Ink: Draw or sign"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Ink</span>
              </Button>

              {/* Highlight */}
              <Button
                variant={activeTool === "highlight" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("highlight"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-1.5 md:px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "highlight" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Highlight: Drag over text"
              >
                <Highlighter className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Highlight</span>
              </Button>

              {/* Whiteout */}
              <Button
                variant={activeTool === "whiteout" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("whiteout"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-1.5 md:px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "whiteout" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Whiteout: Cleanly cover area without border"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Whiteout</span>
              </Button>

              {/* Redact */}
              <Button
                variant={activeTool === "redact" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("redact"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-1.5 md:px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "redact" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Redact: Permanent blackout redaction"
              >
                <Move className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Redact</span>
              </Button>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* Shapes & Arrows Dropdown Popover */}
              <div className="relative">
                <Button
                  variant={isCurrentShapeActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setIsShapesMenuOpen(!isShapesMenuOpen)}
                  className={`h-7 px-2 gap-1 text-xs font-semibold rounded-md ${
                    isCurrentShapeActive ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Shapes & Arrows"
                >
                  {(() => {
                    switch (activeShape) {
                      case "circle": return <Circle className="h-3.5 w-3.5" />;
                      case "triangle": return <Triangle className="h-3.5 w-3.5" />;
                      case "star": return <Star className="h-3.5 w-3.5" />;
                      case "line": return <Minus className="h-3.5 w-3.5" />;
                      case "arrow": return <ArrowRight className="h-3.5 w-3.5" />;
                      case "double-arrow": return <ArrowLeftRight className="h-3.5 w-3.5" />;
                      case "callout": return <MessageSquare className="h-3.5 w-3.5" />;
                      case "check": return <Check className="h-3.5 w-3.5" />;
                      case "cross": return <X className="h-3.5 w-3.5" />;
                      default: return <Square className="h-3.5 w-3.5" />;
                    }
                  })()}
                  <span className="hidden sm:inline">Shapes</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isShapesMenuOpen ? "rotate-180" : ""}`} />
                </Button>

                {/* Shapes Dropdown Flyout Grid */}
                {isShapesMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsShapesMenuOpen(false)} 
                    />
                    <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-64 animate-in fade-in zoom-in-95 duration-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                        Professional Shapes & Arrows
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { id: "rect", label: "Rectangle", icon: Square },
                          { id: "rounded-rect", label: "Rounded Rect", icon: Square },
                          { id: "circle", label: "Circle / Ellipse", icon: Circle },
                          { id: "triangle", label: "Triangle", icon: Triangle },
                          { id: "star", label: "Star", icon: Star },
                          { id: "line", label: "Line", icon: Minus },
                          { id: "arrow", label: "Single Arrow", icon: ArrowRight },
                          { id: "double-arrow", label: "Double Arrow", icon: ArrowLeftRight },
                          { id: "callout", label: "Callout Bubble", icon: MessageSquare },
                          { id: "check", label: "Checkmark", icon: Check },
                          { id: "cross", label: "Cross / X", icon: X },
                        ].map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setActiveTool(id as any);
                              setActiveShape(id as any);
                              setIsShapesMenuOpen(false);
                              setSelectedElementId(null);
                            }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                              activeTool === id 
                                ? "bg-blue-50 text-blue-700 font-bold border border-blue-200" 
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Add Image Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                className="h-7 px-2 gap-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-200/60"
                title="Upload or insert an image"
              >
                <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden md:inline">Image</span>
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleAddImageFile(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />

              {/* Hand Tool */}
              <Button
                variant={activeTool === "hand" ? "default" : "ghost"}
                size="sm"
                onClick={() => { setActiveTool("hand"); setSelectedElementId(null); setIsShapesMenuOpen(false); }}
                className={`h-7 px-1.5 md:px-2 gap-1 text-xs font-semibold rounded-md ${
                  activeTool === "hand" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Hand Tool: Pan around canvas (Spacebar)"
              >
                <Hand className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Pan</span>
              </Button>
            </div>

            {/* Right: Context-Sensitive Properties Inspector */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isCurrentShapeActive ? (
                /* Shape Customization Inspector */
                <div className="flex items-center gap-1.5">
                  {/* Stroke Thickness Stepper & Presets */}
                  <div className="flex items-center gap-1 border border-border/80 rounded-md bg-white px-1.5 h-7">
                    <span className="text-[10px] text-muted-foreground font-medium">Stroke:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(1, (activeStrokeWidth || 2) - 1);
                        setActiveStrokeWidth(next);
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { strokeWidth: next }, "Change Stroke Width");
                      }}
                      className="w-4 h-4 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
                      title="Decrease thickness"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{activeStrokeWidth || 2}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(12, (activeStrokeWidth || 2) + 1);
                        setActiveStrokeWidth(next);
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { strokeWidth: next }, "Change Stroke Width");
                      }}
                      className="w-4 h-4 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
                      title="Increase thickness"
                    >
                      +
                    </button>
                  </div>

                  {/* Stroke Style: Solid vs Dashed */}
                  <div className="flex items-center border border-border/80 rounded-md bg-white h-7 overflow-hidden text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStrokeStyle("solid");
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { strokeStyle: "solid" }, "Solid Stroke");
                      }}
                      className={`px-1.5 h-full ${activeStrokeStyle === "solid" ? "bg-blue-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      Solid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStrokeStyle("dashed");
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { strokeStyle: "dashed" }, "Dashed Stroke");
                      }}
                      className={`px-1.5 h-full border-l border-border/80 ${activeStrokeStyle === "dashed" ? "bg-blue-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      Dash
                    </button>
                  </div>

                  {/* Stroke Color */}
                  <div className="flex items-center gap-1 border border-border/80 rounded-md px-1.5 h-7 bg-white" title="Stroke Color">
                    <span className="text-[10px] text-muted-foreground font-medium">Border:</span>
                    {["#000000", "#2563eb", "#dc2626", "#16a34a", "#f59e0b"].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setActiveColor(c);
                          if (selectedCustomElement) updateElement(selectedCustomElement.id, { color: c, strokeColor: c }, "Change Stroke Color");
                        }}
                        className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-all ${
                          activeColor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary ring-offset-1 scale-110" : "opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={activeColor.startsWith("#") ? activeColor : "#000000"}
                      onChange={(e) => {
                        const c = e.target.value;
                        setActiveColor(c);
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { color: c, strokeColor: c }, "Change Stroke Color");
                      }}
                      className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 ml-0.5 bg-transparent"
                      title="Custom Stroke Color"
                    />
                  </div>

                  {/* Fill Color */}
                  <div className="flex items-center gap-1 border border-border/80 rounded-md px-1.5 h-7 bg-white" title="Fill Color">
                    <span className="text-[10px] text-muted-foreground font-medium">Fill:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFillColor("transparent");
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { fillColor: "transparent" }, "Transparent Fill");
                      }}
                      className={`px-1 py-0.5 text-[9px] font-bold rounded border ${
                        activeFillColor === "transparent" ? "bg-slate-200 text-slate-800 border-slate-400" : "text-slate-500 hover:bg-slate-100 border-transparent"
                      }`}
                      title="None (Transparent)"
                    >
                      None
                    </button>
                    {["#ffffff", "#dbeafe", "#fee2e2", "#dcfce7", "#fef3c7"].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setActiveFillColor(c);
                          if (selectedCustomElement) updateElement(selectedCustomElement.id, { fillColor: c }, "Change Fill Color");
                        }}
                        className={`w-3.5 h-3.5 rounded-full border border-black/15 transition-all ${
                          activeFillColor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary ring-offset-1 scale-110" : "opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={activeFillColor && activeFillColor.startsWith("#") ? activeFillColor : "#ffffff"}
                      onChange={(e) => {
                        const c = e.target.value;
                        setActiveFillColor(c);
                        if (selectedCustomElement) updateElement(selectedCustomElement.id, { fillColor: c }, "Change Fill Color");
                      }}
                      className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 ml-0.5 bg-transparent"
                      title="Custom Fill Color"
                    />
                  </div>
                </div>
              ) : (
                /* Typography Controls Inspector (When Text is selected or default) */
                <div className="flex items-center gap-1.5">
                  {/* Font Family Selector */}
                  <select
                    value={activeFontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveFontFamily(val);
                      if (selectedElementId) {
                        updateElement(selectedElementId, { fontFamily: val }, "Change font");
                      }
                    }}
                    className="h-7 text-xs border border-border/80 rounded-md bg-white px-1.5 font-medium w-24 sm:w-28 truncate"
                  >
                    {Array.from(new Set(FONT_FAMILIES.map(f => f.group))).map((group) => (
                      <optgroup key={group} label={group}>
                        {FONT_FAMILIES.filter(f => f.group === group).map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Font Size Stepper */}
                  <div className="flex items-center gap-1 border border-border/80 rounded-md bg-white px-1 h-7">
                    <span className="text-[10px] text-muted-foreground">Size:</span>
                    <select
                      value={activeFontSize}
                      onChange={(e) => {
                        const sz = parseInt(e.target.value, 10);
                        setActiveFontSize(sz);
                        if (selectedElementId) {
                          updateElement(selectedElementId, { fontSize: sz }, "Change font size");
                        }
                      }}
                      className="text-xs bg-transparent focus:outline-hidden font-bold pr-0.5"
                    >
                      {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72].map(s => (
                        <option key={s} value={s}>{s}pt</option>
                      ))}
                    </select>
                  </div>

                  {/* Bold / Italic Toggles */}
                  <div className="flex items-center border border-border/80 rounded-md bg-white h-7 overflow-hidden">
                    <Button
                      size="icon"
                      variant="ghost"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const next = !activeIsBold;
                        setActiveIsBold(next);
                        if (selectedElementId) {
                          updateElement(selectedElementId, { isBold: next, fontWeight: next ? "bold" : "normal" }, "Toggle bold");
                        }
                      }}
                      className={`h-6 w-6 rounded-none ${activeIsBold ? "bg-blue-100 text-blue-700 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                      title="Bold"
                    >
                      <Bold className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const next = !activeIsItalic;
                        setActiveIsItalic(next);
                        if (selectedElementId) {
                          updateElement(selectedElementId, { isItalic: next, fontStyle: next ? "italic" : "normal" }, "Toggle italic");
                        }
                      }}
                      className={`h-6 w-6 rounded-none ${activeIsItalic ? "bg-blue-100 text-blue-700 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                      title="Italic"
                    >
                      <Italic className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Color Swatches & Custom Hex Picker */}
                  <div className="flex items-center gap-1 border border-border/80 rounded-md px-1.5 h-7 bg-white">
                    <Palette className="h-3 w-3 text-muted-foreground mr-0.5" />
                    {COLOR_SWATCHES.slice(0, 5).map((s) => (
                      <button
                        key={s.hex}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setActiveColor(s.hex);
                          if (selectedElementId) {
                            updateElement(selectedElementId, { color: s.hex }, "Change color");
                          }
                        }}
                        className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-all ${
                          activeColor.toLowerCase() === s.hex.toLowerCase()
                            ? "ring-2 ring-primary ring-offset-1 scale-110" 
                            : "opacity-75 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: s.hex }}
                        title={s.name}
                      />
                    ))}
                    <input
                      type="color"
                      value={activeColor.startsWith("#") ? activeColor : "#000000"}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const col = e.target.value;
                        setActiveColor(col);
                        if (selectedElementId) {
                          updateElement(selectedElementId, { color: col }, "Change color");
                        }
                      }}
                      className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 ml-0.5 bg-transparent"
                      title="Custom Hex Color Picker"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area: Left Multi-Tab Drawer + Center Interactive Canvas */}
          <div className="flex-1 min-h-0 flex overflow-hidden relative">
            {/* Left Multi-Tab Sidebar */}
            {showSidebar && (
              <aside className="w-36 sm:w-40 h-full max-h-full bg-white border-r border-border/70 flex flex-col shrink-0 overflow-hidden z-20 transition-all">
                {/* Tab switcher */}
                <div className="flex items-center justify-between border-b border-border/60 bg-slate-50/80 px-1 py-1 shrink-0">
                  <div className="flex items-center gap-0.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSidebarTab("pages")}
                      className={`flex-1 py-1 text-[10px] font-bold rounded transition-all truncate ${
                        sidebarTab === "pages" ? "bg-white text-blue-600 shadow-2xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={`Pages (${numPages})`}
                    >
                      Pages
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab("forms")}
                      className={`flex-1 py-1 text-[10px] font-bold rounded transition-all truncate ${
                        sidebarTab === "forms" ? "bg-white text-blue-600 shadow-2xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Forms"
                    >
                      Forms
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarTab("comments")}
                      className={`flex-1 py-1 text-[10px] font-bold rounded transition-all truncate ${
                        sidebarTab === "comments" ? "bg-white text-blue-600 shadow-2xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={`Notes (${comments.length})`}
                    >
                      Notes
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSidebar(false)}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                    title="Collapse Sidebar"
                  >
                    <PanelLeftClose className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                  {sidebarTab === "pages" && (
                    <div className="p-2 space-y-2 flex flex-col">
                      <div className="flex items-center justify-between pb-0.5 px-0.5 shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Pages ({numPages})
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] gap-0.5 text-primary hover:text-primary font-bold"
                          onClick={async () => {
                            if (!file) return;
                            try {
                              const arrayBuffer = await file.arrayBuffer();
                              const doc = await PDFDocument.load(arrayBuffer);
                              doc.addPage([595.28, 841.89]);
                              const pdfBytes = await doc.save();
                              const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
                              setFile(new File([blob], fileName, { type: "application/pdf" }));
                              toast({ title: "Page Added", description: `Added blank page ${numPages + 1}` });
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          title="Add new page"
                        >
                          <FilePlus className="h-2.5 w-2.5" />
                          <span>Add</span>
                        </Button>
                      </div>

                      {Array.from({ length: numPages }).map((_, idx) => {
                        const pageNum = idx + 1;
                        const isCurrent = currentPage === pageNum;
                        return (
                          <PageThumbnail
                            key={pageNum}
                            pdfDoc={pdfDoc}
                            pageNum={pageNum}
                            isActive={isCurrent}
                            onClick={() => {
                              setCurrentPage(pageNum);
                              setSelectedElementId(null);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {sidebarTab === "forms" && (
                    <FormPalette
                      onAddField={handleAddFormField}
                      onAutoDetectFields={handleAutoDetectFields}
                      isDetecting={isDetectingFields}
                    />
                  )}

                  {sidebarTab === "comments" && (
                    <CommentsDrawer
                      comments={comments}
                      currentPage={currentPage}
                      onSelectComment={(c) => {
                        setSelectedElementId(c.id);
                      }}
                      onDeleteComment={(id) => {
                        setComments(prev => prev.filter(c => c.id !== id));
                        saveSnapshot("Delete comment");
                      }}
                      onToggleResolve={(id) => {
                        setComments(prev => prev.map(c => c.id === id ? { ...c, isResolved: !c.isResolved } : c));
                        saveSnapshot("Resolve comment");
                      }}
                    />
                  )}
                </div>
              </aside>
            )}

            {/* Center Canvas Workbench */}
            <main 
              ref={viewportContainerRef}
              className={`flex-1 min-h-0 h-full overflow-auto bg-slate-200/70 relative select-none ${
                activeTool === "hand" ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              onPointerDown={handlePanPointerDown}
              onPointerMove={handlePanPointerMove}
              onPointerUp={handlePanPointerUp}
              onMouseDown={(e) => {
                // Clicking on workbench outside the paper deselects so document displays normal like preview
                if (e.target === viewportContainerRef.current) {
                  setSelectedElementId(null);
                  setEditingBlockId(null);
                }
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={handleCanvasDrop}
            >
              {/* Centering canvas wrapper that allows scrolling without clipping or margin-auto bugs */}
              <div 
                className="min-h-full min-w-full flex p-4 sm:p-6 w-max h-max"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedElementId(null);
                    setEditingBlockId(null);
                  }
                }}
              >
                {/* Document Paper Container */}
                <div 
                  ref={paperRef}
                  className="m-auto relative bg-white shadow-2xl rounded-sm ring-1 ring-black/10 transition-all duration-75 shrink-0 overflow-hidden"
                  onClick={handleCanvasContainerClick}
                  onPointerDown={handlePaperPointerDown}
                  style={{
                    width: `${(rawPageSizeRef.current?.width || 595.28) * scale}px`,
                    height: `${(rawPageSizeRef.current?.height || 841.89) * scale}px`,
                    cursor: (activeTool === "addText" || activeTool === "draw" || activeTool === "whiteout" || activeTool === "redact" || activeTool === "highlight") 
                      ? "crosshair" 
                      : activeTool === "hand" 
                      ? "grab" 
                      : "default"
                  }}
                >
                {/* PDF Page Canvas (HiDPI Retina Razor Sharp) */}
                <canvas ref={canvasRef} className="block rounded-sm w-full h-full" />

                {/* Whiteout / Background Masks for Moved or Deleted Detected Images */}
                {(detectedImages[pageIdx] || [])
                  .filter(img => maskedImageIds.has(img.id))
                  .map(img => {
                    const rawPageH = rawPageSizeRef.current.height || 841.89;
                    const screenX = img.pdfX * scale;
                    const screenY = (rawPageH - img.pdfY - img.pdfHeight) * scale;
                    const screenW = img.pdfWidth * scale;
                    const screenH = img.pdfHeight * scale;
                    return (
                      <div
                        key={`mask_detected_${img.id}`}
                        className="absolute z-[5] pointer-events-none"
                        style={{
                          left: `${screenX - 1}px`,
                          top: `${screenY - 1}px`,
                          width: `${screenW + 2}px`,
                          height: `${screenH + 2}px`,
                          backgroundColor: "#ffffff",
                        }}
                      />
                    );
                })}

                {/* Freehand Drawing Ink Layer */}
                <FreehandCanvas
                  pageIndex={pageIdx}
                  width={rawPageSizeRef.current.width || 595.28}
                  height={rawPageSizeRef.current.height || 841.89}
                  scale={scale}
                  activeColor={activeColor}
                  strokeWidth={activeStrokeWidth}
                  isActive={activeTool === "draw"}
                  strokes={drawingStrokes}
                  onAddStroke={(stroke) => {
                    const nextStrokes = [...drawingStrokesRef.current, stroke];
                    drawingStrokesRef.current = nextStrokes;
                    setDrawingStrokes(nextStrokes);
                    saveSnapshot("Add Drawing Stroke", { drawingStrokes: nextStrokes });
                  }}
                />

                {/* Live Shape Preview when dragging Whiteout, Redaction, Highlight, Shapes & Arrows */}
                {dragShape && (
                  dragShape.tool === "circle" ? (
                    <div
                      className="absolute pointer-events-none z-50 rounded-full border-2 border-blue-600 border-dashed bg-blue-500/10"
                      style={{
                        left: `${Math.min(dragShape.startX, dragShape.currentX)}px`,
                        top: `${Math.min(dragShape.startY, dragShape.currentY)}px`,
                        width: `${Math.abs(dragShape.currentX - dragShape.startX)}px`,
                        height: `${Math.abs(dragShape.currentY - dragShape.startY)}px`,
                      }}
                    />
                  ) : dragShape.tool === "line" || dragShape.tool === "arrow" || dragShape.tool === "double-arrow" ? (() => {
                    const sx = dragShape.startX;
                    const sy = dragShape.startY;
                    const ex = dragShape.currentX;
                    const ey = dragShape.currentY;
                    const angle = Math.atan2(ey - sy, ex - sx);
                    const headLen = 14;
                    const wingAngle = Math.PI / 6;
                    const eWing1X = ex - headLen * Math.cos(angle - wingAngle);
                    const eWing1Y = ey - headLen * Math.sin(angle - wingAngle);
                    const eWing2X = ex - headLen * Math.cos(angle + wingAngle);
                    const eWing2Y = ey - headLen * Math.sin(angle + wingAngle);

                    const revAngle = angle + Math.PI;
                    const sWing1X = sx - headLen * Math.cos(revAngle - wingAngle);
                    const sWing1Y = sy - headLen * Math.sin(revAngle - wingAngle);
                    const sWing2X = sx - headLen * Math.cos(revAngle + wingAngle);
                    const sWing2Y = sy - headLen * Math.sin(revAngle + wingAngle);

                    return (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible"
                      >
                        <line
                          x1={sx}
                          y1={sy}
                          x2={ex}
                          y2={ey}
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                        />
                        {dragShape.tool.includes("arrow") && (
                          <polygon
                            points={`${ex},${ey} ${eWing1X},${eWing1Y} ${eWing2X},${eWing2Y}`}
                            fill="#2563eb"
                          />
                        )}
                        {dragShape.tool === "double-arrow" && (
                          <polygon
                            points={`${sx},${sy} ${sWing1X},${sWing1Y} ${sWing2X},${sWing2Y}`}
                            fill="#2563eb"
                          />
                        )}
                      </svg>
                    );
                  })() : (
                    <div
                      className={`absolute pointer-events-none z-50 rounded-xs border-2 ${
                        dragShape.tool === "redact"
                          ? "bg-black/80 border-red-500 border-dashed"
                          : dragShape.tool === "highlight"
                          ? "bg-yellow-400/35 border-yellow-500 border-dashed"
                          : dragShape.tool === "rect"
                          ? "bg-blue-500/10 border-blue-600 border-dashed"
                          : "bg-white border-blue-500 border-dashed shadow-xs"
                      }`}
                      style={{
                        left: `${Math.min(dragShape.startX, dragShape.currentX)}px`,
                        top: `${Math.min(dragShape.startY, dragShape.currentY)}px`,
                        width: `${Math.abs(dragShape.currentX - dragShape.startX)}px`,
                        height: `${Math.abs(dragShape.currentY - dragShape.startY)}px`,
                      }}
                    />
                  )
                )}

                {/* Contextual Floating Toolbar */}
                {!previewMode && selectedElementId && (
                  (() => {
                    const elem = selectedCustomElement;
                    const blk = selectedExistingBlock;
                    const paperHeight = paperRef.current?.offsetHeight || 600;

                    let targetX = 50;
                    let targetY = 50;
                    let targetWidth = 140;
                    let targetHeight = 36;

                    if (elem) {
                      const isLine = elem.type === "line" || elem.type === "arrow" || elem.type === "double-arrow";
                      const rawPageH = rawPageSizeRef.current?.height || 841.89;
                      if (isLine) {
                        const sX = (elem.startPdfX !== undefined ? elem.startPdfX : elem.pdfX) * scale;
                        const sY = (rawPageH - (elem.startPdfY !== undefined ? elem.startPdfY : (elem.pdfY + elem.pdfHeight))) * scale;
                        const eX = (elem.endPdfX !== undefined ? elem.endPdfX : (elem.pdfX + elem.pdfWidth)) * scale;
                        const eY = (rawPageH - (elem.endPdfY !== undefined ? elem.endPdfY : elem.pdfY)) * scale;
                        targetX = Math.min(sX, eX);
                        targetY = Math.max(sY, eY);
                        targetWidth = Math.max(Math.abs(eX - sX), 60);
                        targetHeight = Math.max(Math.abs(eY - sY), 20);
                      } else {
                        targetX = elem.pdfX * scale;
                        targetY = (rawPageH - elem.pdfY - elem.pdfHeight) * scale;
                        targetWidth = elem.pdfWidth * scale;
                        targetHeight = elem.pdfHeight * scale;
                      }
                    } else if (blk) {
                      targetX = blk.vx;
                      targetY = blk.vy;
                      targetWidth = Math.max(blk.vWidth, 140);
                      targetHeight = Math.max(blk.vHeight, 28);
                    }

                    return (
                      <FloatingToolbar
                        x={targetX}
                        y={targetY}
                        targetWidth={targetWidth}
                        targetHeight={targetHeight}
                        fontSize={blk ? blk.fontSize : (elem?.fontSize || activeFontSize)}
                        fontFamily={blk ? blk.fontFamily : (elem?.fontFamily || activeFontFamily)}
                        color={blk ? (blk.color || "#000000") : (elem?.color || activeColor)}
                        isBold={blk ? (blk.fontWeight === "bold" || !!blk.isBold) : (elem?.isBold ?? activeIsBold)}
                        isItalic={blk ? (blk.fontStyle === "italic" || !!blk.isItalic) : (elem?.isItalic ?? activeIsItalic)}
                        alignment={blk ? (blk.textAlign || blk.alignment || "left") : (elem?.textAlign || elem?.alignment || "left")}
                        isText={elem ? elem.type === "text" : !!blk}
                        isShape={elem ? ["rect", "rounded-rect", "circle", "triangle", "star", "line", "arrow", "double-arrow", "callout", "check", "cross"].includes(elem.type) : false}
                        strokeWidth={elem?.strokeWidth || activeStrokeWidth || 2}
                        strokeColor={elem?.color || activeColor || "#000000"}
                        fillColor={elem?.fillColor ?? activeFillColor ?? "transparent"}
                        strokeStyle={elem?.strokeStyle || activeStrokeStyle || "solid"}
                        onUpdateShape={(updates) => {
                          if (elem) {
                            updateElement(elem.id, updates, "Update Shape Styling");
                          }
                        }}
                        isAspectRatioLocked={elem ? elem.aspectRatioLocked : false}
                        onToggleAspectRatio={elem && elem.type === "image" ? () => {
                          const nextLock = !elem.aspectRatioLocked;
                          updateElement(elem.id, { aspectRatioLocked: nextLock }, nextLock ? "Lock Aspect Ratio" : "Unlock Aspect Ratio");
                        } : undefined}
                        onUpdateTypography={(updates) => {
                          if (selectedElementId) {
                            updateElement(selectedElementId, updates, "Update Typography");
                          }
                        }}
                        onBringForward={selectedElementId ? () => handleBringToFront(selectedElementId) : undefined}
                        onSendBackward={selectedElementId ? () => handleSendToBack(selectedElementId) : undefined}
                        onDuplicate={elem ? () => {
                          const dup: CustomElement = {
                            ...elem,
                            id: `dup_${Date.now()}`,
                            pdfX: elem.pdfX + 15,
                            pdfY: elem.pdfY - 15,
                          };
                          setCustomElements(prev => [...prev, dup]);
                          setSelectedElementId(dup.id);
                          setEditingBlockId(null);
                          saveSnapshot("Duplicate Element");
                        } : undefined}
                        onDelete={() => {
                          if (elem) {
                            setCustomElements(prev => prev.filter(e => e.id !== elem.id));
                            setSelectedElementId(null);
                            setEditingBlockId(null);
                            saveSnapshot("Delete Element");
                          } else if (blk) {
                            blk.isDeleted = true;
                            blk.isModified = true;
                            setPageTextBlocks(prev => ({
                              ...prev,
                              [blk.pageIndex]: (prev[blk.pageIndex] || []).map(b => b.id === blk.id ? { ...blk } : b)
                            }));
                            setSelectedElementId(null);
                            setEditingBlockId(null);
                            saveSnapshot("Delete Text Block");
                          }
                        }}
                        onClose={() => {
                          setSelectedElementId(null);
                          setEditingBlockId(null);
                        }}
                      />
                    );
                  })()
                )}

                {/* Existing Text Blocks (In-Place Editable & Draggable - Optimistic UI Staging) */}
                {currentPageBlocks.map((block) => {
                  const isSelected = selectedElementId === block.id;
                  const isDeleted = !!block.isDeleted;
                  const isModified = checkIsBlockModified(block);

                  // Measure visual width dynamically so box matches text length snugly
                  const currentTextVisualW = measureExactTextWidth(
                    block.currentText,
                    block.fontSize * scale,
                    block.fontFamily,
                    block.fontWeight === "bold" || !!block.isBold,
                    block.fontStyle === "italic" || !!block.isItalic
                  );

                  const isDarkMask = block.maskColor ? isColorDark(block.maskColor) : false;
                  const normalizedColor = normalizeCssColor(block.color);
                  let safeColor = (normalizedColor && normalizedColor !== "transparent" && normalizedColor !== "rgba(0, 0, 0, 0)")
                    ? normalizedColor
                    : (isDarkMask ? "#ffffff" : "#000000");

                  // Strict Contrast Guard: Ensure words never disappear on dark or light masks
                  if (isDarkMask && isColorDark(safeColor)) {
                    safeColor = "#ffffff";
                  } else if (!isDarkMask && !isColorDark(safeColor)) {
                    safeColor = "#000000";
                  }

                  const rawPageH = rawPageSizeRef.current?.height || 841.89;
                  const paperW = (rawPageSizeRef.current?.width || 595.28) * scale;
                  const paperH = rawPageH * scale;

                  // Zoom-invariant original coordinates derived strictly from invariant PDF space:
                  const origPdfX = block.origPdfX !== undefined ? block.origPdfX : (block.origVx !== undefined ? block.origVx / scale : block.pdfX);
                  const origPdfY = block.origPdfY !== undefined ? block.origPdfY : (block.origVy !== undefined ? (rawPageH - (block.origVy / scale) - block.pdfHeight) : block.pdfY);
                  const origPdfW = block.origPdfWidth !== undefined ? block.origPdfWidth : (block.origVWidth !== undefined ? block.origVWidth / scale : block.pdfWidth);
                  const origPdfH = block.origPdfHeight !== undefined ? block.origPdfHeight : (block.origVHeight !== undefined ? block.origVHeight / scale : block.pdfHeight);

                  const curOrigScreenX = block.origVx !== undefined ? block.origVx : (origPdfX * scale);
                  const curOrigScreenY = block.origVy !== undefined ? block.origVy : (rawPageH - origPdfY - origPdfH) * scale;
                  const curOrigScreenW = block.origVWidth !== undefined ? block.origVWidth : (origPdfW * scale);
                  const curOrigScreenH = block.origVHeight !== undefined ? block.origVHeight : (origPdfH * scale);

                  // Precision line-level or snug single-line mask coordinates (ZERO spillover to adjacent lines)
                  const fallbackFSize = block.fontSize || 12;
                  const fallbackScreenBaselineY = (rawPageH - (block.origPdfY ?? block.pdfY)) * scale;
                  const fallbackMaskTop = fallbackScreenBaselineY - (fallbackFSize * scale * 0.76);
                  const fallbackMaskHeight = fallbackFSize * scale * 0.81;
                  const fallbackMaskLeft = (block.origPdfX ?? block.pdfX) * scale;
                  const fallbackMaskWidth = (block.origPdfWidth ?? block.pdfWidth) * scale;

                  return (
                    <React.Fragment key={block.id}>
                      {/* Layer 1: Static Mask to permanently hide original rasterized text on canvas bitmap */}
                      {(isModified || isSelected || isDeleted) && (
                        block.children && block.children.length > 0 ? (
                          block.children.map((child, ci) => {
                            const cFSize = child.height || block.fontSize || 12;
                            const cScreenBaselineY = (rawPageH - child.y) * scale;
                            const cMaskTop = cScreenBaselineY - (cFSize * scale * 0.80);
                            const cMaskHeight = cFSize * scale * 0.95;
                            const cMaskLeft = (child.x - 0.5) * scale;
                            const cMaskWidth = (child.width + 1) * scale;

                            return (
                              <div
                                key={`mask_${block.id}_${ci}`}
                                className="absolute pointer-events-none select-none"
                                style={{
                                  left: `${cMaskLeft}px`,
                                  top: `${cMaskTop}px`,
                                  width: `${cMaskWidth}px`,
                                  height: `${cMaskHeight}px`,
                                  backgroundColor: block.maskColor || "#ffffff",
                                  opacity: 1,
                                  zIndex: 5,
                                }}
                              />
                            );
                          })
                        ) : (
                          <div
                            className="absolute pointer-events-none select-none"
                            style={{
                              left: `${fallbackMaskLeft}px`,
                              top: `${fallbackMaskTop}px`,
                              width: `${fallbackMaskWidth}px`,
                              height: `${fallbackMaskHeight}px`,
                              backgroundColor: block.maskColor || "#ffffff",
                              opacity: 1,
                              zIndex: 5,
                            }}
                          />
                        )
                      )}

                      {/* Layer 2: Interactive / Content Layer */}
                      {isDeleted ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute bg-transparent border border-dashed border-red-400/40 group flex items-center justify-center z-10"
                          style={{
                            left: `${maskLeft}px`,
                            top: `${maskTop}px`,
                            width: `${maskWidth}px`,
                            height: `${maskHeight}px`,
                          }}
                          title="Deleted Text (Click Restore to undo)"
                        >
                          <button
                            type="button"
                            className="hidden group-hover:flex items-center gap-1 text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              block.isDeleted = false;
                              block.isModified = (block.currentText !== block.originalText) || isMoved;
                              setPageTextBlocks(prev => ({
                                ...prev,
                                [block.pageIndex]: (prev[block.pageIndex] || []).map(b => b.id === block.id ? { ...block } : b)
                              }));
                              saveSnapshot("Restore Text");
                            }}
                          >
                            <Undo2 className="h-2.5 w-2.5" /> Restore
                          </button>
                        </div>
                      ) : isSelected ? (
                        /* High-Fidelity In-Place Text Editor with 8-Point Transform Bounding Box */
                        <TransformBoundingBox
                          key={block.id}
                          x={block.vx}
                          y={block.vy}
                          width={block.vWidth}
                          height={block.vHeight}
                          rotation={block.rotation || 0}
                          isSelected={true}
                          isEditing={editingBlockId === block.id}
                          isText={true}
                          onDoubleClick={() => setEditingBlockId(block.id)}
                          onStartEditing={() => setEditingBlockId(block.id)}
                          aspectRatioLocked={false}
                          onSelect={() => setSelectedElementId(block.id)}
                          onDelete={() => {
                            block.isDeleted = true;
                            block.isModified = true;
                            setSelectedElementId(null);
                            setEditingBlockId(null);
                            setPageTextBlocks(prev => ({
                              ...prev,
                              [block.pageIndex]: (prev[block.pageIndex] || []).map(b => b.id === block.id ? { ...block } : b)
                            }));
                            saveSnapshot("Delete Text Block");
                          }}
                          onTransformChange={(updates) => {
                            if (canvasRef.current && (!block.maskColor || block.maskColor === "#ffffff")) {
                              block.maskColor = sampleCanvasBackgroundColor(
                                canvasRef.current,
                                block.origVx ?? block.vx,
                                block.origVy ?? block.vy,
                                block.origVWidth ?? block.vWidth,
                                block.origVHeight ?? block.vHeight
                              );
                            }
                            if (updates.x !== undefined) {
                              block.vx = updates.x;
                              block.pdfX = (block.origPdfX ?? block.pdfX) + (updates.x - (block.origVx ?? block.vx)) / scale;
                              block.isModified = true;
                            }
                            if (updates.y !== undefined) {
                              block.vy = updates.y;
                              block.pdfY = (block.origPdfY ?? block.pdfY) - (updates.y - (block.origVy ?? block.vy)) / scale;
                              block.isModified = true;
                            }
                            if (updates.width !== undefined) {
                              block.vWidth = Math.max(20, updates.width);
                              block.pdfWidth = block.vWidth / scale;
                              block.isModified = true;
                              block.isManuallyResized = true;
                            }
                            if (updates.height !== undefined) {
                              block.vHeight = Math.max(14, updates.height);
                              block.pdfHeight = block.vHeight / scale;
                              block.isModified = true;
                              block.isManuallyResized = true;
                            }
                            if (updates.rotation !== undefined) {
                              block.rotation = updates.rotation;
                            }
                            setPageTextBlocks(prev => ({
                              ...prev,
                              [block.pageIndex]: (prev[block.pageIndex] || []).map(b => b.id === block.id ? { ...block } : b)
                            }));
                          }}
                          onTransformEnd={() => {
                            saveSnapshot("Transform Text Block");
                          }}
                          zIndex={block.zIndex || 10}
                        >
                          <InPlaceTextEditor
                            block={block}
                            scale={scale}
                            isEditing={editingBlockId === block.id}
                            onStartEditing={() => setEditingBlockId(block.id)}
                            onTextChange={(newText) => handleTextChange(block.id, newText)}
                            onCommit={(newText) => {
                              handleCommitText(block, newText);
                              setEditingBlockId(null);
                            }}
                            onCancel={() => {
                              block.currentText = block.originalText;
                              block.isModified = isMoved;
                              setSelectedElementId(null);
                              setEditingBlockId(null);
                              setPageTextBlocks(prev => ({
                                ...prev,
                                [block.pageIndex]: (prev[block.pageIndex] || []).map(b => b.id === block.id ? { ...block } : b)
                              }));
                            }}
                          />
                        </TransformBoundingBox>
                      ) : isModified ? (
                        /* Persistent Display Mode for Modified Text (Optimistic UI Staging) */
                        <div
                          data-block-id={block.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTextBlock(block);
                            if (activeTool === "edit") {
                              setEditingBlockId(block.id);
                            } else {
                              setEditingBlockId(null);
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            selectTextBlock(block);
                            setEditingBlockId(block.id);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleStartBlockDrag(e, block);
                          }}
                          className={`absolute flex flex-col items-start select-none cursor-pointer transition-all px-0.5 break-words ${
                            previewMode 
                              ? "outline-none" 
                              : "hover:outline hover:outline-1 hover:outline-blue-400"
                          }`}
                          style={{
                            left: `${block.vx}px`,
                            top: `${block.vy}px`,
                            width: `${block.vWidth}px`,
                            height: `${block.vHeight}px`,
                            fontSize: `${block.fontSize * scale}px`,
                            fontFamily: getFontFamilyCss(block.fontFamily),
                            color: normalizeCssColor(block.color) || safeColor || "#000000",
                            fontWeight: (block.fontWeight === "bold" || block.isBold) ? "bold" : "normal",
                            fontStyle: (block.fontStyle === "italic" || block.isItalic) ? "italic" : "normal",
                            textAlign: block.textAlign || block.alignment || "left",
                            zIndex: block.zIndex || 10,
                            whiteSpace: "pre-wrap",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            lineHeight: 1.25,
                            backgroundColor: "transparent",
                            border: "none",
                            outline: "none",
                            letterSpacing: block.letterSpacing ? `${block.letterSpacing}px` : "normal",
                          }}
                          title="Single-click to move/resize, double-click to edit text"
                        >
                          {block.richHtml && /<(b|strong|i|em|span|font|mark)\b/i.test(block.richHtml) ? (
                            <div
                              className="w-full h-full pointer-events-none select-none"
                              dangerouslySetInnerHTML={{ __html: block.richHtml }}
                            />
                          ) : (
                            block.currentText
                          )}
                        </div>
                      ) : (
                        /* Unmodified Text Overlay Trigger */
                        <div
                          data-block-id={block.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTextBlock(block);
                            if (activeTool === "edit") {
                              setEditingBlockId(block.id);
                            } else {
                              setEditingBlockId(null);
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            selectTextBlock(block);
                            setEditingBlockId(block.id);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleStartBlockDrag(e, block);
                          }}
                          className={`absolute rounded-[1px] transition-all cursor-grab select-none bg-transparent ${
                            (activeTool === "edit" || activeTool === "select") && !previewMode
                              ? "border border-dashed border-transparent hover:border-blue-400 hover:bg-blue-500/5"
                              : "pointer-events-none"
                          }`}
                          style={{
                            left: `${block.vx}px`,
                            top: `${block.vy}px`,
                            width: `${block.vWidth}px`,
                            height: `${block.vHeight}px`,
                            textAlign: block.textAlign || block.alignment || "left",
                            zIndex: block.zIndex || 10,
                          }}
                          title="Single-click to move/resize, double-click to edit text"
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Custom Elements (Text Boxes, Images, Highlights, Redactions) */}
                {currentPageElements.map((elem) => {
                  const rawPageH = rawPageSizeRef.current.height || 841.89;
                  const screenX = elem.pdfX * scale;
                  const screenY = (rawPageH - elem.pdfY - elem.pdfHeight) * scale;
                  const screenW = elem.pdfWidth * scale;
                  const screenH = elem.pdfHeight * scale;
                  const isSelected = !previewMode && selectedElementId === elem.id;
                  const isLineLike = elem.type === "line" || elem.type === "arrow" || elem.type === "double-arrow";

                  if (isLineLike) {
                    const sX = (elem.startPdfX !== undefined ? elem.startPdfX : elem.pdfX) * scale;
                    const sY = (rawPageH - (elem.startPdfY !== undefined ? elem.startPdfY : (elem.pdfY + elem.pdfHeight))) * scale;
                    const eX = (elem.endPdfX !== undefined ? elem.endPdfX : (elem.pdfX + elem.pdfWidth)) * scale;
                    const eY = (rawPageH - (elem.endPdfY !== undefined ? elem.endPdfY : elem.pdfY)) * scale;
                    const strokeW = Math.max(1, (elem.strokeWidth || 2) * scale);
                    const strokeColor = elem.color || "#000000";
                    const isDashed = elem.strokeStyle === "dashed";

                    return (
                      <React.Fragment key={elem.id}>
                        {/* Vector SVG Line Layer */}
                        {(() => {
                          const angle = Math.atan2(eY - sY, eX - sX);
                          const headLen = Math.max(14, strokeW * 3.5);
                          const wingAngle = Math.PI / 6;
                          const endWing1X = eX - headLen * Math.cos(angle - wingAngle);
                          const endWing1Y = eY - headLen * Math.sin(angle - wingAngle);
                          const endWing2X = eX - headLen * Math.cos(angle + wingAngle);
                          const endWing2Y = eY - headLen * Math.sin(angle + wingAngle);

                          const revAngle = angle + Math.PI;
                          const startWing1X = sX - headLen * Math.cos(revAngle - wingAngle);
                          const startWing1Y = sY - headLen * Math.sin(revAngle - wingAngle);
                          const startWing2X = sX - headLen * Math.cos(revAngle + wingAngle);
                          const startWing2Y = sY - headLen * Math.sin(revAngle + wingAngle);

                          return (
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-visible"
                              style={{ zIndex: elem.zIndex || 20 }}
                            >
                              {/* Invisible wider hit area for easy clicking & dragging */}
                              <line
                                x1={sX}
                                y1={sY}
                                x2={eX}
                                y2={eY}
                                stroke="transparent"
                                strokeWidth={Math.max(24, strokeW + 16)}
                                strokeLinecap="round"
                                className="pointer-events-auto cursor-move"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedElementId(elem.id);
                                  setEditingBlockId(null);
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedElementId(elem.id);
                                  setEditingBlockId(null);
                                  const startClientX = e.clientX;
                                  const startClientY = e.clientY;
                                  const initSX = elem.startPdfX ?? elem.pdfX;
                                  const initSY = elem.startPdfY ?? (elem.pdfY + elem.pdfHeight);
                                  const initEX = elem.endPdfX ?? (elem.pdfX + elem.pdfWidth);
                                  const initEY = elem.endPdfY ?? elem.pdfY;

                                  const onMove = (mEvt: PointerEvent) => {
                                    const dx = (mEvt.clientX - startClientX) / scale;
                                    const dy = (mEvt.clientY - startClientY) / scale;
                                    elem.startPdfX = initSX + dx;
                                    elem.startPdfY = initSY - dy;
                                    elem.endPdfX = initEX + dx;
                                    elem.endPdfY = initEY - dy;
                                    elem.pdfX = Math.min(elem.startPdfX, elem.endPdfX);
                                    elem.pdfY = Math.min(elem.startPdfY, elem.endPdfY);
                                    elem.pdfWidth = Math.max(0.1, Math.abs(elem.endPdfX - elem.startPdfX));
                                    elem.pdfHeight = Math.max(0.1, Math.abs(elem.endPdfY - elem.startPdfY));
                                    setCustomElements([...customElementsRef.current]);
                                  };

                                  const onUp = () => {
                                    window.removeEventListener("pointermove", onMove);
                                    window.removeEventListener("pointerup", onUp);
                                    saveSnapshot("Move Arrow");
                                  };

                                  window.addEventListener("pointermove", onMove);
                                  window.addEventListener("pointerup", onUp);
                                }}
                              />

                              {/* Visible Vector Line */}
                              <line
                                x1={sX}
                                y1={sY}
                                x2={eX}
                                y2={eY}
                                stroke={strokeColor}
                                strokeWidth={strokeW}
                                strokeDasharray={isDashed ? "5 5" : undefined}
                                strokeLinecap="round"
                              />

                              {/* End Arrowhead */}
                              {elem.type.includes("arrow") && (
                                <polygon
                                  points={`${eX},${eY} ${endWing1X},${endWing1Y} ${endWing2X},${endWing2Y}`}
                                  fill={strokeColor}
                                />
                              )}

                              {/* Start Arrowhead (Double Arrow) */}
                              {elem.type === "double-arrow" && (
                                <polygon
                                  points={`${sX},${sY} ${startWing1X},${startWing1Y} ${startWing2X},${startWing2Y}`}
                                  fill={strokeColor}
                                />
                              )}
                            </svg>
                          );
                        })()}

                        {/* 2-Point Vector Endpoint Handles when Selected */}
                        {isSelected && (
                          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: (elem.zIndex || 20) + 15 }}>
                            {/* Start Point Handle */}
                            <div
                              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-blue-600 shadow-lg pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
                              style={{ left: `${sX}px`, top: `${sY}px` }}
                              title="Drag to reposition arrow start (360°)"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const onMove = (mEvt: PointerEvent) => {
                                  if (!paperRef.current) return;
                                  const rect = paperRef.current.getBoundingClientRect();
                                  const curX = mEvt.clientX - rect.left;
                                  const curY = mEvt.clientY - rect.top;
                                  elem.startPdfX = curX / scale;
                                  elem.startPdfY = rawPageH - (curY / scale);
                                  const ex = elem.endPdfX ?? (elem.pdfX + elem.pdfWidth);
                                  const ey = elem.endPdfY ?? elem.pdfY;
                                  elem.pdfX = Math.min(elem.startPdfX, ex);
                                  elem.pdfY = Math.min(elem.startPdfY, ey);
                                  elem.pdfWidth = Math.max(0.1, Math.abs(ex - elem.startPdfX));
                                  elem.pdfHeight = Math.max(0.1, Math.abs(ey - elem.startPdfY));
                                  setCustomElements([...customElementsRef.current]);
                                };
                                const onUp = () => {
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                  saveSnapshot("Adjust Arrow Start");
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />

                            {/* End Point Handle (Arrowhead Tip) */}
                            <div
                              className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 border-2 border-white shadow-lg ring-1 ring-blue-700 pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
                              style={{ left: `${eX}px`, top: `${eY}px` }}
                              title="Drag to aim arrowhead (360°)"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const onMove = (mEvt: PointerEvent) => {
                                  if (!paperRef.current) return;
                                  const rect = paperRef.current.getBoundingClientRect();
                                  const curX = mEvt.clientX - rect.left;
                                  const curY = mEvt.clientY - rect.top;
                                  elem.endPdfX = curX / scale;
                                  elem.endPdfY = rawPageH - (curY / scale);
                                  const sx = elem.startPdfX ?? elem.pdfX;
                                  const sy = elem.startPdfY ?? (elem.pdfY + elem.pdfHeight);
                                  elem.pdfX = Math.min(sx, elem.endPdfX);
                                  elem.pdfY = Math.min(sy, elem.endPdfY);
                                  elem.pdfWidth = Math.max(0.1, Math.abs(elem.endPdfX - sx));
                                  elem.pdfHeight = Math.max(0.1, Math.abs(elem.endPdfY - sy));
                                  setCustomElements([...customElementsRef.current]);
                                };
                                const onUp = () => {
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                  saveSnapshot("Aim Arrowhead");
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }

                  return (
                    <TransformBoundingBox
                      key={elem.id}
                      x={screenX}
                      y={screenY}
                      width={screenW}
                      height={screenH}
                      rotation={elem.rotation}
                      zIndex={elem.zIndex}
                      isSelected={isSelected}
                      isEditing={editingBlockId === elem.id}
                      isText={elem.type === "text"}
                      onDoubleClick={() => {
                        if (elem.type === "text") {
                          setEditingBlockId(elem.id);
                        }
                      }}
                      aspectRatioLocked={elem.aspectRatioLocked}
                      onSelect={() => {
                        setSelectedElementId(elem.id);
                        setEditingBlockId(null);
                      }}
                      onRotate90={() => {
                        elem.rotation = ((elem.rotation || 0) + 90) % 360;
                        setCustomElements([...customElements]);
                        saveSnapshot("Rotate 90°");
                      }}
                      onDuplicate={() => {
                        const newElem = {
                          ...elem,
                          id: `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                          pdfX: elem.pdfX + 15,
                          pdfY: Math.max(0, elem.pdfY - 15),
                        };
                        setCustomElements([...customElements, newElem]);
                        setSelectedElementId(newElem.id);
                        setEditingBlockId(null);
                        saveSnapshot("Duplicate Element");
                      }}
                      onBringForward={() => handleBringToFront(elem.id)}
                      onSendBackward={() => handleSendToBack(elem.id)}
                      onDelete={() => {
                        setCustomElements(customElements.filter(e => e.id !== elem.id));
                        setSelectedElementId(null);
                        setEditingBlockId(null);
                        saveSnapshot("Delete Element");
                      }}
                      onTransformChange={(updates) => {
                        const newW = updates.width !== undefined ? updates.width / scale : elem.pdfWidth;
                        const newH = updates.height !== undefined ? updates.height / scale : elem.pdfHeight;
                        const newX = updates.x !== undefined ? updates.x / scale : elem.pdfX;
                        let newY = elem.pdfY;

                        if (updates.y !== undefined) {
                          newY = rawPageH - (updates.y / scale) - newH;
                        } else if (updates.height !== undefined) {
                          newY = elem.pdfY + (elem.pdfHeight - newH);
                        }

                        elem.pdfX = newX;
                        elem.pdfY = newY;
                        elem.pdfWidth = Math.max(5, newW);
                        elem.pdfHeight = Math.max(5, newH);
                        if (updates.rotation !== undefined) elem.rotation = updates.rotation;
                        setCustomElements([...customElements]);
                      }}
                      onTransformEnd={() => saveSnapshot("Transform Element")}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                          setEditingBlockId(null);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                          if (elem.type === "text") {
                            setEditingBlockId(elem.id);
                          }
                        }}
                        className="w-full h-full relative"
                      >
                        {elem.type === "redaction" && (
                          <div className="w-full h-full bg-black rounded-xs shadow-xs pointer-events-none select-none" title="Permanent Redaction" />
                        )}

                        {elem.type === "whiteout" && (
                          <div 
                            className="w-full h-full bg-white pointer-events-none select-none" 
                            title="Whiteout Mask" 
                          />
                        )}

                        {elem.type === "highlight" && (
                          <div
                            className="w-full h-full rounded-xs pointer-events-none select-none"
                            style={{
                              backgroundColor: elem.color || "#fef08a",
                              opacity: 0.45,
                            }}
                            title="Highlight"
                          />
                        )}

                        {elem.type === "rect" && (
                          <div
                            className="w-full h-full pointer-events-none select-none"
                            style={{
                              border: `${Math.max(1, (elem.strokeWidth || 2) * scale)}px ${elem.strokeStyle === "dashed" ? "dashed" : "solid"} ${elem.color || "#000000"}`,
                              backgroundColor: elem.fillColor || "transparent",
                              boxSizing: "border-box",
                            }}
                            title="Rectangle"
                          />
                        )}

                        {elem.type === "rounded-rect" && (
                          <div
                            className="w-full h-full pointer-events-none select-none rounded-xl"
                            style={{
                              border: `${Math.max(1, (elem.strokeWidth || 2) * scale)}px ${elem.strokeStyle === "dashed" ? "dashed" : "solid"} ${elem.color || "#000000"}`,
                              backgroundColor: elem.fillColor || "transparent",
                              boxSizing: "border-box",
                            }}
                            title="Rounded Rectangle"
                          />
                        )}

                        {elem.type === "circle" && (
                          <div
                            className="w-full h-full rounded-full pointer-events-none select-none"
                            style={{
                              border: `${Math.max(1, (elem.strokeWidth || 2) * scale)}px ${elem.strokeStyle === "dashed" ? "dashed" : "solid"} ${elem.color || "#000000"}`,
                              backgroundColor: elem.fillColor || "transparent",
                              boxSizing: "border-box",
                            }}
                            title="Circle"
                          />
                        )}

                        {elem.type === "triangle" && (
                          <svg className="w-full h-full pointer-events-none select-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polygon
                              points="50 3, 97 97, 3 97"
                              fill={elem.fillColor && elem.fillColor !== "transparent" ? elem.fillColor : "transparent"}
                              stroke={elem.color || "#000000"}
                              strokeWidth={Math.max(1, (elem.strokeWidth || 2) * scale * (100 / Math.max(1, elem.pdfWidth * scale)))}
                              strokeDasharray={elem.strokeStyle === "dashed" ? "6 6" : undefined}
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}

                        {elem.type === "star" && (
                          <svg className="w-full h-full pointer-events-none select-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polygon
                              points="50 4, 63 35, 96 36, 70 56, 80 89, 50 70, 20 89, 30 56, 4 36, 37 35"
                              fill={elem.fillColor && elem.fillColor !== "transparent" ? elem.fillColor : "transparent"}
                              stroke={elem.color || "#000000"}
                              strokeWidth={Math.max(1, (elem.strokeWidth || 2) * scale * (100 / Math.max(1, elem.pdfWidth * scale)))}
                              strokeDasharray={elem.strokeStyle === "dashed" ? "6 6" : undefined}
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}



                        {elem.type === "callout" && (
                          <svg className="w-full h-full pointer-events-none select-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path
                              d="M 5 5 L 95 5 A 4 4 0 0 1 99 9 L 99 68 A 4 4 0 0 1 95 72 L 45 72 L 20 95 L 25 72 L 5 72 A 4 4 0 0 1 1 68 L 1 9 A 4 4 0 0 1 5 5 Z"
                              fill={elem.fillColor && elem.fillColor !== "transparent" ? elem.fillColor : "transparent"}
                              stroke={elem.color || "#000000"}
                              strokeWidth={Math.max(1, (elem.strokeWidth || 2) * scale * (100 / Math.max(1, elem.pdfWidth * scale)))}
                              strokeDasharray={elem.strokeStyle === "dashed" ? "6 6" : undefined}
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}

                        {elem.type === "check" && (
                          <svg className="w-full h-full pointer-events-none select-none overflow-visible" viewBox="0 0 100 100">
                            <path
                              d="M 15 50 L 38 75 L 85 22"
                              fill="none"
                              stroke={elem.color || "#16a34a"}
                              strokeWidth={Math.max(2, (elem.strokeWidth || 3) * scale * 2.5)}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}

                        {elem.type === "cross" && (
                          <svg className="w-full h-full pointer-events-none select-none overflow-visible" viewBox="0 0 100 100">
                            <line
                              x1="20"
                              y1="20"
                              x2="80"
                              y2="80"
                              stroke={elem.color || "#dc2626"}
                              strokeWidth={Math.max(2, (elem.strokeWidth || 3) * scale * 2.5)}
                              strokeLinecap="round"
                            />
                            <line
                              x1="80"
                              y1="20"
                              x2="20"
                              y2="80"
                              stroke={elem.color || "#dc2626"}
                              strokeWidth={Math.max(2, (elem.strokeWidth || 3) * scale * 2.5)}
                              strokeLinecap="round"
                            />
                          </svg>
                        )}

                        {elem.type === "image" && elem.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={elem.imageUrl}
                            alt="Asset"
                            className="w-full h-full object-fill pointer-events-none select-none"
                            draggable={false}
                          />
                        )}

                        {elem.type === "text" && (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setSelectedElementId(elem.id);
                              setEditingBlockId(elem.id);
                            }}
                            className={`w-full h-full p-1 rounded-xs transition-all bg-transparent ${
                              isSelected
                                ? "border-none outline-none ring-0 shadow-none"
                                : "border-none outline-none pointer-events-none"
                            }`}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              outline: "none",
                              fontSize: `${(elem.fontSize || 14) * scale}px`,
                              fontWeight: elem.isBold ? "bold" : "normal",
                              fontStyle: elem.isItalic ? "italic" : "normal",
                              fontFamily: getFontFamilyCss(elem.fontFamily),
                              color: elem.color || "black",
                              textAlign: elem.textAlign || elem.alignment || "left",
                              zIndex: elem.zIndex || 10,
                            }}
                          >
                            {isSelected && editingBlockId === elem.id ? (
                              <div
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                autoFocus
                                data-custom-id={elem.id}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={() => saveSnapshot("Edit text box")}
                                onInput={(e) => {
                                  elem.richHtml = /<(b|strong|i|em|span|font|mark)\b/i.test(e.currentTarget.innerHTML) ? e.currentTarget.innerHTML : undefined;
                                  elem.text = e.currentTarget.innerText;
                                  elem.currentText = e.currentTarget.innerText;
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingBlockId(null);
                                  } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                    e.preventDefault();
                                    setEditingBlockId(null);
                                    saveSnapshot("Update text box");
                                  }
                                }}
                                onBlur={(e) => {
                                  elem.richHtml = /<(b|strong|i|em|span|font|mark)\b/i.test(e.currentTarget.innerHTML) ? e.currentTarget.innerHTML : undefined;
                                  elem.text = e.currentTarget.innerText;
                                  elem.currentText = e.currentTarget.innerText;
                                  setEditingBlockId(null);
                                  saveSnapshot("Update text box");
                                }}
                                className="w-full h-full resize-none border-none bg-transparent focus:outline-none focus:ring-0 p-0 leading-tight pointer-events-auto select-text"
                                style={{
                                  backgroundColor: "transparent",
                                  border: "none",
                                  outline: "none",
                                  textAlign: elem.textAlign || elem.alignment || "left",
                                }}
                                dangerouslySetInnerHTML={{ __html: elem.richHtml || elem.text || elem.currentText || "" }}
                              />
                            ) : (
                              <div 
                                className="w-full h-full whitespace-pre-wrap select-none leading-tight bg-transparent pointer-events-none"
                                style={{ 
                                  backgroundColor: "transparent",
                                  textAlign: elem.textAlign || elem.alignment || "left",
                                }}
                                dangerouslySetInnerHTML={{ __html: elem.richHtml || elem.text || elem.currentText || "" }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </TransformBoundingBox>
                  );
                })}

                {/* Detected Images in Existing PDF (Immediate drag-to-move exactly like Sejda / PDFgear) */}
                {!previewMode && (detectedImages[pageIdx] || []).filter(img => !maskedImageIds.has(img.id)).map((img) => {
                  const rawPageH = rawPageSizeRef.current.height || 841.89;
                  const screenX = img.pdfX * scale;
                  const screenY = (rawPageH - img.pdfY - img.pdfHeight) * scale;
                  const screenW = img.pdfWidth * scale;
                  const screenH = img.pdfHeight * scale;

                  return (
                    <div
                      key={img.id}
                      onPointerDown={(e) => handleStartDetectedImageDrag(e, img)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectDetectedImage(img);
                      }}
                      className="absolute z-[25] group border border-dashed border-blue-400 hover:border-blue-600 hover:bg-blue-500/10 cursor-grab active:cursor-grabbing rounded-xs transition-all"
                      style={{
                        left: `${screenX}px`,
                        top: `${screenY}px`,
                        width: `${screenW}px`,
                        height: `${screenH}px`,
                      }}
                      title="Detected Image: Click or drag to move immediately"
                    >
                      <div className="hidden group-hover:flex absolute top-1 right-1 items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm select-none pointer-events-none">
                        <Move className="h-3 w-3" /> Move Image
                      </div>
                    </div>
                  );
                })}

                {/* Form Fields Layer */}
                {formFields.filter(f => f.pageIndex === pageIdx).map((field) => {
                  const paperHeight = paperRef.current?.offsetHeight || 800;
                  const screenX = field.pdfX * scale;
                  const screenY = paperHeight - (field.pdfY * scale) - (field.pdfHeight * scale);
                  const screenW = field.pdfWidth * scale;
                  const screenH = field.pdfHeight * scale;

                  return (
                    <div
                      key={field.id}
                      className="absolute z-20 border border-blue-500 bg-blue-50/70 rounded-xs p-1 flex items-center justify-between shadow-xs cursor-move"
                      style={{
                        left: `${screenX}px`,
                        top: `${screenY}px`,
                        width: `${screenW}px`,
                        height: `${screenH}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {field.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={field.isChecked}
                          onChange={(e) => {
                            field.isChecked = e.target.checked;
                            setFormFields([...formFields]);
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      ) : field.type === "signature" ? (
                        <span className="text-[10px] text-blue-800 font-bold flex items-center gap-1">
                          <PenTool className="h-3 w-3" /> Sign Here
                        </span>
                      ) : (
                        <input
                          type="text"
                          placeholder={field.name}
                          value={field.value || ""}
                          onChange={(e) => {
                            field.value = e.target.value;
                            setFormFields([...formFields]);
                          }}
                          className="w-full h-full text-xs bg-transparent border-0 focus:outline-hidden text-blue-900"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => setFormFields(prev => prev.filter(f => f.id !== field.id))}
                        className="text-red-500 hover:text-red-700 ml-1"
                        title="Remove Field"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Comment Pins */}
                {comments.filter(c => c.pageIndex === pageIdx).map((comm, idx) => {
                  const paperHeight = paperRef.current?.offsetHeight || 800;
                  const screenX = comm.pdfX * scale;
                  const screenY = paperHeight - (comm.pdfY * scale);

                  return (
                    <div
                      key={comm.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSidebarTab("comments");
                        setShowSidebar(true);
                      }}
                      className="absolute z-30 w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-125 transition-transform"
                      style={{
                        left: `${screenX - 12}px`,
                        top: `${screenY - 12}px`,
                      }}
                      title={comm.text}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            </main>

            {/* Bottom Compact Navigation Bar (Fixed to Viewport Bottom - Never scrolls away) */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-full px-3.5 py-1.5 shadow-2xl shadow-slate-900/10 flex items-center gap-2 z-30 pointer-events-auto">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                disabled={currentPage <= 1}
                onClick={() => { setCurrentPage(p => p - 1); setSelectedElementId(null); }}
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              
              <span className="text-xs font-semibold px-2 select-none text-slate-600">
                Page <strong className="text-slate-900 font-bold">{currentPage}</strong> of {numPages}
              </span>

              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                disabled={currentPage >= numPages}
                onClick={() => { setCurrentPage(p => p + 1); setSelectedElementId(null); }}
                title="Next Page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* PDF Export Live Pre-Download Preview Modal */}
          {exportPreviewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="h-16 px-6 border-b border-slate-200/80 flex items-center justify-between bg-white/95 backdrop-blur-xl shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-red-500/20">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        PDF Export Preview
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          {exportPreviewData.pageCount} {exportPreviewData.pageCount === 1 ? "page" : "pages"} • {exportPreviewData.sizeKb} KB
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 truncate max-w-md">
                        {exportPreviewData.fileName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseExportPreview}
                      className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700"
                    >
                      Back to Editing
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleDownloadExportedPdf();
                        handleCloseExportPreview();
                      }}
                      className="h-9 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 text-white font-bold gap-1.5 shadow-md shadow-red-500/25 px-5 rounded-xl hover:-translate-y-0.5 transition-all text-xs sm:text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Modal Body: High-Fidelity Embedded PDF Viewer */}
                <div className="flex-1 bg-slate-100 p-3 sm:p-5 min-h-0 overflow-hidden">
                  <iframe
                    src={`${exportPreviewData.url}#toolbar=0`}
                    title="PDF Export Preview"
                    className="w-full h-full rounded-2xl border border-slate-200/80 bg-white shadow-xl transform-gpu"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}
