import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Settings2, Upload, X } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { resolveCertificateSignatures } from "@/utils/officialSignatures";
import { formatStudentName } from "@/utils/formatName";

interface CertificatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData | null;
  coordinatorUserId?: string | null;
}

const CertificatePreviewDialog = ({
  open,
  onOpenChange,
  data,
  coordinatorUserId,
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
  const [profileCoordinatorSignature, setProfileCoordinatorSignature] = useState<string>();
  const [officialPrincipalSignature, setOfficialPrincipalSignature] = useState<string>();
  const [officialLeftLogo, setOfficialLeftLogo] = useState<string>();
  const [officialRightLogo, setOfficialRightLogo] = useState<string>();
  const [showOfficialLogos, setShowOfficialLogos] = useState(false);

  const customizedData = useMemo(
    () =>
      data
        ? {
            ...data,
            studentName: formatStudentName(data.studentName),
            leftLogoDataUrl: showOfficialLogos ? leftLogo || officialLeftLogo : undefined,
            rightLogoDataUrl: showOfficialLogos ? rightLogo || officialRightLogo : undefined,
            coordinatorSignatureDataUrl: coordinatorSignature || profileCoordinatorSignature,
            principalSignatureDataUrl: principalSignature || officialPrincipalSignature,
          }
        : null,
    [
      data,
      leftLogo,
      rightLogo,
      coordinatorSignature,
      principalSignature,
      profileCoordinatorSignature,
      officialPrincipalSignature,
      officialLeftLogo,
      officialRightLogo,
      showOfficialLogos,
    ],
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
    if (!open) return;
    let active = true;

    resolveCertificateSignatures(coordinatorUserId)
      .then((signatures) => {
        if (!active) return;
        setProfileCoordinatorSignature(signatures.coordinatorSignatureDataUrl);
        setOfficialPrincipalSignature(signatures.principalSignatureDataUrl);
        setOfficialLeftLogo(signatures.leftLogoDataUrl);
        setOfficialRightLogo(signatures.rightLogoDataUrl);
      })
      .catch((error) => {
        console.error("Tanda tangan sertifikat gagal dimuat:", error);
        if (!active) return;
        setProfileCoordinatorSignature(undefined);
        setOfficialPrincipalSignature(undefined);
        setOfficialLeftLogo(undefined);
        setOfficialRightLogo(undefined);
      });

    return () => {
      active = false;
    };
  }, [open, coordinatorUserId]);

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
            <DialogTitle>Preview Sertifikat - {formatStudentName(data?.studentName ?? "")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 border-b bg-background px-4 py-3 sm:grid-cols-4">
            <label className="col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium sm:col-span-4">
              <Switch
                checked={showOfficialLogos}
                onCheckedChange={setShowOfficialLogos}
              />
              Tampilkan logo resmi pada sertifikat
              <span className="text-muted-foreground">(default OFF)</span>
            </label>
            {[
              ["Logo kiri", setLeftLogo],
              ["Logo kanan", setRightLogo],
              ["TTD Koordinator", setCoordinatorSignature],
              ["TTD Kepala Sekolah", setPrincipalSignature],
            ].map(([label, setter]) => (
              <label
                key={label as string}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                  showOfficialLogos || (label !== "Logo kiri" && label !== "Logo kanan")
                    ? "cursor-pointer hover:bg-muted"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                <Upload className="h-4 w-4" />
                {label as string}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={!showOfficialLogos && (label === "Logo kiri" || label === "Logo kanan")}
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
                alt={`Preview sertifikat ${formatStudentName(data?.studentName ?? "")}`}
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
