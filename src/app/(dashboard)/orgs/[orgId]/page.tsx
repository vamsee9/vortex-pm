/**
 * (dashboard)/orgs/[orgId]/page.tsx
 * ---------------------------------
 * Organization Projects List.
 * Shows all projects inside a specific organization.
 */

"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, FolderKanban, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { fetchProjects, createProject, deleteProject } from "@/lib/actions/projects";
import { checkIsOrgAdmin } from "@/lib/actions/lifecycle";
import { deleteOrganizationCascading } from "@/lib/actions/organizations";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Project } from "@/lib/types";

export default function ProjectsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null);

  // Form State
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newJiraKey, setNewJiraKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects(orgId);
      setProjects(data);
      const adminStatus = await checkIsOrgAdmin(orgId);
      setIsOrgAdmin(adminStatus);
    } catch (err) {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim() || !newJiraKey.trim()) return;

    setIsCreating(true);
    try {
      const newProj = await createProject(orgId, newName.trim(), newSlug.trim(), newJiraKey.trim());
      setProjects([newProj, ...projects]);
      setNewName("");
      setNewSlug("");
      setNewJiraKey("");
      setShowForm(false);
      toast.success("Project created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleNameChange(name: string) {
    setNewName(name);
    setNewSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }

  // When clicking a project, set it as active in the session cookie and go to board
  function handleProjectClick(projectId: string) {
    document.cookie = `active_project_id=${projectId}; path=/; max-age=31536000; SameSite=Lax`;
    router.push("/board");
  }

  async function handleDeleteProject(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    setIsDeletingProject(projectId);
    try {
      await deleteProject(projectId, orgId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success("Project deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project.");
    } finally {
      setIsDeletingProject(null);
    }
  }

  async function handleDeleteOrg() {
    setIsDeletingOrg(true);
    try {
      await deleteOrganizationCascading(orgId);
      
      // If we made it here, the org is deleted. If the user was also deleted,
      // their session is invalid. Let's just sign out locally and redirect.
      const supabase = createClient();
      await supabase.auth.signOut();
      
      toast.success("Organization and account deleted successfully.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete organization.");
      setIsDeletingOrg(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-4">
        <Link href="/orgs" className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center w-fit">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Organizations
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-100">Projects</h2>
          <p className="text-neutral-400 mt-1">
            Select a project to view its sprint board.
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> New Project</>}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100">Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label className="text-neutral-300">Project Name</Label>
                <Input 
                  placeholder="e.g., Mobile App Core"
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-neutral-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-300">URL Slug</Label>
                  <Input 
                    placeholder="mobile-app-core"
                    value={newSlug}
                    onChange={e => setNewSlug(e.target.value)}
                    required
                    className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Jira Project Key</Label>
                  <Input 
                    placeholder="e.g., PROJ"
                    value={newJiraKey}
                    onChange={e => setNewJiraKey(e.target.value.toUpperCase())}
                    required
                    className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono uppercase"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isCreating || !newName.trim() || !newJiraKey.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white w-full"
              >
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Project
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 && !showForm ? (
        <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl bg-neutral-900/30">
          <FolderKanban className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <h3 className="text-lg font-medium text-neutral-300">No projects found</h3>
          <p className="text-neutral-500 max-w-sm mx-auto mt-2 mb-6">
            This organization doesn't have any projects yet. Create one to start importing Jira issues.
          </p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="border-neutral-700">
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              onClick={() => handleProjectClick(project.id)}
              className="bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/80 transition-all cursor-pointer h-full"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-neutral-200">{project.name}</h3>
                    <div className="flex gap-2 text-sm text-neutral-400">
                      <span className="font-mono bg-neutral-950 px-2 rounded border border-neutral-800 text-neutral-300">{project.jira_project_key}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isOrgAdmin && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isDeletingProject === project.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent onClick={(e) => e.stopPropagation()}>
                          <DialogHeader>
                            <DialogTitle>Delete Project?</DialogTitle>
                            <DialogDescription>
                              This action cannot be undone. This will permanently delete the project
                              <strong> {project.name} </strong> and all its associated data.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline">Cancel</Button>
                            <Button 
                              variant="destructive" 
                              onClick={(e) => handleDeleteProject(e, project.id)}
                            >
                              Confirm Deletion
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <ArrowRight className="w-5 h-5 text-neutral-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isOrgAdmin && (
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Danger Zone</CardTitle>
              <CardDescription className="text-neutral-400">
                Permanently delete this organization and all its data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={projects.length > 0 || isDeletingOrg}
                    className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900/50"
                  >
                    {isDeletingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Delete Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete the organization, all associated data, 
                      and <strong>your own user account</strong>. You will be logged out immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteOrg}
                      disabled={isDeletingOrg}
                    >
                      {isDeletingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Yes, Delete Everything"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {projects.length > 0 && (
                <p className="text-sm text-red-400/80 mt-3">
                  You must delete all projects before you can delete the organization.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
