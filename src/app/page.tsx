"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Combine, 
  Split, 
  FileEdit, 
  Minimize, 
  Image as ImageIcon, 
  FileImage, 
  RotateCw, 
  Lock,
  Search,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  MousePointerClick,
  Layers,
  FileCheck,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolItem {
  id: string;
  title: string;
  description: string;
  category: "edit" | "organize" | "convert" | "security";
  icon: any;
  iconBg: string;
  iconColor: string;
  badge?: string;
  href: string;
}

const allTools: ToolItem[] = [
  {
    id: "edit",
    title: "Edit PDF",
    description: "Click directly on existing text to edit words, fix typos, change fonts, colors, or whiteout sensitive info in-place.",
    category: "edit",
    icon: FileEdit,
    iconBg: "bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white",
    iconColor: "text-blue-600",
    badge: "In-Place Edit",
    href: "/tools/edit",
  },
  {
    id: "merge",
    title: "Merge PDF",
    description: "Combine multiple PDF documents into a single unified file with custom page sequencing and layout control.",
    category: "organize",
    icon: Combine,
    iconBg: "bg-red-500/10 border-red-500/20 group-hover:bg-red-600 group-hover:text-white",
    iconColor: "text-red-600",
    badge: "Popular",
    href: "/tools/merge",
  },
  {
    id: "split",
    title: "Split PDF",
    description: "Separate one page or extract specific page ranges (e.g. 1-3, 5, 8-10) into clean independent documents.",
    category: "organize",
    icon: Split,
    iconBg: "bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white",
    iconColor: "text-amber-600",
    badge: "Fast",
    href: "/tools/split",
  },
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert every page of your PDF into crisp, high-resolution JPG images packaged in a downloadable ZIP.",
    category: "convert",
    icon: ImageIcon,
    iconBg: "bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white",
    iconColor: "text-emerald-600",
    badge: "High Res",
    href: "/tools/pdf-to-jpg",
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Turn your JPG, PNG, and photo images into a formatted PDF document in seconds with full orientation control.",
    category: "convert",
    icon: FileImage,
    iconBg: "bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-600 group-hover:text-white",
    iconColor: "text-orange-600",
    href: "/tools/jpg-to-pdf",
  },
  {
    id: "rotate",
    title: "Rotate PDF",
    description: "Rotate your PDF pages 90°, 180°, or 270° clockwise or counterclockwise with real-time visual alignment.",
    category: "organize",
    icon: RotateCw,
    iconBg: "bg-purple-500/10 border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white",
    iconColor: "text-purple-600",
    href: "/tools/rotate",
  },
  {
    id: "compress",
    title: "Compress PDF",
    description: "Optimize and reduce the file size of heavy PDFs while preserving document clarity and vector fidelity.",
    category: "organize",
    icon: Minimize,
    iconBg: "bg-cyan-500/10 border-cyan-500/20 group-hover:bg-cyan-600 group-hover:text-white",
    iconColor: "text-cyan-600",
    badge: "Preview",
    href: "/tools/compress",
  },
  {
    id: "protect",
    title: "Protect PDF",
    description: "Add robust password encryption and access permissions to your sensitive PDF files.",
    category: "security",
    icon: Lock,
    iconBg: "bg-slate-500/10 border-slate-500/20 group-hover:bg-slate-700 group-hover:text-white",
    iconColor: "text-slate-600",
    badge: "Security",
    href: "/tools/protect",
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredTools = useMemo(() => {
    return allTools.filter((tool) => {
      const matchesSearch = 
        tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = 
        selectedCategory === "all" || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="w-full min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-20 px-4 sm:px-6 lg:px-8 border-b border-border/40 bg-white">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-red-500/8 via-blue-500/8 to-transparent blur-3xl -z-10 pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Professional All-in-One PDF Suite</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
            Every tool you need to edit & manage{" "}
            <span className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 bg-clip-text text-transparent">
              PDF Documents
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
            Edit existing text in-place, merge documents, split pages, convert formats, and redact PDFs with professional precision. Fast, free, and unlimited.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/tools/edit" prefetch={true}>
              <Button size="lg" className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/20 px-8 font-semibold rounded-xl gap-2 h-12">
                <FileEdit className="h-5 w-5" />
                <span>Launch PDF Editor</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link href="/tools/merge" prefetch={true}>
              <Button size="lg" variant="outline" className="px-6 rounded-xl font-semibold border-border hover:bg-muted/80 h-12 gap-2">
                <Combine className="h-4 w-4 text-red-600" />
                <span>Merge PDFs</span>
              </Button>
            </Link>
          </div>

          {/* Value props ticker */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 pt-4 text-xs font-medium text-muted-foreground/90">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>In-Place Text Editing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Instant High-Speed Processing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Unlimited Use</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Clean Exports</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tools Showcase Section */}
      <section className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Controls: Search and Categories */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-border/70 rounded-xl shadow-xs overflow-x-auto max-w-full">
            {[
              { id: "all", label: "All Tools" },
              { id: "edit", label: "Edit & Annotate" },
              { id: "organize", label: "Organize & Merge" },
              { id: "convert", label: "Convert Formats" },
              { id: "security", label: "Security" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tools (e.g. merge, edit)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Beautifully Laid Out Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link 
                href={tool.href} 
                key={tool.id} 
                prefetch={true}
                className="group flex h-full"
              >
                <div className="flex flex-col justify-between w-full p-6 bg-white rounded-2xl border border-border/80 shadow-xs hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-200">
                  <div className="space-y-4">
                    {/* Icon & Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-200 shadow-xs ${tool.iconBg}`}>
                        <Icon className={`h-6 w-6 transition-colors ${tool.iconColor} group-hover:text-white`} />
                      </div>

                      {tool.badge && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-border/60">
                          {tool.badge}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        <span>{tool.title}</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Hint */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-blue-600 transition-colors">
                    <span>Open tool</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-16 space-y-3 bg-white border border-dashed rounded-2xl">
            <p className="text-muted-foreground font-medium">No PDF tools found matching &quot;{searchQuery}&quot;</p>
            <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
              Reset Filters
            </Button>
          </div>
        )}
      </section>

      {/* Feature Guarantee Banner */}
      <section className="max-w-7xl mx-auto pb-16 px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 to-zinc-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-rose-300">
              <Zap className="h-3.5 w-3.5" />
              <span>Modern High-Performance Architecture</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Why professionals rely on PDF Studio
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-white/10 w-fit text-red-400">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm">Blazing Fast Execution</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Documents render instantly in full vector clarity without waiting in conversion queues or server delays.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-white/10 w-fit text-blue-400">
                  <MousePointerClick className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm">Real In-Place Editing</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Click on any text line in your document to fix typos, change names, update dates, or redact numbers with clean typography.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-white/10 w-fit text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm">No Limits & Clean Exports</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Export your documents without watermarks, task limits, or compression degradation.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Link href="/tools/edit" prefetch={true}>
                <Button size="lg" className="bg-white text-zinc-950 hover:bg-white/90 font-bold rounded-xl shadow-lg">
                  Start Editing Now — It&apos;s Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
