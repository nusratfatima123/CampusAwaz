import { createAdminClient } from './supabase/admin';
import type {
  AnalyticsSummary,
  AnalyticsCategoryCount,
  AnalyticsDepartmentCount,
} from '@/types/database';

/**
 * Server-side analytics queries. All results are aggregated — no student
 * identity is ever returned.
 *
 * SERVER ONLY — uses the service-role client.
 */

export async function getAnalyticsSummary(
  universityId: string,
): Promise<AnalyticsSummary> {
  const admin = createAdminClient();

  const [
    categoryResult,
    departmentResult,
    resolutionResult,
    pendingResult,
    escalatedResult,
    totalResult,
    resolvedResult,
    escalationSummaryResult,
    feedbackResult,
  ] = await Promise.all([
    admin
      .from('complaints')
      .select('id, category_id, complaint_categories ( key, label )')
      .eq('university_id', universityId),
    admin
      .from('complaints')
      .select('id, department_id, departments ( key, name )')
      .eq('university_id', universityId),
    admin
      .from('complaints')
      .select('id, submitted_at, updated_at, status')
      .eq('university_id', universityId)
      .eq('status', 'resolved'),
    admin
      .from('complaints')
      .select('id')
      .eq('university_id', universityId)
      .in('status', ['submitted', 'assigned', 'in_review']),
    admin
      .from('complaints')
      .select('id')
      .eq('university_id', universityId)
      .eq('status', 'escalated'),
    admin
      .from('complaints')
      .select('id')
      .eq('university_id', universityId),
    admin
      .from('complaints')
      .select('id')
      .eq('university_id', universityId)
      .eq('status', 'resolved'),
    admin
      .from('escalations')
      .select('id, level, complaints ( university_id )')
      .eq('complaints.university_id', universityId),
    admin
      .from('feedback')
      .select('id, rating, complaints ( university_id )')
      .eq('complaints.university_id', universityId),
  ]);

  const categoryRows = (categoryResult.data ?? []) as unknown as {
    id: string;
    category_id: string | null;
    complaint_categories: { key: string; label: string } | null;
  }[];

  const categoryMap = new Map<string, { label: string; total: number }>();
  for (const row of categoryRows) {
    const key = row.complaint_categories?.key ?? 'uncategorized';
    const label = row.complaint_categories?.label ?? 'Uncategorized';
    const existing = categoryMap.get(key);
    if (existing) {
      existing.total += 1;
    } else {
      categoryMap.set(key, { label, total: 1 });
    }
  }
  const byCategory: AnalyticsCategoryCount[] = Array.from(categoryMap.entries()).map(
    ([key, val]) => ({
      categoryKey: key,
      categoryLabel: val.label,
      total: val.total,
    }),
  );

  const deptRows = (departmentResult.data ?? []) as unknown as {
    id: string;
    department_id: string | null;
    departments: { key: string; name: string } | null;
  }[];

  const deptMap = new Map<string, { name: string; total: number }>();
  for (const row of deptRows) {
    const key = row.departments?.key ?? 'unassigned';
    const name = row.departments?.name ?? 'Unassigned';
    const existing = deptMap.get(key);
    if (existing) {
      existing.total += 1;
    } else {
      deptMap.set(key, { name, total: 1 });
    }
  }
  const byDepartment: AnalyticsDepartmentCount[] = Array.from(deptMap.entries()).map(
    ([key, val]) => ({
      departmentKey: key,
      departmentName: val.name,
      total: val.total,
    }),
  );

  const resolvedRows = (resolutionResult.data ?? []) as {
    id: string;
    submitted_at: string;
    updated_at: string;
    status: string;
  }[];

  let avgResolutionHours: number | null = null;
  if (resolvedRows.length > 0) {
    const totalHours = resolvedRows.reduce((sum, r) => {
      const diff = new Date(r.updated_at).getTime() - new Date(r.submitted_at).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedRows.length) * 10) / 10;
  }

  const pendingCount = pendingResult.data?.length ?? 0;
  const escalatedCount = escalatedResult.data?.length ?? 0;
  const totalCount = totalResult.data?.length ?? 0;
  const resolvedCount = resolvedResult.data?.length ?? 0;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const facilityCount = categoryRows.filter(
    (r) => r.complaint_categories?.key === 'facilities',
  ).length;

  const recurringFacilityIssues: AnalyticsCategoryCount[] = facilityCount > 3
    ? [{ categoryKey: 'facilities', categoryLabel: 'Facilities', total: facilityCount }]
    : [];

  const escalationRows = (escalationSummaryResult.data ?? []) as unknown as {
    id: string;
    level: number;
    complaints: { university_id: string } | null;
  }[];
  const totalEscalations = escalationRows.length;

  const feedbackRows = (feedbackResult.data ?? []) as unknown as {
    id: string;
    rating: number;
    complaints: { university_id: string } | null;
  }[];
  const totalFeedback = feedbackRows.length;
  const avgRating =
    totalFeedback > 0
      ? Math.round(
          (feedbackRows.reduce((sum, f) => sum + f.rating, 0) / totalFeedback) * 10,
        ) / 10
      : null;

  return {
    byCategory,
    byDepartment,
    avgResolutionHours,
    pendingCount,
    escalatedCount,
    resolutionRate,
    recurringFacilityIssues,
    totalFeedback,
    avgRating,
    totalEscalations,
  };
}
