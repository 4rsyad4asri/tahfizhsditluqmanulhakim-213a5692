import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sourceRow: {
    nilai_aspek: {
      predikat: "Mumtaz",
      verificationToken: "token-dari-metadata",
      assessorName: "Koordinator Tahfizh",
    },
    verification_token: "",
    assessed_by: "assessor-id",
    document_status: "Published",
    published_at: "2026-06-14T08:00:00.000Z",
    nomor_sertifikat: "001/SDITLH",
  },
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== "ujian") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: mocks.sourceRow, error: null })),
          })),
        })),
        update: mocks.update,
      };
    }),
  },
}));

import { publishTahfizhDocument } from "./publishTahfizhDocument";

describe("publishTahfizhDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.updateEq });
  });

  it("publishes the source document without replacing stable identifiers", async () => {
    const result = await publishTahfizhDocument({
      ujianId: "source-id",
      certificateNumber: "nomor-baru",
    });

    expect(result).toEqual({
      verificationToken: "token-dari-metadata",
      publishedAt: "2026-06-14T08:00:00.000Z",
    });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      document_status: "Published",
      published_at: "2026-06-14T08:00:00.000Z",
      verification_token: "token-dari-metadata",
      nomor_sertifikat: "001/SDITLH",
      nilai_aspek: expect.objectContaining({
        documentStatus: "Published",
        verificationToken: "token-dari-metadata",
        assessorName: "Koordinator Tahfizh",
      }),
    }));
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "source-id");
  });
});
