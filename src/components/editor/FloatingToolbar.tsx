"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Trash2, 
  Copy, 
  ArrowUpToLine, 
  ArrowDownToLine, 
  Check,
  Palette,
  GripVertical,
  Lock,
  Unlock,
  Paintbrush,
  Ban,
  Slash,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const FONT_FAMILIES = [
  // Sans-Serif
  { name: "Arial (Standard)", value: "Arial", group: "Sans-Serif", css: "Arial, Helvetica, sans-serif" },
  { name: "Calibri (Office)", value: "Calibri", group: "Sans-Serif", css: "Calibri, Candara, 'Segoe UI', Arial, sans-serif" },
  { name: "Segoe UI", value: "Segoe UI", group: "Sans-Serif", css: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  { name: "Helvetica / Arial", value: "Helvetica", group: "Sans-Serif", css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { name: "Inter (UI Clean)", value: "Inter", group: "Sans-Serif", css: "'Inter', sans-serif" },
  { name: "Poppins (Modern)", value: "Poppins", group: "Sans-Serif", css: "'Poppins', sans-serif" },
  { name: "Roboto (Tech)", value: "Roboto", group: "Sans-Serif", css: "'Roboto', sans-serif" },
  { name: "Montserrat (Bold)", value: "Montserrat", group: "Sans-Serif", css: "'Montserrat', sans-serif" },
  { name: "Open Sans (Neutral)", value: "Open Sans", group: "Sans-Serif", css: "'Open Sans', sans-serif" },
  { name: "Lato (Humanist)", value: "Lato", group: "Sans-Serif", css: "'Lato', sans-serif" },
  { name: "Verdana (Wide)", value: "Verdana", group: "Sans-Serif", css: "Verdana, sans-serif" },
  { name: "Trebuchet MS", value: "Trebuchet MS", group: "Sans-Serif", css: "'Trebuchet MS', sans-serif" },
  
  // Serif
  { name: "Times New Roman", value: "Times", group: "Serif", css: "'Times New Roman', Times, 'Nimbus Roman No9 L', serif" },
  { name: "Cambria (Office)", value: "Cambria", group: "Serif", css: "Cambria, Georgia, serif" },
  { name: "Georgia (Editorial)", value: "Georgia", group: "Serif", css: "Georgia, serif" },
  { name: "Garamond (Classic)", value: "Garamond", group: "Serif", css: "Garamond, serif" },
  { name: "Playfair Display", value: "Playfair Display", group: "Serif", css: "'Playfair Display', serif" },
  { name: "Merriweather", value: "Merriweather", group: "Serif", css: "'Merriweather', serif" },
  
  // Monospace
  { name: "Courier New (Mono)", value: "Courier", group: "Monospace", css: "'Courier New', monospace" },
  { name: "Consolas (Code)", value: "Consolas", group: "Monospace", css: "Consolas, monospace" },
  
  // Script / Handwritten / Signature
  { name: "Pacifico (Signature)", value: "Pacifico", group: "Script & Signature", css: "'Pacifico', cursive" },
  { name: "Dancing Script", value: "Dancing Script", group: "Script & Signature", css: "'Dancing Script', cursive" },
  { name: "Caveat (Handwritten)", value: "Caveat", group: "Script & Signature", css: "'Caveat', cursive" },
  { name: "Impact (Heavy)", value: "Impact", group: "Display", css: "Impact, sans-serif" },
  { name: "Comic Sans MS", value: "Comic Sans MS", group: "Display", css: "'Comic Sans MS', cursive" },
];

export const COLOR_SWATCHES = [
  { name: "Black", hex: "#000000" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Slate", hex: "#64748b" },
  { name: "Red", hex: "#ef4444" },
  { name: "Crimson", hex: "#be123c" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Pink", hex: "#ec4899" },
  { name: "White", hex: "#ffffff" },
];

interface FloatingToolbarProps {
  x: number;
  y: number;
  targetWidth?: number;
  targetHeight?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
  alignment?: "left" | "center" | "right";
  isText?: boolean;
  isShape?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeStyle?: "solid" | "dashed";
  isAspectRatioLocked?: boolean;
  onToggleAspectRatio?: () => void;
  onUpdateTypography?: (updates: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    isBold?: boolean;
    isItalic?: boolean;
    alignment?: "left" | "center" | "right";
  }) => void;
  onUpdateShape?: (updates: {
    strokeWidth?: number;
    color?: string;
    fillColor?: string;
    strokeStyle?: "solid" | "dashed";
  }) => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export function FloatingToolbar({
  x,
  y,
  targetWidth = 140,
  targetHeight = 36,
  fontSize = 14,
  fontFamily = "Helvetica",
  color = "#000000",
  isBold = false,
  isItalic = false,
  alignment = "left",
  isText = true,
  isShape = false,
  strokeWidth = 2,
  strokeColor,
  fillColor = "transparent",
  strokeStyle = "solid",
  isAspectRatioLocked,
  onToggleAspectRatio,
  onUpdateTypography,
  onUpdateShape,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onDelete,
  onClose,
}: FloatingToolbarProps) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initOffsetX: number; initOffsetY: number } | null>(null);

  // Prevent toolbar clicks from propagating to canvas
  const handleToolbarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Dragging logic for user re-positioning toolbar
  const handleGripMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initOffsetX: dragOffset.x,
      initOffsetY: dragOffset.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setDragOffset({
        x: dragStartRef.current.initOffsetX + dx,
        y: dragStartRef.current.initOffsetY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // SMART PLACEMENT:
  // If y > 95: place ABOVE the target so it NEVER covers text
  // If y <= 95 (near top of page): place BELOW the target with safe margin
  const toolbarHeight = 82;
  const isNearTop = y < 110;
  const computedTop = isNearTop 
    ? y + targetHeight + 12 
    : y - toolbarHeight - 18;

  // Center horizontally over target element with safety clamping
  const computedLeft = Math.max(10, x + (targetWidth / 2) - 200);

  const finalX = computedLeft + dragOffset.x;
  const finalY = computedTop + dragOffset.y;

  return (
    <div
      onClick={handleToolbarClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-50 flex flex-col gap-1.5 p-2 bg-white/95 border border-border shadow-2xl rounded-2xl text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 w-max max-w-[95vw]"
      style={{
        left: `${finalX}px`,
        top: `${finalY}px`,
      }}
    >
      {/* Top Row: Grip, Font Family, Size Stepper, Bold/Italic, Alignment, Layer & Actions */}
      <div className="flex items-center gap-1.5 flex-nowrap">
        {/* Drag Handle */}
        <div 
          onMouseDown={handleGripMouseDown}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/60 hover:text-foreground hover:bg-slate-100 rounded-md transition-colors shrink-0"
          title="Drag to reposition toolbar"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {isText && onUpdateTypography && (
          <>
            {/* Font Family Selector */}
            <select
              value={fontFamily}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateTypography({ fontFamily: e.target.value })}
              className="h-7 text-xs border border-border/80 rounded-lg bg-white px-1.5 font-medium focus:outline-hidden w-28 sm:w-32 truncate shrink-0"
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
            <div className="flex items-center border border-border/80 rounded-lg bg-white h-7 px-1 shrink-0">
              <button
                type="button"
                className="px-1 text-muted-foreground hover:text-foreground font-bold hover:bg-slate-50 rounded"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ fontSize: Math.max(8, fontSize - 1) })}
                title="Decrease font size"
              >
                -
              </button>
              <span className="font-mono text-xs px-1 font-bold w-6 text-center">
                {fontSize}
              </span>
              <button
                type="button"
                className="px-1 text-muted-foreground hover:text-foreground font-bold hover:bg-slate-50 rounded"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ fontSize: Math.min(72, fontSize + 1) })}
                title="Increase font size"
              >
                +
              </button>
            </div>

            {/* Bold & Italic */}
            <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-white shrink-0">
              <Button
                variant={isBold ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ isBold: !isBold })}
                title="Bold"
              >
                <Bold className="h-3 w-3" />
              </Button>
              <Button
                variant={isItalic ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ isItalic: !isItalic })}
                title="Italic"
              >
                <Italic className="h-3 w-3" />
              </Button>
            </div>

            {/* Alignment */}
            <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-white shrink-0">
              <Button
                variant={alignment === "left" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ alignment: "left" })}
                title="Align Left"
              >
                <AlignLeft className="h-3 w-3" />
              </Button>
              <Button
                variant={alignment === "center" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ alignment: "center" })}
                title="Align Center"
              >
                <AlignCenter className="h-3 w-3" />
              </Button>
              <Button
                variant={alignment === "right" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ alignment: "right" })}
                title="Align Right"
              >
                <AlignRight className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}

        {isShape && onUpdateShape && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Stroke Thickness Stepper */}
            <div className="flex items-center border border-border/80 rounded-lg bg-white h-7 px-1.5 shrink-0 gap-1">
              <span className="text-[10px] text-muted-foreground font-semibold">Stroke:</span>
              <button
                type="button"
                className="px-1 text-xs text-muted-foreground hover:text-foreground font-bold hover:bg-slate-50 rounded"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateShape({ strokeWidth: Math.max(1, (strokeWidth || 2) - 1) })}
                title="Decrease stroke thickness"
              >
                -
              </button>
              <span className="font-mono text-xs px-0.5 font-bold min-w-[24px] text-center">
                {strokeWidth || 2}px
              </span>
              <button
                type="button"
                className="px-1 text-xs text-muted-foreground hover:text-foreground font-bold hover:bg-slate-50 rounded"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateShape({ strokeWidth: Math.min(16, (strokeWidth || 2) + 1) })}
                title="Increase stroke thickness"
              >
                +
              </button>
            </div>

            {/* Quick Presets */}
            <div className="hidden sm:flex items-center border border-border/80 rounded-lg p-0.5 bg-white shrink-0 gap-0.5">
              {[1, 2, 4, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateShape({ strokeWidth: w })}
                  className={`h-6 px-1.5 text-[10px] font-bold rounded transition-colors ${
                    (strokeWidth || 2) === w ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${w}px thickness`}
                >
                  {w}px
                </button>
              ))}
            </div>

            {/* Solid vs Dashed */}
            <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-white shrink-0 gap-0.5">
              <Button
                variant={strokeStyle !== "dashed" ? "secondary" : "ghost"}
                size="sm"
                className={`h-6 px-1.5 text-[10px] font-semibold rounded shrink-0 ${strokeStyle !== "dashed" ? "bg-slate-200 font-bold" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateShape({ strokeStyle: "solid" })}
                title="Solid Line"
              >
                Solid
              </Button>
              <Button
                variant={strokeStyle === "dashed" ? "secondary" : "ghost"}
                size="sm"
                className={`h-6 px-1.5 text-[10px] font-semibold rounded shrink-0 ${strokeStyle === "dashed" ? "bg-slate-200 font-bold" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateShape({ strokeStyle: "dashed" })}
                title="Dashed Line"
              >
                Dashed
              </Button>
            </div>
          </div>
        )}

        {/* Actions Cluster (Layer, Duplicate, Delete, Done) */}
        <div className="flex items-center gap-1 shrink-0 ml-auto pl-1.5 border-l border-border/60">
          {onToggleAspectRatio && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 shrink-0 ${isAspectRatioLocked ? "text-blue-600 bg-blue-50" : "text-muted-foreground hover:text-foreground"}`}
              onClick={onToggleAspectRatio}
              onMouseDown={(e) => e.preventDefault()}
              title={isAspectRatioLocked ? "Aspect Ratio: Locked (Click to unlock free resize)" : "Aspect Ratio: Free (Click to lock ratio)"}
            >
              {isAspectRatioLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </Button>
          )}

          {onBringForward && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
              onClick={onBringForward}
              title="Bring to Front"
            >
              <ArrowUpToLine className="h-3 w-3" />
            </Button>
          )}

          {onSendBackward && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
              onClick={onSendBackward}
              title="Send to Back"
            >
              <ArrowDownToLine className="h-3 w-3" />
            </Button>
          )}

          {onDuplicate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
              onClick={onDuplicate}
              title="Duplicate Element"
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-red-50 shrink-0"
              onClick={onDelete}
              title="Delete Element"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 shrink-0"
              onClick={onClose}
              title="Done (Escape)"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Row: Color Swatches & Hex Color Picker */}
      {isText && onUpdateTypography && (
        <div className="flex items-center gap-1.5 pl-6 pt-1 border-t border-border/40">
          <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          
          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            {COLOR_SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTypography({ color: s.hex })}
                className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-transform shrink-0 ${
                  color.toLowerCase() === s.hex.toLowerCase()
                    ? "ring-2 ring-blue-600 ring-offset-1 scale-110" 
                    : "opacity-80 hover:opacity-100 hover:scale-110"
                }`}
                style={{ backgroundColor: s.hex }}
                title={s.name}
              />
            ))}
          </div>

          {/* Custom Hex Color Picker */}
          <div className="relative flex items-center ml-1 shrink-0">
            <input
              type="color"
              value={color.startsWith("#") ? color : "#000000"}
              onChange={(e) => onUpdateTypography({ color: e.target.value })}
              className="w-5 h-5 rounded-full border border-border cursor-pointer p-0 bg-transparent overflow-hidden shrink-0"
              title="Custom Hex Color Picker"
            />
          </div>
        </div>
      )}

      {/* Bottom Row for Shapes: Stroke Color & Fill Color */}
      {isShape && onUpdateShape && (
        <div className="flex items-center flex-wrap gap-2 pl-6 pt-1 border-t border-border/40 text-xs">
          {/* Stroke Color */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground font-semibold">Stroke:</span>
            <div className="flex items-center gap-1 flex-nowrap shrink-0">
              {COLOR_SWATCHES.slice(0, 8).map((s) => (
                <button
                  key={`stroke_${s.hex}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateShape({ color: s.hex })}
                  className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-transform shrink-0 ${
                    (strokeColor || color || "#000000").toLowerCase() === s.hex.toLowerCase()
                      ? "ring-2 ring-blue-600 ring-offset-1 scale-110" 
                      : "opacity-80 hover:opacity-100 hover:scale-110"
                  }`}
                  style={{ backgroundColor: s.hex }}
                  title={`Stroke: ${s.name}`}
                />
              ))}
              <input
                type="color"
                value={(strokeColor || color || "#000000").startsWith("#") ? (strokeColor || color || "#000000") : "#000000"}
                onChange={(e) => onUpdateShape({ color: e.target.value })}
                className="w-4 h-4 rounded-full border border-border cursor-pointer p-0 bg-transparent overflow-hidden shrink-0 ml-0.5"
                title="Custom Stroke Color"
              />
            </div>
          </div>

          <div className="h-3.5 w-px bg-border/80 shrink-0" />

          {/* Fill Color */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground font-semibold">Fill:</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onUpdateShape({ fillColor: "transparent" })}
              className={`h-4 px-1 rounded text-[9px] font-bold border transition-colors ${
                !fillColor || fillColor === "transparent"
                  ? "bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400"
                  : "bg-white text-muted-foreground border-border hover:text-foreground"
              }`}
              title="No Fill (Transparent)"
            >
              None
            </button>
            <div className="flex items-center gap-1 flex-nowrap shrink-0">
              {COLOR_SWATCHES.slice(0, 8).map((s) => (
                <button
                  key={`fill_${s.hex}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateShape({ fillColor: s.hex })}
                  className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-transform shrink-0 ${
                    fillColor && fillColor.toLowerCase() === s.hex.toLowerCase()
                      ? "ring-2 ring-blue-600 ring-offset-1 scale-110" 
                      : "opacity-80 hover:opacity-100 hover:scale-110"
                  }`}
                  style={{ backgroundColor: s.hex }}
                  title={`Fill: ${s.name}`}
                />
              ))}
              <input
                type="color"
                value={fillColor && fillColor.startsWith("#") ? fillColor : "#ffffff"}
                onChange={(e) => onUpdateShape({ fillColor: e.target.value })}
                className="w-4 h-4 rounded-full border border-border cursor-pointer p-0 bg-transparent overflow-hidden shrink-0 ml-0.5"
                title="Custom Fill Color"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
