import * as pdfjsLib from "pdfjs-dist";

export interface DetectedPdfImage {
  id: string;
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  vx: number;
  vy: number;
  vWidth: number;
  vHeight: number;
  imgUrl?: string;
  name?: string;
  bgColor?: string;
}

// 2D Affine transform helper [a, b, c, d, e, f]
function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Detects all embedded images in a PDF page and computes their bounding boxes.
 */
export async function detectPageImages(
  page: pdfjsLib.PDFPageProxy,
  pageIndex: number,
  viewport: pdfjsLib.PageViewport,
  scale: number,
  renderedCanvas?: HTMLCanvasElement | null
): Promise<DetectedPdfImage[]> {
  const images: DetectedPdfImage[] = [];

  try {
    const operatorList = await page.getOperatorList();
    const fnArray = operatorList.fnArray;
    const argsArray = operatorList.argsArray;

    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack: number[][] = [];

    const OPS = pdfjsLib.OPS;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];

      if (fn === OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        if (ctmStack.length > 0) {
          ctm = ctmStack.pop()!;
        }
      } else if (fn === OPS.transform) {
        if (args && args.length === 6) {
          ctm = multiplyTransform(ctm, args);
        }
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const imgName = args && args[0] ? String(args[0]) : `img_${images.length}`;

        // The image unit box [0,0] to [1,1] is mapped by ctm
        const corners = [
          [ctm[4], ctm[5]],
          [ctm[0] + ctm[4], ctm[1] + ctm[5]],
          [ctm[2] + ctm[4], ctm[3] + ctm[5]],
          [ctm[0] + ctm[2] + ctm[4], ctm[1] + ctm[3] + ctm[5]],
        ];

        const xs = corners.map(c => c[0]);
        const ys = corners.map(c => c[1]);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const pdfWidth = maxX - minX;
        const pdfHeight = maxY - minY;

        // Skip microscopic artifacts (< 5pt)
        if (pdfWidth < 5 || pdfHeight < 5) continue;

        // Convert coordinates to viewport screen space
        const [vx, vy] = viewport.convertToViewportPoint(minX, maxY);
        const vWidth = Math.max(pdfWidth * scale, 10);
        const vHeight = Math.max(pdfHeight * scale, 10);

        let imgUrl = "";
        let bgColor = "#ffffff";

        // Attempt 1: Extract from rendered canvas if available
        if (renderedCanvas && vWidth > 0 && vHeight > 0) {
          try {
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = Math.max(Math.round(vWidth), 1);
            cropCanvas.height = Math.max(Math.round(vHeight), 1);
            const cropCtx = cropCanvas.getContext("2d");
            if (cropCtx && renderedCanvas) {
              const canvasDpr = renderedCanvas.width / (viewport.width || 1);
              cropCtx.drawImage(
                renderedCanvas,
                Math.round(vx * canvasDpr),
                Math.round(vy * canvasDpr),
                Math.round(cropCanvas.width * canvasDpr),
                Math.round(cropCanvas.height * canvasDpr),
                0,
                0,
                cropCanvas.width,
                cropCanvas.height
              );
              imgUrl = cropCanvas.toDataURL("image/png");

              // Sample background color right outside the image bounds
              const sampleCoords = [
                [-3, -3],
                [vWidth + 3, -3],
                [-3, vHeight + 3],
                [vWidth / 2, -3],
              ];
              const canvasCtx = renderedCanvas.getContext("2d");
              if (canvasCtx) {
                for (const [ox, oy] of sampleCoords) {
                  const sx = Math.round((vx + ox) * canvasDpr);
                  const sy = Math.round((vy + oy) * canvasDpr);
                  if (sx >= 0 && sx < renderedCanvas.width && sy >= 0 && sy < renderedCanvas.height) {
                    const p = canvasCtx.getImageData(sx, sy, 1, 1).data;
                    if (p[3] > 100) {
                      bgColor = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
                      break;
                    }
                  }
                }
              }
            }
          } catch (cropErr) {
            console.warn("Canvas crop/sample fallback:", cropErr);
          }
        }

        images.push({
          id: `img_${pageIndex}_${images.length}_${Math.random().toString(36).substring(2, 6)}`,
          pageIndex,
          pdfX: minX,
          pdfY: minY,
          pdfWidth,
          pdfHeight,
          vx,
          vy,
          vWidth,
          vHeight,
          imgUrl,
          name: imgName,
          bgColor,
        });
      }
    }
  } catch (err) {
    console.warn("Image detection encountered an error:", err);
  }

  return images;
}
