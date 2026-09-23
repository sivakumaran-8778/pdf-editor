// Typography & Font Matching Engine

export interface MatchedTypography {
  fontSize: number;
  fontFamily: string;
  color: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface TextReferenceItem {
  pdfX: number;
  pdfY: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
}

export function findNearestTypography(
  clickPdfX: number,
  clickPdfY: number,
  referenceItems: TextReferenceItem[]
): MatchedTypography {
  // Default fallback typography
  const defaultTypography: MatchedTypography = {
    fontSize: 14,
    fontFamily: "Helvetica",
    color: "black",
    isBold: false,
    isItalic: false,
  };

  if (!referenceItems || referenceItems.length === 0) {
    return defaultTypography;
  }

  let minDistance = Infinity;
  let closestItem: TextReferenceItem | null = null;

  for (const item of referenceItems) {
    // Euclidean distance in PDF coordinates
    const distance = Math.hypot(item.pdfX - clickPdfX, item.pdfY - clickPdfY);
    if (distance < minDistance) {
      minDistance = distance;
      closestItem = item;
    }
  }

  if (!closestItem) {
    return defaultTypography;
  }

  return {
    fontSize: Math.max(8, Math.min(closestItem.fontSize || 14, 36)),
    fontFamily: closestItem.fontFamily || "Helvetica",
    color: closestItem.color || "black",
    isBold: !!closestItem.isBold,
    isItalic: !!closestItem.isItalic,
  };
}
