import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Loader2, Save, User, PenTool } from "lucide-react";
import FileUploader from "@/components/profile/SignatureUploader";
import {
  loadOfficialSignatureSettings,
  saveOfficialSignatureSettings,
} from "@/utils/officialSignatures";

export default function Profile() {
  const { user, profile, role } = useAuthContext();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", username: "", whatsapp: "", bio: "",
    title: "", jabatan: "", display_name_rapor: "", display_name_certificate: "",
  });
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [headmasterSignaturePath, setHeadmasterSignaturePath] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || "",
      username: profile.username || "",
      whatsapp: profile.whatsapp || "",
      bio: profile.bio || "",
      title: profile.title || "",
      jabatan: profile.jabatan || "",
      display_name_rapor: profile.display_name_rapor || "",
      display_name_certificate: profile.display_name_certificate || "",
    });
    setAvatarPath(profile.avatar_url || null);
    setSignaturePath(profile.signature_url || null);
  }, [profile]);

  useEffect(() => {
    if (role !== "admin") return;
    let alive = true;

    loadOfficialSignatureSettings()
      .then((settings) => {
        if (alive) setHeadmasterSignaturePath(settings.headmasterSignaturePath || null);
      })
      .catch((error) => console.error("Gagal memuat TTD kepala sekolah:", error));

    return () => {
      alive = false;
    };
  }, [role]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-10 text-center text-muted-foreground">Silakan login.</div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        ...form,
        avatar_url: avatarPath,
        signature_url: signaturePath,
      }).eq("id", user.id);
      if (error) throw error;
      if (role === "admin") {
        await saveOfficialSignatureSettings({
          headmasterSignaturePath,
        });
      }
      toast.success("Profil tersimpan");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const showWorkFields = role === "guru" || role === "penguji" || role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-primary" /> Profil Saya
          </h2>
          <p className="text-sm text-muted-foreground">Kelola identitas dan tanda tangan digital Anda.</p>
        </div>

        <section className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-card">
          <h3 className="font-semibold text-foreground">Identitas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput label="Nama Lengkap" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <TextInput label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            <TextInput label="Email" value={user.email || ""} onChange={() => {}} disabled />
            <TextInput label="Nomor WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Biodata</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <FileUploader
            userId={user.id}
            currentPath={avatarPath}
            bucket="avatars"
            label="Foto Profil"
            onChange={setAvatarPath}
          />
        </section>

        {showWorkFields && (
          <section className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-card">
            <h3 className="font-semibold text-foreground">Data Resmi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Gelar (mis. S.Pd)" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <TextInput label="Jabatan" value={form.jabatan} onChange={(v) => setForm({ ...form, jabatan: v })} />
              <TextInput label="Nama Tampilan Rapor" value={form.display_name_rapor} onChange={(v) => setForm({ ...form, display_name_rapor: v })} />
              <TextInput label="Nama Tampilan Sertifikat" value={form.display_name_certificate} onChange={(v) => setForm({ ...form, display_name_certificate: v })} />
            </div>
          </section>
        )}

        {showWorkFields && (
          <section className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-card">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <PenTool className="w-5 h-5 text-primary" /> Tanda Tangan Digital
            </h3>
            <FileUploader
              userId={user.id}
              currentPath={signaturePath}
              bucket="signatures"
              label="Tanda Tangan Saya"
              hint="Dipakai otomatis sebagai TTD Penguji, Guru Tahfizh, atau Koordinator Tahfizh sesuai akun Anda."
              onChange={setSignaturePath}
            />
          </section>
        )}

        {role === "admin" && (
          <section className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-card">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <PenTool className="w-5 h-5 text-primary" /> Tanda Tangan Kepala Sekolah
            </h3>
            <p className="text-xs text-muted-foreground">
              Upload ini terpisah dari TTD profil admin. Dipakai otomatis sebagai TTD Kepala Sekolah di semua PDF rapor dan sertifikat.
            </p>
            <FileUploader
              userId={user.id}
              currentPath={headmasterSignaturePath}
              bucket="signatures"
              label="TTD Kepala Sekolah"
              hint="Gunakan PNG transparan untuk hasil terbaik (maks 2 MB)."
              fileStem="headmaster-signature"
              onChange={setHeadmasterSignaturePath}
            />
          </section>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold gradient-islamic text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </main>
    </div>
  );
}

function TextInput({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </div>
  );
}
