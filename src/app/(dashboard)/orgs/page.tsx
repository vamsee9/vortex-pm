/**
 * (dashboard)/orgs/page.tsx
 * -------------------------
 * Organizations Dashboard.
 * Lists all organizations the user belongs to.
 * Allows creating new organizations.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Building2, ArrowRight, ShieldAlert, Check, X } from "lucide-react";
import { toast } from "sonner";
import { fetchOrganizations, createOrganization } from "@/lib/actions/organizations";
import { checkIsGlobalAdmin, getRemovalRequests, updateRemovalRequest } from "@/lib/actions/lifecycle";
import { isDemoModeActive, enableDemoMode, disableDemoMode } from "@/lib/demo-mode";
import type { Organization } from "@/lib/types";

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [removalRequests, setRemovalRequests] = useState<any[]>([]);

  // Form State
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const demoCheck = await isDemoModeActive();
      setDemoActive(demoCheck);

      const adminCheck = await checkIsGlobalAdmin();
      setIsGlobalAdmin(adminCheck);
      if (adminCheck) {
        const requests = await getRemovalRequests();
        setRemovalRequests(requests);
      }

      if (!demoCheck) {
        const data = await fetchOrganizations();
        setOrgs(data);
      }
    } catch (err) {
      toast.error("Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setIsCreating(true);
    try {
      const newOrg = await createOrganization(newOrgName.trim(), newOrgSlug.trim());
      setOrgs([newOrg, ...orgs]);
      setNewOrgName("");
      setNewOrgSlug("");
      setShowForm(false);
      toast.success("Organization created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization.");
    } finally {
      setIsCreating(false);
    }
  }

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    setNewOrgName(name);
    setNewOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }

  async function handleRequestAction(requestId: string, status: "approved" | "rejected") {
    try {
      await updateRemovalRequest(requestId, status);
      setRemovalRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success(`Request ${status} successfully.`);
      if (status === "approved") {
        loadOrgs(); // Reload to see paused statuses
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update request.");
    }
  }

  async function handleDemoMode(role: "admin" | "member" | "off") {
    setLoading(true);
    if (role === "off") {
      await disableDemoMode();
    } else {
      await enableDemoMode(role);
    }
    // Hard refresh to reload context
    window.location.href = "/board";
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-100">Organizations</h2>
          <p className="text-neutral-400 mt-1">
            Select an organization to view its projects, or create a new one.
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> New Organization</>}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg text-neutral-100">Create New Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label className="text-neutral-300">Organization Name</Label>
                <Input 
                  placeholder="e.g., Acme Corp"
                  value={newOrgName}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-neutral-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">URL Slug</Label>
                <Input 
                  placeholder="acme-corp"
                  value={newOrgSlug}
                  onChange={e => setNewOrgSlug(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono text-sm"
                />
                <p className="text-xs text-neutral-500">Must be unique. Only lowercase letters, numbers, and hyphens.</p>
              </div>
              <Button 
                type="submit" 
                disabled={isCreating || !newOrgName.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white w-full"
              >
                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Organization
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {orgs.length === 0 && !showForm ? (
        <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl bg-neutral-900/30">
          <Building2 className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <h3 className="text-lg font-medium text-neutral-300">No organizations found</h3>
          <p className="text-neutral-500 max-w-sm mx-auto mt-2 mb-6">
            You don't belong to any organizations yet. Create one to get started.
          </p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="border-neutral-700">
            Create Organization
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <Link key={org.id} href={`/orgs/${org.id}`}>
              <Card className="bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/80 transition-all cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded-md" />
                        ) : (
                          <span className="text-emerald-500 font-bold text-lg">{org.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-200">{org.name}</h3>
                        <p className="text-sm text-neutral-500 font-mono">/{org.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {org.status === "paused" && (
                        <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded border border-amber-500/20">Paused</span>
                      )}
                      <ArrowRight className="w-5 h-5 text-neutral-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Global Admin: Demo Mode Sandbox */}
      {isGlobalAdmin && (
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Application Admin Demo Sandbox</CardTitle>
              <CardDescription className="text-neutral-400">
                Impersonate organizational roles and interact with isolated dummy data to test UI/UX workflows safely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={() => handleDemoMode("admin")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Preview as Org Admin
                </Button>
                <Button 
                  onClick={() => handleDemoMode("member")}
                  variant="outline"
                  className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                >
                  Preview as Team User
                </Button>
                {demoActive && (
                  <Button 
                    onClick={() => handleDemoMode("off")}
                    variant="destructive"
                  >
                    Exit Demo Mode
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Global Admin: Pending Removal Requests */}
      {isGlobalAdmin && removalRequests.length > 0 && (
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Pending Removal Requests
          </h3>
          <div className="space-y-4">
            {removalRequests.map(req => (
              <Card key={req.id} className="bg-neutral-900/50 border-amber-500/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-neutral-200 font-medium">
                      Organization: <span className="text-emerald-400">{req.organizations?.name}</span>
                    </p>
                    <p className="text-sm text-neutral-500">
                      Requested by {req.requested_by?.email || req.requested_by?.raw_user_meta_data?.username} on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRequestAction(req.id, "rejected")}
                      className="border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRequestAction(req.id, "approved")}
                      className="bg-red-900/50 hover:bg-red-900 text-red-200 border-red-900/50"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve & Pause
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
