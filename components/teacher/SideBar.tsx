"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Users, Settings, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession, signOut } from "next-auth/react";

type IconType = ComponentType<{ className?: string }>;

export type SidebarItem = {
  name: string;
  icon: IconType;
  path?: string;
  id?: string;
};

const defaultMenuItems: SidebarItem[] = [
  { name: "Dashboard", path: "/teacher/dashboard", icon: Home },
  { name: "Classes", path: "/teacher/classes", icon: Users },
  { name: "Settings", path: "/teacher/settings", icon: Settings },
];

export default function Sidebar({
  items,
  activeId,
  onSelect,
  notificationComponent,
}: {
  items?: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  notificationComponent?: React.ReactNode;
}) {
  const pathname = usePathname();
  const menuItems = items ?? defaultMenuItems;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("teacherSidebarCollapsed") === "1";
    }
    return false;
  });
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Account";
  const role = (session?.user as { role?: string })?.role || "";
  const initial = typeof name === 'string' ? name.charAt(0).toUpperCase() : 'A';

  return (
    <TooltipProvider>
      <>
      <aside
        className={`p-4 glass relative ${
          collapsed ? "w-[72px] p-2" : "w-[260px] p-3"
        } fixed z-40 h-[calc(100dvh-2rem)] top-4 left-4 transition-[width] duration-[360ms] ease-[cubic-bezier(0.2,1.1,0.2,1)]`}
      >
        {/* Collapse toggle anchored to the sidebar itself */}
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={() => {
            setCollapsed((prev) => {
              const next = !prev;
              if (typeof window !== "undefined") {
                localStorage.setItem("teacherSidebarCollapsed", next ? "1" : "0");
              }
              return next;
            });
          }}
          className={`absolute ${collapsed ? "right-[-10px]" : "right-2"} top-2 ${collapsed ? "size-6" : "size-7"} rounded-full flex items-center justify-center bg-transparent hover:bg-transparent hover:ring-2 hover:ring-[rgba(40,165,125,0.28)] shadow-none transition-all duration-300 ease-in-out`}
          >
          {collapsed ? <ChevronRight className="h-3 w-3"/> : <ChevronLeft className="h-4 w-4"/>}
        </button>

        <div className={`flex items-center mb-6 ${collapsed ? "justify-center" : "gap-3 pr-6"}`}>
          <Image
            src="/logo.png"
            width={collapsed ? 28 : 32}
            height={collapsed ? 28 : 32}
            alt="SynapsEd logo"
            className="rounded-md select-none"
            priority
          />
          {!collapsed && (
            <h2 className="text-xl font-semibold text-slate-800">SynapsEd</h2>
          )}
        </div>
        <ul className="space-y-2">
          {menuItems.map(({ name, path, icon: Icon, id }) => {
            const active = (id && activeId === id) || (!!path && pathname === path);
            const Item = (
              <div
                className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} py-2 rounded-[22px] transition-all duration-[360ms] ease-in-out hover:-translate-y-0.5 ${
                  active
                    ? "bg-[rgba(40,165,125,0.12)] font-semibold text-slate-900"
                    : "text-slate-700 bg-transparent hover:bg-transparent hover:ring-2 hover:ring-[rgba(40,165,125,0.28)]"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 text-slate-800" />
                {!collapsed && <span className="truncate">{name}</span>}
              </div>
            );

            return (
              <li key={path ?? id ?? name}>
                {onSelect && id ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => onSelect(id)} className="w-full text-left">
                        {Item}
                      </button>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="rounded-full bg-[#28A57D] text-white shadow-none">
                        {name}
                      </TooltipContent>
                    )}
                  </Tooltip>
                ) : (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={path ?? "#"} className="block">
                        {Item}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="rounded-full bg-[#28A57D] text-white shadow-none">
                        {name}
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>

        {/* Bottom actions: notifications and account */}
        <div className="absolute bottom-2 left-0 right-0 px-2">
          <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between gap-2"}>
            {notificationComponent || (
              <button
                type="button"
                aria-label="Notifications"
                className="size-9 rounded-full bg-transparent hover:bg-transparent hover:ring-2 hover:ring-[rgba(40,165,125,0.28)] shadow-none flex items-center justify-center text-slate-800"
              >
                <Bell className="h-5 w-5" />
              </button>
            )}

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Account"
                  className="size-9 rounded-full bg-transparent hover:bg-transparent hover:ring-2 hover:ring-[rgba(40,165,125,0.28)] shadow-none flex items-center justify-center text-slate-800 font-semibold"
                >
                  {initial}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-0">
                <div className="bg-white text-slate-900 rounded-md p-3 min-w-[180px]">
                  <div className="text-sm font-medium leading-tight">{name}</div>
                  {role && <div className="text-xs text-slate-600">{role}</div>}
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="mt-3 w-full rounded-md bg-slate-100 hover:bg-slate-200 text-slate-900 px-3 py-1 text-sm"
                  >
                    Sign out
                  </button>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
      {/* Flow spacer to prevent content overlap on desktop */}
      <div
        className="shrink-0 mr-0"
        style={{ width: collapsed ? "72px" : "72px" }}
        aria-hidden
      />
      </>
    </TooltipProvider>
  );
}
