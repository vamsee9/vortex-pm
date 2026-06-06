/**
 * components/dashboards/owner-dashboard.tsx
 * ------------------------------------------
 * Platform Owner's dashboard — Supabase-inspired organization grid.
 * Shows all organizations with stats, admin info, and status.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Building2,
  FolderKanban,
  Users,
  Calendar,
  Crown,
  ArrowRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchOrganizationsWithStats } from "@/lib/actions/organizations";
import { isDemoModeActive, enableDemoMode, disableDemoMode } from "@/lib/demo-mode";
import type { Organization } from "@/lib/types";

interface OwnerDashboardProps {
  userId: string;
  userEmail: string;
  userName: string;
}

export function OwnerDashboard({ userId, userEmail, userName }: OwnerDashboardProps) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [demoActive, setDemoActive] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const demoCheck = await isDemoModeActive();
      setDemoActive(demoCheck);

      if (!demoCheck) {
        const data = await fetchOrganizationsWithStats();
        setOrgs(data);
      }
    } catch {
      toast.error("Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDemoMode(role: "admin" | "member" | "off") {
    setLoading(true);
    if (role === "off") {
      await disableDemoMode();
      window.location.href = "/dashboard";
    } else {
      await enableDemoMode(role);
      window.location.href = "/board";
    }
  }

  const filteredOrgs = orgs.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-neutral-500">Loading organizations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">
            Organizations
          </h1>
          <p className="text-neutral-400 mt-1.5 text-sm">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} on the platform
          </p>
        </div>
        <Link href="/orgs">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 transition-all hover:shadow-emerald-500/20">
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <Input
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-neutral-900 border-neutral-800 text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
        />
      </div>

      {/* Organization Grid */}
      {filteredOrgs.length === 0 && !searchQuery ? (
        <div className="text-center py-24 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
            <Building2 className="w-8 h-8 text-emerald-500/60" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-200">No organizations yet</h3>
          <p className="text-neutral-500 max-w-sm mx-auto mt-2 mb-8">
            Create your first organization to start managing projects and teams.
          </p>
          <Link href="/orgs">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </Link>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500">No organizations match "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredOrgs.map((org) => (
            <Link key={org.id} href={`/orgs/${org.id}`}>
              <Card className="group bg-neutral-900/60 border-neutral-800/80 hover:border-emerald-500/30 hover:bg-neutral-900/90 transition-all duration-300 cursor-pointer h-full shadow-sm hover:shadow-lg hover:shadow-emerald-500/5">
                <CardContent className="p-6">
                  {/* Top: Logo + Name + Status */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl flex items-center justify-center shrink-0 group-hover:from-emerald-500/30 group-hover:to-emerald-600/20 transition-all">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded-lg" />
                      ) : (
                        <span className="text-emerald-400 font-bold text-lg">{org.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-neutral-100 text-base truncate group-hover:text-emerald-300 transition-colors">
                        {org.name}
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">/{org.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          org.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]"
                        }
                      >
                        {org.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-neutral-950/50 rounded-lg p-2.5 text-center">
                      <FolderKanban className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                      <p className="text-sm font-semibold text-neutral-200">{org.project_count ?? 0}</p>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Projects</p>
                    </div>
                    <div className="bg-neutral-950/50 rounded-lg p-2.5 text-center">
                      <Crown className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-neutral-300 truncate" title={org.admin_name || "—"}>
                        {org.admin_name || "—"}
                      </p>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Admin</p>
                    </div>
                    <div className="bg-neutral-950/50 rounded-lg p-2.5 text-center">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500 mx-auto mb-1" />
                      <p className="text-xs font-medium text-neutral-300">
                        {new Date(org.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">Created</p>
                    </div>
                  </div>

                  {/* Footer: Plan + Arrow */}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-800/50">
                    <Badge variant="secondary" className="bg-neutral-800/50 text-neutral-400 border-neutral-700/50 text-[10px] uppercase tracking-wider">
                      {org.subscription_plan || "free"}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-neutral-700 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Demo Sandbox */}
      <div className="mt-12 pt-8 border-t border-neutral-800/50">
        <Card className="bg-gradient-to-r from-emerald-500/5 to-transparent border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-emerald-400">Owner Demo Sandbox</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Impersonate roles to test UI/UX workflows with isolated dummy data.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleDemoMode("admin")}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Preview as Org Admin
                </Button>
                <Button
                  onClick={() => handleDemoMode("member")}
                  size="sm"
                  variant="outline"
                  className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                >
                  Preview as Member
                </Button>
                {demoActive && (
                  <Button
                    onClick={() => handleDemoMode("off")}
                    size="sm"
                    variant="destructive"
                  >
                    Exit Demo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
