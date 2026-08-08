import type { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { TabBar } from "@/components/navigation/TabBar";
import { MobileTopBar } from "@/components/navigation/MobileTopBar";
import { ConnectionBanner } from "@/components/shared/ConnectionBanner";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-h-full flex-1 flex-col">
        <ConnectionBanner />
        <MobileTopBar />
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
        <TabBar />
      </div>
    </div>
  );
}
