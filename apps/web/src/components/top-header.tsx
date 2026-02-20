"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Sun, Moon } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

function deriveBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Overview" }];

  const crumbs: Crumb[] = [{ label: "Overview", href: "/" }];

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (!projectMatch) return crumbs;

  const projectId = projectMatch[1];
  const rest = pathname.slice(`/projects/${projectId}`.length);

  if (!rest || rest === "/") {
    crumbs.push({ label: "Project" });
    return crumbs;
  }

  if (rest.startsWith("/flows/")) {
    crumbs.push({ label: "Project", href: `/projects/${projectId}` });
    crumbs.push({ label: "Flow Detail" });
  } else if (rest === "/personas") {
    crumbs.push({ label: "Project", href: `/projects/${projectId}` });
    crumbs.push({ label: "Manage Personas" });
  } else if (rest === "/runs/new") {
    crumbs.push({ label: "Project", href: `/projects/${projectId}` });
    crumbs.push({ label: "New Run" });
  } else if (/^\/runs\/[^/]+/.test(rest)) {
    crumbs.push({ label: "Project", href: `/projects/${projectId}` });
    crumbs.push({ label: "Run Detail" });
  }

  return crumbs;
}

export function TopHeader() {
  const pathname = usePathname();
  const crumbs = deriveBreadcrumbs(pathname);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.theme = next ? "dark" : "light";
  }

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/50 bg-background px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-muted-foreground/40 select-none">&rsaquo;</span>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="rounded p-1.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button className="rounded p-1.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
