import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Settings2, Upload, X } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CertificateLayoutEditor from "@/components/CertificateLayoutEditor";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  loadCertificateLayout,
  type CertificateLayout,
} from "@/utils/certificateLayout";
import { renderCertificateImage } from "@/utils/certificateRenderer";
import {
  type CertificateData,
  type CertificatePdfFormat,
  buildCertificatePDF,
  safeFileName,
} from "@/utils/generateCertificatePDF";

interface CertificatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData | null;
}

const CertificatePreviewDialog = ({
  open,
  onOpenChange,
  data,
}: CertificatePreviewDialogProps) => {
  const { isAdmin } = useAuthContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pdfFormat, setPdfFormat] = useState<CertificatePdfFormat>("a4-landscape");
  const [layout, setLayout] = useState<CertificateLayout>(DEFAULT_CERTIFICATE_LAYOUT);
  const [leftLogo, setLeftLogo] = useState<string>();
  const [rightLogo, setRightLogo] = useState<string>();
  const [coordinatorSignature, setCoordinatorSignature] = useState<string>();
  const [principalSignature, setPrincipalSignature] = useState<string>();

  const customizedData = useMemo(
    () =>
      data
        ? {
            ...data,
            leftLogoDataUrl: leftLogo,
            rightLogoDataUrl: rightLogo,
            coordinatorSignatureDataUrl: coordinatorSignature,
            principalSignatureDataUrl: principalSignature,
          }
        : null,
    [data, leftLogo, rightLogo, coordinatorSignature, principalSignature],
  );

  const readImage = (
    file: File | undefined,
    setter: (value: string | undefined) => void,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!open) return;
    loadCertificateLayout()
      .then(setLayout)
      .catch((error) => console.error("Layout sertifikat gagal dimuat:", error));
  }, [open]);

  useEffect(() => {
    if (!open || !customizedData) {
      setPreviewUrl(null);
      return;
    }

    let active = true;
    setLoading(true);
    renderCertificateImage(customizedData, layout)
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch((error) => {
        console.error("Preview sertifikat gagal dibuat:", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, customizedData, layout]);

  const handleDownload = async () => {
    if (!customizedData) return;
    const doc = await buildCertificatePDF(customizedData, layout, pdfFormat);
    doc.save(`Sertifikat_${safeFileName(customizedData.studentName)}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-6xl gap-0 p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Preview Sertifikat - {data?.studentName ?? ""}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 border-b bg-background px-4 py-3 sm:grid-cols-4">
            {[
              ["Logo kiri", setLeftLogo],
              ["Logo kanan", setRightLogo],
              ["TTD Koordinator", setCoordinatorSignature],
              ["TTD Kepala Sekolah", setPrincipalSignature],
            ].map(([label, setter]) => (
              <label
                key={label as string}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {label as string}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) =>
                    readImage(
                      event.target.files?.[0],
                      setter as (value: string | undefined) => void,
                    )
                  }
                />
              </label>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
              Gunakan PNG transparan agar logo dan tanda tangan menyatu dengan template.
            </p>
          </div>

          <div className="flex h-[64vh] items-center justify-center overflow-auto bg-slate-100 p-3">
            {loading || !previewUrl ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Menyiapkan preview...
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={`Preview sertifikat ${data?.studentName ?? ""}`}
                className="max-h-full max-w-full border bg-white shadow-lg"
              />
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:gap-2">
            <Select
              value={pdfFormat}
              onValueChange={(value) => setPdfFormat(value as CertificatePdfFormat)}
            >
              <SelectTrigger className="mr-auto w-[210px]">
                <SelectValue placeholder="Format PDF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4-landscape">A4 Landscape (Cetak)</SelectItem>
                <SelectItem value="original">Rasio Asli 4:3</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-4 w-4" /> Tutup
            </Button>
            {isAdmin && customizedData && (
              <Button variant="outline" onClick={() => setEditorOpen(true)}>
                <Settings2 className="mr-1 h-4 w-4" /> Atur Layout
              </Button>
            )}
            <Button onClick={handleDownload} disabled={loading || !customizedData}>
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && customizedData && (
        <CertificateLayoutEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          data={customizedData}
          initialLayout={layout}
          onSaved={setLayout}
        />
      )}
    </>
  );
};

export default CertificatePreviewDialog;
