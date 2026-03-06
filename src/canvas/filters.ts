import type {
  AssignmentBucket,
  AssignmentResult,
  CanvasActivityStreamItem,
  CanvasAssignment,
  CanvasCourse
} from './types.js';
import { toTimestamp } from './date.js';

export function isCurrentCourse(course: CanvasCourse, now = new Date()): boolean {
  const nowMs = now.getTime();

  if (course.workflow_state === 'completed') {
    return false;
  }

  const startAt = toTimestamp(course.start_at ?? course.term?.start_at ?? null);
  const endAt = toTimestamp(course.end_at ?? course.term?.end_at ?? null);

  if (endAt !== null && endAt < nowMs) {
    return false;
  }

  if (course.access_restricted_by_date && startAt !== null && startAt > nowMs) {
    return false;
  }

  return true;
}

export function classifyAssignment(
  assignment: CanvasAssignment,
  now = new Date()
): AssignmentResult['bucket'] {
  const dueAt = toTimestamp(assignment.due_at ?? null);
  const submission = assignment.submission;

  if (submission?.missing) {
    return 'missing';
  }

  if (submission?.submitted_at || assignment.has_submitted_submissions) {
    return 'submitted';
  }

  if (dueAt !== null && dueAt >= now.getTime()) {
    return 'upcoming';
  }

  return 'other';
}

export function filterAssignmentsByBucket(
  assignments: AssignmentResult[],
  bucket: AssignmentBucket
): AssignmentResult[] {
  if (bucket === 'all') {
    return assignments;
  }

  return assignments.filter((assignment) => assignment.bucket === bucket);
}

export function filterRecentActivity(
  items: CanvasActivityStreamItem[],
  days: number,
  now = new Date()
): CanvasActivityStreamItem[] {
  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    const updatedAt = toTimestamp(item.updated_at ?? item.created_at ?? null);
    return updatedAt !== null && updatedAt >= threshold;
  });
}
