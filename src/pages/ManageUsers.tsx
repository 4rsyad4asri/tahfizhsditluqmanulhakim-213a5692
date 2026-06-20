import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  UserPlus, Loader2, Shield, Search, CheckCircle2, XCircle, Power, KeyRound,
  Eye, EyeOff,
  Pencil, MessageCircle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import AssignKelasDialog from "@/components/AssignKelasDialog";
import { DataTablePagination } from "@/components/DataTablePagination";

type AppRole = "admin" | "penguji" | "guru" | "parent";
type Status = "pending" | "approved" | "rejected" | "inactive";

interface UserRow {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  whatsapp: string | null;
  status: Status | null;
  registered_at: string | null;
  role: AppRole | "unknown";
}

const ROLE_OPTS: AppRole[] = ["admin", "penguji", "guru", "parent"];
const STATUS_OPTS: Status[] = ["pending", "approved", "rejected", "inactive"];

const statusBadge: Record<Status, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  inactive: "bg-gray-200 text-gray-700",
};
const roleBadge: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary",
  penguji: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
  guru: "bg-blue-100 text-blue-800",
  parent: "bg-purple-100 text-purple-800",
};

export default function ManageUsers() {
  const { isAdmin } = useAuthContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<AppRole | "all">("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterStatus]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("registered_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profRes.error) throw profRes.error;
      if (rolesRes.error) throw rolesRes.error;
      return (profRes.data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        email: p.email,
        whatsapp: p.whatsapp,
        status: p.status as Status,
        registered_at: p.registered_at,
        role: (rolesRes.data?.find((r: any) => r.user_id === p.id)?.role as AppRole) ?? "unknown",
      })) as UserRow[];
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (q) {
        const hay = [u.full_name, u.username, u.email, u.whatsapp].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterStatus]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const callAction = useMutation({
    mutationFn: async (body: { action: string; target_user_id: string; payload?: any }) => {
      const { data, error } = await supabase.functions.invoke("admin-user-action", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: any) => toast.error(getSafeErrorMessage(e)),
  });

  const sendWhatsApp = (u: UserRow) => {
    if (!u.whatsapp) return toast.error("Nomor WhatsApp belum diisi");
    const text = encodeURIComponent(
      `Assalamu'alaikum.\n\nAkun Anda pada Sistem Tahfizh SDIT Luqmanul Hakim telah disetujui.\n\nUsername: ${u.username || "-"}\n\nSilakan login melalui website:\nhttps://tahfizhsditluqmanulhakim.lovable.app\n\nBarakallahu fiikum.`,
    );
    const phone = u.whatsapp.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Akses ditolak. Hanya Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Manajemen Akun
            </h2>
            <p className="text-sm text-muted-foreground">Persetujuan & kelola akun Admin, Penguji, Guru, Orang Tua</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-islamic text-primary-foreground hover:opacity-90"
          >
            <UserPlus className="w-4 h-4" /> Tambah Akun
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, username, email, WhatsApp..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Semua Role</option>
            {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Semua Status</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Tidak ada akun</p>
        ) : (
          <div className="overflow-x-auto bg-card border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Nama</Th><Th>Username</Th><Th>Role</Th><Th>WhatsApp</Th>
                  <Th>Status</Th><Th>Registrasi</Th><Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/20">
                    <Td>
                      <div className="font-semibold text-foreground">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                    </Td>
                    <Td>{u.username || "—"}</Td>
                    <Td>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.role !== "unknown" ? roleBadge[u.role as AppRole] : "bg-gray-100 text-gray-600"
                      }`}>{u.role}</span>
                    </Td>
                    <Td>{u.whatsapp || "—"}</Td>
                    <Td>
                      {u.status && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[u.status]}`}>
                          {u.status}
                        </span>
                      )}
                    </Td>
                    <Td>{u.registered_at ? new Date(u.registered_at).toLocaleDateString("id-ID") : "—"}</Td>
                    <Td className="text-right">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        {u.status === "pending" && (
                          <IconBtn title="Setujui" onClick={() => callAction.mutate({ action: "approve", target_user_id: u.id })}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </IconBtn>
                        )}
                        {u.status === "pending" && (
                          <IconBtn title="Tolak" onClick={() => callAction.mutate({ action: "reject", target_user_id: u.id })}>
                            <XCircle className="w-4 h-4 text-red-600" />
                          </IconBtn>
                        )}
                        {u.status === "approved" && (
                          <IconBtn title="Nonaktifkan" onClick={() => callAction.mutate({ action: "deactivate", target_user_id: u.id })}>
                            <Power className="w-4 h-4 text-orange-600" />
                          </IconBtn>
                        )}
                        {(u.status === "inactive" || u.status === "rejected") && (
                          <IconBtn title="Aktifkan" onClick={() => callAction.mutate({ action: "reactivate", target_user_id: u.id })}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </IconBtn>
                        )}
                        <IconBtn title="Kirim WhatsApp" onClick={() => sendWhatsApp(u)}>
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                        </IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditUser(u)}>
                          <Pencil className="w-4 h-4" />
                        </IconBtn>
                        <IconBtn title="Reset Password" onClick={() => setResetUser(u)}>
                          <KeyRound className="w-4 h-4 text-blue-600" />
                        </IconBtn>
                        {u.role === "penguji" && (
                          <AssignKelasDialog pengujiUserId={u.id} pengujiName={u.full_name || "Penguji"} />
                        )}
                        <IconBtn title="Hapus" onClick={() => {
                          if (confirm(`Hapus akun ${u.full_name}? Tindakan ini tidak bisa dibatalkan.`)) {
                            callAction.mutate({ action: "delete_user", target_user_id: u.id });
                          }
                        }}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </IconBtn>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="p-4 border-t border-border">
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        )}

        <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        <EditUserDialog user={editUser} onClose={() => setEditUser(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
      </main>
    </div>
  );
}

const Th = ({ children, className = "" }: any) => <th className={`px-3 py-2 text-xs font-semibold text-muted-foreground ${className}`}>{children}</th>;
const Td = ({ children, className = "" }: any) => <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
const IconBtn = ({ children, title, onClick }: any) => (
  <button title={title} onClick={onClick} className="p-1.5 rounded-md hover:bg-muted transition-colors">{children}</button>
);

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", whatsapp: "",
    password: "", role: "penguji" as AppRole, bio: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.full_name || !form.email || !form.password) return toast.error("Field wajib belum diisi");
    if (form.password.length < 8) return toast.error("Password minimal 8 karakter");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: form });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Akun dibuat");
      onCreated();
      onClose();
      setForm({ full_name: "", username: "", email: "", whatsapp: "", password: "", role: "penguji", bio: "" });
    } catch (e: any) {
      toast.error(getSafeErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tambah Akun Baru</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Field label="Nama Lengkap *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Nomor WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
          <Field label="Password *" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" showPasswordToggle />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
              {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-muted">Batal</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm gradient-islamic text-primary-foreground disabled:opacity-50">
            {busy ? "Membuat..." : "Buat"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({});
  const [role, setRole] = useState<AppRole>("penguji");
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "", username: user.username || "",
        whatsapp: user.whatsapp || "", email: user.email || "",
      });
      setRole((user.role as AppRole) || "penguji");
    }
  }, [user]);

  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke("admin-user-action", {
        body: { action: "update_profile", target_user_id: user.id, payload: form },
      });
      if (role !== user.role) {
        await supabase.functions.invoke("admin-user-action", {
          body: { action: "set_role", target_user_id: user.id, payload: { role } },
        });
      }
      toast.success("Profil tersimpan");
      onSaved(); onClose();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Akun</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Field label="Nama" value={form.full_name || ""} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Username" value={form.username || ""} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Email" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="WhatsApp" value={form.whatsapp || ""} onChange={(v) => setForm({ ...form, whatsapp: v })} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
              {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-muted">Batal</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm gradient-islamic text-primary-foreground disabled:opacity-50">
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const [mode, setMode] = useState<"temporary" | "link">("temporary");
  const [pwd, setPwd] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submit = async () => {
    setBusy(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-action", {
        body: { action: "reset_password", target_user_id: user.id, payload: { mode, password: pwd || undefined } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (mode === "temporary") setResult(`Password sementara: ${data.temporary_password}`);
      else setResult(`Link reset: ${data.action_link}`);
      toast.success("Selesai");
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && (setResult(null), setPwd(""), onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Reset Password — {user.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <button onClick={() => setMode("temporary")} className={`flex-1 px-3 py-2 rounded-md text-sm ${mode === "temporary" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              Password Sementara
            </button>
            <button onClick={() => setMode("link")} className={`flex-1 px-3 py-2 rounded-md text-sm ${mode === "link" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              Kirim Link Reset
            </button>
          </div>
          {mode === "temporary" && (
            <Field label="Password (kosongkan untuk acak)" value={pwd} onChange={setPwd} type="text" />
          )}
          {result && (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm break-all">
              {result}
              <p className="text-xs text-muted-foreground mt-2">Salin sekarang — tidak akan ditampilkan ulang.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={() => { setResult(null); setPwd(""); onClose(); }} className="px-4 py-2 rounded-md text-sm bg-muted">Tutup</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm gradient-islamic text-primary-foreground disabled:opacity-50">
            {busy ? "Memproses..." : "Eksekusi"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", showPasswordToggle = false }: any) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && showPasswordToggle ? (visible ? "text" : "password") : type;

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="relative">
        <input type={resolvedType} value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
            isPassword && showPasswordToggle ? "px-3 py-2 pr-10" : "px-3 py-2"
          }`} />
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setVisible((prev: boolean) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
