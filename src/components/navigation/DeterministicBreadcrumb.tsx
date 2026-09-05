import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateInternalReturnTo } from '@/lib/navigation/projectNavigation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface DeterministicBreadcrumbProps {
  items: BreadcrumbItem[];
  fallbackBackHref?: string;
  showBackButton?: boolean;
  className?: string;
}

export function DeterministicBreadcrumb({
  items,
  fallbackBackHref,
  showBackButton = true,
  className = '',
}: DeterministicBreadcrumbProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Internal defensive array normalization
  const safeItems: BreadcrumbItem[] = Array.isArray(items) ? items : [];

  // Determine back destination: state.returnTo -> query.returnTo -> fallbackBackHref -> previous breadcrumb
  const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const queryReturnTo = new URLSearchParams(location.search).get('returnTo');
  const effectiveReturnTo = stateReturnTo || queryReturnTo;
  const previousBreadcrumbHref = safeItems.length > 1 ? safeItems[safeItems.length - 2]?.href : undefined;
  const backDestination = validateInternalReturnTo(
    effectiveReturnTo,
    fallbackBackHref || previousBreadcrumbHref || '/'
  );

  const handleBack = () => {
    navigate(backDestination);
  };

  return (
    <nav
      aria-label="مسار التنقل"
      dir="rtl"
      className={`flex items-center gap-2 text-sm text-muted-foreground flex-wrap py-2 ${className}`}
    >
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 px-2.5 h-8 text-foreground hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors"
          title="الرجوع"
          aria-label="الرجوع إلى الصفحة السابقة"
        >
          <ArrowRight className="h-4 w-4" />
          <span className="text-xs font-medium">رجوع</span>
        </Button>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Link
          to="/"
          className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer p-1 rounded hover:bg-muted/50"
          title="الرئيسية"
          aria-label="الرئيسية"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>

        {safeItems.map((item, index) => {
          const isLast = index === safeItems.length - 1;

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
              {isLast || !item.href ? (
                <span
                  className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px]"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="hover:text-primary transition-colors cursor-pointer truncate max-w-[150px] sm:max-w-[250px]"
                >
                  {item.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
