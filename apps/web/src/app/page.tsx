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
  Filter,
  FileText,
  Clock,
  Trash2,
  AlertTriangle,
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
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
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
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">All Projects</h2>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-64 rounded border border-border bg-transparent pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Filter button */}
          <button className="flex h-10 w-10 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <Filter className="h-4 w-4" />
          </button>

          {/* Create Project */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary">
                Create Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My App Redesign"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description (optional)</Label>
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

      {/* Project cards grid */}
      {filtered.length === 0 && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-border bg-muted">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to get started.
          </p>
          <Button
            variant="outline"
            className="mt-5 border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => setOpen(true)}
          >
            Create Project
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No projects match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <div className="group rounded border border-primary/20 bg-card p-5 transition-colors hover:border-primary/40">
                {/* Name + delete */}
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-medium text-foreground">{p.name}</h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    className="rounded p-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Description */}
                {p.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>
                )}

                {/* Avatar */}
                <div className="mt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Runs count */}
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{p._count.runs ?? 0} Runs</span>
                </div>

                {/* Divider */}
                <div className="my-3 h-px bg-border/50" />

                {/* Metadata */}
                <div className="flex items-start gap-6">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Created
                    </div>
                    <div className="mt-0.5 text-sm text-foreground">
                      {timeAgo(p.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Flows
                    </div>
                    <div className="mt-0.5 text-sm text-foreground">
                      {p._count.flows}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Personas
                    </div>
                    <div className="mt-0.5 text-sm text-foreground">
                      {p._count.personas}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-3 h-px bg-border/50" />

                {/* Updated */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Updated {timeAgo(p.createdAt)}</span>
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
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[15px] text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              This will permanently remove all flows, personas, runs, and findings associated with this project.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteProject}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
