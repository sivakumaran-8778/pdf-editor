"use client";

import React from "react";
import { 
  FormInput, 
  CheckSquare, 
  PenTool, 
  Calendar, 
  Sparkles, 
  HelpCircle,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type FormFieldType = "text" | "checkbox" | "signature" | "date" | "radio";

export interface FormFieldItem {
  id: string;
  pageIndex: number;
  type: FormFieldType;
  name: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  value?: string;
  isChecked?: boolean;
  required?: boolean;
}

interface FormPaletteProps {
  onAddField: (type: FormFieldType) => void;
  onAutoDetectFields: () => void;
  isDetecting?: boolean;
}

export function FormPalette({
  onAddField,
  onAutoDetectFields,
  isDetecting = false,
}: FormPaletteProps) {
  const fields = [
    { type: "text" as FormFieldType, label: "Text Input", icon: FormInput, desc: "Single line text entry" },
    { type: "checkbox" as FormFieldType, label: "Checkbox", icon: CheckSquare, desc: "Interactive toggle" },
    { type: "signature" as FormFieldType, label: "Signature", icon: PenTool, desc: "Signee approval block" },
    { type: "date" as FormFieldType, label: "Date Field", icon: Calendar, desc: "Calendar date picker" },
    { type: "radio" as FormFieldType, label: "Radio Option", icon: Radio, desc: "Single selection group" },
  ];

  return (
    <div className="p-3 space-y-4 text-xs select-none">
      {/* Auto Detect Button */}
      <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl space-y-2 shadow-xs">
        <div className="flex items-center gap-1.5 font-bold text-blue-900">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span>Smart Form Detection</span>
        </div>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          Automatically detect underlined blanks, signatures, and date lines to generate interactive fields.
        </p>
        <Button
          size="sm"
          onClick={onAutoDetectFields}
          disabled={isDetecting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 rounded-lg shadow-xs"
        >
          {isDetecting ? "Scanning Document..." : "Auto-Detect Fields"}
        </Button>
      </div>

      {/* Manual Field Palette */}
      <div className="space-y-2">
        <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block">
          Form Elements
        </span>

        <div className="grid grid-cols-1 gap-2">
          {fields.map(({ type, label, icon: Icon, desc }) => (
            <div
              key={type}
              onClick={() => onAddField(type)}
              className="p-2.5 rounded-xl border border-border/80 bg-white hover:border-blue-500 hover:bg-blue-50/40 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-foreground block group-hover:text-blue-600 transition-colors">
                    {label}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {desc}
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                + Add
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
