"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { ImageIcon, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Initialize worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export default function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      const zip = new JSZip();

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
        
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        
        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
        });

        if (blob) {
          zip.file(`page_${pageNum}.jpg`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${file.name.replace('.pdf', '')}_images.zip`);
      
      toast({
        title: "Success!",
        description: "PDF has been converted to images and downloaded.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while converting PDF to JPG.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout 
      title="PDF to JPG" 
      description="Convert each PDF page into a high-quality JPG image."
    >
      {!file ? (
        <FileUpload onFilesSelected={handleFilesSelected} multiple={false} />
      ) : (
        <div className="space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-8 w-8 text-yellow-500" />
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

          <div className="flex justify-end pt-4 border-t">
            <Button size="lg" onClick={handleConvert} disabled={isProcessing}>
              {isProcessing ? "Extracting Images..." : (
                <>
                  Convert to JPG <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
