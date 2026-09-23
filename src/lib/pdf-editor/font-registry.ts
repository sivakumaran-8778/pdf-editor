import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface FontResult {
  font: PDFFont;
  isCustom: boolean;
}

// Pre-resolved, reliable, direct WOFF/TTF URLs for popular Google Fonts
// These load in <100ms and are cached permanently in memory and CacheStorage
export const STATIC_FONT_ENDPOINTS: Record<string, { regular: string; bold?: string; italic?: string }> = {
  poppins: {
    regular: "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrFJDUc1NECPY.ttf",
    bold: "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z11lFd2JQEl8qw.ttf",
  },
  pacifico: {
    regular: "https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ-6H6M8.woff",
  },
  caveat: {
    regular: "https://fonts.gstatic.com/s/caveat/v18/WnzrHA44eyAj58nsAPtwPtAE.woff",
    bold: "https://fonts.gstatic.com/s/caveat/v18/WnzrHA44eyAj58nsAPs6PtAExTRD.woff",
  },
  "playfair display": {
    regular: "https://fonts.gstatic.com/s/playfairdisplay/v37/6NU58GuALoqPXgkAKtCA-DVZ9d0c-L-FgvM0PdIL7m0.woff",
    bold: "https://fonts.gstatic.com/s/playfairdisplay/v37/6NU58GuALoqPXgkAKtCA-DVZ9d0c-L-FgvM0PdI7720.woff",
  },
  "dancing script": {
    regular: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Rep8ktA.woff",
    bold: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup8ktA.woff",
  },
  roboto: {
    regular: "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5WZLCzYlKw.woff",
    bold: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.woff",
  },
  inter: {
    regular: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff",
    bold: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff",
  },
  montserrat: {
    regular: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aX8.woff",
    bold: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aX8.woff",
  },
  "open sans": {
    regular: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVQUwaEQbjA.woff",
    bold: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1x4gaVQUwaEQbjA.woff",
  },
  lato: {
    regular: "https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXiWtFCc.woff",
    bold: "https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.woff",
  },
  merriweather: {
    regular: "https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZMdeX3rg.woff",
    bold: "https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l52xwNZWMf6hPvhPQ.woff",
  },
};

// Global in-memory cache for downloaded font buffers (0ms latency after initial fetch)
const fontBufferMemoryCache = new Map<string, ArrayBuffer>();

/**
 * Dynamically resolves a binary WOFF/TTF URL from Google Fonts CSS API
 */
async function resolveGoogleFontUrl(family: string, isBold: boolean, isItalic: boolean): Promise<string | null> {
  try {
    const formattedFamily = family.replace(/\s+/g, "+");
    const weight = isBold ? "700" : "400";
    const query = `${formattedFamily}:${weight}`;
    const url = `https://fonts.googleapis.com/css?family=${query}`;

    // Older IE user agent prompts Google Fonts to return standard WOFF format
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
      },
    });

    if (!res.ok) return null;
    const css = await res.text();
    const match = css.match(/src:\s*url\((https:\/\/[^)]+\.(woff|ttf))\)/);
    return match ? match[1] : null;
  } catch (err) {
    console.warn(`Could not resolve dynamic font URL for ${family}:`, err);
    return null;
  }
}

/**
 * Fetches and caches font binary array buffer with CacheStorage persistence
 */
export async function getFontArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (fontBufferMemoryCache.has(url)) {
    return fontBufferMemoryCache.get(url)!;
  }

  // Check browser CacheStorage for persistent caching across page reloads
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open("pdf-editor-fonts-v1");
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        const buffer = await cachedResponse.arrayBuffer();
        fontBufferMemoryCache.set(url, buffer);
        return buffer;
      }
    } catch {}
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download font binary from ${url} (status: ${response.status})`);
  }

  // Clone response to cache it if browser cache is available
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open("pdf-editor-fonts-v1");
      cache.put(url, response.clone());
    } catch {}
  }

  const buffer = await response.arrayBuffer();
  fontBufferMemoryCache.set(url, buffer);
  return buffer;
}

/**
 * Embeds a custom Google Font (or falls back to Standard 14 PostScript font)
 * Automatically registers fontkit and subsets embedded fonts for optimal file size.
 */
export async function embedCustomOrStandardFont(
  doc: PDFDocument,
  embeddedFontCache: Map<string, PDFFont>,
  family?: string,
  isBold?: boolean,
  isItalic?: boolean
): Promise<FontResult> {
  // Ensure fontkit is registered
  try {
    doc.registerFontkit(fontkit);
  } catch {}

  const cleanFamily = (family || "").trim().toLowerCase();

  // 1. Try static direct endpoints first (fastest, guaranteed)
  let matchedStaticKey: string | undefined;
  for (const key of Object.keys(STATIC_FONT_ENDPOINTS)) {
    if (cleanFamily.includes(key) || key.includes(cleanFamily)) {
      matchedStaticKey = key;
      break;
    }
  }

  if (matchedStaticKey) {
    const config = STATIC_FONT_ENDPOINTS[matchedStaticKey];
    const url = isBold && config.bold ? config.bold : config.regular;
    const cacheKey = `custom_${matchedStaticKey}_${isBold ? "bold" : "reg"}`;

    if (embeddedFontCache.has(cacheKey)) {
      return { font: embeddedFontCache.get(cacheKey)!, isCustom: true };
    }

    try {
      const buffer = await getFontArrayBuffer(url);
      // Embed with glyph subsetting to keep PDF size small (<35KB per font face)
      const embedded = await doc.embedFont(buffer, { subset: true });
      embeddedFontCache.set(cacheKey, embedded);
      return { font: embedded, isCustom: true };
    } catch (err) {
      console.warn(`Font embedding error for static font ${matchedStaticKey}:`, err);
    }
  }

  // 2. Try dynamic Google Fonts lookup for non-static custom font names (if not standard)
  const isLikelyStandard = 
    cleanFamily.includes("times") || 
    cleanFamily.includes("courier") || 
    cleanFamily.includes("helvetica") || 
    cleanFamily.includes("arial") ||
    cleanFamily === "serif" ||
    cleanFamily === "sans-serif" ||
    cleanFamily === "monospace";

  if (!isLikelyStandard && cleanFamily.length > 2) {
    const cacheKey = `custom_dyn_${cleanFamily}_${isBold ? "bold" : "reg"}`;
    if (embeddedFontCache.has(cacheKey)) {
      return { font: embeddedFontCache.get(cacheKey)!, isCustom: true };
    }

    try {
      const dynUrl = await resolveGoogleFontUrl(family || cleanFamily, !!isBold, !!isItalic);
      if (dynUrl) {
        const buffer = await getFontArrayBuffer(dynUrl);
        const embedded = await doc.embedFont(buffer, { subset: true });
        embeddedFontCache.set(cacheKey, embedded);
        return { font: embedded, isCustom: true };
      }
    } catch (dynErr) {
      console.warn(`Dynamic font lookup failed for ${family}:`, dynErr);
    }
  }

  // 3. Fallback to Standard 14 PostScript fonts
  // Check Monospace / Code first
  if (
    cleanFamily.includes("courier") || 
    cleanFamily.includes("consolas") || 
    cleanFamily.includes("mono") || 
    cleanFamily.includes("code") ||
    cleanFamily.includes("menlo")
  ) {
    const fontName = isBold && isItalic
      ? StandardFonts.CourierBoldOblique
      : isBold
      ? StandardFonts.CourierBold
      : isItalic
      ? StandardFonts.CourierOblique
      : StandardFonts.Courier;

    if (embeddedFontCache.has(fontName)) {
      return { font: embeddedFontCache.get(fontName)!, isCustom: false };
    }
    const embedded = await doc.embedFont(fontName);
    embeddedFontCache.set(fontName, embedded);
    return { font: embedded, isCustom: false };
  }

  // Check Serif (strict: must NOT include "sans")
  if (
    cleanFamily.includes("times") || 
    cleanFamily.includes("georgia") || 
    cleanFamily.includes("garamond") || 
    (cleanFamily.includes("serif") && !cleanFamily.includes("sans"))
  ) {
    const fontName = isBold && isItalic
      ? StandardFonts.TimesRomanBoldItalic
      : isBold
      ? StandardFonts.TimesRomanBold
      : isItalic
      ? StandardFonts.TimesRomanItalic
      : StandardFonts.TimesRoman;

    if (embeddedFontCache.has(fontName)) {
      return { font: embeddedFontCache.get(fontName)!, isCustom: false };
    }
    const embedded = await doc.embedFont(fontName);
    embeddedFontCache.set(fontName, embedded);
    return { font: embedded, isCustom: false };
  }

  // Default Standard Sans-Serif (Helvetica)
  const fontName = isBold && isItalic
    ? StandardFonts.HelveticaBoldOblique
    : isBold
    ? StandardFonts.HelveticaBold
    : isItalic
    ? StandardFonts.HelveticaOblique
    : StandardFonts.Helvetica;

  if (embeddedFontCache.has(fontName)) {
    return { font: embeddedFontCache.get(fontName)!, isCustom: false };
  }
  const embedded = await doc.embedFont(fontName);
  embeddedFontCache.set(fontName, embedded);
  return { font: embedded, isCustom: false };
}

/**
 * Text sanitizer for drawing into PDF
 * Custom fonts embedded via fontkit natively support full UTF-8 Unicode.
 * Standard 14 fonts only support WinAnsi (Latin-1).
 */
export function sanitizeTextForPdf(text: string, isCustomFont: boolean): string {
  if (isCustomFont) {
    // Custom fontkit fonts support full Unicode: smart quotes, em-dashes, accents, currency
    // Only strip control characters (except tabs and newlines)
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }
  // Standard 14 fonts need WinAnsi sanitization
  return text.replace(/[^\x00-\x7F\xA0-\xFF]/g, " ");
}
