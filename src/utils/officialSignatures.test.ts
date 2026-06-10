import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRaportSignatureAssets } from "./officialSignatures";

const maybeSingle = vi.fn();
const createSignedUrl = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({ createSignedUrl })),
    },
  },
}));

describe("official raport signatures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    maybeSingle.mockReset();
    createSignedUrl.mockReset();

    maybeSingle
      .mockResolvedValueOnce({ data: { signature_url: "teacher/signature-new.png" } })
      .mockResolvedValueOnce({ data: { value: {} } })
      .mockResolvedValueOnce({ data: { value: {} } });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signature.png?token=test" },
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["new-signature"], { type: "image/png" }),
    }));
  });

  it("prefers the current profile signature over a stale manual signature", async () => {
    const resolved = await resolveRaportSignatureAssets("teacher-id", {
      sigExaminer: "data:image/png;base64,old-signature",
    });

    expect(resolved.sigExaminer).toContain("data:image/png;base64,");
    expect(resolved.sigExaminer).not.toBe("data:image/png;base64,old-signature");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("&v="),
      { cache: "no-store" },
    );
  });

  it("keeps the manual signature as fallback when the profile has none", async () => {
    maybeSingle.mockReset();
    maybeSingle
      .mockResolvedValueOnce({ data: { signature_url: null } })
      .mockResolvedValueOnce({ data: { value: {} } })
      .mockResolvedValueOnce({ data: { value: {} } });

    const resolved = await resolveRaportSignatureAssets("teacher-id", {
      sigExaminer: "data:image/png;base64,manual-signature",
    });

    expect(resolved.sigExaminer).toBe("data:image/png;base64,manual-signature");
  });
});
