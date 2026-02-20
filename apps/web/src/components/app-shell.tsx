"use client";

import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-60">
        <TopHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
