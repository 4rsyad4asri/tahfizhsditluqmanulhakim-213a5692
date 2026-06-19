import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateTahfizhAssessmentsForDisplay,
  normalizeTahfizhPayload,
  toSafeNumber,
  type TahfizhPenaltyConfig,
  type TahfizhSurahAssessment,
} from "@/data/tahfizhSystem";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2, Download, Filter, CheckCircle2, XCircle, Edit2, X, Eye, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportJsonToExcel } from "@/utils/excel";
import {
  buildCertificatePDF,
  safeFileName,
  type CertificateData,
} from "@/utils/generateCertificatePDF";
import CertificatePreviewDialog from "@/components/CertificatePreviewDialog";
import {
  buildVerificationUrl,
  isLegacyTahfizhCertificateCandidate,
  usesLegacyTahfizhScoring,
} from "@/utils/verificationUrl";
import { buildReportDocumentNumber } from "@/utils/documentNumber";
import { resolveCertificateSignatures } from "@/utils/officialSignatures";
import { formatStudentName } from "@/utils/formatName";
import {
  loadCertificateLayout,
  normalizeCertificateLayout,
  type CertificateLayout,
} from "@/utils/certificateLayout";
import type { Json } from "@/integrations/supabase/types";
import {
  downloadBulkCertificatePDF,
  type BulkCertificateItem,
} from "@/utils/generateBulkCertificatePDF";
import type { CertificatePdfFormat } from "@/utils/generateCertificatePDF";
import { publishTahfizhDocument } from "@/utils/publishTahfizhDocument";
import { resolveExamClassName, resolveExamGrade } from "@/utils/examSnapshot";

type PublishStatus = "belum_publish" | "published" | "revised" | "cancelled";

interface RekapItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  classGrade: number;
  certificateSequence: number | null;
  juz: string;
  nilaiAkhir: number;
  predikat: string;
  tanggal: string;
  nomorSertifikat: string;
  status: string;
  verificationToken?: string | null;
  assessedBy?: string | null;
  forceIncluded?: boolean;
  certificateId?: string;
  publishStatus: PublishStatus;
  publishedAt?: string | null;
  publishedBy?: string | null;
  documentNumber?: string | null;
  layoutSnapshot?: CertificateLayout | null;
  layoutOverride?: CertificateLayout | null;
  hasLayoutOverride: boolean;
  coordinatorNameSnapshot?: string | null;
  principalNameSnapshot?: string | null;
}

interface EditModalState {
  isOpen: boolean;
  ujianId: string | null;
  certificateId: string | null;
  publishStatus: PublishStatus;
  studentName: string;
  currentNomorSertifikat: string;
  newNomorSertifikat: string;
}

const BULAN_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const DEFAULT_PRINCIPAL_NAME = "Amrullah Rozy Dalimunthe, S.Si";

const generateNomorSertifikat = (tanggal: string, index: number): string => {
  const date = new Date(tanggal);
  const month = date.getMonth() + 1;
  const bulanRoman = BULAN_ROMAN[month];
  const nomorUrut = index + 134; // Mulai dari 134
  
  return `${nomorUrut}/SDITLH/STQ/2526/${bulanRoman}/2026`;
};

const hasCertificateNumber = (ujian: any) =>
  typeof ujian?.nomor_sertifikat === "string" &&
  ujian.nomor_sertifikat.trim().length > 0;

const isExplicitTahfizhRegularExam = (ujian: any) => {
  const aspek = ujian?.nilai_aspek || {};
  return (
    aspek.tahfizhMode === "Reguler" ||
    aspek.verificationType === "tahfizh-reguler"
  );
};

const toPublishStatus = (status?: string | null): PublishStatus => {
  if (status === "published" || status === "revised" || status === "cancelled") {
    return status;
  }
  return "belum_publish";
};

const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  belum_publish: "Belum Publish",
  published: "Published",
  revised: "Revised",
  cancelled: "Cancelled",
};

const PUBLISH_STATUS_CLASSES: Record<PublishStatus, string> = {
  belum_publish: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  published: "border-success/30 bg-success/10 text-success",
  revised: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const hasCertificateMetadata = (ujian: any) => {
  const aspek = ujian?.nilai_aspek || {};
  return (
    aspek.tahfizhMode === "Sertifikat" ||
    aspek.verificationType === "sertifikat-tahfizh" ||
    aspek.reportType === "summary"
  );
};

const hasLegacyCertificateResult = (ujian: any) =>
  ujian?.mode === "Tahfizh" &&
  ujian?.status === "Lulus" &&
  !isExplicitTahfizhRegularExam(ujian);

const normalizeStudentName = (name?: string) =>
  (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const isForcedCertificateStudent = (student?: { name?: string | null }) => {
  const name = normalizeStudentName(student?.name || "");
  return (
    name.includes("zahidaqonita") ||
    name.includes("zahidahqonita") ||
    name.includes("husnafathania") ||
    name.includes("husnafhataniah")
  );
};

const shouldShowInCertificateRecap = (ujian: any, student?: { name?: string | null }) => {
  if (ujian?.mode !== "Tahfizh") return false;
  if (isForcedCertificateStudent(student)) return true;
  if (isExplicitTahfizhRegularExam(ujian)) return false;

  return (
    hasCertificateMetadata(ujian) ||
    hasCertificateNumber(ujian) ||
    hasLegacyCertificateResult(ujian) ||
    isLegacyTahfizhCertificateCandidate({
      mode: ujian.mode,
      tahfizhMode: ujian?.nilai_aspek?.tahfizhMode,
      verificationType: ujian?.nilai_aspek?.verificationType,
      assessedBy: ujian.assessed_by,
      tanggal: ujian.tanggal,
    })
  );
};

const getSyncedTahfizhCertificateResult = (
  ujian: any,
): {
  entries: TahfizhSurahAssessment[];
  nilaiAkhir: number;
  predikat: string;
  grade: string;
  status: "Lulus" | "Tidak Lulus";
} => {
  const aspek = ujian.nilai_aspek as any;
  const rawEntries = Array.isArray(aspek?.surahEntries)
    ? aspek.surahEntries
    : Array.isArray(aspek?.entries)
      ? aspek.entries
      : [];
  const entries = aggregateTahfizhAssessmentsForDisplay(rawEntries) as TahfizhSurahAssessment[];

  if (entries.length === 0) {
    return {
      entries: [],
      nilaiAkhir: toSafeNumber(ujian.nilai_akhir, 0),
      predikat: aspek?.predikat || "-",
      grade: ujian.grade || "-",
      status: ujian.status || "Tidak Lulus",
    };
  }

  const legacyScoring = usesLegacyTahfizhScoring({
    mode: ujian.mode,
    assessedBy: ujian.assessed_by,
    tanggal: ujian.tanggal,
  });
  const normalized = normalizeTahfizhPayload({
    entries,
    nilaiAspek: aspek,
    tahfizhMode: "Sertifikat",
    config: aspek?.config as TahfizhPenaltyConfig | undefined,
    manualStopReason: legacyScoring ? "" : aspek?.manualStopReason || "",
    ignoreAutoFail: legacyScoring,
    autoFailConfig: aspek?.autoFailConfig,
  });

  return {
    entries: normalized.assessments,
    nilaiAkhir: normalized.nilaiAkhir,
    predikat: normalized.predikat,
    grade: normalized.grade,
    status: normalized.status,
  };
};

const RekapSertifikat = () => {
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [filterJuz, setFilterJuz] = useState<string>("all");
  const [filterPublish, setFilterPublish] = useState<PublishStatus | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkPdfFormat, setBulkPdfFormat] = useState<CertificatePdfFormat>("a4-landscape");
  const [previewItem, setPreviewItem] = useState<RekapItem | null>(null);
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    ujianId: null,
    certificateId: null,
    publishStatus: "belum_publish",
    studentName: "",
    currentNomorSertifikat: "",
    newNomorSertifikat: "",
  });
  const { role, user } = useAuthContext();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["rekap-sertifikat", showAll],
    queryFn: async () => {
      const query = supabase
        .from("ujian")
        .select("*")
        .eq("mode", "Tahfizh")
        .order("tanggal", { ascending: true })
        .order("created_at", { ascending: true }); // Urutan asli tetap stabil pada tanggal yang sama

      const { data: ujianData, error: ujianError } = await query;
      if (ujianError) throw ujianError;

      const studentIds = [...new Set((ujianData || []).map((u) => u.student_id))];
      if (studentIds.length === 0) return { items: [] as RekapItem[], classes: [] as string[] };
      const ujianIds = (ujianData || []).map((u) => u.id);

      const [{ data: students }, certificateResult, overrideResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, name, class_id, status_sertifikasi")
          .in("id", studentIds),
        supabase
          .from("tahfizh_certificates")
          .select("*")
          .in("ujian_id", ujianIds),
        supabase
          .from("tahfizh_certificate_layout_overrides")
          .select("ujian_id, layout")
          .in("ujian_id", ujianIds),
      ]);
      const certificatesAvailable = !certificateResult.error;
      if (certificateResult.error) {
        console.warn(
          "Tabel publish sertifikat belum tersedia, memakai data rekap lama:",
          certificateResult.error,
        );
      }
      const certificates = certificateResult.data || [];
      if (overrideResult.error) {
        console.warn(
          "Layout khusus siswa belum tersedia, memakai template global:",
          overrideResult.error,
        );
      }
      const layoutOverrides = overrideResult.data || [];

      const classIds = [...new Set((students || []).map((s) => s.class_id))];
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, grade, section")
        .in("id", classIds);

      const studentMap = new Map((students || []).map((s) => [s.id, s]));
      const classMap = new Map((classes || []).map((c) => [c.id, c]));
      const certificateMap = new Map(certificates.map((certificate) => [
        certificate.ujian_id,
        certificate,
      ]));
      const layoutOverrideMap = new Map(layoutOverrides.map((override) => [
        override.ujian_id,
        normalizeCertificateLayout(override.layout),
      ]));
      const certificateUjianData = (ujianData || []).filter((u) =>
        shouldShowInCertificateRecap(u, studentMap.get(u.student_id))
      );

      // Buat array dengan nomor urut berdasarkan urutan input
      let lulusIndex = 0;
      const itemsWithSequence: Array<any> = certificateUjianData.map((u) => {
        const student = studentMap.get(u.student_id);
        const cls = student ? classMap.get(student.class_id) : null;
        const classGrade = resolveExamGrade(u, cls?.grade);
        const syncedResult = getSyncedTahfizhCertificateResult(u);
        const entries = syncedResult.entries;
        const juzList = [
          ...new Set(
            entries
              .map((entry: any) => String(entry.juz ?? "").trim())
              .filter(Boolean),
          ),
        ];
        const forceIncluded = isForcedCertificateStudent(student);
        const isLulus = syncedResult.status === "Lulus";
        const receivesCertificateNumber = isLulus || forceIncluded;
        const certificate = certificateMap.get(u.id);
        const layoutOverride = layoutOverrideMap.get(u.id) || null;

        const sequenceNumber = receivesCertificateNumber ? lulusIndex++ : -1;

        // Gunakan nomor sertifikat dari database jika sudah ada, jika tidak generate otomatis
        const nomorSertifikatFromDb = u.nomor_sertifikat;
        const nomorSertifikat = receivesCertificateNumber
          ? (nomorSertifikatFromDb || generateNomorSertifikat(u.tanggal, sequenceNumber))
          : "-";

        const item: RekapItem = {
          id: u.id,
          studentId: u.student_id,
          studentName: formatStudentName(
            certificate?.student_name_snapshot || student?.name || "Unknown",
          ),
          className: certificate?.class_name_snapshot || resolveExamClassName(u, cls) || "Unknown",
          classGrade,
          certificateSequence: receivesCertificateNumber ? sequenceNumber + 1 : null,
          juz: certificate?.juz_snapshot || (juzList.length > 0 ? juzList.join(", ") : "-"),
          nilaiAkhir: certificate
            ? Number(certificate.final_score_snapshot)
            : syncedResult.nilaiAkhir,
          predikat: certificate?.predicate_snapshot || syncedResult.predikat,
          tanggal: certificate?.issued_date || u.tanggal,
          nomorSertifikat: certificate?.certificate_number || nomorSertifikat,
          status: syncedResult.status,
          verificationToken: certificate?.verification_token ?? u.verification_token ?? null,
          assessedBy: certificate?.coordinator_user_id ?? u.assessed_by ?? null,
          forceIncluded,
          certificateId: certificate?.id,
          publishStatus: toPublishStatus(certificate?.status),
          publishedAt: certificate?.published_at ?? null,
          publishedBy: certificate?.published_by ?? null,
          documentNumber: certificate?.document_number ?? null,
          layoutSnapshot: certificate?.layout_snapshot
            ? normalizeCertificateLayout(certificate.layout_snapshot)
            : null,
          layoutOverride,
          hasLayoutOverride: Boolean(layoutOverride),
          coordinatorNameSnapshot: certificate?.coordinator_name_snapshot ?? null,
          principalNameSnapshot: certificate?.principal_name_snapshot ?? null,
        };
        return item;
      });

      // Reverse untuk menampilkan yang terakhir diinput di atas
      const allItems = itemsWithSequence.reverse();
      const items = showAll
        ? allItems
        : allItems.filter((item) => item.status === "Lulus" || item.forceIncluded);

      const uniqueClasses = [...new Set(items.map((i) => i.className))].sort();
      return {
        items,
        classes: uniqueClasses,
        certificatesAvailable,
      };
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ ujianId, studentId, newStatus }: { ujianId: string; studentId: string; newStatus: "Lulus" | "Tidak Lulus" }) => {
      const { error: ujianError } = await supabase
        .from("ujian")
        .update({ status: newStatus })
        .eq("id", ujianId);
      if (ujianError) throw ujianError;

      const { error: studentError } = await supabase
        .from("students")
        .update({ status_sertifikasi: newStatus })
        .eq("id", studentId);
      if (studentError) throw studentError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      toast({
        title: "Status diperbarui",
        description: `Status berhasil diubah ke "${variables.newStatus}"`,
      });
    },
    onError: () => {
      toast({ title: "Gagal", description: "Gagal mengubah status", variant: "destructive" });
    },
  });

  const publishCertificateMutation = useMutation({
    mutationFn: async (item: RekapItem) => {
      const requiredText = [
        item.studentName,
        item.className,
        item.juz,
        item.predikat,
        item.tanggal,
        item.nomorSertifikat,
      ];
      if (
        requiredText.some((value) => !value?.trim() || value.trim() === "-")
        || !Number.isFinite(item.nilaiAkhir)
      ) {
        throw new Error("Data wajib sertifikat belum lengkap");
      }
      if (!user?.id) throw new Error("Sesi admin tidak tersedia");

      const publishedDocument = await publishTahfizhDocument({
        ujianId: item.id,
        certificateNumber: item.nomorSertifikat,
      });
      const documentNumber = buildReportDocumentNumber(
        "Tahfizh",
        item.id,
        publishedDocument.publishedAt,
        item.tanggal,
      );
      const [globalLayout, signatures] = await Promise.all([
        item.layoutOverride ? Promise.resolve(null) : loadCertificateLayout(),
        resolveCertificateSignatures(item.assessedBy),
      ]);
      const layout = item.layoutOverride || globalLayout;
      if (!layout) throw new Error("Layout sertifikat tidak tersedia");

      const { error: insertError } = await supabase
        .from("tahfizh_certificates")
        .insert({
          ujian_id: item.id,
          student_id: item.studentId,
          student_name_snapshot: item.studentName,
          class_name_snapshot: item.className,
          juz_snapshot: item.juz,
          final_score_snapshot: item.nilaiAkhir,
          predicate_snapshot: item.predikat,
          certificate_number: item.nomorSertifikat,
          document_number: documentNumber,
          verification_token: publishedDocument.verificationToken,
          coordinator_user_id: item.assessedBy || null,
          coordinator_name_snapshot: signatures.coordinatorName || "-",
          principal_name_snapshot: DEFAULT_PRINCIPAL_NAME,
          issued_date: item.tanggal,
          layout_snapshot: layout as unknown as Json,
          status: "published",
          published_by: user.id,
        });
      if (insertError) throw insertError;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["student-detail", item.studentId] });
      queryClient.invalidateQueries({ queryKey: ["rekap-ujian-global"] });
      toast({
        title: "Dokumen dan sertifikat dipublish",
        description: "Dokumen verifikasi dan snapshot resmi berhasil dipublish serta dikunci.",
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Publish gagal",
        description: error instanceof Error ? error.message : "Gagal mempublish sertifikat",
        variant: "destructive",
      });
    },
  });

  const editNomorSertifikatMutation = useMutation({
    mutationFn: async ({
      ujianId,
      nomorSertifikat,
      certificateId,
      publishStatus,
    }: {
      ujianId: string;
      nomorSertifikat: string;
      certificateId: string | null;
      publishStatus: PublishStatus;
    }) => {
      const shouldRevisePublishedCertificate =
        Boolean(certificateId) &&
        (publishStatus === "published" || publishStatus === "revised");

      const operations: PromiseLike<{ error: Error | null }>[] = [
        supabase
          .from("ujian")
          .update({ nomor_sertifikat: nomorSertifikat })
          .eq("id", ujianId),
      ];

      if (shouldRevisePublishedCertificate && certificateId) {
        operations.push(
          supabase
            .from("tahfizh_certificates")
            .update({
              certificate_number: nomorSertifikat,
              status: "revised",
            })
            .eq("id", certificateId),
        );
      }

      const results = await Promise.all(operations);
      const failedOperation = results.find((result) => result.error);
      if (failedOperation?.error) {
        throw failedOperation.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
      queryClient.invalidateQueries({ queryKey: ["student-detail"] });
      queryClient.invalidateQueries({ queryKey: ["rekap-ujian-global"] });
      toast({
        title: "Berhasil",
        description: "Nomor sertifikat berhasil direvisi",
      });
      setEditModal({
        isOpen: false,
        ujianId: null,
        certificateId: null,
        publishStatus: "belum_publish",
        studentName: "",
        currentNomorSertifikat: "",
        newNomorSertifikat: "",
      });
    },
    onError: () => {
      toast({
        title: "Gagal",
        description: "Gagal mengubah nomor sertifikat",
        variant: "destructive",
      });
    },
  });

  const openEditModal = (
    ujianId: string,
    certificateId: string | null,
    studentName: string,
    currentNomorSertifikat: string,
    publishStatus: PublishStatus,
  ) => {
    if (!isAdmin) {
      return;
    }
    if (publishStatus === "published" || publishStatus === "revised") {
      const confirmed = confirm(
        `Sertifikat ${studentName} sudah ${publishStatus}. Revisi ini hanya akan mengubah nomor sertifikat dokumen published. Lanjutkan?`,
      );
      if (!confirmed) return;
    }
    setEditModal({
      isOpen: true,
      ujianId,
      certificateId,
      publishStatus,
      studentName,
      currentNomorSertifikat,
      newNomorSertifikat: currentNomorSertifikat,
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      ujianId: null,
      certificateId: null,
      publishStatus: "belum_publish",
      studentName: "",
      currentNomorSertifikat: "",
      newNomorSertifikat: "",
    });
  };

  const handleSaveNomorSertifikat = () => {
    if (!editModal.ujianId || !editModal.newNomorSertifikat.trim()) {
      toast({
        title: "Gagal",
        description: "Nomor sertifikat tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    if (
      editModal.newNomorSertifikat === editModal.currentNomorSertifikat
    ) {
      toast({
        title: "Tidak ada perubahan",
        description: "Nomor sertifikat sama dengan sebelumnya",
        variant: "destructive",
      });
      return;
    }

    if (
      confirm(
        `Ubah nomor sertifikat ${editModal.studentName} dari:\n"${editModal.currentNomorSertifikat}"\n\nmenjadi:\n"${editModal.newNomorSertifikat}"?`
      )
    ) {
      editNomorSertifikatMutation.mutate({
        ujianId: editModal.ujianId,
        nomorSertifikat: editModal.newNomorSertifikat,
        certificateId: editModal.certificateId,
        publishStatus: editModal.publishStatus,
      });
    }
  };

  const handlePublish = (item: RekapItem) => {
    if (data?.certificatesAvailable === false) {
      toast({
        title: "Sistem publish belum aktif",
        description:
          "Data sertifikat tetap aman dan dapat dilihat. Migration database publish perlu diterapkan terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    if (
      confirm(
        `Publish dokumen dan sertifikat untuk ${item.studentName}? Setelah publish, data utama akan dikunci.`,
      )
    ) {
      publishCertificateMutation.mutate(item);
    }
  };

  const items = useMemo(() => data?.items || [], [data?.items]);
  const classOptions = data?.classes || [];

  const filteredByClassAndJuz = useMemo(() => {
    return items.filter((item) => {
      if (filterKelas !== "all" && item.className !== filterKelas) return false;
      if (filterJuz !== "all" && !item.juz.includes(filterJuz)) return false;
      return true;
    });
  }, [items, filterKelas, filterJuz]);

  const filtered = useMemo(
    () => filteredByClassAndJuz.filter(
      (item) => filterPublish === "all" || item.publishStatus === filterPublish,
    ),
    [filterPublish, filteredByClassAndJuz],
  );

  const lulusItems = useMemo(
    () => filteredByClassAndJuz.filter((i) => i.status === "Lulus"),
    [filteredByClassAndJuz],
  );

  const bulkItems = useMemo(
    () => filtered.filter(
      (item) => item.publishStatus === "published" || item.publishStatus === "revised",
    ),
    [filtered],
  );

  useEffect(() => {
    setSelectedBulkIds((current) => {
      const nextIds = bulkItems.map((item) => item.id);
      if (
        current.length === nextIds.length
        && current.every((id) => nextIds.includes(id))
      ) {
        return current;
      }
      return nextIds;
    });
  }, [bulkItems]);

  const selectedBulkItems = useMemo(
    () => bulkItems.filter((item) => selectedBulkIds.includes(item.id)),
    [bulkItems, selectedBulkIds],
  );

  const downloadableItemIds = useMemo(
    () => new Set(bulkItems.map((item) => item.id)),
    [bulkItems],
  );

  const allBulkItemsSelected = bulkItems.length > 0 && selectedBulkItems.length === bulkItems.length;

  const toggleBulkSelection = (itemId: string, checked: boolean) => {
    setSelectedBulkIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const toggleSelectAllBulkItems = (checked: boolean) => {
    setSelectedBulkIds(checked ? bulkItems.map((item) => item.id) : []);
  };

  const chartData = useMemo(() => {
    const classCount: Record<string, number> = {};
    lulusItems.forEach((item) => {
      classCount[item.className] = (classCount[item.className] || 0) + 1;
    });
    return Object.entries(classCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lulusItems]);

  const juzOptions = useMemo(() => {
    const juzSet = new Set<string>();
    items.forEach((item) => {
      item.juz.split(", ").forEach((j) => {
        if (j !== "-") juzSet.add(j);
      });
    });
    return [...juzSet].sort((a, b) => parseInt(a) - parseInt(b));
  }, [items]);

  const handleExportExcel = () => {
    exportJsonToExcel(
      filtered.map((item) => ({
        No: item.certificateSequence ?? "-",
        "Nama Siswa": item.studentName,
        Kelas: item.className,
        "Juz Diujikan": item.juz,
        "Nilai Akhir": item.nilaiAkhir,
        Predikat: item.predikat,
        Status: item.status,
        "Status Publish": item.publishStatus,
        "Tanggal Lulus": item.tanggal,
        "Nomor Sertifikat": item.nomorSertifikat,
      })),
      "Rekap Sertifikat",
      "rekap_sertifikat_tahfizh.xlsx",
    );
  };

  const handleBulkDownload = async () => {
    if (bulkItems.length === 0) {
      toast({
        title: "Tidak ada sertifikat",
        description: "Tidak ada sertifikat published yang bisa diunduh.",
        variant: "destructive",
      });
      return;
    }

    if (selectedBulkItems.length === 0) {
      toast({
        title: "Belum ada siswa dipilih",
        description: "Centang minimal satu siswa yang ingin diunduh PDF sertifikatnya.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkDownloading(true);
    try {
      const itemsForPdf: BulkCertificateItem[] = selectedBulkItems.map((item) => ({
        studentName: item.studentName,
        className: item.className,
        juz: item.juz,
        nilaiAkhir: item.nilaiAkhir,
        predikat: item.predikat,
        tanggal: item.tanggal,
        nomorSertifikat: item.nomorSertifikat,
        documentNumber:
          item.documentNumber
          || buildReportDocumentNumber("Tahfizh", item.id, item.publishedAt, item.tanggal),
        verificationToken: item.verificationToken,
        verificationUrl: buildVerificationUrl("sertifikat-tahfizh", item.verificationToken),
        assessedBy: item.assessedBy,
        coordinatorName: item.coordinatorNameSnapshot,
        principalName: item.principalNameSnapshot || DEFAULT_PRINCIPAL_NAME,
        layoutSnapshot: item.layoutSnapshot,
        layoutOverride: item.layoutOverride,
      }));
      const classSuffix = filterKelas !== "all"
        ? `_Kelas_${safeFileName(filterKelas)}`
        : "_Terfilter";
      await downloadBulkCertificatePDF(itemsForPdf, {
        format: bulkPdfFormat,
        fileName: `Sertifikat_Tahfizh${classSuffix}.pdf`,
      });
      toast({
        title: "Download selesai",
        description: `${selectedBulkItems.length} sertifikat berhasil digabungkan.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Download massal gagal",
        description: error instanceof Error ? error.message : "Gagal membuat PDF gabungan.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(142 76% 36%)",
    "hsl(48 96% 53%)",
    "hsl(0 84% 60%)",
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">📁 Rekap Siswa Bersertifikat</h2>
            <p className="text-sm text-muted-foreground">Data siswa yang lulus sertifikasi Tahfizh</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
            {isAdmin && (
              <>
                <select
                  value={bulkPdfFormat}
                  onChange={(event) => setBulkPdfFormat(event.target.value as CertificatePdfFormat)}
                  disabled={isBulkDownloading}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
                  aria-label="Format PDF massal"
                >
                  <option value="a4-landscape">A4 Landscape</option>
                  <option value="legal-landscape">F4 / Legal 8.5 x 14 in</option>
                  <option value="original">Rasio Asli 4:3</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkDownload}
                  disabled={isBulkDownloading}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isBulkDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isBulkDownloading
                    ? "Menyiapkan PDF..."
                    : `Download Massal PDF (${selectedBulkItems.length})`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterJuz}
              onChange={(e) => setFilterJuz(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Juz</option>
              {juzOptions.map((j) => (
                <option key={j} value={j}>Juz {j}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterPublish}
              onChange={(e) => setFilterPublish(e.target.value as PublishStatus | "all")}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Status Publish</option>
              <option value="belum_publish">Belum Publish</option>
              <option value="published">Published</option>
              <option value="revised">Revised</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-input text-primary focus:ring-ring h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">Tampilkan semua hasil sertifikasi</span>
            </label>
          )}
        </div>

        {data?.certificatesAvailable === false && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            Data sertifikat lama tetap ditampilkan. Sistem publish resmi belum aktif karena migration
            database belum diterapkan.
          </div>
        )}

        {isAdmin && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Pilihan Download Massal PDF</p>
                <p className="text-xs text-muted-foreground">
                  Centang siswa yang ingin digabungkan ke PDF. Hanya sertifikat yang sudah publish atau revisi yang bisa dipilih.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllBulkItems(true)}
                  disabled={bulkItems.length === 0 || isBulkDownloading}
                  className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Pilih Semua ({bulkItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAllBulkItems(false)}
                  disabled={selectedBulkItems.length === 0 || isBulkDownloading}
                  className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Kosongkan Pilihan
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Terpilih {selectedBulkItems.length} dari {bulkItems.length} sertifikat yang siap diunduh.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Chart */}
            {chartData.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6 shadow-card mb-6">
                <h3 className="font-semibold text-foreground mb-4">📊 Jumlah Siswa Lulus per Kelas</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="count" name="Siswa Lulus" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Publish Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Lulus</p>
              </div>
              <div className="bg-card rounded-lg border border-amber-500/20 p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {lulusItems.filter((i) => i.publishStatus === "belum_publish").length}
                </p>
                <p className="text-xs text-muted-foreground">Belum Publish</p>
              </div>
              <div className="bg-card rounded-lg border border-success/20 p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">
                  {lulusItems.filter((i) => i.publishStatus === "published").length}
                </p>
                <p className="text-xs text-muted-foreground">Sudah Publish</p>
              </div>
              <div className="bg-card rounded-lg border border-blue-500/20 p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {lulusItems.filter((i) => i.publishStatus === "revised").length}
                </p>
                <p className="text-xs text-muted-foreground">Perlu Revisi</p>
              </div>
              <div className="bg-card rounded-lg border border-destructive/20 p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-destructive">
                  {lulusItems.filter((i) => i.publishStatus === "cancelled").length}
                </p>
                <p className="text-xs text-muted-foreground">Dibatalkan</p>
              </div>
            </div>

            {/* Predicate Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.length}</p>
                <p className="text-xs text-muted-foreground">Total Lulus</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">{lulusItems.filter((i) => i.predikat === "Mumtaz Murtafi").length}</p>
                <p className="text-xs text-muted-foreground">A+ Mumtaz Murtafi</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-success">{lulusItems.filter((i) => i.predikat === "Mumtaz").length}</p>
                <p className="text-xs text-muted-foreground">A Mumtaz</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-[#0f2a55] dark:text-blue-200">{lulusItems.filter((i) => i.predikat === "Jayyid Jiddan").length}</p>
                <p className="text-xs text-muted-foreground">B+ Jayyid Jiddan</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-foreground">{lulusItems.filter((i) => i.predikat === "Jayyid").length}</p>
                <p className="text-xs text-muted-foreground">B Jayyid</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-primary">{lulusItems.filter((i) => i.predikat === "Maqbul").length}</p>
                <p className="text-xs text-muted-foreground">C Maqbul</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 shadow-card text-center">
                <p className="text-2xl font-bold text-destructive">{filtered.filter((i) => i.predikat === "Rosib").length}</p>
                <p className="text-xs text-muted-foreground">D Rosib</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border shadow-card">
              <table className="min-w-[1180px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">No</th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={allBulkItemsSelected}
                              onChange={(event) => toggleSelectAllBulkItems(event.target.checked)}
                              disabled={bulkItems.length === 0}
                              className="h-4 w-4 rounded border-input text-primary focus:ring-ring disabled:opacity-50"
                              aria-label="Pilih semua siswa untuk download massal PDF"
                            />
                          </label>
                        </th>
                      )}
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama Siswa</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kelas</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Juz</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Nilai</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Predikat</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tanggal</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. Sertifikat</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status Publish</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${item.status === "Tidak Lulus" ? "bg-destructive/5" : ""}`}>
                        <td className="px-4 py-3 text-foreground">{item.certificateSequence ?? "-"}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedBulkIds.includes(item.id)}
                              onChange={(event) => toggleBulkSelection(item.id, event.target.checked)}
                              disabled={!downloadableItemIds.has(item.id)}
                              className="h-4 w-4 rounded border-input text-primary focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Pilih ${item.studentName} untuk download massal PDF`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-foreground">{item.studentName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.className}</td>
                        <td className="px-4 py-3 text-muted-foreground">Juz {item.juz}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex min-w-12 items-center justify-center rounded-full border px-2.5 py-1 text-sm font-bold ${
                            item.nilaiAkhir >= 96 ? "border-success/30 bg-success/10 text-success" :
                            item.nilaiAkhir >= 90 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                            item.nilaiAkhir >= 86 ? "border-blue-950/30 bg-blue-950/10 text-[#0f2a55] dark:border-blue-200/30 dark:bg-blue-200/10 dark:text-blue-200" :
                            item.nilaiAkhir >= 80 ? "border-foreground/30 bg-foreground/10 text-foreground" :
                            item.nilaiAkhir >= 70 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" :
                            "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}>
                            {item.nilaiAkhir}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.predikat === "Mumtaz Murtafi" ? "bg-success/10 text-success" :
                            item.predikat === "Mumtaz" ? "bg-emerald-500/10 text-emerald-700" :
                            item.predikat === "Jayyid Jiddan" ? "bg-blue-950/10 text-[#0f2a55] border border-blue-950/30 dark:bg-blue-200/10 dark:text-blue-200 dark:border-blue-200/30" :
                            item.predikat === "Jayyid" ? "bg-foreground/10 text-foreground border border-foreground/30" :
                            item.predikat === "Maqbul" ? "bg-yellow-500/10 text-yellow-700" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {item.predikat}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "Lulus" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          }`}>
                            {item.status === "Lulus" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.tanggal}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.nomorSertifikat}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PUBLISH_STATUS_CLASSES[item.publishStatus]}`}>
                            {PUBLISH_STATUS_LABELS[item.publishStatus]}
                          </span>
                          <span className="mt-1 block text-[10px] font-medium text-muted-foreground">
                            {item.certificateId
                              ? "Snapshot"
                              : item.hasLayoutOverride
                                ? "Khusus"
                                : "Global"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {item.status === "Lulus" && (
                              <button
                                onClick={() => setPreviewItem(item)}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                title="Preview Sertifikat"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && item.status === "Lulus" && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      setDownloadingId(item.id);
                                      const {
                                        coordinatorSignatureDataUrl,
                                        principalSignatureDataUrl,
                                        coordinatorName,
                                      } = await resolveCertificateSignatures(item.assessedBy);
                                      const certificateData = {
                                        ...item,
                                        coordinatorSignatureDataUrl,
                                        principalSignatureDataUrl,
                                        coordinatorName:
                                          item.coordinatorNameSnapshot || coordinatorName,
                                        principalName:
                                          item.principalNameSnapshot || DEFAULT_PRINCIPAL_NAME,
                                        documentNumber:
                                          item.documentNumber
                                          || buildReportDocumentNumber(
                                            "Tahfizh",
                                            item.id,
                                            item.publishedAt,
                                            item.tanggal,
                                          ),
                                        verificationUrl: buildVerificationUrl(
                                          "sertifikat-tahfizh",
                                          item.verificationToken,
                                        ),
                                      } as CertificateData;
                                      const doc = await buildCertificatePDF(
                                        certificateData,
                                        item.layoutSnapshot || item.layoutOverride || undefined,
                                        bulkPdfFormat,
                                      );
                                      doc.save(`Sertifikat_${safeFileName(item.studentName)}.pdf`);
                                      toast({ title: "Berhasil", description: "Sertifikat berhasil diunduh" });
                                    } catch (err) {
                                      console.error(err);
                                      toast({ title: "Gagal", description: "Gagal membuat PDF", variant: "destructive" });
                                    } finally {
                                      setDownloadingId(null);
                                    }
                                  }}
                                  disabled={downloadingId === item.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
                                  title="Download Sertifikat PDF"
                                >
                                  {downloadingId === item.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3" />
                                  )}
                                </button>
                                {item.publishStatus === "belum_publish" ? (
                                  <>
                                    <button
                                      onClick={() => handlePublish(item)}
                                      disabled={
                                        publishCertificateMutation.isPending
                                        || data?.certificatesAvailable === false
                                      }
                                      className="inline-flex items-center gap-1 rounded-md bg-success px-2 py-1.5 text-xs font-medium text-success-foreground transition-colors hover:bg-success/90 disabled:opacity-50"
                                      title="Publish Sertifikat"
                                    >
                                      {publishCertificateMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Send className="w-3 h-3" />
                                      )}
                                      Publish
                                    </button>
                                    <button
                                      onClick={() =>
                                        openEditModal(
                                          item.id,
                                          item.certificateId || null,
                                          item.studentName,
                                          item.nomorSertifikat,
                                          item.publishStatus,
                                        )
                                      }
                                      disabled={editNomorSertifikatMutation.isPending}
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-50"
                                      title="Edit Nomor Sertifikat"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className={`inline-flex items-center rounded-md border px-2 py-1.5 text-xs font-medium ${PUBLISH_STATUS_CLASSES[item.publishStatus]}`}>
                                      {PUBLISH_STATUS_LABELS[item.publishStatus]}
                                    </span>
                                    {(item.publishStatus === "published" || item.publishStatus === "revised") && (
                                      <button
                                        onClick={() =>
                                          openEditModal(
                                            item.id,
                                            item.certificateId || null,
                                            item.studentName,
                                            item.nomorSertifikat,
                                            item.publishStatus,
                                          )
                                        }
                                        disabled={editNomorSertifikatMutation.isPending}
                                        className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-50"
                                        title="Revisi Nomor Sertifikat"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {isAdmin && !item.certificateId && (
                              <button
                                onClick={() => {
                                  const newStatus = item.status === "Lulus" ? "Tidak Lulus" : "Lulus";
                                  if (confirm(`Ubah status ${item.studentName} menjadi "${newStatus}"?`)) {
                                    toggleStatusMutation.mutate({
                                      ujianId: item.id,
                                      studentId: item.studentId,
                                      newStatus,
                                    });
                                  }
                                }}
                                disabled={toggleStatusMutation.isPending}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                  item.status === "Lulus"
                                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                    : "bg-success/10 text-success hover:bg-success/20"
                                }`}
                              >
                                <Edit2 className="w-3 h-3" />
                                {item.status === "Lulus" ? "Batalkan" : "Luluskan"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 12 : 10} className="px-4 py-12 text-center text-muted-foreground">
                          {showAll ? "Belum ada hasil sertifikasi Tahfizh" : "Belum ada siswa yang lulus sertifikasi Tahfizh"}
                        </td>
                      </tr>
                    )}
                  </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <CertificatePreviewDialog
        open={!!previewItem}
        onOpenChange={(o) => { if (!o) setPreviewItem(null); }}
        coordinatorUserId={previewItem?.assessedBy}
        layoutOverride={previewItem?.layoutSnapshot || previewItem?.layoutOverride || null}
        lockLayout={Boolean(previewItem?.certificateId)}
        ujianId={previewItem?.id}
        studentId={previewItem?.studentId}
        layoutMode={
          previewItem?.certificateId
            ? "published_snapshot"
            : previewItem?.hasLayoutOverride
              ? "student_override"
              : "global"
        }
        onLayoutOverrideSaved={(layout) => {
          setPreviewItem((current) => current
            ? {
                ...current,
                layoutOverride: layout,
                hasLayoutOverride: Boolean(layout),
              }
            : null);
          queryClient.invalidateQueries({ queryKey: ["rekap-sertifikat"] });
        }}
        data={
          previewItem
            ? {
                studentName: previewItem.studentName,
                className: previewItem.className,
                juz: previewItem.juz,
                nilaiAkhir: previewItem.nilaiAkhir,
                predikat: previewItem.predikat,
                tanggal: previewItem.tanggal,
                nomorSertifikat: previewItem.nomorSertifikat,
                documentNumber:
                  previewItem.documentNumber
                  || buildReportDocumentNumber(
                    "Tahfizh",
                    previewItem.id,
                    previewItem.publishedAt,
                    previewItem.tanggal,
                  ),
                verificationToken: previewItem.verificationToken,
                verificationUrl: buildVerificationUrl("sertifikat-tahfizh", previewItem.verificationToken),
                coordinatorName: previewItem.coordinatorNameSnapshot || undefined,
                principalName: previewItem.principalNameSnapshot || undefined,
              }
            : null
        }
      />

      {/* Modal Edit Nomor Sertifikat */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Edit Nomor Sertifikat</h3>
              <button
                onClick={closeEditModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nama Siswa
                </label>
                <p className="text-foreground font-medium">{editModal.studentName}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nomor Sertifikat Saat Ini
                </label>
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="font-mono text-sm text-foreground">
                    {editModal.currentNomorSertifikat}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Nomor Sertifikat Baru
                </label>
                <input
                  type="text"
                  value={editModal.newNomorSertifikat}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      newNomorSertifikat: e.target.value,
                    })
                  }
                  placeholder="Masukkan nomor sertifikat baru"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {(editModal.publishStatus === "published" || editModal.publishStatus === "revised") && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  Revisi ini khusus untuk dokumen yang sudah published. Data utama sertifikat lainnya tetap terkunci.
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveNomorSertifikat}
                  disabled={editNomorSertifikatMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editNomorSertifikatMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RekapSertifikat;
