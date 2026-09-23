"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PDFDocument } from "pdf-lib";
import { FileIcon, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    if (!ranges.trim()) {
      toast({
        title: "Empty ranges",
        description: "Please enter pages to extract (e.g., 1-3, 5).",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      // Parse ranges like "1-3, 5"
      const pagesToExtract = new Set<number>();
      const parts = ranges.split(",").map(p => p.trim());
      
      for (const part of parts) {
        if (part.includes("-")) {
          const [startStr, endStr] = part.split("-");
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start) && !isNaN(end) && start > 0 && end <= totalPages && start <= end) {
            for (let i = start; i <= end; i++) {
              pagesToExtract.add(i - 1); // zero-indexed
            }
          }
        } else {
          const pageNum = parseInt(part);
          if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
            pagesToExtract.add(pageNum - 1);
          }
        }
      }

      if (pagesToExtract.size === 0) {
        toast({
          title: "Invalid ranges",
          description: `Please enter valid page numbers between 1 and ${totalPages}.`,
          variant: "destructive",
        });
        return;
      }

      const splitPdf = await PDFDocument.create();
      const pageIndices = Array.from(pagesToExtract).sort((a, b) => a - b);
      const copiedPages = await splitPdf.copyPages(pdfDoc, pageIndices);
      
      copiedPages.forEach((page) => {
        splitPdf.addPage(page);
      });

      const splitPdfFile = await splitPdf.save();
      
      const blob = new Blob([splitPdfFile as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `split_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: "PDF has been split successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while splitting the PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout 
      title="Split PDF" 
      description="Extract pages from your PDF by entering page ranges."
    >
      {!file ? (
        <FileUpload onFilesSelected={handleFilesSelected} multiple={false} />
      ) : (
        <div className="space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <FileIcon className="h-8 w-8 text-orange-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ranges">Pages to Extract</Label>
            <Input 
              id="ranges" 
              placeholder="e.g. 1-3, 5, 8-10" 
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter page numbers and/or page ranges separated by commas.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button size="lg" onClick={handleSplit} disabled={isProcessing || !ranges}>
              {isProcessing ? "Processing..." : (
                <>
                  Split PDF <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
