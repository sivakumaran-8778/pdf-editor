"use client";

import { useState } from "react";
import { ToolLayout } from "@/components/ToolLayout";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { PDFDocument, degrees } from "pdf-lib";
import { FileIcon, Trash2, ArrowRight, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]);
      setRotation(0);
    }
  };

  const handleRotate = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      pages.forEach(page => {
        // Get current rotation
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + rotation));
      });

      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rotated_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: "PDF has been rotated successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "An error occurred while rotating the PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout 
      title="Rotate PDF" 
      description="Rotate all pages of your PDF document."
    >
      {!file ? (
        <FileUpload onFilesSelected={handleFilesSelected} multiple={false} />
      ) : (
        <div className="space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <FileIcon className="h-8 w-8 text-purple-500" />
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

          <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
            <div 
              className="w-32 h-40 bg-white shadow-md border rounded flex items-center justify-center text-xs text-muted-foreground transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              Document Preview
            </div>
            <div className="mt-8 flex gap-4">
              <Button variant="outline" onClick={() => setRotation((r) => (r - 90) % 360)}>
                <RotateCw className="mr-2 h-4 w-4 scale-x-[-1]" /> Rotate Left
              </Button>
              <Button variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                Rotate Right <RotateCw className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button size="lg" onClick={handleRotate} disabled={isProcessing || rotation === 0}>
              {isProcessing ? "Processing..." : (
                <>
                  Apply Rotation <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
