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
  normalizeCertificateLayout,
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
  layoutOverride?: CertificateLayout | null;
  lockLayout?: boolean;
  ujianId?: string;
  studentId?: string | null;
  layoutMode?: "global" | "student_override" | "published_snapshot";
  onLayoutOverrideSaved?: (layout: CertificateLayout | null) => void;
}

const LAYOUT_MODE_LABELS = {
  global: "Template Global",
  student_override: "Layout Khusus Siswa Ini",
  published_snapshot: "Snapshot Published",
} as const;

const CertificatePreviewDialog = ({
  open,
  onOpenChange,
  data,
  coordinatorUserId,
  layoutOverride,
  lockLayout = false,
  ujianId,
  studentId,
  layoutMode = "global",
  onLayoutOverrideSaved,
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
  const [coordinatorName, setCoordinatorName] = useState("-");
  const [showOfficialLogos, setShowOfficialLogos] = useState(false);
  const [showCoordinatorIdentity, setShowCoordinatorIdentity] = useState(false);
  const [showPrincipalIdentity, setShowPrincipalIdentity] = useState(false);

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
            coordinatorName: data.coordinatorName || coordinatorName,
            showCoordinatorIdentity,
            showPrincipalIdentity,
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
      coordinatorName,
      showOfficialLogos,
      showCoordinatorIdentity,
      showPrincipalIdentity,
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
    setShowOfficialLogos(false);
    setShowCoordinatorIdentity(false);
    setShowPrincipalIdentity(false);
    if (layoutOverride) {
      setLayout(normalizeCertificateLayout(layoutOverride));
      return;
    }
    loadCertificateLayout()
      .then(setLayout)
      .catch((error) => console.error("Layout sertifikat gagal dimuat:", error));
  }, [open, layoutOverride]);

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
        setCoordinatorName(signatures.coordinatorName);
      })
      .catch((error) => {
        console.error("Tanda tangan sertifikat gagal dimuat:", error);
        if (!active) return;
        setProfileCoordinatorSignature(undefined);
        setOfficialPrincipalSignature(undefined);
        setOfficialLeftLogo(undefined);
        setOfficialRightLogo(undefined);
        setCoordinatorName("-");
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
        <DialogContent className="grid h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg p-0 sm:h-[96dvh] sm:w-[96vw]">
          <DialogHeader className="border-b px-4 py-3 pr-12 sm:px-6 sm:py-4">
            <DialogTitle className="truncate text-left text-base sm:text-lg">
              Preview Sertifikat - {formatStudentName(data?.studentName ?? "")}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {LAYOUT_MODE_LABELS[layoutMode]}
              </span>
              {lockLayout && (
                <span className="text-xs text-muted-foreground">
                  Sertifikat sudah dipublish. Layout memakai snapshot resmi.
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="grid max-h-[34dvh] grid-cols-2 gap-2 overflow-y-auto border-b bg-background px-3 py-2 sm:max-h-none sm:grid-cols-4 sm:px-4 sm:py-3">
            <label className="col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium sm:col-span-4">
              <Switch
                checked={showOfficialLogos}
                onCheckedChange={setShowOfficialLogos}
              />
              Tampilkan logo resmi pada sertifikat
              <span className="text-muted-foreground">(default OFF)</span>
            </label>
            <label className="col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium sm:col-span-2">
              <Switch
                checked={showCoordinatorIdentity}
                onCheckedChange={setShowCoordinatorIdentity}
              />
              Tampilkan jabatan dan nama Koordinator Tahfizh
              <span className="text-muted-foreground">(default OFF)</span>
            </label>
            <label className="col-span-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium sm:col-span-2">
              <Switch
                checked={showPrincipalIdentity}
                onCheckedChange={setShowPrincipalIdentity}
              />
              Tampilkan jabatan dan nama Kepala Sekolah
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

          <div className="flex min-h-0 items-center justify-center overflow-hidden bg-slate-100 p-2 sm:p-3">
            {loading || !previewUrl ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Menyiapkan preview...
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={`Preview sertifikat ${formatStudentName(data?.studentName ?? "")}`}
                className="h-full w-full border bg-white object-contain shadow-lg"
              />
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 border-t px-3 py-3 sm:flex sm:flex-row sm:px-6 sm:py-4">
            <Select
              value={pdfFormat}
              onValueChange={(value) => setPdfFormat(value as CertificatePdfFormat)}
            >
              <SelectTrigger className="col-span-2 w-full sm:mr-auto sm:w-[210px]">
                <SelectValue placeholder="Format PDF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4-landscape">A4 Landscape (Cetak)</SelectItem>
                <SelectItem value="legal-landscape">F4 / Legal 8.5 x 14 in</SelectItem>
                <SelectItem value="original">Rasio Asli 4:3</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-4 w-4" /> Tutup
            </Button>
            {isAdmin && customizedData && !lockLayout && (
              <Button className="w-full" variant="outline" onClick={() => setEditorOpen(true)}>
                <Settings2 className="mr-1 h-4 w-4" /> Atur Layout
              </Button>
            )}
            <Button
              className={isAdmin ? "col-span-2 w-full sm:col-span-1" : "w-full"}
              onClick={handleDownload}
              disabled={loading || !customizedData}
            >
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && customizedData && !lockLayout && (
        <CertificateLayoutEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          data={customizedData}
          initialLayout={layout}
          onSaved={setLayout}
          ujianId={ujianId}
          studentId={studentId}
          layoutMode={layoutMode}
          onLayoutOverrideSaved={onLayoutOverrideSaved}
        />
      )}
    </>
  );
};

export default CertificatePreviewDialog;
