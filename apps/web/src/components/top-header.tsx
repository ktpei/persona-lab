"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sun, Moon, Command, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface Crumb {
  label: string;
  href?: string;
}

function deriveBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard") return [{ label: "Overview" }];

  const crumbs: Crumb[] = [{ label: "Overview", href: "/dashboard" }];

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
    <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-sm px-6">
      {/* Breadcrumbs — Figma/Stripe style with / separator */}
      <nav className="flex items-center gap-1 text-[13px]">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/30 select-none font-mono text-xs">/</span>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {/* Command hint */}
        <div className="hidden sm:flex items-center gap-1.5 mr-2 px-2 py-1 rounded border border-border/40 text-[11px] text-muted-foreground/40 font-mono">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
