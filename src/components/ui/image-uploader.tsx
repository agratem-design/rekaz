import { useState, useRef, useCallback } from "react";
import { supabase, isOfflineMode } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Link2, Loader2, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  className?: string;
  previewClassName?: string;
}

interface UploadSettings {
  provider: string;
  imgbb_api_key?: string;
  freeimage_api_key?: string;
  cloudinary_cloud_name?: string;
  cloudinary_upload_preset?: string;
}

function useUploadSettings(): UploadSettings {
  const { data } = useQuery({
    queryKey: ["upload-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("image_upload_provider, imgbb_api_key, freeimage_api_key, cloudinary_cloud_name, cloudinary_upload_preset")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    provider: (data as any)?.image_upload_provider || "supabase",
    imgbb_api_key: (data as any)?.imgbb_api_key,
    freeimage_api_key: (data as any)?.freeimage_api_key,
    cloudinary_cloud_name: (data as any)?.cloudinary_cloud_name,
    cloudinary_upload_preset: (data as any)?.cloudinary_upload_preset,
  };
}

async function uploadToSupabase(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("images").upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
  return urlData.publicUrl;
}

async function uploadToImgbb(file: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("key", apiKey);
  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "فشل رفع الصورة إلى imgbb");
  return json.data.url;
}

async function uploadToFreeimage(file: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("source", file);
  formData.append("key", apiKey);
  formData.append("action", "upload");
  formData.append("format", "json");
  const res = await fetch("https://freeimage.host/api/1/upload", { method: "POST", body: formData });
  const json = await res.json();
  if (json.status_code !== 200) throw new Error(json.status_txt || "فشل رفع الصورة إلى Freeimage");
  return json.image.url;
}

async function uploadToCloudinary(file: File, cloudName: string, preset: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.secure_url;
}

async function compressImageToBase64(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement("canvas");
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const dataUri = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(img.src);
      resolve(dataUri);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("فشل معالجة الصورة"));
    };
    img.src = URL.createObjectURL(file);
  });
}

async function uploadToDatabase(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export function ImageUploader({
  value,
  onChange,
  folder = "general",
  label,
  className,
  previewClassName,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const settings = useUploadSettings();

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "خطأ", description: "يرجى اختيار ملف صورة فقط", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "خطأ", description: "حجم الصورة يجب ألا يتجاوز 10 ميجابايت", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let url: string;

      const effectiveProvider = isOfflineMode ? "database" : settings.provider;
      switch (effectiveProvider) {
        case "imgbb":
          if (!settings.imgbb_api_key) throw new Error("مفتاح imgbb API غير مُعدّ. اذهب للإعدادات لإضافته");
          url = await uploadToImgbb(file, settings.imgbb_api_key);
          break;
        case "freeimage":
          if (!settings.freeimage_api_key) throw new Error("مفتاح Freeimage API غير مُعدّ. اذهب للإعدادات لإضافته");
          url = await uploadToFreeimage(file, settings.freeimage_api_key);
          break;
        case "cloudinary":
          if (!settings.cloudinary_cloud_name || !settings.cloudinary_upload_preset)
            throw new Error("إعدادات Cloudinary غير مكتملة. اذهب للإعدادات لإضافتها");
          url = await uploadToCloudinary(file, settings.cloudinary_cloud_name, settings.cloudinary_upload_preset);
          break;
        case "database":
          url = await uploadToDatabase(file);
          break;
        default:
          url = await uploadToSupabase(file, folder);
      }

      onChange(url);
      toast({ title: "تم رفع الصورة بنجاح ✨" });
    } catch (err: any) {
      toast({ title: "خطأ في رفع الصورة", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [folder, onChange, toast, settings]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const file = e.clipboardData.files[0];
    if (file && file.type.startsWith("image/")) {
      e.preventDefault();
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleRemove = async () => {
    if (value.includes("supabase.co/storage")) {
      try {
        const path = value.split("/images/")[1];
        if (path) await supabase.storage.from("images").remove([path]);
      } catch {}
    }
    onChange("");
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  const providerLabel: Record<string, string> = {
    supabase: "Supabase",
    imgbb: "imgbb",
    freeimage: "Freeimage",
    cloudinary: "Cloudinary",
    database: "قاعدة البيانات",
  };

  if (value) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label>{label}</Label>}
        <div className={cn("relative group rounded-lg border overflow-hidden bg-muted/30", previewClassName || "h-32 w-full")}>
          <img
            src={value}
            alt="معاينة"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              تغيير
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={handleRemove} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              حذف
            </Button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} onPaste={handlePaste}>
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30",
          uploading && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">جاري رفع الصورة عبر {providerLabel[settings.provider] || settings.provider}...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">اسحب صورة هنا أو انقر للاختيار</p>
              <p className="text-xs text-muted-foreground mt-0.5">أو الصق من الحافظة (Ctrl+V) • {isOfflineMode ? "قاعدة البيانات (محلي)" : (providerLabel[settings.provider] || settings.provider)}</p>
            </div>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs flex-1"
          onClick={async () => {
            try {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const imageType = item.types.find(t => t.startsWith("image/"));
                if (imageType) {
                  const blob = await item.getType(imageType);
                  const file = new File([blob], `paste-${Date.now()}.${imageType.split("/")[1]}`, { type: imageType });
                  uploadFile(file);
                  return;
                }
              }
              toast({ title: "لا توجد صورة", description: "لا توجد صورة في الحافظة", variant: "destructive" });
            } catch {
              toast({ title: "خطأ", description: "تعذر الوصول للحافظة. جرب Ctrl+V بدلاً من ذلك", variant: "destructive" });
            }
          }}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          لصق من الحافظة
        </Button>
        {!showUrlInput ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => setShowUrlInput(true)}>
            <Link2 className="h-3.5 w-3.5" />
            رابط صورة
          </Button>
        ) : (
          <div className="flex gap-2 flex-1">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              dir="ltr"
              className="text-xs"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlSubmit())}
            />
            <Button type="button" size="sm" onClick={handleUrlSubmit}>إضافة</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowUrlInput(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
