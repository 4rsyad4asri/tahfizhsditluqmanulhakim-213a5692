import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

import { confirmQuestionRemoval } from "@/components/EditUjianDialog";

describe("confirmQuestionRemoval", () => {
  beforeEach(() => {
    toastError.mockReset();
    vi.restoreAllMocks();
  });

  it("menolak penghapusan jika hanya tersisa satu soal", () => {
    const onRemove = vi.fn();
    const confirm = vi.spyOn(window, "confirm");

    confirmQuestionRemoval(1, 1, onRemove);

    expect(toastError).toHaveBeenCalledWith(
      "Minimal harus ada satu soal dalam hasil ujian."
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("tidak menghapus soal saat konfirmasi dibatalkan", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onRemove = vi.fn();

    confirmQuestionRemoval(3, 2, onRemove);

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("menghapus soal yang dipilih setelah dikonfirmasi", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onRemove = vi.fn();

    confirmQuestionRemoval(3, 2, onRemove);

    expect(window.confirm).toHaveBeenCalledWith(
      "Hapus soal 2? Nilai dan catatan pada soal ini juga akan dihapus."
    );
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
