import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "tahfizh-sidebar-collapsed";
const DESKTOP_BREAKPOINT = 1024;

export default function AppLayout() {
  const { isAdmin } = useAuthContext();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : true,
  );
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const handleToggleSidebar = () => {
    if (isDesktop) {
      setCollapsed((value) => !value);
      return;
    }
    setMobileOpen((value) => !value);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,164,76,0.08),_transparent_20%),linear-gradient(180deg,#f3f8f5_0%,#f8fbf9_100%)] text-foreground">
      <Header onMenuClick={handleToggleSidebar} collapsed={collapsed} />
      <div className="flex min-h-[calc(100vh-73px)]">
        <Sidebar
          collapsed={collapsed}
          isDesktop={isDesktop}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          isAdmin={isAdmin}
        />
        <div className={cn("min-w-0 flex-1 transition-all duration-300", !isDesktop && "w-full")}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
