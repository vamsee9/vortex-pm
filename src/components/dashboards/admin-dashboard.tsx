/**
 * components/dashboards/admin-dashboard.tsx
 * ------------------------------------------
 * Organization Admin's dashboard — Supabase-inspired project grid.
 * Shows all projects belonging to the admin's organization.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  FolderKanban,
  Users,
  Calendar,
  Activity,
  ArrowRight,
  Search,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchProjectsWithStats } from "@/lib/actions/projects";
import type { Project } from "@/lib/types";

interface AdminDashboardProps {
  orgId: string;
  orgName: string;
  userId: string;
}

export function AdminDashboard({ orgId, orgName, userId }: AdminDashboardProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      const data = await fetchProjectsWithStats(orgId);
      setProjects(data);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleProjectClick(project: Project) {
    if (project.status === "draft") {
      // Navigate to wizard to continue setup
      router.push(`/projects/${project.id}/setup`);
    } else {
      // Set active project cookie and navigate to project management
      document.cookie = `active_project_id=${project.id}; path=/; max-age=31536000; SameSite=Lax`;
      router.push(`/projects/${project.id}`);
    }
  }

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jira_project_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = projects.filter((p) => p.status === "active").length;
  const draftCount = projects.filter((p) => p.status === "draft").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-neutral-500">Loading projects…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider mb-1">
            {orgName}
          </p>
          <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">
            Projects
          </h1>
          <p className="text-neutral-400 mt-1.5 text-sm">
            {activeCount} active · {draftCount} draft
          </p>
        </div>
        <Button
          onClick={() => router.push("/projects/new")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 transition-all hover:shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-neutral-900 border-neutral-800 text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
        />
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 && !searchQuery ? (
        <div className="text-center py-24 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
            <FolderKanban className="w-8 h-8 text-emerald-500/60" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-200">No projects yet</h3>
          <p className="text-neutral-500 max-w-sm mx-auto mt-2 mb-8">
            Create your first project to start managing sprints and team members.
          </p>
          <Button
            onClick={() => router.push("/projects/new")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className="group bg-neutral-900/60 border-neutral-800/80 hover:border-emerald-500/30 hover:bg-neutral-900/90 transition-all duration-300 cursor-pointer h-full shadow-sm hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <CardContent className="p-6">
                {/* Top: Name + Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-lg flex items-center justify-center shrink-0 group-hover:from-blue-500/30 group-hover:to-purple-500/20 transition-all">
                      <FolderKanban className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-neutral-100 text-base truncate group-hover:text-emerald-300 transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">{project.jira_project_key}</p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      project.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                        : project.status === "draft"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]"
                        : "bg-neutral-800 text-neutral-500 border-neutral-700 text-[10px]"
                    }
                  >
                    {project.status === "draft" ? (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Setup
                      </span>
                    ) : (
                      project.status
                    )}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-neutral-950/50 rounded-lg p-2 text-center">
                    <Users className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-neutral-200">{project.member_count ?? 0}</p>
                    <p className="text-[10px] text-neutral-600">Members</p>
                  </div>
                  <div className="bg-neutral-950/50 rounded-lg p-2 text-center">
                    <Activity className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-neutral-200">{project.sprint_count ?? 0}</p>
                    <p className="text-[10px] text-neutral-600">Sprints</p>
                  </div>
                  <div className="bg-neutral-950/50 rounded-lg p-2 text-center">
                    <Calendar className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                    <p className="text-xs font-medium text-neutral-300">
                      {new Date(project.updated_at || project.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <p className="text-[10px] text-neutral-600">Updated</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/50">
                  <span className="text-xs text-neutral-600">
                    {project.status === "draft"
                      ? `Step ${project.wizard_step}/3`
                      : "Active"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-neutral-700 group-hover:text-emerald-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
