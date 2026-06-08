import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, Loader2, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type RoleOpt = "guru" | "penguji" | "parent";

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

  const { data: classes } = useQuery({
    queryKey: ["classes-public"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id,name").order("grade").order("section");
      return data || [];
    },
  });

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-500 text-primary-foreground">
      <div className="w-full max-w-md">
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