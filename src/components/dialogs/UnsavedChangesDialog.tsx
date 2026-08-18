import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
  onStay: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirmDiscard,
  onStay,
  title = 'تعديلات غير محفوظة',
  description = 'لديك بيانات وتعديلات تم إدخالها ولم تُحفظ بعد. هل أنت متأكد من رغبتك في تجاهل التعديلات ومغادرة الشاشة؟',
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="text-right max-w-md">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-foreground">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-start pt-4 border-t border-border/50">
          <AlertDialogAction
            onClick={onConfirmDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
          >
            تجاهل التعديلات والخروج
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={onStay}
            className="bg-muted hover:bg-muted/80 text-foreground cursor-pointer mt-0"
          >
            البقاء ومتابعة التعديل
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
