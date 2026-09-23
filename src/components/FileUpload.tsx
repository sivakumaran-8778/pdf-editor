"use client";

import React, { useCallback, useState, useRef } from "react";
import { Upload, FileUp, Sparkles, Shield, AlertCircle, Zap, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  title?: string;
  subtitle?: string;
}

export function FileUpload({
  onFilesSelected,
  accept = "application/pdf,.pdf",
  multiple = false,
  maxSizeMB = 150,
  title,
  subtitle,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateAndProcessFiles = useCallback((files: File[]) => {
    setError(null);
    const validFiles: File[] = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || 
                    file.type === "application/x-pdf" || 
                    name.endsWith(".pdf");
      const isImage = file.type.startsWith("image/") || 
                      /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(name);

      if (accept.includes("pdf") && !isPdf && !accept.includes("image")) {
        setError("Only PDF files are supported for this tool.");
        return;
      }
      if (accept.includes("image") && !isImage && !accept.includes("pdf")) {
        setError("Only image files are supported for this tool.");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File exceeds maximum size of ${maxSizeMB}MB.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (!multiple && validFiles.length > 1) {
      onFilesSelected([validFiles[0]]);
    } else {
      onFilesSelected(validFiles);
    }
  }, [accept, maxSizeMB, multiple, onFilesSelected]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        validateAndProcessFiles(Array.from(e.dataTransfer.files));
      }
    },
    [validateAndProcessFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndProcessFiles(Array.from(e.target.files));
      }
      // Reset input value so choosing the same file again triggers onChange
      e.target.value = "";
    },
    [validateAndProcessFiles]
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? "border-rose-500 bg-rose-500/5 ring-4 ring-rose-500/10 scale-[1.008]"
            : "border-slate-300/80 hover:border-rose-500/60 hover:bg-slate-50/70 bg-slate-50/30 shadow-xs"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
        />

        <div className="flex flex-col items-center justify-center space-y-5 max-w-md mx-auto">
          {/* Glowing animated icon badge */}
          <div className={`p-4 rounded-2xl transition-all duration-300 ${
            isDragging 
              ? "bg-rose-600 text-white scale-110 shadow-xl shadow-rose-500/30" 
              : "bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-xs group-hover:scale-105"
          }`}>
            <FileUp className="h-10 w-10" />
          </div>

          <div className="space-y-1.5">
            <h3 className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900">
              {title || (multiple ? "Select or Drop PDF Files" : "Select or Drop your PDF")}
            </h3>
            <p className="text-sm text-slate-500">
              {subtitle || (multiple ? "Drag and drop multiple documents to combine them" : "Drag and drop your file here, or click to browse from device")}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button 
              type="button" 
              size="lg" 
              className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 text-white shadow-xl shadow-red-500/25 px-8 font-bold rounded-2xl gap-2 h-12 hover:-translate-y-0.5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
            >
              <Upload className="h-4 w-4" />
              <span>Choose {multiple ? "Files" : "File"}</span>
            </Button>
          </div>

          {/* Privacy & Size Trust row */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-5 border-t border-slate-200/80 w-full font-medium">
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>100% Private (No uploads)</span>
            </div>
            <span>•</span>
            <span>Up to {maxSizeMB}MB</span>
            <span>•</span>
            <div className="flex items-center gap-1 text-slate-600">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Instant preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
