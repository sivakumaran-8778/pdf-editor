"use client";

import { ToolLayout } from "@/components/ToolLayout";

export default function CompressTool() {
  return (
    <ToolLayout 
      title="Compress PDF" 
      description="Reduce the file size of your PDF."
    >
      <div className="text-center p-12 bg-muted/30 rounded-xl">
        <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
        <p className="text-muted-foreground">High-performance compression tools are currently being integrated.</p>
      </div>
    </ToolLayout>
  );
}
