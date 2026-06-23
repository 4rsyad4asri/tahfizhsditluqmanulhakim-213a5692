import { X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { dashboardItem, navSections, type NavItem } from "@/components/app-layout/navigation";

type SidebarProps = {
  collapsed: boolean;
  isDesktop: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
};

const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Index"),
  "/kelola-siswa": () => import("@/pages/ManageStudents"),
  "/profil": () => import("@/pages/ProfilPenguji"),
  "/tahun-ajaran": () => import("@/pages/AcademicYears"),
  "/rekap-global": () => import("@/pages/RekapGlobal"),
  "/rekap-sertifikat": () => import("@/pages/RekapSertifikat"),
  "/profile": () => import("@/pages/Profile"),
  "/kelola-user": () => import("@/pages/ManageUsers"),
};
const preloadedRoutes = new Set<string>();

function preloadRoute(path?: string) {
  if (!path || preloadedRoutes.has(path)) return;
  const preload = routePreloaders[path];
  if (!preload) return;

  preloadedRoutes.add(path);
  void preload().catch(() => {
    preloadedRoutes.delete(path);
  });
}

const DESKTOP_EXPANDED_WIDTH = "w-[308px]";
const DESKTOP_COLLAPSED_WIDTH = "w-[104px]";

export const getSidebarDesktopWidthClass = (collapsed: boolean) =>
  collapsed ? DESKTOP_COLLAPSED_WIDTH : DESKTOP_EXPANDED_WIDTH;

function SidebarMenuItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      disabled={item.disabled}
      title={collapsed ? item.label : undefined}
      onPointerEnter={() => preloadRoute(item.path)}
      onPointerDown={() => preloadRoute(item.path)}
      onFocus={() => preloadRoute(item.path)}
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] border px-3 py-3 text-left transition-all duration-150",
        collapsed ? "justify-center px-2.5 py-3.5" : "",
        item.disabled
          ? "cursor-not-allowed border-transparent bg-transparent text-slate-400 opacity-70"
          : "border-transparent text-slate-600 hover:-translate-y-[1px] hover:border-emerald-100 hover:bg-emerald-50/90 hover:text-slate-900 hover:shadow-sm",
        active && "border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] text-emerald-950 shadow-[0_14px_34px_rgba(4,120,87,0.10)]",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#c9a44c] transition-all duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-150",
          item.disabled
            ? "bg-slate-100 text-slate-400"
            : active
              ? "bg-emerald-700 text-white shadow-[0_12px_28px_rgba(4,120,87,0.24)] ring-4 ring-emerald-100/80"
              : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1 transition-all duration-150">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{item.label}</span>
            {item.disabled && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Segera
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">{item.description}</p>
        </div>
      )}
    </button>
  );
}

export default function Sidebar({ collapsed, isDesktop, mobileOpen, onCloseMobile, isAdmin }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    if (item.match) return item.match(location.pathname);
    return location.pathname === item.path;
  };

  const filteredSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  }));

  const desktopAside = (
    <aside
      className={cn(
        "hidden border-r border-emerald-100/80 bg-[radial-gradient(circle_at_top,_rgba(201,164,76,0.10),_transparent_22%),linear-gradient(180deg,#ffffff_0%,#f7fbf8_100%)] shadow-[8px_0_30px_rgba(15,23,42,0.04)] transition-[width] duration-150 ease-out lg:flex lg:flex-col",
        getSidebarDesktopWidthClass(collapsed),
      )}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4">
  <div className="space-y-5">
    <div>
      {!collapsed && (
        <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Utama
        </p>
      )}
      <SidebarMenuItem
        item={dashboardItem}
        active={isActive(dashboardItem)}
        collapsed={collapsed}
        onClick={() => navigate("/")}
      />
    </div>

          {filteredSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {section.label}
                </p>
              )}
              <div className="space-y-2">
                {section.items.map((item) => (
                  <SidebarMenuItem
                    key={item.label}
                    item={item}
                    active={isActive(item)}
                    collapsed={collapsed}
                    onClick={() => {
                      if (item.path && !item.disabled) navigate(item.path);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );

  const mobileAside = (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[3px] transition-opacity duration-150 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[312px] max-w-[86vw] border-r border-emerald-100 bg-[radial-gradient(circle_at_top,_rgba(201,164,76,0.10),_transparent_22%),linear-gradient(180deg,#ffffff_0%,#f7fbf8_100%)] shadow-[20px_0_60px_rgba(15,23,42,0.18)] transition-transform duration-150 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b88a2f]">Menu</p>
            <p className="text-sm text-slate-500">Navigasi admin & guru</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label="Tutup sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100vh-73px)] overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            <div>
              <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Utama</p>
              <SidebarMenuItem
                item={dashboardItem}
                active={isActive(dashboardItem)}
                collapsed={false}
                onClick={() => {
                  navigate("/");
                  onCloseMobile();
                }}
              />
            </div>

            {filteredSections.map((section) => (
              <div key={section.label}>
                <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {section.label}
                </p>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <SidebarMenuItem
                      key={item.label}
                      item={item}
                      active={isActive(item)}
                      collapsed={false}
                      onClick={() => {
                        if (item.path && !item.disabled) {
                          navigate(item.path);
                          onCloseMobile();
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );

  return isDesktop ? desktopAside : mobileAside;
}
