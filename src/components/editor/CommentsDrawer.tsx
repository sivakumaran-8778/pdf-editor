"use client";

import React, { useState } from "react";
import { MessageSquare, Trash2, CheckCircle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CommentItem {
  id: string;
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  author: string;
  text: string;
  createdAt: string;
  color: string;
  isResolved?: boolean;
}

interface CommentsDrawerProps {
  comments: CommentItem[];
  currentPage: number;
  onSelectComment: (comment: CommentItem) => void;
  onDeleteComment: (id: string) => void;
  onToggleResolve: (id: string) => void;
  onAddCommentText?: (commentId: string, newText: string) => void;
}

export function CommentsDrawer({
  comments,
  currentPage,
  onSelectComment,
  onDeleteComment,
  onToggleResolve,
}: CommentsDrawerProps) {
  const pageComments = comments.filter((c) => c.pageIndex === currentPage - 1);

  return (
    <div className="p-3 space-y-3 text-xs select-none">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          <span>Comments on Page {currentPage} ({pageComments.length})</span>
        </div>
      </div>

      {pageComments.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground space-y-1">
          <p className="font-medium">No notes on this page</p>
          <p className="text-[11px]">Select &quot;Comment&quot; tool and click anywhere on the page to leave a note.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[70vh] overflow-y-auto">
          {pageComments.map((comment) => (
            <div
              key={comment.id}
              onClick={() => onSelectComment(comment)}
              className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                comment.isResolved
                  ? "bg-slate-50 border-border/60 opacity-60"
                  : "bg-amber-50/50 border-amber-200/80 shadow-xs hover:border-amber-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{comment.author}</span>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {comment.createdAt}
                </span>
              </div>

              <p className="text-xs text-foreground/90 leading-relaxed break-words font-medium">
                {comment.text}
              </p>

              <div className="flex items-center justify-between pt-1 border-t border-amber-200/50">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolve(comment.id);
                  }}
                  className={`flex items-center gap-1 text-[10px] font-bold ${
                    comment.isResolved ? "text-emerald-600" : "text-slate-600 hover:text-emerald-600"
                  }`}
                >
                  <CheckCircle className="h-3 w-3" />
                  <span>{comment.isResolved ? "Resolved" : "Mark Resolved"}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteComment(comment.id);
                  }}
                  className="text-muted-foreground hover:text-red-600 p-0.5 rounded"
                  title="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
