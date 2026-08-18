import React, { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Database, CloudUpload, CheckCircle2, AlertCircle, FolderOpen, Loader2 } from "lucide-react";
import type { BackupStatusEvent } from "@/types/desktop";

export const DesktopBackupNotifier: React.FC = () => {
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!window.desktopAPI) {
      return;
    }

    const unsubscribe = window.desktopAPI.onBackupStatus((data: BackupStatusEvent) => {
      switch (data.status) {
        case "starting":
        case "dumping": {
          if (!toastIdRef.current) {
            toastIdRef.current = toast.loading(data.message, {
              description: "يتم أخذ نسخة كاملة من قاعدة البيانات في الخلفية...",
              icon: <Database className="h-4 w-4 text-primary animate-pulse" />,
              duration: Infinity,
            });
          } else {
            toast.loading(data.message, {
              id: toastIdRef.current,
              description: data.fileName ? `الملف: ${data.fileName}` : undefined,
              icon: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
            });
          }
          break;
        }

        case "uploading": {
          const currentId = toastIdRef.current || undefined;
          toast.loading(data.message, {
            id: currentId,
            description: `الحجم: ${data.fileSize || "غير محدد"} - جاري التزامن مع Google Drive...`,
            icon: <CloudUpload className="h-4 w-4 text-amber-500 animate-pulse" />,
          });
          break;
        }

        case "completed": {
          const currentId = toastIdRef.current || undefined;
          toast.success(data.message, {
            id: currentId,
            description: data.fileSize ? `حجم النسخة: ${data.fileSize} ${data.driveUploaded ? "(مرفوع سحابياً)" : ""}` : undefined,
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
            duration: 6000,
            action: {
              label: "فتح المجلد",
              onClick: () => {
                window.desktopAPI?.openBackupFolder(data.filePath);
              },
            },
          });
          toastIdRef.current = null;
          break;
        }

        case "error": {
          const currentId = toastIdRef.current || undefined;
          toast.error("فشل النسخ الاحتياطي", {
            id: currentId,
            description: data.error || data.message,
            icon: <AlertCircle className="h-4 w-4 text-destructive" />,
            duration: 8000,
          });
          toastIdRef.current = null;
          break;
        }

        default:
          break;
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  return null;
};
