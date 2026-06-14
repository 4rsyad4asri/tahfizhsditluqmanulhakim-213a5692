import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const createVerificationToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getAssessorName = async (assessorId?: string | null) => {
  if (!assessorId) return undefined;

  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assessorId)
    .maybeSingle();

  return data?.full_name || undefined;
};

export interface PublishTahfizhDocumentInput {
  ujianId: string;
  certificateNumber?: string | null;
}

export interface PublishedTahfizhDocument {
  verificationToken: string;
  publishedAt: string;
}

export const publishTahfizhDocument = async ({
  ujianId,
  certificateNumber,
}: PublishTahfizhDocumentInput): Promise<PublishedTahfizhDocument> => {
  const { data: row, error: fetchError } = await supabase
    .from("ujian")
    .select(
      "nilai_aspek, verification_token, assessed_by, document_status, published_at, nomor_sertifikat",
    )
    .eq("id", ujianId)
    .single();
  if (fetchError) throw fetchError;

  const currentAspek =
    row.nilai_aspek && typeof row.nilai_aspek === "object" && !Array.isArray(row.nilai_aspek)
      ? row.nilai_aspek as Record<string, unknown>
      : {};
  const verificationToken =
    row.verification_token
    || currentAspek.verificationToken as string | undefined
    || createVerificationToken();
  const assessorName =
    currentAspek.assessorName as string | undefined
    || await getAssessorName(row.assessed_by);
  const publishedAt =
    row.document_status === "Published" && row.published_at
      ? row.published_at
      : new Date().toISOString();
  const nilaiAspek = {
    ...currentAspek,
    documentStatus: "Published",
    verificationToken,
    assessorName,
  };

  const { error: updateError } = await supabase
    .from("ujian")
    .update({
      document_status: "Published",
      published_at: publishedAt,
      verification_token: verificationToken,
      nilai_aspek: nilaiAspek as Json,
      nomor_sertifikat: row.nomor_sertifikat || certificateNumber || null,
    })
    .eq("id", ujianId);
  if (updateError) throw updateError;

  return { verificationToken, publishedAt };
};
