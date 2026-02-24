"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, Image, X } from "lucide-react";

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
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
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">{flow?.name ?? "..."}</h2>
        {flow?.frames && (
          <p className="text-[13px] text-muted-foreground/60">
            <span className="font-mono">{flow.frames.length}</span> frame{flow.frames.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Upload */}
      <div className="rounded border border-dashed border-border/40 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpload();
          }}
          className="flex items-center gap-3"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="flex-1 text-[13px] text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <Button type="submit" disabled={uploading} size="sm" className="gap-1.5 text-[13px]">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground/40 mt-2">
          Upload screenshots in order. They will be assigned sequential step indices.
        </p>
      </div>

      {/* Frames */}
      {flow?.frames && flow.frames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {flow.frames.map((frame) => (
            <div key={frame.id} className="group rounded border border-border/40 overflow-hidden hover:border-border/70 transition-colors">
              <button
                onClick={() => setLightboxSrc(`/api/uploads/${frame.imagePath}`)}
                className="aspect-[16/10] relative bg-muted/30 w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/uploads/${frame.imagePath}`}
                  alt={`Step ${frame.stepIndex}`}
                  className="object-contain w-full h-full"
                />
              </button>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/30">
                <span className="text-[13px] font-medium text-foreground font-mono">
                  Step {frame.stepIndex}
                </span>
                <button
                  className="rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={() => handleDelete(frame.id)}
                  disabled={deleting === frame.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/40 py-16">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <Image className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No frames yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Upload screenshots of your UX flow above.
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Screenshot"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded border border-border/20"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
