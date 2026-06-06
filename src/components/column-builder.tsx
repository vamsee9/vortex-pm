"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchColumnDefinitions, createColumnDefinition, updateColumnDefinition, deleteColumnDefinition, reorderColumnDefinitions } from "@/lib/actions/column-definitions";
import type { ColumnDefinition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { updateProjectFieldMappings } from "@/lib/actions/projects";

interface ColumnBuilderProps {
  projectId: string;
  initialFieldMappings?: Record<string, string>;
}

export function ColumnBuilder({ projectId, initialFieldMappings = {} }: ColumnBuilderProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>(initialFieldMappings);

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<string>("text");

  const loadColumns = useCallback(async () => {
    try {
      const data = await fetchColumnDefinitions(projectId);
      setColumns(data);
    } catch (err) {
      toast.error("Failed to load columns.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  async function handleAddColumn() {
    if (!newKey || !newLabel) return;
    setIsSaving(true);
    try {
      const res = await createColumnDefinition(projectId, {
        key: newKey,
        label: newLabel,
        data_type: newType as any,
        is_required: false,
        is_sortable: true,
        is_filterable: newType === "select",
        is_editable: true,
        is_visible: true,
        is_reportable: false,
      });
      if (res.success && res.data) {
        setColumns([...columns, res.data]);
        setNewKey("");
        setNewLabel("");
        setNewType("text");
        toast.success("Column added.");
      } else {
        toast.error(res.error || "Failed to add column");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(id: string, field: keyof ColumnDefinition, value: boolean) {
    const updated = columns.map(c => c.id === id ? { ...c, [field]: value } : c);
    setColumns(updated);
    await updateColumnDefinition(id, { [field]: value });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this column? This removes it from the UI but data remains in tasks.")) return;
    try {
      const res = await deleteColumnDefinition(id);
      if (res.success) {
        setColumns(columns.filter(c => c.id !== id));
        toast.success("Column deleted.");
      } else {
        toast.error(res.error || "Could not delete");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSaveMappings() {
    setIsSaving(true);
    try {
      await updateProjectFieldMappings(projectId, fieldMappings);
      toast.success("Webhook field mappings saved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save mappings");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-500"/></div>;

  return (
    <div className="space-y-8">
      {/* Add New Column Form */}
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label className="text-neutral-300">Internal Key (e.g. priority)</Label>
              <Input 
                value={newKey} 
                onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                className="bg-neutral-950 border-neutral-800"
                placeholder="system_key"
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label className="text-neutral-300">Display Label</Label>
              <Input 
                value={newLabel} 
                onChange={e => setNewLabel(e.target.value)} 
                className="bg-neutral-950 border-neutral-800"
                placeholder="Column Name"
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label className="text-neutral-300">Data Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700">
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddColumn} disabled={isSaving || !newKey || !newLabel} className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="w-4 h-4 mr-2" /> Add Column
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List of Columns */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">Current Schema</h3>
        {columns.map(col => (
          <div key={col.id} className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-800 p-3 rounded-lg group">
            <GripVertical className="w-4 h-4 text-neutral-600 cursor-grab" />
            
              <div className="flex-1 grid grid-cols-7 gap-4 items-center">
              <div>
                <p className="text-sm font-medium text-neutral-200">{col.label}</p>
                <p className="text-xs text-neutral-500 font-mono">{col.key}</p>
              </div>
              
              <div className="text-xs text-neutral-400 capitalize">
                {col.data_type} {col.is_system && "(System)"}
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={col.is_visible} 
                  onCheckedChange={v => handleToggle(col.id, "is_visible", !!v)}
                />
                <span className="text-xs text-neutral-400">Visible</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={col.is_editable} 
                  onCheckedChange={v => handleToggle(col.id, "is_editable", !!v)}
                  disabled={col.is_system && col.auto_source === "computed"}
                />
                <span className="text-xs text-neutral-400">Editable</span>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={col.is_filterable} 
                  onCheckedChange={v => handleToggle(col.id, "is_filterable", !!v)}
                />
                <span className="text-xs text-neutral-400">Filterable</span>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={col.is_reportable} 
                  onCheckedChange={v => handleToggle(col.id, "is_reportable", !!v)}
                />
                <span className="text-xs text-neutral-400">Reportable</span>
              </div>
              
              <div className="flex justify-end gap-2">
                {!col.is_system && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(col.id)} className="text-neutral-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Field Mappings */}
      <div className="pt-8 border-t border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">Jira Webhook Field Mapping</h3>
        <p className="text-xs text-neutral-400 mb-4">Map incoming Jira webhook payload paths (e.g. <code>issue.fields.customfield_10014</code>) to your table columns. Core fields like summary are mapped automatically.</p>
        
        <div className="grid gap-4 max-w-2xl">
          {columns.map(col => {
            // Skip computed system fields that don't map directly from webhook
            if (col.auto_source === "computed") return null;

            return (
              <div key={`map-${col.key}`} className="flex items-center gap-4">
                <div className="w-1/3 text-sm text-neutral-300 font-mono text-right">{col.key}</div>
                <div className="text-neutral-500">&larr;</div>
                <Input 
                  placeholder="e.g. issue.fields.customfield_1234"
                  value={fieldMappings[col.key] || ""}
                  onChange={(e) => setFieldMappings(prev => ({...prev, [col.key]: e.target.value}))}
                  className="bg-neutral-950 border-neutral-800 flex-1 font-mono text-sm"
                />
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 flex justify-end max-w-2xl">
          <Button onClick={handleSaveMappings} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings2 className="w-4 h-4 mr-2" />}
            Save Mappings
          </Button>
        </div>
      </div>
    </div>
  );
}
