"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  FolderOpen,
  Plus,
  LayoutGrid,
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

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => setProjects(data))
      .catch(() => {});
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <FlaskConical className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold tracking-tight text-foreground">
          Persona<span className="font-normal italic text-muted-foreground">Lab</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-1 space-y-0.5">
        {/* New Project */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded px-3 py-2 text-[15px] text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>

        {/* Overview */}
        <Link
          href="/"
          className={`flex items-center gap-2.5 rounded px-3 py-2 text-[15px] transition-colors ${
            pathname === "/" && !activeProjectId
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Overview
        </Link>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <div className="mt-6 mb-1.5 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Projects
            </div>
            {projects.map((project) => {
              const active = activeProjectId === project.id;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`flex items-center gap-2.5 rounded px-3 py-2 text-[15px] transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
