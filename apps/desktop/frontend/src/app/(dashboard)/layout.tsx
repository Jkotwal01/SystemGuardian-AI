import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-1 h-full"
      style={{ background: "var(--color-surface-950)" }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden m-0 md:m-2 bg-[var(--color-surface-900)] rounded-none md:rounded-xl border-x-0 md:border border-[var(--color-surface-700)] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <TopBar />
        <main className="flex-1 flex flex-col overflow-y-auto relative">{children}</main>
      </div>
    </div>
  );
}
