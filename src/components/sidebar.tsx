/**
 * components/sidebar.tsx
 * ----------------------
 * Dashboard sidebar — role-based navigation.
 *
 * Owner:  Dashboard → Organizations, Platform Settings
 * Admin:  Dashboard → Projects, Team Members, Configurations, Reporting
 * Member: Sprint Board, Reporting
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
  Building2,
  FolderKanban,
  Users,
  Settings,
  PieChart,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  userEmail: string;
  userName: string;
  userRole: string;
  activeProjectId?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  tooltip: string;
}

function getNavItemsForRole(role: string, activeProjectId?: string): NavItem[] {
  if (role === "owner") {
    return [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        tooltip: "Organization overview",
      },
      {
        label: "Organizations",
        href: "/orgs",
        icon: Building2,
        tooltip: "Manage organizations",
      },
    ];
  }

  if (role === "admin") {
    const items: NavItem[] = [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        tooltip: "Project overview",
      },
    ];

    if (activeProjectId) {
      items.push(
        {
          label: "Team Members",
          href: `/projects/${activeProjectId}`,
          icon: Users,
          tooltip: "Manage team members",
        },
        {
          label: "Configurations",
          href: "/settings",
          icon: Settings,
          tooltip: "Metadata and table schema",
        },
        {
          label: "Reporting",
          href: "/reporting",
          icon: PieChart,
          tooltip: "Charts and analytics",
        },
      );
    }

    return items;
  }

  // Member
  const items: NavItem[] = [];
  if (activeProjectId) {
    items.push(
      {
        label: "Sprint Board",
        href: "/board",
        icon: LayoutDashboard,
        tooltip: "View and manage sprint tasks",
      },
      {
        label: "Reporting",
        href: "/reporting",
        icon: PieChart,
        tooltip: "Charts and analytics",
      },
    );
  }

  return items;
}

export function Sidebar({ userEmail, userName, userRole, activeProjectId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear project cookie
    document.cookie = "active_project_id=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  }

  const navItems = getNavItemsForRole(userRole, activeProjectId);

  // Role display label
  const roleLabel =
    userRole === "owner"
      ? "Platform Owner"
      : userRole === "admin"
      ? "Org Admin"
      : "Team Member";

  const roleColor =
    userRole === "owner"
      ? "text-amber-400"
      : userRole === "admin"
      ? "text-emerald-400"
      : "text-blue-400";

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
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-neutral-200 truncate">
                Vortex
              </span>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase truncate">
                Plan. Track. Deliver.
              </span>
            </div>
          )}
        </div>

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

      {/* ── Role indicator ── */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-b border-neutral-800/50">
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest", roleColor)}>
            {roleLabel}
          </span>
        </div>
      )}

      {/* ── Navigation Links ── */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
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

