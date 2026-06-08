import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

interface Props {
  userId: string;
  currentPath?: string | null;
  bucket: "signatures" | "avatars";
  label: string;
  hint?: string;
  onChange: (path: string | null) => void;
}

export default function FileUploader({ userId, currentPath, bucket, label, hint, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentPath) { setPreview(null); return; }
      const { data } = await supabase.storage.from(bucket).createSignedUrl(currentPath, 3600);
      if (alive) setPreview(data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [currentPath, bucket]);

  const handleFile = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Hanya PNG atau JPG yang didukung");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran maksimal 2 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/${bucket === "signatures" ? "signature" : "avatar"}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      onChange(path);
      toast.success(`${label} berhasil diunggah`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunggah");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPath) return;
    setBusy(true);
    try {
      await supabase.storage.from(bucket).remove([currentPath]);
      onChange(null);
      toast.success(`${label} dihapus`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-4">
        <div className="h-24 w-40 rounded-md border border-dashed border-input bg-muted/30 flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{currentPath ? "Ganti" : "Unggah"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {currentPath && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}