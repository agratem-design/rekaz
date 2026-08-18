import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export function LegacyEditRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/projects/${id}/settings`, { replace: true });
    } else {
      navigate("/projects", { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="p-8 text-center text-xs text-muted-foreground" dir="rtl">
      <span>جاري التحويل إلى إعدادات المشروع...</span>
    </div>
  );
}
