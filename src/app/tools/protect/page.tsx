"use client";

import { ToolLayout } from "@/components/ToolLayout";

export default function ProtectTool() {
  return (
    <ToolLayout 
      title="Protect PDF" 
      description="Encrypt your PDF files."
    >
      <div className="text-center p-12 bg-muted/30 rounded-xl">
        <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
        <p className="text-muted-foreground">Advanced PDF encryption and security tools are currently being integrated.</p>
      </div>
    </ToolLayout>
  );
}
