import { describe, expect, it } from 'vitest';
import { classifyAssignment, filterAssignmentsByBucket, filterRecentActivity, isCurrentCourse } from '../src/canvas/filters.js';

describe('course filtering', () => {
  it('excludes completed courses', () => {
    expect(
      isCurrentCourse(
        {
          id: 1,
          name: 'Done',
          workflow_state: 'completed'
        },
        new Date('2026-03-06T10:00:00Z')
      )
    ).toBe(false);
  });

  it('keeps published courses without date restrictions', () => {
    expect(
      isCurrentCourse(
        {
          id: 2,
          name: 'Active',
          workflow_state: 'available',
          access_restricted_by_date: false
        },
        new Date('2026-03-06T10:00:00Z')
      )
    ).toBe(true);
  });
});

describe('assignment classification', () => {
  it('classifies missing assignments', () => {
    expect(
      classifyAssignment({
        id: 1,
        name: 'Essay',
        submission: { missing: true }
      })
    ).toBe('missing');
  });

  it('filters by bucket', () => {
    const result = filterAssignmentsByBucket(
      [
        {
          id: 1,
          name: 'Upcoming',
          dueAt: null,
          htmlUrl: null,
          bucket: 'upcoming',
          submittedAt: null,
          missing: false
        },
        {
          id: 2,
          name: 'Missing',
          dueAt: null,
          htmlUrl: null,
          bucket: 'missing',
          submittedAt: null,
          missing: true
        }
      ],
      'missing'
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });
});

describe('activity filtering', () => {
  it('keeps recent activity only', () => {
    const items = filterRecentActivity(
      [
        { title: 'Recent', updated_at: '2026-03-05T12:00:00Z' },
        { title: 'Old', updated_at: '2026-02-01T12:00:00Z' }
      ],
      14,
      new Date('2026-03-06T12:00:00Z')
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Recent');
  });
});
