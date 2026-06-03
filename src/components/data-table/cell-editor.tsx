"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnDefinition } from "@/lib/types";

interface CellEditorProps {
  def: ColumnDefinition;
  value: any;
  onSave: (value: any) => void;
  children: React.ReactNode;
}

export function CellEditor({ def, value, onSave, children }: CellEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (currentValue !== value) {
      onSave(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setIsEditing(false);
      setCurrentValue(value);
    }
  };

  if (!isEditing) {
    return (
      <div 
        className={`w-full h-full flex items-center min-h-[30px] cursor-text ${def.is_editable ? 'hover:bg-white/5' : ''}`}
        onClick={() => {
          if (def.is_editable) setIsEditing(true);
        }}
      >
        {children}
      </div>
    );
  }

  // Edit Mode Rendering
  switch (def.data_type) {
    case "text":
    case "number":
      return (
        <Input
          ref={inputRef}
          type={def.data_type === "number" ? "number" : "text"}
          value={currentValue || ""}
          onChange={(e) => setCurrentValue(def.data_type === "number" ? Number(e.target.value) : e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 py-1 px-2 text-sm bg-neutral-900 border-blue-500 rounded-none w-full"
        />
      );

    case "select":
      return (
        <Select 
          value={currentValue || ""} 
          onValueChange={(val) => {
            onSave(val);
            setIsEditing(false);
          }}
          defaultOpen={true}
          onOpenChange={(open) => {
            if (!open) handleSave();
          }}
        >
          <SelectTrigger className="h-8 px-2 text-sm bg-neutral-900 border-blue-500 rounded-none w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700">
            {def.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-neutral-300">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      
    // Dates, Users, and multi-select can be added here.
    // For now, fallback to generic text input for unsupported rich edits.
    default:
      return (
        <Input
          ref={inputRef}
          value={currentValue || ""}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 py-1 px-2 text-sm bg-neutral-900 border-blue-500 rounded-none w-full"
        />
      );
  }
}
