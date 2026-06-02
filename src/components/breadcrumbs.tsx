import Link from "next/link";
import { ChevronRight, Home, Building2, FolderKanban, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const IconMap: Record<string, any> = {
    Home,
    Building2,
    FolderKanban,
    Settings,
  };

  return (
    <nav className="flex items-center space-x-1 text-sm text-neutral-400 mb-6 px-1">
      {items.map((item, index) => {
        const Icon = item.icon ? IconMap[item.icon] : null;
        const isLast = index === items.length - 1;

        const content = (
          <div className={cn("flex items-center gap-1.5", isLast ? "text-neutral-200 font-medium" : "hover:text-neutral-200 transition-colors")}>
            {Icon && <Icon className="w-4 h-4" />}
            <span>{item.label}</span>
          </div>
        );

        return (
          <div key={index} className="flex items-center">
            {item.href && !isLast ? (
              <Link href={item.href}>{content}</Link>
            ) : (
              content
            )}
            {!isLast && <ChevronRight className="w-4 h-4 mx-2 text-neutral-600 shrink-0" />}
          </div>
        );
      })}
    </nav>
  );
}
