import { ImportForm } from '@/components/import/ImportForm';
import { WeekList } from '@/components/import/WeekList';

// F-IMP-2..5. Route chỉ cho admin/editor (routes.ts); ImportForm kiểm lại vai trò để báo sớm.
export function ImportPage() {
  return (
    <div className="grid gap-4" data-testid="page-import">
      <ImportForm />
      <WeekList />
    </div>
  );
}
