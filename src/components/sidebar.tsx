/**
 * components/sidebar.tsx
 * ----------------------
 * Dashboard sidebar navigation — Supabase-inspired dark design.
 * Shows navigation links, the current user info, and a logout button.
 *
 * Navigation items:
 * - Sprint Board (main data table)
 * - QBR Presentation (charts)
 * - Organizations (multi-tenant, all users)
 * - Team Management (admin/moderator only)
 * - Configurations (admin/moderator only)
 *
 * The collapse toggle sits next to the "Sprint Metrics" title
 * for a compact, intuitive header layout.
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  LayoutDashboard,
  Presentation,
  Shield,
  Settings,
  Building2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  userEmail: string;
  userName: string;
  userRole: string;
  activeProjectId?: string;
}

// Navigation items — easy to add new pages here.
// `allowedRoles` controls visibility: undefined = all users, array = only those roles.
const navItems = [
  {
    label: "Sprint Board",
    href: "/board",
    icon: LayoutDashboard,
    allowedRoles: undefined, // visible to everyone
    tooltip: "View and manage sprint tasks",
    requireProject: true,
  },
  {
    label: "QBR Presentation",
    href: "/qbr",
    icon: Presentation,
    allowedRoles: undefined,
    tooltip: "Charts and sprint analytics",
    requireProject: true,
  },
  {
    label: "Organizations",
    href: "/orgs",
    icon: Building2,
    allowedRoles: undefined,
    tooltip: "Manage orgs and projects",
  },
  {
    label: "Team Management",
    href: "/admin",
    icon: Shield,
    allowedRoles: ["admin", "moderator"] as string[],
    tooltip: "Add or manage team members",
    requireProject: true,
  },
  {
    label: "Configurations",
    href: "/settings",
    icon: Settings,
    allowedRoles: ["admin", "moderator"] as string[],
    tooltip: "Metadata, integrations, and app settings",
    requireProject: true,
  },
];

export function Sidebar({ userEmail, userName, userRole, activeProjectId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Filter nav items based on the user's role and active project
  const visibleItems = navItems.filter(
    (item) => {
      if (item.requireProject && !activeProjectId) return false;
      if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return false;
      return true;
    }
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-neutral-950 border-r border-neutral-800 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Logo / Brand + Collapse Toggle ── */}
      <div className="relative flex items-center justify-between px-4 h-16 border-b border-neutral-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-neutral-200 truncate">
              Sprint Metrics
            </span>
          )}
        </div>

        {/* Collapse toggle — sits on the outer border */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0 bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 shrink-0 rounded-full z-10 shadow-sm"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-neutral-800 border-neutral-700 text-neutral-200">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Navigation Links ── */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          // When collapsed, wrap each item in a tooltip showing the label
          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="bg-neutral-800 border-neutral-700 text-neutral-200">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <Separator className="bg-neutral-800" />

      {/* ── User Info & Logout ── */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* User avatar — first letter of name */}
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
            {userName?.charAt(0)?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-200 truncate">{userName}</p>
              <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={cn(
                "mt-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10",
                collapsed ? "w-full justify-center" : "w-full justify-start"
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-neutral-800 border-neutral-700 text-neutral-200">
            Sign out of your account
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
