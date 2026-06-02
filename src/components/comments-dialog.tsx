/**
 * components/comments-dialog.tsx
 * ------------------------------
 * Modal dialog for viewing and adding comments on a task.
 * Any authenticated team member can add a comment to any task.
 * Users can only delete their own comments (RLS enforced).
 *
 * Opens when the user clicks "Add Comment" from the row actions menu.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Trash2 } from "lucide-react";
import { fetchComments, addComment, deleteComment } from "@/lib/actions/comments";
import { toast } from "sonner";
import type { TaskComment } from "@/lib/types";

interface CommentsDialogProps {
  taskId: string | null;
  taskKey: string;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommentsDialog({
  taskId,
  taskKey,
  currentUserId,
  open,
  onOpenChange,
}: CommentsDialogProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load comments when the dialog opens
  const loadComments = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await fetchComments(taskId);
      setComments(data);
    } catch {
      toast.error("Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      loadComments();
    }
  }, [open, taskId, loadComments]);

  // Submit a new comment
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const result = await addComment(taskId, newComment);
      if (result.success) {
        setNewComment("");
        loadComments(); // Refresh the list
        toast.success("Comment added!");
      } else {
        toast.error(result.error || "Failed to add comment.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete own comment
  async function handleDelete(commentId: string) {
    try {
      const result = await deleteComment(commentId);
      if (result.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Comment deleted.");
      } else {
        toast.error(result.error || "Failed to delete comment.");
      }
    } catch {
      toast.error("Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-neutral-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">
            Comments — {taskKey}
          </DialogTitle>
        </DialogHeader>

        {/* Comments list */}
        <div className="max-h-[300px] overflow-y-auto space-y-3 py-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-neutral-500 text-sm py-6">
              No comments yet. Be the first to add one!
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 bg-neutral-800/50 rounded-lg group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">
                      {comment.author_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-neutral-300">
                      {comment.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {new Date(comment.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {/* Delete button — only for own comments */}
                    {comment.author_id === currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comment.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-neutral-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-neutral-400 pl-8">
                  {comment.content}
                </p>
              </div>
            ))
          )}
        </div>

        <Separator className="bg-neutral-700" />

        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
            rows={2}
            className="bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 resize-none flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !newComment.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white self-end"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
