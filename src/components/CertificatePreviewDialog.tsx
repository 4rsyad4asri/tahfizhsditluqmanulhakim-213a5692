import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, Upload, X } from "lucide-react";
import {
  type CertificateData,
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    let revoked: string | null = null;

    if (open && customizedData) {
      setLoading(true);
      buildCertificatePDF(customizedData)
        .then((doc) => {
          const blob = doc.output("blob");
          const url = URL.createObjectURL(blob);
          revoked = url;
          setBlobUrl(url);
        })
        .catch((err) => {
          console.error("Failed to build certificate PDF:", err);
        })
        .finally(() => setLoading(false));
    }

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      setBlobUrl(null);
    };
  }, [open, customizedData]);

  const handleDownload = async () => {
    if (!customizedData) return;
    const doc = await buildCertificatePDF(customizedData);
    doc.save(`Sertifikat_${safeFileName(customizedData.studentName)}.pdf`);
  };

  const handleOpenPreview = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Preview Sertifikat - {data?.studentName ?? ""}</span>
          </DialogTitle>
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

        <div className="bg-muted/30 px-2 py-2" style={{ height: "62vh" }}>
          {loading || !blobUrl ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Menyiapkan preview...
            </div>
          ) : (
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full rounded-md border border-border bg-white"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                <p>Browser memblokir preview PDF di dalam halaman ini.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleOpenPreview}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Buka Preview di Tab Baru
                </Button>
              </div>
            </object>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-row justify-end gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Tutup
          </Button>
          <Button variant="outline" onClick={handleOpenPreview} disabled={loading || !blobUrl}>
            <ExternalLink className="w-4 h-4 mr-1" /> Buka Preview
          </Button>
          <Button onClick={handleDownload} disabled={loading || !customizedData}>
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificatePreviewDialog;
