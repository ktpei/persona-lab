"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Users,
  Workflow,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { flows: number; personas: number; runs?: number };
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects);
  }, []);

  async function createProject() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
    });
    if (res.ok) {
      const project = await res.json();
      setProjects((prev) => [
        { ...project, _count: { flows: 0, personas: 0, runs: 0 } },
        ...prev,
      ]);
      setName("");
      setDescription("");
      setOpen(false);
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  const filtered = search
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 rounded border border-border/60 bg-transparent pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Create Project */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-[13px]">
                <Plus className="h-3.5 w-3.5" />
                New project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[13px]">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My App Redesign"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc" className="text-[13px]">Description <span className="text-muted-foreground/50 font-normal">optional</span></Label>
                  <Input
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Testing the new checkout flow"
                  />
                </div>
                <Button onClick={createProject} disabled={!name.trim()} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Project cards */}
      {filtered.length === 0 && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/50 py-20">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Create your first project to get started.
          </p>
          <Button
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-8 text-center">
          No projects match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <div className="group relative rounded border border-border/50 bg-card p-5 transition-all hover:border-border hover:bg-card/80">
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteTarget(p);
                  }}
                  className="absolute top-4 right-4 rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Project initial */}
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-[13px] font-semibold text-primary">
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + description */}
                <h3 className="mt-3 text-[15px] font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                  {p.name}
                </h3>
                {p.description && (
                  <p className="mt-1 text-[13px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                )}

                {/* Stats row */}
                <div className="mt-4 flex items-center gap-4 text-[12px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Workflow className="h-3 w-3" />
                    <span className="font-mono">{p._count.flows}</span> flows
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span className="font-mono">{p._count.personas}</span> personas
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span className="font-mono">{p._count.runs ?? 0}</span> runs
                  </span>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/50 font-mono">
                    {timeAgo(p.createdAt)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              This will permanently remove all flows, personas, runs, and findings.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteProject}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
