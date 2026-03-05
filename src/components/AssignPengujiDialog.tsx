import { useState } from "react";
import { usePengujiList, useClassPenguji, useAssignPenguji } from "@/hooks/usePenguji";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/utils/errorMessages";
import { UserPlus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface AssignPengujiDialogProps {
  classId: string;
  className: string;
}

export default function AssignPengujiDialog({ classId, className }: AssignPengujiDialogProps) {
  const { isAdmin } = useAuthContext();
  const { data: allPenguji = [], isLoading: loadingAll } = usePengujiList();
  const { data: assigned = [], isLoading: loadingAssigned } = useClassPenguji(classId);
  const { assign, unassign } = useAssignPenguji();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const assignedIds = new Set(assigned.map((p) => p.id));
  const available = allPenguji.filter((p) => !assignedIds.has(p.id));

  const handleAssign = async (pengujiId: string) => {
    try {
      await assign.mutateAsync({ classId, pengujiId });
      toast.success("Penguji berhasil ditambahkan");
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    }
  };

  const handleUnassign = async (pengujiId: string) => {
    try {
      await unassign.mutateAsync({ classId, pengujiId });
      toast.success("Penguji berhasil dihapus dari kelas");
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    }
  };

  const isLoading = loadingAll || loadingAssigned;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <UserPlus className="w-3.5 h-3.5" />
          Kelola Penguji
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Penguji — {className}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Assigned */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Penguji Aktif ({assigned.length})</p>
              {assigned.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Belum ada penguji</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assigned.map((p) => (
                    <Badge key={p.id} variant="secondary" className="flex items-center gap-1 pr-1">
                      {p.name}
                      <button
                        onClick={() => handleUnassign(p.id)}
                        className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Available */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tambahkan Penguji</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {available.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Semua penguji sudah di-assign</p>
                ) : (
                  available.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAssign(p.id)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      <UserPlus className="w-3.5 h-3.5 text-primary opacity-60" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
