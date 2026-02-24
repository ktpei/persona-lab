"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  FolderOpen,
  Plus,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] ?? null;
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => setProjects(data))
      .catch(() => {});
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border/40 bg-sidebar">
      {/* Brand */}
      <div className="flex h-12 items-center gap-2.5 px-4 border-b border-border/40">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/15">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-[15px] font-semibold text-foreground" style={{ fontFamily: "'Source Serif 4', serif" }}>
          Persona<em className="not-italic italic">Lab</em>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pt-3 space-y-0.5">
        {/* New Project */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Link>

        {/* Overview */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] transition-colors ${
            isDashboard && !activeProjectId
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Overview
        </Link>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <div className="mt-5 mb-1 px-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
              Projects
            </div>
            {projects.map((project) => {
              const active = activeProjectId === project.id;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`group flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-primary/8 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {active ? (
                    <div className="h-3.5 w-0.5 rounded-full bg-primary shrink-0" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{project.name}</span>
                  <ChevronRight className={`h-3 w-3 ml-auto shrink-0 transition-opacity ${active ? "text-muted-foreground/40 opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/30">
        <div className="text-[10px] text-muted-foreground/30 font-mono">v0.1.0</div>
      </div>
    </aside>
  );
}
