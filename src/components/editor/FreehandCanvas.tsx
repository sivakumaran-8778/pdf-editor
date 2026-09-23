"use client";

import React, { useState, useRef, useCallback } from "react";

export interface DrawingStroke {
  id: string;
  pageIndex: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

interface FreehandCanvasProps {
  pageIndex: number;
  width: number;
  height: number;
  scale: number;
  activeColor: string;
  strokeWidth: number;
  opacity?: number;
  isActive: boolean;
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
}

// Convert discrete points into a smooth SVG bezier curve
function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function FreehandCanvas({
  pageIndex,
  width,
  height,
  scale,
  activeColor,
  strokeWidth,
  opacity = 1,
  isActive,
  strokes,
  onAddStroke,
}: FreehandCanvasProps) {
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    isDrawingRef.current = true;
    setCurrentPoints([{ x, y }]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current || !isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setCurrentPoints((prev) => [...prev, { x, y }]);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentPoints.length > 1) {
      const newStroke: DrawingStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        pageIndex,
        points: currentPoints,
        color: activeColor,
        strokeWidth,
        opacity,
      };
      onAddStroke(newStroke);
    }
    setCurrentPoints([]);
  };

  const pageStrokes = strokes.filter((s) => s.pageIndex === pageIndex);

  return (
    <svg
      className={`absolute inset-0 w-full h-full ${
        isActive ? "pointer-events-auto cursor-crosshair z-30" : "pointer-events-none z-10"
      }`}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Existing Saved Strokes */}
      {pageStrokes.map((stroke) => (
        <path
          key={stroke.id}
          d={pointsToSvgPath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={stroke.opacity}
        />
      ))}

      {/* In-Flight Active Stroke */}
      {currentPoints.length > 1 && (
        <path
          d={pointsToSvgPath(currentPoints)}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      )}
    </svg>
  );
}
