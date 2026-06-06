/**
 * (dashboard)/admin/page.tsx
 * --------------------------
 * Admin page for managing team members across all organizations.
 * Only visible to users with role = "owner".
 *
 * Features:
 * - Add a new team member (generates temp password)
 * - View list of all current team members
 * - See who still needs to change their password
 *
 * The temp password is shown ONCE after creation — admin must
 * copy it and share it with the new user securely.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOrganizations } from "@/lib/actions/organizations";
import { checkUsername } from "@/lib/actions/auth";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  UserPlus,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: string;
  must_change_password: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New user form fields
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("member");

  // Orgs for dropdown
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // Temp password display (shown after creating a user)
  const [tempCredentials, setTempCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Check if the current user is an owner
  const [isOwner, setIsOwner] = useState(false);

  // ── Fetch team members ──
  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.status === 403) {
        setIsOwner(false);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch team members");
      }
      const data = await response.json();
      setMembers(data.users || []);
      setIsOwner(true);
    } catch (err) {
      console.error("Error fetching members:", err);
      setError("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Verify owner status client-side too
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.role !== "owner") {
        router.push("/board");
        return;
      }
      fetchMembers();
      fetchOrganizations().then(setOrgs);
    });
  }, [fetchMembers, router]);

  // ── Username Check ──
  async function handleUsernameBlur() {
    if (!newUsername.trim()) {
      setUsernameError(null);
      return;
    }
    const exists = await checkUsername(newUsername.trim());
    if (exists) {
      setUsernameError("This username is already taken.");
    } else {
      setUsernameError(null);
    }
  }

  // ── Create a new user ──
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (usernameError) return;

    setError(null);
    setCreating(true);
    setTempCredentials(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          email: newEmail.trim() || undefined,
          display_name: newName.trim(),
          org_id: selectedOrg,
          role: selectedRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create user.");
        return;
      }

      // Show the temporary credentials
      setTempCredentials({
        email: newEmail.trim(),
        password: data.temp_password,
      });

      // Reset the form
      setNewUsername("");
      setNewEmail("");
      setNewName("");
      setSelectedOrg("");
      setSelectedRole("member");

      // Refresh the member list
      fetchMembers();

      toast.success("Team member added successfully!");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Copy temp password to clipboard ──
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  }

  // If not owner, show nothing (redirect happens in useEffect)
  if (!isOwner && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-neutral-400">
          <ShieldAlert className="w-5 h-5" />
          <p>You need Owner access to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Add New Member Card ── */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            Add Team Member
          </CardTitle>
          <CardDescription className="text-neutral-400">
            Create a new account with a temporary password. The user will be
            forced to change it on their first login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-neutral-300">
                  Username <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  onBlur={handleUsernameBlur}
                  required
                  disabled={creating}
                  className={`bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 ${usernameError ? "border-red-500" : ""}`}
                />
                {usernameError && <p className="text-xs text-red-400">{usernameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300">
                  Email Address (Optional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={creating}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-neutral-300">
                  Display Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  disabled={creating}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">
                  Organization <span className="text-red-400">*</span>
                </Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg} required disabled={creating}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    {orgs.map(o => (
                      <SelectItem key={o.id} value={o.id} className="text-neutral-300">{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">
                  Role <span className="text-red-400">*</span>
                </Label>
                <Select value={selectedRole} onValueChange={setSelectedRole} required disabled={creating}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="admin" className="text-neutral-300">Org Admin</SelectItem>
                    <SelectItem value="moderator" className="text-neutral-300">Project Admin</SelectItem>
                    <SelectItem value="member" className="text-neutral-300">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={creating || !newUsername || !newName || !selectedOrg || !!usernameError}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* ── Temp Credentials Display ── */}
          {tempCredentials && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-sm text-emerald-400 font-medium mb-2">
                ✅ Account created! Share these credentials securely:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Email:</span>
                  <code className="text-neutral-200">{tempCredentials.email}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Temp Password:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-neutral-200 bg-neutral-800 px-2 py-1 rounded">
                      {tempCredentials.password}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(tempCredentials.password)}
                      className="text-neutral-400 hover:text-neutral-200"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-400 mt-3">
                ⚠️ This password will not be shown again. Copy it now.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Team Members Table ── */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg text-neutral-100">
            Team Members
          </CardTitle>
          <CardDescription className="text-neutral-400">
            {members.length} member{members.length !== 1 ? "s" : ""} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800 hover:bg-transparent">
                  <TableHead className="text-neutral-400">Name</TableHead>
                  <TableHead className="text-neutral-400">Username</TableHead>
                  <TableHead className="text-neutral-400">Email</TableHead>
                  <TableHead className="text-neutral-400">Role</TableHead>
                  <TableHead className="text-neutral-400">Status</TableHead>
                  <TableHead className="text-neutral-400">Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow
                    key={member.id}
                    className="border-neutral-800 hover:bg-neutral-800/50"
                  >
                    <TableCell className="text-neutral-200 font-medium">
                      {member.display_name || "—"}
                    </TableCell>
                    <TableCell className="text-neutral-300 font-mono text-sm">
                      {member.username || "—"}
                    </TableCell>
                    <TableCell className="text-neutral-400">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.role === "admin" ? "default" : "secondary"}
                        className={
                          member.role === "admin"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.must_change_password ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/20"
                        >
                          Pending Setup
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        >
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-500 text-sm">
                      {member.last_sign_in_at
                        ? new Date(member.last_sign_in_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
