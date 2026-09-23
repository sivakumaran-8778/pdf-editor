"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
import { ImageIcon, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let image;
        
        if (file.type === "image/jpeg" || file.type === "image/jpg") {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else if (file.type === "image/png") {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          continue; // skip non jpg/png
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "converted_images.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: "Images have been converted to PDF successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while converting images to PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout 
      title="JPG to PDF" 
      description="Convert JPG or PNG images to PDF in seconds."
    >
      {!files.length ? (
        <FileUpload onFilesSelected={handleFilesSelected} multiple={true} accept="image/jpeg, image/png, image/jpg" />
      ) : (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="grid gap-4">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-8 w-8 text-yellow-600" />
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
                accept="image/jpeg, image/png, image/jpg" 
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
                Add More Images
              </Button>
            </label>
            <Button size="lg" onClick={handleConvert} disabled={isProcessing || files.length === 0}>
              {isProcessing ? "Converting..." : (
                <>
                  Convert to PDF <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
