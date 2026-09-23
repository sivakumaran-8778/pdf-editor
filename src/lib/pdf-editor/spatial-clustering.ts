/**
 * Spatial Clustering Algorithm for Extracted PDF Text Items
 * Fixes:
 * 1. Horizontal Rule (Table Column Fix): Prevents unrelated table columns from merging into giant blocks.
 * 2. Vertical Rule (Paragraph Fix): Groups subsequent lines into cohesive multi-line paragraphs with \n.
 * 3. Alignment Support: Supports both left-aligned paragraphs and center-aligned titles/certificates.
 */

export interface ClusteredBlockData {
  id: string;
  pageIndex: number;
  originalText: string;
  currentText: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  firstLinePdfY: number;
  fontSize: number;
  fontFamily: string;
  isBold?: boolean;
  isItalic?: boolean;
  fontWeight?: "bold" | "normal";
  fontStyle?: "italic" | "normal";
  color: string;
  alignment: "left" | "center" | "right";
  textAlign?: "left" | "center" | "right";
  zIndex?: number;
  isModified: boolean;
  isDeleted: boolean;
  isManuallyResized?: boolean;
  lineCount: number;
  children?: { x: number; y: number; width: number; height: number; text: string }[];
}

interface LineSegment {
  text: string;
  x: number;
  y: number; // baseline
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

interface CandidateBlock {
  id: string;
  pageIndex: number;
  text: string;
  children: { x: number; y: number; width: number; height: number; text: string }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  firstLinePdfY: number;
  lastLineY: number;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  alignment: "left" | "center" | "right";
  lineCount: number;
}

/**
 * Cluster raw PDF.js text items into logical blocks (table cells or multi-line paragraphs)
 */
export function clusterPdfTextItems(
  rawItems: any[],
  fontStyles: Record<string, any>,
  pageIndex: number,
  detectFontDetails: (fontName?: string, styleObj?: any) => { fontFamily: string; isBold: boolean; isItalic: boolean }
): ClusteredBlockData[] {
  const validItems = (rawItems || []).filter(item => item.str && item.str.trim().length > 0);
  if (validItems.length === 0) return [];

  // 1. Sort raw items: top-to-bottom (descending Y in PDF coordinates), then left-to-right (ascending X)
  const sortedItems = [...validItems].sort((a, b) => {
    const diffY = b.transform[5] - a.transform[5];
    if (Math.abs(diffY) > 3.5) return diffY;
    return a.transform[4] - b.transform[4];
  });

  // 2. Phase 1: Horizontal Sorting & Line Assembly with Horizontal Rule (Table Column Fix)
  const lineSegments: LineSegment[] = [];
  let curSegment: LineSegment | null = null;

  for (const item of sortedItems) {
    const rawSize = Math.hypot(item.transform[2] || 0, item.transform[3] || 0) || Math.abs(item.transform[3]) || item.height || 12;
    const fontSize = +(Math.max(rawSize, 8).toFixed(1));
    const itemX = item.transform[4];
    const itemY = item.transform[5];

    const style = fontStyles[item.fontName];
    const exactFontFamily = style ? style.fontFamily : "sans-serif";
    const detected = detectFontDetails(item.fontName, style);
    const isBold = detected.isBold;
    const isItalic = detected.isItalic;
    const cleanStr = (item.str || "").trimEnd();
    if (!cleanStr) continue;

    const itemWidth = Math.max(item.width || 0, fontSize * 0.55 * cleanStr.length);

    if (
      curSegment &&
      Math.abs(itemY - curSegment.y) <= 3.5 &&
      itemX >= curSegment.x
    ) {
      const gap = itemX - (curSegment.x + curSegment.width);

      // The Horizontal Rule (Table Column Fix):
      // If the gap is greater than fontSize * 1.5, do NOT merge (separate table column)
      if (gap <= fontSize * 1.5) {
        const addSpace = gap > fontSize * 0.18 && !curSegment.text.endsWith(" ") && !cleanStr.startsWith(" ");
        curSegment.text += (addSpace ? " " : "") + cleanStr;
        const endX = itemX + itemWidth;
        curSegment.width = Math.max(curSegment.width, endX - curSegment.x);
        curSegment.height = Math.max(curSegment.height, fontSize);
        continue;
      }
    }

    // Otherwise, push current segment and start a new line segment
    if (curSegment) {
      lineSegments.push(curSegment);
    }

    curSegment = {
      text: cleanStr,
      x: itemX,
      y: itemY,
      width: itemWidth,
      height: fontSize,
      fontSize,
      fontFamily: exactFontFamily,
      fontName: item.fontName,
      isBold,
      isItalic,
    };
  }

  if (curSegment) {
    lineSegments.push(curSegment);
  }

  // 3. Phase 2: Vertical Paragraph Clustering with Left & Center Alignment Support
  const candidateBlocks: CandidateBlock[] = [];

  for (const segment of lineSegments) {
    let matchedBlock: CandidateBlock | null = null;

    // Search active candidate blocks that can adopt this line segment
    for (const block of candidateBlocks) {
      const verticalGap = block.lastLineY - segment.y;
      const standardLineHeight = block.fontSize * 1.8;
      const minLineHeight = block.fontSize * 0.4;

      // Check vertical proximity (line immediately below within standard line-height)
      if (verticalGap >= minLineHeight && verticalGap <= standardLineHeight) {
        // Horizontal alignment check:
        // Left-align match (within 12px threshold)
        const isLeftAligned = Math.abs(block.minX - segment.x) <= 12;

        // Center-align match (within 12px threshold for titles/certificates)
        const blockCenter = block.minX + ((block.maxX - block.minX) / 2);
        const segmentCenter = segment.x + (segment.width / 2);
        const isCenterAligned = Math.abs(blockCenter - segmentCenter) <= 12;

        // Font compatibility (matching size within 2.5pt and font family)
        const isFontCompatible = Math.abs(block.fontSize - segment.fontSize) <= 2.5;

        if ((isLeftAligned || isCenterAligned) && isFontCompatible) {
          matchedBlock = block;
          if (isCenterAligned && !isLeftAligned) {
            matchedBlock.alignment = "center";
          }
          break;
        }
      }
    }

    if (matchedBlock) {
      // Merge into existing paragraph block
      matchedBlock.text += "\n" + segment.text;
      matchedBlock.lastLineY = segment.y;
      matchedBlock.lineCount += 1;
      matchedBlock.children.push({
        x: segment.x,
        y: segment.y,
        width: segment.width,
        height: segment.height,
        text: segment.text,
      });

      // The right-most edge (maxX) MUST include the width of the items
      const maxX = Math.max(...matchedBlock.children.map(child => child.x + child.width));
      const minX = Math.min(...matchedBlock.children.map(child => child.x));
      matchedBlock.minX = minX;
      matchedBlock.maxX = maxX;
      matchedBlock.minY = Math.min(matchedBlock.minY, segment.y);
      matchedBlock.maxY = Math.max(matchedBlock.maxY, segment.y + segment.height);
    } else {
      // Start a new logical block
      candidateBlocks.push({
        id: `p${pageIndex}_t${candidateBlocks.length}_${Math.random().toString(36).substring(2, 7)}`,
        pageIndex,
        text: segment.text,
        children: [{
          x: segment.x,
          y: segment.y,
          width: segment.width,
          height: segment.height,
          text: segment.text,
        }],
        minX: segment.x,
        maxX: segment.x + segment.width,
        minY: segment.y,
        maxY: segment.y + segment.height,
        firstLinePdfY: segment.y,
        lastLineY: segment.y,
        fontSize: segment.fontSize,
        fontFamily: segment.fontFamily,
        isBold: segment.isBold,
        isItalic: segment.isItalic,
        alignment: "left",
        lineCount: 1,
      });
    }
  }

  // 4. Map candidate blocks into final ClusteredBlockData structures
  return candidateBlocks.map(b => {
    const maxX = Math.max(...b.children.map(child => child.x + child.width));
    const minX = Math.min(...b.children.map(child => child.x));
    const width = Math.max(maxX - minX, 10);
    const height = Math.max(b.maxY - b.minY, b.fontSize);

    return {
      id: b.id,
      pageIndex: b.pageIndex,
      originalText: b.text,
      currentText: b.text,
      pdfX: minX,
      pdfY: b.firstLinePdfY, // Anchor baseline for line 0
      pdfWidth: width,
      pdfHeight: height,
      minX: minX,
      maxX: maxX,
      minY: b.minY,
      maxY: b.maxY,
      firstLinePdfY: b.firstLinePdfY,
      fontSize: b.fontSize,
      fontFamily: b.fontFamily,
      isBold: b.isBold,
      isItalic: b.isItalic,
      fontWeight: b.isBold ? "bold" : "normal",
      fontStyle: b.isItalic ? "italic" : "normal",
      color: "#000000",
      alignment: b.alignment,
      textAlign: b.alignment,
      zIndex: 10,
      isModified: false,
      isDeleted: false,
      isManuallyResized: false,
      lineCount: b.lineCount,
      children: b.children,
    };
  });
}
