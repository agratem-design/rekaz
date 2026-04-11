import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Images, Download, Search, FolderOpen, FileImage, Loader2, X } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

interface ProjectWithImages {
  id: string;
  name: string;
  image_url: string | null;
  purchases: {
    id: string;
    invoice_number: string | null;
    invoice_image_url: string | null;
    supplier_name: string | null;
  }[];
}

export default function Gallery() {
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["gallery-projects"],
    queryFn: async () => {
      const { data: projectsData, error: pErr } = await supabase
        .from("projects")
        .select("id, name, image_url")
        .order("name");
      if (pErr) throw pErr;

      const { data: purchasesData, error: purErr } = await supabase
        .from("purchases")
        .select("id, project_id, invoice_number, invoice_image_url, suppliers(name)")
        .not("invoice_image_url", "is", null);
      if (purErr) throw purErr;

      return (projectsData || []).map((p) => ({
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        purchases: (purchasesData || [])
          .filter((pur) => pur.project_id === p.id && pur.invoice_image_url)
          .map((pur) => ({
            id: pur.id,
            invoice_number: pur.invoice_number,
            invoice_image_url: pur.invoice_image_url,
            supplier_name: (pur.suppliers as any)?.name || null,
          })),
      })) as ProjectWithImages[];
    },
  });

  const projectsWithImages = projects.filter(
    (p) => p.image_url || p.purchases.length > 0
  );

  const filtered = projectsWithImages.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalImages = filtered.reduce(
    (sum, p) => sum + (p.image_url ? 1 : 0) + p.purchases.length,
    0
  );

  const getExtFromUrl = (url: string) => {
    try {
      const path = new URL(url).pathname;
      const ext = path.split(".").pop()?.split("?")[0];
      return ext && ext.length <= 5 ? ext : "jpg";
    } catch {
      return "jpg";
    }
  };

  const sanitizeName = (name: string) =>
    name.replace(/[/\\?%*:|"<>]/g, "_").trim();

  const handleDownloadZip = async () => {
    if (totalImages === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const root = zip.folder("معرض_الصور")!;

      for (const project of filtered) {
        const folderName = sanitizeName(project.name);
        const projectFolder = root.folder(folderName)!;

        if (project.image_url) {
          try {
            const res = await fetch(project.image_url);
            const blob = await res.blob();
            const ext = getExtFromUrl(project.image_url);
            projectFolder.file(`صورة_المشروع.${ext}`, blob);
          } catch {}
        }

        for (const pur of project.purchases) {
          if (!pur.invoice_image_url) continue;
          try {
            const res = await fetch(pur.invoice_image_url);
            const blob = await res.blob();
            const ext = getExtFromUrl(pur.invoice_image_url);
            const invoiceNum = pur.invoice_number ? `فاتورة_${sanitizeName(pur.invoice_number)}` : `فاتورة_${pur.id.slice(0, 6)}`;
            const supplierPart = pur.supplier_name ? `_مورد_${sanitizeName(pur.supplier_name)}` : "";
            projectFolder.file(`${invoiceNum}${supplierPart}.${ext}`, blob);
          } catch {}
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "معرض_الصور.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل الأرشيف بنجاح");
    } catch (err: any) {
      toast.error("فشل إنشاء الأرشيف: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Images className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">معرض الصور</h1>
            <p className="text-sm text-muted-foreground">
              جميع صور المشاريع والفواتير — {totalImages} صورة في {filtered.length} مشروع
            </p>
          </div>
        </div>
        <Button
          onClick={handleDownloadZip}
          disabled={downloading || totalImages === 0}
          className="gap-2"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "جاري التنزيل..." : "تنزيل أرشيف ZIP"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالمشروع..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Images className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-40" />
          <p className="text-lg text-muted-foreground">لا توجد صور مرفوعة بعد</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((project) => {
            const imageCount = (project.image_url ? 1 : 0) + project.purchases.length;
            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant="secondary" className="mr-auto">
                      {imageCount} صورة
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {/* Project cover image */}
                    {project.image_url && (
                      <div
                        className="group relative aspect-square rounded-lg border overflow-hidden cursor-pointer bg-muted/30 hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => setPreviewImage(project.image_url)}
                      >
                        <img
                          src={project.image_url}
                          alt={`صورة ${project.name}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-xs font-medium truncate">صورة المشروع</p>
                        </div>
                      </div>
                    )}

                    {/* Invoice images */}
                    {project.purchases.map((pur) => (
                      <div
                        key={pur.id}
                        className="group relative aspect-square rounded-lg border overflow-hidden cursor-pointer bg-muted/30 hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => setPreviewImage(pur.invoice_image_url)}
                      >
                        <img
                          src={pur.invoice_image_url!}
                          alt={`فاتورة ${pur.invoice_number || ""}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="flex items-center gap-1">
                            <FileImage className="h-3 w-3 text-white/80" />
                            <p className="text-white text-xs font-medium truncate">
                              {pur.invoice_number ? `فاتورة ${pur.invoice_number}` : "فاتورة"}
                              {pur.supplier_name && ` — ${pur.supplier_name}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(v) => !v && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-black/90 border-none">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 text-white hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {previewImage && (
            <img
              src={previewImage}
              alt="معاينة"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
