/**
 * (dashboard)/projects/[projectId]/page.tsx
 * ------------------------------------------
 * Team Members Management Table for Org Admins.
 * Shows all team members in the project with credential tracking,
 * real-time status updates via Supabase Realtime, and full CRUD actions.
 */

"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  KeyRound,
  Download,
  Users,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  fetchProjectMembers,
  resetMemberPassword,
  deleteMember,
  type TeamMemberInfo,
} from "@/lib/actions/team-members";
import { generateCredentialFileContent } from "@/lib/utils/credentials";
import { createClient } from "@/lib/supabase/client";

export default function ProjectMembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>("");
  const [projectName, setProjectName] = useState("");

  // Action states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();

      // Get project info
      const { data: project } = await supabase
        .from("projects")
        .select("org_id, name")
        .eq("id", projectId)
        .single();

      if (project) {
        setOrgId(project.org_id);
        setProjectName(project.name);
        const data = await fetchProjectMembers(project.org_id);
        setMembers(data);
      }
    } catch {
      toast.error("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime subscription for credential status changes
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          // Update the specific member's temp_password_changed status
          setMembers((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, temp_password_changed: payload.new.temp_password_changed }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  async function handleResetPassword(memberId: string) {
    try {
      const creds = await resetMemberPassword(memberId);
      setResetCreds(creds);

      // Auto-download credential file
      downloadCredentials(
        members.find((m) => m.id === memberId)?.username || "user",
        creds.email,
        creds.password
      );

      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, temp_password_changed: false } : m))
      );

      toast.success("Password reset. Credential file downloaded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    }
  }

  async function handleDeleteMember(memberId: string) {
    setDeletingId(memberId);
    try {
      await deleteMember(memberId, orgId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setShowDeleteDialog(null);
      toast.success("Team member removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member.");
    } finally {
      setDeletingId(null);
    }
  }

  function downloadCredentials(username: string, email: string, password: string) {
    const content = generateCredentialFileContent(username, email, password);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}_credentials.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center w-fit">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">Team Members</h1>
          <p className="text-neutral-400 mt-1 text-sm">
            {projectName} · {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Members Table */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableHead className="text-neutral-400 font-medium">Username</TableHead>
                <TableHead className="text-neutral-400 font-medium">Email</TableHead>
                <TableHead className="text-neutral-400 font-medium">Role</TableHead>
                <TableHead className="text-neutral-400 font-medium">Last Updated</TableHead>
                <TableHead className="text-neutral-400 font-medium">Credential Status</TableHead>
                <TableHead className="text-neutral-400 font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-neutral-500">
                    <Users className="w-8 h-8 mx-auto mb-3 text-neutral-700" />
                    No team members yet. Add members through the project setup wizard.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow
                    key={member.id}
                    className="border-neutral-800 hover:bg-neutral-800/40 cursor-pointer transition-colors"
                    onClick={() => router.push(`/projects/${projectId}/members/${member.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                          {member.display_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="text-neutral-200 font-medium">{member.display_name}</p>
                          <p className="text-xs text-neutral-500 font-mono">@{member.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-neutral-400 text-sm">{member.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-neutral-800 text-neutral-400 border-neutral-700 text-xs"
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500 text-sm">
                      {member.last_sign_in_at
                        ? new Date(member.last_sign_in_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {member.temp_password_changed ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Password Changed
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs"
                        >
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Temp Password
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-400">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-neutral-800">
                          <DropdownMenuItem
                            onClick={() => router.push(`/projects/${projectId}/members/${member.id}`)}
                            className="text-neutral-300 focus:bg-neutral-800"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Workspace
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem
                            onClick={() => handleResetPassword(member.id)}
                            className="text-neutral-300 focus:bg-neutral-800"
                          >
                            <KeyRound className="w-4 h-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          {!member.temp_password_changed && (
                            <DropdownMenuItem
                              onClick={() =>
                                downloadCredentials(member.username, member.email, "—")
                              }
                              className="text-neutral-300 focus:bg-neutral-800"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Credentials
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem
                            onClick={() => setShowDeleteDialog(member.id)}
                            className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset Credentials Dialog */}
      {resetCreds && (
        <Dialog open={!!resetCreds} onOpenChange={() => setResetCreds(null)}>
          <DialogContent className="bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">Password Reset Successful</DialogTitle>
              <DialogDescription className="text-neutral-400">
                New temporary credentials have been generated and downloaded.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 bg-neutral-950 p-4 rounded-md border border-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-500 text-sm">Email:</span>
                <code className="text-neutral-200">{resetCreds.email}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 text-sm">New Password:</span>
                <code className="text-neutral-200 bg-neutral-800 px-2 py-0.5 rounded">{resetCreds.password}</code>
              </div>
            </div>
            <p className="text-xs text-amber-400">⚠️ Share these credentials securely. They won't be shown again.</p>
            <DialogFooter>
              <Button onClick={() => setResetCreds(null)} className="bg-neutral-800 hover:bg-neutral-700">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <DialogContent className="bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">Remove Team Member?</DialogTitle>
              <DialogDescription className="text-neutral-400">
                This will permanently delete this user's account and remove all their data. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(null)} className="border-neutral-700">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteMember(showDeleteDialog)}
                disabled={deletingId === showDeleteDialog}
              >
                {deletingId === showDeleteDialog ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Remove Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
