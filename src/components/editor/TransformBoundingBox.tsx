"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotateCw } from "lucide-react";


interface TransformBoundingBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isSelected: boolean;
  isEditing?: boolean;
  isText?: boolean;
  aspectRatioLocked?: boolean;
  onTransformChange: (updates: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  }) => void;
  onTransformEnd?: () => void;
  onSelect?: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onStartEditing?: () => void;
  onRotate90?: () => void;
  onDuplicate?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onDelete?: () => void;
  zIndex?: number;
  children: React.ReactNode;
}

type HandleType = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot" | "drag";

export function TransformBoundingBox({
  x,
  y,
  width,
  height,
  rotation = 0,
  isSelected,
  isEditing = false,
  isText = false,
  aspectRatioLocked = false,
  onTransformChange,
  onTransformEnd,
  onSelect,
  onDoubleClick,
  onStartEditing,
  onRotate90,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onDelete,
  zIndex,
  children,
}: TransformBoundingBoxProps) {
  const [isInteracting, setIsInteracting] = useState(false);

  const handlePointerDown = (
    e: React.PointerEvent,
    handleType: HandleType
  ) => {
    // When actively editing text and clicking/dragging on the element body,
    // allow the text editor (contenteditable or textarea) to handle focus, selection, and typing!
    if (isEditing && handleType === "drag") {
      return;
    }

    e.stopPropagation();
    // Only call preventDefault on resize/rotation handles, not on drag,
    // so clicks, double-clicks, and text focus are not cancelled by the browser!
    if (handleType !== "drag") {
      e.preventDefault();
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = x;
    const initY = y;
    const initW = width;
    const initH = height;
    const initRot = rotation;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    let hasMoved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMoved = true;
        setIsInteracting(true);
      }

      if (handleType === "drag") {
        onTransformChange({
          x: Math.round(initX + dx),
          y: Math.round(initY + dy),
        });
        return;
      }

      if (handleType === "rot") {
        const rad = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;
        if (deg < 0) deg += 360;
        const snapTolerance = 6;
        for (const snapAngle of [0, 90, 180, 270, 360]) {
          if (Math.abs(deg - snapAngle) <= snapTolerance) {
            deg = snapAngle % 360;
            break;
          }
        }
        onTransformChange({ rotation: deg });
        return;
      }

      // Handle Resizing
      let newW = initW;
      let newH = initH;
      let newX = initX;
      let newY = initY;

      const isCornerHandle = handleType.length === 2; // "ne", "nw", "se", "sw"
      const lockRatio = (aspectRatioLocked || moveEvent.shiftKey) && isCornerHandle;
      const initialAspect = initW / Math.max(initH, 1);

      if (handleType.includes("e")) newW = Math.max(20, initW + dx);
      if (handleType.includes("s")) newH = Math.max(20, initH + dy);
      if (handleType.includes("w")) {
        const potentialW = initW - dx;
        if (potentialW >= 20) {
          newW = potentialW;
          newX = initX + dx;
        }
      }
      if (handleType.includes("n")) {
        const potentialH = initH - dy;
        if (potentialH >= 20) {
          newH = potentialH;
          newY = initY + dy;
        }
      }

      if (lockRatio) {
        if (handleType.includes("e") || handleType.includes("w")) {
          newH = Math.round(newW / initialAspect);
        } else {
          newW = Math.round(newH * initialAspect);
        }
      }

      onTransformChange({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setIsInteracting(false);

      if (hasMoved) {
        if (onTransformEnd) onTransformEnd();
        // Prevent synthetic click-away deselect right after transform drag finishes
        window.addEventListener(
          "click",
          (e) => {
            e.stopPropagation();
          },
          { capture: true, once: true }
        );
      } else {
        if (onSelect) onSelect();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      className={`transform-bounding-box absolute select-none bg-transparent ${
        isSelected 
          ? (isEditing ? "cursor-default" : "cursor-move") 
          : "cursor-grab hover:ring-2 hover:ring-blue-500/50 hover:ring-offset-1"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
        backgroundColor: "transparent",
        zIndex: zIndex !== undefined ? zIndex : (isSelected ? 30 : 20),
      }}
      onPointerDown={(e) => handlePointerDown(e, "drag")}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
    >
      {/* Element Content */}
      <div 
        className={`w-full h-full relative bg-transparent ${
          isEditing 
            ? "pointer-events-auto select-text" 
            : isText 
            ? "pointer-events-auto cursor-text" 
            : "pointer-events-auto cursor-move"
        }`}
        style={{ backgroundColor: "transparent" }}
        onClick={(e) => {
          if (isText && !isEditing) {
            e.stopPropagation();
            onStartEditing?.();
          }
        }}
        onDoubleClick={(e) => {
          if (isText) {
            e.stopPropagation();
            onStartEditing?.();
            onDoubleClick?.(e);
          }
        }}
      >
        {children}
      </div>



      {/* Bounding Box Outline & Handles (Sejda Style) */}
      {isSelected && (
        <>
          {/* Solid Sejda Blue Border Outline */}
          <div className="absolute -inset-1 border-2 border-blue-600 rounded-xs pointer-events-none shadow-sm" />

          {/* Top Rotation Stem and Circular Handle */}
          <div className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing">
            <div
              className="w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow-md flex items-center justify-center hover:scale-125 transition-transform"
              onPointerDown={(e) => handlePointerDown(e, "rot")}
              title="Drag to rotate"
              data-handle="rot"
            >
              <RotateCw className="h-2.5 w-2.5 text-blue-600" />
            </div>
            <div className="w-0.5 h-2.5 bg-blue-600" />
          </div>

          {/* 4 Sejda Circular Corner Handles */}
          {[
            { type: "nw", pos: "-top-2 -left-2 cursor-nwse-resize" },
            { type: "ne", pos: "-top-2 -right-2 cursor-nesw-resize" },
            { type: "se", pos: "-bottom-2 -right-2 cursor-nwse-resize" },
            { type: "sw", pos: "-bottom-2 -left-2 cursor-nesw-resize" },
          ].map(({ type, pos }) => (
            <div
              key={type}
              data-handle={type}
              className={`absolute w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-full shadow-md pointer-events-auto hover:bg-blue-600 hover:scale-125 transition-all ${pos}`}
              onPointerDown={(e) => handlePointerDown(e, type as HandleType)}
            />
          ))}

          {/* 4 Edge Midpoint Handles */}
          {[
            { type: "n", pos: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
            { type: "e", pos: "top-1/2 -translate-y-1/2 -right-1.5 cursor-ew-resize" },
            { type: "s", pos: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
            { type: "w", pos: "top-1/2 -translate-y-1/2 -left-1.5 cursor-ew-resize" },
          ].map(({ type, pos }) => (
            <div
              key={type}
              data-handle={type}
              className={`absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-xs shadow-xs pointer-events-auto hover:bg-blue-500 hover:scale-125 transition-all ${pos}`}
              onPointerDown={(e) => handlePointerDown(e, type as HandleType)}
            />
          ))}

          {/* Angle Badge when Rotating */}
          {rotation > 0 && (
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow-md font-mono pointer-events-none">
              {rotation}°
            </div>
          )}
        </>
      )}
    </div>
  );
}
