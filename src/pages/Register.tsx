import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, Loader2, Search, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type RoleOpt = "guru" | "penguji" | "parent";
type ParentChildForm = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  search: string;
  nisn: string;
};
type PublicStudentOption = {
  id: string;
  name: string;
  class_id: string;
  classes: { name: string } | { name: string }[] | null;
};

const createChildForm = (): ParentChildForm => ({
  id: crypto.randomUUID(),
  studentId: "",
  studentName: "",
  className: "",
  search: "",
  nisn: "",
});

export default function Register() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState<RoleOpt>("penguji");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [parentChildren, setParentChildren] = useState<ParentChildForm[]>([createChildForm()]);

  const { data: classes } = useQuery({
    queryKey: ["classes-public"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id,name").order("grade").order("section");
      return data || [];
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-public-register"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,class_id,classes(name)")
        .order("name");
      if (error) throw error;
      return (data || []) as PublicStudentOption[];
    },
  });

  useEffect(() => {
    if (role === "parent" && parentChildren.length === 0) {
      setParentChildren([createChildForm()]);
    }
  }, [role, parentChildren.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !email || !whatsapp || !password) {
      toast.error("Semua field wajib diisi");
      return;
    }
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }

    const parentLinks = role === "parent"
      ? parentChildren.map((child, index) => ({
          index,
          student_id: child.studentId,
          nisn: child.nisn.trim(),
          search: child.search.trim(),
        }))
      : [];

    if (role === "parent") {
      if (parentLinks.length === 0) {
        toast.error("Data Anak wajib diisi minimal 1 anak");
        return;
      }

      for (const child of parentLinks) {
        if (!child.student_id) {
          toast.error(`Pilih siswa untuk Anak ${child.index + 1}`);
          return;
        }
        if (!child.nisn) {
          toast.error(`NISN Anak ${child.index + 1} wajib diisi`);
          return;
        }
      }

      const selectedIds = parentLinks.map((child) => child.student_id);
      if (new Set(selectedIds).size !== selectedIds.length) {
        toast.error("Siswa yang sama tidak boleh dipilih dua kali");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
            whatsapp: whatsapp.trim(),
            role,
            bio,
            assigned_classes: role === "guru" ? assignedClasses : undefined,
            parent_students: role === "parent"
              ? parentLinks.map(({ student_id, nisn }) => ({ student_id, nisn }))
              : undefined,
          },
        },
      });
      if (error) throw error;
      toast.success("Pendaftaran berhasil! Akun Anda menunggu persetujuan admin.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Gagal mendaftar");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleClass = (id: string) =>
    setAssignedClasses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addChildForm = () => {
    setParentChildren((prev) => [...prev, createChildForm()]);
  };

  const updateChild = (id: string, updates: Partial<ParentChildForm>) => {
    setParentChildren((prev) => prev.map((child) => (child.id === id ? { ...child, ...updates } : child)));
  };

  const removeChild = (id: string) => {
    setParentChildren((prev) => (prev.length > 1 ? prev.filter((child) => child.id !== id) : prev));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-500 text-primary-foreground">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-islamic text-primary-foreground mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Pendaftaran Akun</h1>
          <p className="text-sm text-muted-foreground mt-1">SDIT Luqmanul Hakim</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border shadow-card p-6 space-y-3">
          <Field label="Nama Lengkap *" value={fullName} onChange={setFullName} />
          <Field label="Username *" value={username} onChange={setUsername} placeholder="huruf kecil, tanpa spasi" />
          <Field label="Email *" value={email} onChange={setEmail} type="email" />
          <Field label="Nomor WhatsApp *" value={whatsapp} onChange={setWhatsapp} placeholder="6281234567890" />

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Jenis Akun *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleOpt)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="penguji">Penguji</option>
              <option value="guru">Guru</option>
              <option value="parent">Orang Tua</option>
            </select>
          </div>

          {role === "guru" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Kelas/Rombel yang Diampu</label>
              <div className="max-h-32 overflow-auto rounded-md border border-input p-2 space-y-1">
                {(classes || []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assignedClasses.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {role === "parent" && (
            <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Data Anak</h2>
                  <p className="text-xs text-muted-foreground">Pilih siswa lalu isi NISN anak untuk validasi.</p>
                </div>
                <button
                  type="button"
                  onClick={addChildForm}
                  className="shrink-0 rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
                >
                  + Tambah Anak
                </button>
              </div>

              <div className="space-y-3">
                {parentChildren.map((child, index) => (
                  <ParentChildFields
                    key={child.id}
                    child={child}
                    index={index}
                    students={students || []}
                    studentsLoading={studentsLoading}
                    selectedStudentIds={parentChildren
                      .filter((entry) => entry.id !== child.id)
                      .map((entry) => entry.studentId)
                      .filter(Boolean)}
                    onChange={(updates) => updateChild(child.id, updates)}
                    onRemove={() => removeChild(child.id)}
                    canRemove={parentChildren.length > 1}
                  />
                ))}
              </div>
            </section>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Biodata Singkat</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Field label="Password *" value={password} onChange={setPassword} type="password" placeholder="Minimal 8 karakter" />
          <Field label="Konfirmasi Password *" value={confirm} onChange={setConfirm} type="password" />

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {submitting ? "Mendaftar..." : "Daftar"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function ParentChildFields({
  child,
  index,
  students,
  studentsLoading,
  selectedStudentIds,
  onChange,
  onRemove,
  canRemove,
}: {
  child: ParentChildForm;
  index: number;
  students: PublicStudentOption[];
  studentsLoading: boolean;
  selectedStudentIds: string[];
  onChange: (updates: Partial<ParentChildForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const normalizedSearch = child.search.trim().toLowerCase();
  const filteredStudents = normalizedSearch.length < 2
    ? []
    : students
        .filter((student) => {
          if (selectedStudentIds.includes(student.id)) return false;
          const className = getClassName(student.classes);
          return `${student.name} ${className}`.toLowerCase().includes(normalizedSearch);
        })
        .slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Anak {index + 1}</p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Hapus
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">Cari Nama Anak *</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={child.search}
            placeholder="Ketik minimal 2 huruf"
            onChange={(e) =>
              onChange({
                search: e.target.value,
                studentId: "",
                studentName: "",
                className: "",
              })
            }
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {child.studentId && (
            <p className="mt-2 text-xs text-emerald-600">
              Terpilih: {child.studentName}
              {child.className ? ` - ${child.className}` : ""}
            </p>
          )}
        </div>

        {!child.studentId && normalizedSearch.length >= 2 && (
          <div className="rounded-md border border-input bg-background">
            {studentsLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Memuat data siswa...</p>
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map((student) => {
                const className = getClassName(student.classes);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        studentId: student.id,
                        studentName: student.name,
                        className,
                        search: student.name,
                      })
                    }
                    className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span className="font-medium text-foreground">{student.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{className || "Tanpa kelas"}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-xs text-destructive">Siswa tidak ditemukan atau sudah dipilih.</p>
            )}
          </div>
        )}
      </div>

      <Field
        label="NISN Anak *"
        value={child.nisn}
        onChange={(value) => onChange({ nisn: value.replace(/\D/g, "") })}
        placeholder="Masukkan NISN untuk validasi"
      />
    </div>
  );
}

function getClassName(classes: PublicStudentOption["classes"]) {
  if (Array.isArray(classes)) return classes[0]?.name || "";
  return classes?.name || "";
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
