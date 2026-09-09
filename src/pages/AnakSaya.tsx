import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, ChevronRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useParentChildren } from "@/hooks/useParentChildren";

export default function AnakSaya() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading, isParent } = useAuthContext();
  const { data: children, isLoading } = useParentChildren();

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  // Satu anak -> langsung ke halaman anaknya
  useEffect(() => {
    if (!isLoading && children && children.length === 1 && !showForm) {
      navigate(`/siswa/${children[0].studentId}`, { replace: true });
    }
  }, [isLoading, children, showForm, navigate]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) {
      toast.error("Nama anak dan NIS/NISN wajib diisi");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("link_parent_student", {
      _child_name: name.trim(),
      _identifier: identifier.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Data anak tidak ditemukan");
      return;
    }
    const linked = Array.isArray(data) ? data[0] : data;
    toast.success(`Berhasil terhubung dengan ${linked?.student_name ?? "anak Anda"}`);
    setName("");
    setIdentifier("");
    setShowForm(false);
    await queryClient.invalidateQueries({ queryKey: ["parent-children"] });
    if (linked?.student_id) navigate(`/siswa/${linked.student_id}`);
  };

  const handleRemove = async (linkId: string) => {
    const { error } = await supabase.from("parent_students").delete().eq("id", linkId);
    if (error) {
      toast.error("Gagal menghapus data anak");
      return;
    }
    toast.success("Data anak dilepas dari akun Anda");
    await queryClient.invalidateQueries({ queryKey: ["parent-children"] });
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isParent && (children?.length ?? 0) === 0) {
    // tetap izinkan menghubungkan anak walau role belum terpasang
  }

  const list = children ?? [];
  const emptyState = list.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-islamic text-primary-foreground">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Data Anak Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hubungkan akun Anda dengan data anak menggunakan nama dan NIS/NISN.
        </p>
      </div>

      {!emptyState && (
        <div className="mb-4 space-y-2">
          {list.map((child) => (
            <div
              key={child.linkId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => navigate(`/siswa/${child.studentId}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{child.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Kelas {child.className} • NISN {child.nisn || child.nis || "-"}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleRemove(child.linkId)}
                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                  title="Lepas data anak"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}

      {(emptyState || showForm) ? (
        <form onSubmit={handleLink} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Tambah Anak</h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nama Anak *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap sesuai data sekolah"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">NIS atau NISN *</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Isi salah satu: NIS atau NISN"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold gradient-islamic text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {saving ? "Menghubungkan..." : "Hubungkan"}
            </button>
            {!emptyState && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input py-3 text-sm font-medium text-foreground hover:bg-accent"
        >
          <UserPlus className="h-4 w-4" /> Tambah Anak
        </button>
      )}
    </div>
  );
}
