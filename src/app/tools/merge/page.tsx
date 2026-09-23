"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
import { FileIcon, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: "Not enough files",
        description: "Please select at least 2 PDF files to merge.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      const mergedPdfFile = await mergedPdf.save();
      
      // Trigger download
      const blob = new Blob([mergedPdfFile as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: "Your PDFs have been merged successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while merging the PDFs.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout 
      title="Merge PDF" 
      description="Combine multiple PDFs into one unified document."
    >
      {!files.length ? (
        <FileUpload onFilesSelected={handleFilesSelected} multiple={true} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <FileIcon className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <label className="cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                accept="application/pdf" 
                multiple 
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(Array.from(e.target.files));
                  }
                }} 
              />
              <Button variant="outline" type="button" onClick={() => {
                const el = document.querySelector('.cursor-pointer input[type="file"]') as HTMLInputElement;
                if (el) el.click();
              }}>
                Add More Files
              </Button>
            </label>
            <Button size="lg" onClick={handleMerge} disabled={isProcessing || files.length < 2}>
              {isProcessing ? "Merging..." : (
                <>
                  Merge PDFs <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
