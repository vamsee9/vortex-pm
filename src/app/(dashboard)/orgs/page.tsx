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
import { fetchOrganizations, createOrganizationWithAdmin } from "@/lib/actions/organizations";
import { checkIsGlobalAdmin } from "@/lib/actions/lifecycle";
import { isDemoModeActive, enableDemoMode, disableDemoMode } from "@/lib/demo-mode";
import type { Organization } from "@/lib/types";
import { Copy } from "lucide-react";

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  // Form State
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Temp credentials from creation
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const demoCheck = await isDemoModeActive();
      setDemoActive(demoCheck);

      const adminCheck = await checkIsGlobalAdmin();
      setIsGlobalAdmin(adminCheck);

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
    if (!newOrgName.trim() || !newOrgSlug.trim() || !newAdminUsername.trim() || !newAdminName.trim()) return;

    setIsCreating(true);
    setTempCredentials(null);
    try {
      const { organization, adminCredentials } = await createOrganizationWithAdmin(
        newOrgName.trim(), 
        newOrgSlug.trim(),
        newAdminUsername.trim(),
        newAdminName.trim(),
        newAdminEmail.trim()
      );
      setOrgs([organization, ...orgs]);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewAdminUsername("");
      setNewAdminName("");
      setNewAdminEmail("");
      
      setTempCredentials(adminCredentials);
      toast.success("Organization and Admin created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization.");
    } finally {
      setIsCreating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  }

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    setNewOrgName(name);
    setNewOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
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
            <CardDescription className="text-neutral-400">
              Set up a new organization and assign its first administrative user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tempCredentials ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <h3 className="text-lg font-medium text-emerald-400 mb-2">✅ Organization Created</h3>
                <p className="text-sm text-neutral-300 mb-4">
                  The organization and admin account have been set up. Share these credentials securely with the new Org Admin:
                </p>
                <div className="space-y-3 bg-neutral-950 p-4 rounded-md border border-neutral-800">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 text-sm">Login Email:</span>
                    <code className="text-neutral-200">{tempCredentials.email}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 text-sm">Temporary Password:</span>
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
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-400 mt-4">
                  ⚠️ This password will not be shown again. Copy it now.
                </p>
                <Button 
                  onClick={() => {
                    setTempCredentials(null);
                    setShowForm(false);
                  }} 
                  className="mt-6 w-full bg-neutral-800 hover:bg-neutral-700"
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-6">
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider">1. Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-neutral-300">Organization Name <span className="text-red-400">*</span></Label>
                      <Input 
                        placeholder="e.g., Acme Corp"
                        value={newOrgName}
                        onChange={e => handleNameChange(e.target.value)}
                        required
                        className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-neutral-300">URL Slug <span className="text-red-400">*</span></Label>
                      <Input 
                        placeholder="acme-corp"
                        value={newOrgSlug}
                        onChange={e => setNewOrgSlug(e.target.value)}
                        required
                        className="bg-neutral-800 border-neutral-700 text-neutral-100 font-mono text-sm"
                      />
                      <p className="text-xs text-neutral-500">Must be unique. Lowercase letters/numbers/hyphens.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-neutral-800">
                  <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider">2. Organization Admin</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-neutral-300">Admin Username <span className="text-red-400">*</span></Label>
                      <Input 
                        placeholder="e.g., alice"
                        value={newAdminUsername}
                        onChange={e => setNewAdminUsername(e.target.value)}
                        required
                        className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-neutral-300">Admin Display Name <span className="text-red-400">*</span></Label>
                      <Input 
                        placeholder="e.g., Alice Smith"
                        value={newAdminName}
                        onChange={e => setNewAdminName(e.target.value)}
                        required
                        className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-neutral-300">Admin Email (Optional)</Label>
                      <Input 
                        type="email"
                        placeholder={`e.g., alice@company.com (Defaults to ${newAdminUsername || 'username'}@${newOrgSlug || 'org'}.vortex)`}
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isCreating || !newOrgName.trim() || !newAdminUsername.trim() || !newAdminName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white w-full"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Organization & Admin
                </Button>
              </form>
            )}
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

    </div>
  );
}
