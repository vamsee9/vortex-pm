/**
 * (dashboard)/projects/new/page.tsx
 * ----------------------------------
 * 3-Step Project Creation Wizard.
 *
 * Step 1: Project Details + Table Schema
 * Step 2: Add Team Members (min 1)
 * Step 3: Metadata Configuration
 *
 * Project stays in "draft" until all steps are completed.
 * Partial progress is saved — drafts auto-delete after 7 days.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Download,
  Columns3,
  Users,
  Settings,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createDraftProject, updateProjectWizardStep, activateProject } from "@/lib/actions/projects";
import { addTeamMember, type TeamMemberInfo } from "@/lib/actions/team-members";
import { generateCredentialFileContent } from "@/lib/utils/credentials";
import { createMetadataItem, fetchMetadata } from "@/lib/actions/metadata";
import { ColumnBuilder } from "@/components/column-builder";
import type { MetadataItem } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = [
  { label: "Table Schema", icon: Columns3, description: "Define your project's data columns" },
  { label: "Team Members", icon: Users, description: "Add at least one team member" },
  { label: "Metadata", icon: Settings, description: "Configure labels and filters" },
];

export default function ProjectWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");

  // Step 0 (before wizard): Project Details
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Step 2: Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Step 3: Metadata
  const [metadata, setMetadata] = useState<MetadataItem[]>([]);
  const [newMetaLabel, setNewMetaLabel] = useState("");
  const [newMetaCategory, setNewMetaCategory] = useState<"work_type" | "priority" | "status">("work_type");
  const [isAddingMeta, setIsAddingMeta] = useState(false);

  const [isActivating, setIsActivating] = useState(false);

  // Load org context
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Find admin's org
      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (membership) {
        setOrgId(membership.org_id);
      }
      setLoading(false);
    }
    init();
  }, [router]);

  // Create the draft project
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || !jiraKey.trim()) return;

    setIsCreatingProject(true);
    try {
      const project = await createDraftProject(
        orgId,
        projectName.trim(),
        projectSlug.trim(),
        jiraKey.trim()
      );
      setProjectId(project.id);
      setCurrentStep(1);
      toast.success("Project created in draft mode.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  function handleNameChange(name: string) {
    setProjectName(name);
    setProjectSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }

  // Step 1 complete
  async function handleSchemaComplete() {
    if (!projectId) return;
    try {
      await updateProjectWizardStep(projectId, 1);
      setCurrentStep(2);
      toast.success("Table schema saved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save progress.");
    }
  }

  // Step 2: Add member
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim()) return;

    setIsAddingMember(true);
    try {
      const { member, credentials } = await addTeamMember(
        orgId,
        newUsername.trim(),
        newDisplayName.trim(),
        newEmail.trim()
      );

      setTeamMembers([...teamMembers, member]);

      // Auto-download credential file
      const content = generateCredentialFileContent(
        credentials.username,
        credentials.email,
        credentials.password
      );
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${credentials.username}_credentials.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Reset form
      setNewUsername("");
      setNewDisplayName("");
      setNewEmail("");

      toast.success(`Member added. Credentials downloaded as ${credentials.username}_credentials.txt`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add team member.");
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleTeamComplete() {
    if (teamMembers.length === 0) {
      toast.error("You must add at least one team member.");
      return;
    }
    if (!projectId) return;
    try {
      await updateProjectWizardStep(projectId, 2);
      // Load existing metadata
      const data = await fetchMetadata();
      setMetadata(data);
      setCurrentStep(3);
      toast.success("Team members saved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save progress.");
    }
  }

  // Step 3: Add metadata
  async function handleAddMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (!newMetaLabel.trim()) return;

    setIsAddingMeta(true);
    try {
      const currentItems = metadata.filter((m) => m.category === newMetaCategory);
      const maxOrder = currentItems.reduce((max, item) => Math.max(max, item.display_order), 0);
      const newItem = await createMetadataItem(newMetaCategory, newMetaLabel.trim(), maxOrder + 10);
      setMetadata([...metadata, newItem]);
      setNewMetaLabel("");
      toast.success("Metadata item added.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add metadata.");
    } finally {
      setIsAddingMeta(false);
    }
  }

  // Activate project
  async function handleActivate() {
    if (!projectId) return;
    setIsActivating(true);
    try {
      await updateProjectWizardStep(projectId, 3);
      await activateProject(projectId);
      toast.success("Project activated! 🚀");
      document.cookie = `active_project_id=${projectId}; path=/; max-age=31536000; SameSite=Lax`;
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to activate project.");
    } finally {
      setIsActivating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back */}
      <Button variant="ghost" onClick={() => router.push("/dashboard")} className="text-neutral-500 hover:text-neutral-300 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Button>

      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">
          {projectId ? "Project Setup" : "New Project"}
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">
          {projectId
            ? "Complete the setup wizard to activate your project."
            : "Create a new project and configure it step-by-step."}
        </p>
      </div>

      {/* Step Indicator */}
      {projectId && (
        <div className="flex items-center gap-2">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isComplete = currentStep > idx + 1;
            const isCurrent = currentStep === idx + 1;

            return (
              <div key={idx} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all flex-1 ${
                    isCurrent
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : isComplete
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                      : "bg-neutral-900/50 border-neutral-800 text-neutral-600"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      isComplete
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isCurrent
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-neutral-800 text-neutral-600"
                    }`}
                  >
                    {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div className="min-w-0 hidden md:block">
                    <p className="text-sm font-medium truncate">{step.label}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{step.description}</p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 shrink-0 ${currentStep > idx + 1 ? "bg-emerald-500/30" : "bg-neutral-800"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 0: Project Details (before wizard) */}
      {!projectId && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100">Project Details</CardTitle>
            <CardDescription className="text-neutral-400">
              Define the basic project information to start the setup wizard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label className="text-neutral-300">Project Name <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="e.g., Mobile App Core"
                  value={projectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-neutral-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-300">URL Slug</Label>
                  <Input
                    placeholder="mobile-app-core"
                    value={projectSlug}
                    onChange={(e) => setProjectSlug(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Jira Project Key <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="e.g., PROJ"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value.toUpperCase())}
                    required
                    className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono uppercase"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isCreatingProject || !projectName.trim() || !jiraKey.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white w-full"
              >
                {isCreatingProject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Create & Start Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Table Schema */}
      {projectId && currentStep === 1 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
              <Columns3 className="w-5 h-5 text-emerald-500" />
              Step 1: Define Table Schema
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Configure the columns, types, and validation rules for your project's sprint table. This is the foundation of your metadata system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnBuilder projectId={projectId} initialFieldMappings={{}} />
            <div className="flex justify-end mt-6 gap-3">
              <Button
                onClick={handleSchemaComplete}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Save Schema & Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Team Members */}
      {projectId && currentStep === 2 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Step 2: Add Team Members
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Add at least one team member. Temporary credentials will be generated and automatically downloaded as a .txt file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="space-y-4 p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-300">Username <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="e.g., john"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Display Name <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="e.g., John Doe"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    required
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Email (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isAddingMember || !newUsername.trim() || !newDisplayName.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isAddingMember ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Member & Download Credentials
              </Button>
            </form>

            {/* Members List */}
            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-neutral-300">
                  Added Members ({teamMembers.length})
                </h4>
                <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 overflow-hidden">
                  {teamMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-neutral-950/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                          {m.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-neutral-200 font-medium">{m.display_name}</p>
                          <p className="text-xs text-neutral-500">@{m.username} · {m.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Credentials Downloaded
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" onClick={() => setCurrentStep(1)} className="text-neutral-400">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleTeamComplete}
                disabled={teamMembers.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Continue to Metadata
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Metadata Configuration */}
      {projectId && currentStep === 3 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-500" />
              Step 3: Configure Metadata
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Define labels for work types, priorities, and statuses. These power dropdown filters and reporting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add Metadata Form */}
            <form onSubmit={handleAddMetadata} className="flex gap-4 items-end p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
              <div className="space-y-2 flex-1">
                <Label className="text-neutral-300">Category</Label>
                <Select value={newMetaCategory} onValueChange={(v: any) => setNewMetaCategory(v)}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700">
                    <SelectItem value="work_type" className="text-neutral-300">Work Type</SelectItem>
                    <SelectItem value="priority" className="text-neutral-300">Priority</SelectItem>
                    <SelectItem value="status" className="text-neutral-300">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-[2]">
                <Label className="text-neutral-300">Label Value</Label>
                <Input
                  placeholder="e.g., Critical, Feature, In QA..."
                  value={newMetaLabel}
                  onChange={(e) => setNewMetaLabel(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100"
                />
              </div>
              <Button
                type="submit"
                disabled={isAddingMeta || !newMetaLabel.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isAddingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Add
              </Button>
            </form>

            {/* Metadata Lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["work_type", "priority", "status"] as const).map((category) => {
                const items = metadata.filter((m) => m.category === category);
                const label = category === "work_type" ? "Work Types" : category === "priority" ? "Priorities" : "Statuses";

                return (
                  <div key={category} className="border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800">
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{label}</h4>
                    </div>
                    <div className="divide-y divide-neutral-800/50 max-h-[200px] overflow-y-auto">
                      {items.length === 0 ? (
                        <p className="p-4 text-center text-neutral-600 text-sm">No items</p>
                      ) : (
                        items.map((item) => (
                          <div key={item.id} className="px-4 py-2.5 text-sm text-neutral-300 flex items-center justify-between">
                            <span>{item.label}</span>
                            {item.color && (
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation + Activate */}
            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" onClick={() => setCurrentStep(2)} className="text-neutral-400">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleActivate}
                disabled={isActivating}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isActivating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4 mr-2" />
                )}
                Activate Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
