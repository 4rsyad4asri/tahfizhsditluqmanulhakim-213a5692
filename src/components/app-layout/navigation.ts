import type { LucideIcon } from "lucide-react";
import {
  ArrowUpWideNarrow,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  FileBadge2,
  FolderCog,
  GraduationCap,
  LayoutDashboard,
  Signature,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  description: string;
  icon: LucideIcon;
  path?: string;
  disabled?: boolean;
  adminOnly?: boolean;
  match?: (pathname: string) => boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

const pathStartsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const dashboardItem: NavItem = {
  label: "Dashboard",
  description: "Ringkasan utama dan akses kelas.",
  icon: LayoutDashboard,
  path: "/",
  match: (pathname) => pathname === "/" || pathStartsWith("/kelas")(pathname) || pathStartsWith("/siswa")(pathname),
};

export const navSections: NavSection[] = [
  {
    label: "Data Sekolah",
    items: [
      {
        label: "Data Siswa",
        description: "Tambah, edit, dan kelola data siswa.",
        icon: Users,
        path: "/kelola-siswa",
        adminOnly: true,
      },
      {
        label: "Data Kelas",
        description: "Daftar kelas yang diampu atau seluruh kelas.",
        icon: Building2,
        path: "/profil",
      },
      {
        label: "Tahun Ajaran",
        description: "Kelola tahun ajaran aktif dan arsip.",
        icon: CalendarDays,
        path: "/tahun-ajaran",
        adminOnly: true,
      },
      {
        label: "Naik Kelas Massal",
        description: "Disiapkan untuk alur administrasi massal.",
        icon: ArrowUpWideNarrow,
        disabled: true,
      },
    ],
  },
  {
    label: "Ujian & Rekap",
    items: [
      {
        label: "Input Ujian",
        description: "Mulai dari dashboard, lalu pilih kelas dan siswa.",
        icon: BookOpenCheck,
        path: "/",
        match: dashboardItem.match,
      },
      {
        label: "Rekap Global",
        description: "Ringkasan nilai lintas kelas dan mode ujian.",
        icon: BarChart3,
        path: "/rekap-global",
      },
      {
        label: "Rekap Sertifikat",
        description: "Rekap ujian Tahfizh untuk sertifikat.",
        icon: Award,
        path: "/rekap-sertifikat",
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      {
        label: "Profil Penguji",
        description: "Profil akun dan kelas yang diampu.",
        icon: GraduationCap,
        path: "/profil",
      },
      {
        label: "Tanda Tangan",
        description: "Tanda tangan digital penguji dan sekolah.",
        icon: Signature,
        path: "/profile",
      },
      {
        label: "Template Rapor",
        description: "Identitas global rapor dan kebutuhan PDF.",
        icon: FileBadge2,
        path: "/profile",
      },
      {
        label: "Manajemen User",
        description: "Kelola akun admin, guru, dan penguji.",
        icon: FolderCog,
        path: "/kelola-user",
        adminOnly: true,
      },
    ],
  },
];
