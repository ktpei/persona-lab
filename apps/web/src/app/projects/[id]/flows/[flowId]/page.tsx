"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, Image } from "lucide-react";

interface Frame {
  id: string;
  stepIndex: number;
  imagePath: string;
}

interface Flow {
  id: string;
  name: string;
  frames: Frame[];
}

export default function FlowDetail() {
  const params = useParams<{ id: string; flowId: string }>();
  const { flowId } = params;
  const [flow, setFlow] = useState<Flow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadFlow() {
    fetch(`/api/flows/${flowId}`)
      .then((r) => r.json())
      .then(setFlow);
  }

  useEffect(() => {
    loadFlow();
  }, [flowId]);

  async function handleUpload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("frames", file);
    }

    const res = await fetch(`/api/flows/${flowId}/frames`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      loadFlow();
      if (fileRef.current) fileRef.current.value = "";
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Upload failed: ${err.error || res.statusText}`);
    }
    setUploading(false);
  }

  async function handleDelete(frameId: string) {
    setDeleting(frameId);
    const res = await fetch(`/api/flows/${flowId}/frames`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameId }),
    });

    if (res.ok) {
      loadFlow();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Delete failed: ${err.error || res.statusText}`);
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{flow?.name ?? "..."}</h2>

      {/* Upload */}
      <div className="rounded border border-dashed border-border/60 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpload();
          }}
          className="flex items-center gap-4"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="flex-1 text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <Button type="submit" disabled={uploading} size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Upload screenshots in order. They will be assigned sequential step indices.
        </p>
      </div>

      {/* Frames */}
      {flow?.frames && flow.frames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flow.frames.map((frame) => (
            <div key={frame.id} className="group rounded border border-border/60 overflow-hidden hover:border-border transition-colors">
              <div className="aspect-[16/10] relative bg-muted/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/uploads/${frame.imagePath}`}
                  alt={`Step ${frame.stepIndex}`}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/40">
                <span className="text-sm font-medium text-foreground">
                  Step {frame.stepIndex}
                </span>
                <button
                  className="rounded p-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={() => handleDelete(frame.id)}
                  disabled={deleting === frame.id}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/60 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-border bg-muted">
            <Image className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No frames yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload screenshots of your UX flow above.
          </p>
        </div>
      )}
    </div>
  );
}
