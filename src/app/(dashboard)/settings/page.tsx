/**
 * (dashboard)/settings/page.tsx
 * -----------------------------
 * Application Settings & Configurations.
 * Role-gated to admin and moderator roles only.
 * 
 * Contains 3 tabs:
 * 1. Metadata: Manage dynamic Work Types, Priorities, Statuses.
 * 2. Integrations: Webhook secrets and URLs.
 * 3. About: Application info and environment details.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Key, Link as LinkIcon, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { fetchMetadata, createMetadataItem, deleteMetadataItem } from "@/lib/actions/metadata";
import type { MetadataItem } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");

  // Metadata State
  const [metadata, setMetadata] = useState<MetadataItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<"work_type" | "priority" | "status">("work_type");
  const [isAdding, setIsAdding] = useState(false);

  // Initial check & load
  const loadInitialData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role;
    
    if (role !== "admin" && role !== "moderator") {
      router.push("/board");
      return;
    }
    
    setHasAccess(true);
    setUserRole(role);

    try {
      const data = await fetchMetadata();
      setMetadata(data);
    } catch (err) {
      toast.error("Failed to load metadata configurations.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Actions
  async function handleAddMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    setIsAdding(true);
    try {
      // Very basic logic for display order (put at the end)
      const currentCategoryItems = metadata.filter(m => m.category === newCategory);
      const maxOrder = currentCategoryItems.reduce((max, item) => Math.max(max, item.display_order), 0);
      
      const newItem = await createMetadataItem(newCategory, newLabel.trim(), maxOrder + 10);
      setMetadata([...metadata, newItem]);
      setNewLabel("");
      toast.success("Added successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add item.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteMetadata(id: string) {
    if (!confirm("Are you sure? This may break existing filters if this value is currently in use.")) return;
    
    try {
      await deleteMetadataItem(id);
      setMetadata(metadata.filter(m => m.id !== id));
      toast.success("Deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-neutral-400">
          <ShieldAlert className="w-5 h-5" />
          <p>You need admin or moderator access to view this page.</p>
        </div>
      </div>
    );
  }

  const workTypes = metadata.filter(m => m.category === "work_type");
  const priorities = metadata.filter(m => m.category === "priority");
  const statuses = metadata.filter(m => m.category === "status");

  return (
    <div className="w-full mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-100">Configurations</h2>
        <p className="text-neutral-400 mt-1">
          Manage system-wide settings, dropdown metadata, and integrations.
        </p>
      </div>

      <Tabs defaultValue="metadata" className="w-full">
        <TabsList className="bg-neutral-900 border border-neutral-800 h-11 w-full justify-start rounded-lg mb-6">
          <TabsTrigger value="metadata" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-neutral-400">
            Metadata Lists
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-neutral-400">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-neutral-400">
            About System
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Metadata ─── */}
        <TabsContent value="metadata" className="space-y-6 outline-none">
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg text-neutral-100">Add New Configuration</CardTitle>
              <CardDescription className="text-neutral-400">
                These values power the dropdown filters on the Sprint Board and QBR pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMetadata} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label className="text-neutral-300">Category</Label>
                  <Select value={newCategory} onValueChange={(v: any) => setNewCategory(v)}>
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
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isAdding || !newLabel.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Item
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Work Types */}
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader className="pb-3 border-b border-neutral-800">
                <CardTitle className="text-sm text-neutral-300 font-medium uppercase tracking-wider">Work Types</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="divide-y divide-neutral-800 max-h-[300px] overflow-y-auto">
                  {workTypes.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 px-4 hover:bg-neutral-800/30">
                      <span className="text-neutral-200 text-sm">{item.label}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMetadata(item.id)} className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {workTypes.length === 0 && <div className="p-4 text-center text-neutral-500 text-sm">No work types found.</div>}
                </div>
              </CardContent>
            </Card>

            {/* Priorities */}
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader className="pb-3 border-b border-neutral-800">
                <CardTitle className="text-sm text-neutral-300 font-medium uppercase tracking-wider">Priorities</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="divide-y divide-neutral-800 max-h-[300px] overflow-y-auto">
                  {priorities.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 px-4 hover:bg-neutral-800/30">
                      <span className="text-neutral-200 text-sm">{item.label}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMetadata(item.id)} className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {priorities.length === 0 && <div className="p-4 text-center text-neutral-500 text-sm">No priorities found.</div>}
                </div>
              </CardContent>
            </Card>

            {/* Statuses */}
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader className="pb-3 border-b border-neutral-800">
                <CardTitle className="text-sm text-neutral-300 font-medium uppercase tracking-wider">Statuses</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="divide-y divide-neutral-800 max-h-[300px] overflow-y-auto">
                  {statuses.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 px-4 hover:bg-neutral-800/30">
                      <span className="text-neutral-200 text-sm">{item.label}</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMetadata(item.id)} className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {statuses.length === 0 && <div className="p-4 text-center text-neutral-500 text-sm">No statuses found.</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 2: Integrations ─── */}
        <TabsContent value="integrations" className="space-y-6 outline-none">
           <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-blue-400" />
                Jira Webhook Settings
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Configure your Jira instance to send data to this dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-neutral-300">Webhook URL Payload</Label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-neutral-950 p-3 rounded-lg border border-neutral-800 text-sm text-neutral-300 font-mono">
                    https://[your-domain]/api/webhooks/jira
                  </code>
                  <Button variant="outline" className="border-neutral-700">Copy</Button>
                </div>
                <p className="text-xs text-neutral-500">Configure this in Jira Administration &gt; System &gt; WebHooks.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300">Webhook Secret Token (Header: x-webhook-secret)</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      type="password" 
                      value="************************************************" 
                      readOnly 
                      className="bg-neutral-950 border-neutral-800 text-neutral-300 font-mono pr-10"
                    />
                    <Key className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {userRole === "admin" && (
                    <Button variant="destructive" className="bg-red-900/50 text-red-400 hover:bg-red-900 hover:text-red-300">Regenerate</Button>
                  )}
                </div>
                <p className="text-xs text-neutral-500">Use this token to authenticate incoming Jira payloads. Keep it secure.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: About ─── */}
        <TabsContent value="about" className="space-y-6 outline-none">
          <Card className="bg-neutral-900/80 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg text-neutral-100 flex items-center gap-2">
                <Info className="w-5 h-5 text-purple-400" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-neutral-300">
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500">Application Version</span>
                <span className="font-mono">v1.2.0 (Stable)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500">Database Connection</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Connected (Supabase)</Badge>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500">Node Environment</span>
                <span className="font-mono">{process.env.NODE_ENV || 'production'}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
