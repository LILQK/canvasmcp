import type { BrowserContext } from 'playwright';
import type { BrowserStorageState } from '../playwright-types.js';
import { writeAuthState } from '../auth/state.js';
import { normalizeDateTime, isDateWithinRange } from './date.js';
import { classifyAssignment, filterAssignmentsByBucket, filterRecentActivity, isCurrentCourse } from './filters.js';
import { CanvasRequestError } from './errors.js';
import { CanvasHttpClient } from './http.js';
import { extractDeadlineSignal } from './signals.js';
import { createSnippet, stripHtml } from './text.js';
import type {
  AnnouncementResult,
  AssignmentBucket,
  AssignmentDetailResult,
  AssignmentResult,
  CalendarEventResult,
  CanvasActivityStreamItem,
  CanvasActivitySummaryItem,
  CanvasAssignment,
  CanvasAttachment,
  CanvasCalendarEvent,
  CanvasCourse,
  CanvasDiscussionEntry,
  CanvasDiscussionTopic,
  CanvasEnrollment,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  CanvasPlannerItem,
  CanvasProfile,
  CourseActivityResult,
  CourseResult,
  DigestItemResult,
  DiscussionTopicDetailResult,
  FileMetadataResult,
  GradesSummaryResult,
  ModuleItemResult,
  ModuleResult,
  ProfileResult,
  SearchHitResult,
  SubmissionStatusResult,
  WeeklyDigestResult
} from './types.js';

interface CanvasServiceOptions {
  baseUrl: string;
  profileDir: string;
  storageState: BrowserStorageState;
  browserContext?: BrowserContext;
}

function mapAttachment(attachment: CanvasAttachment): FileMetadataResult {
  return {
    id: attachment.id,
    name: attachment.display_name ?? attachment.filename ?? null,
    contentType: attachment.content_type ?? null,
    size: attachment.size ?? null,
    url: attachment.url ?? null,
    previewUrl: attachment.preview_url ?? null,
    updatedAt: normalizeDateTime(attachment.updated_at ?? attachment.created_at ?? null)
  };
}

function mapFiles(files: CanvasAttachment[] | CanvasFile[] | null | undefined): FileMetadataResult[] {
  return (files ?? []).map((file) => ({
    id: file.id,
    name: 'display_name' in file ? (file.display_name ?? file.filename ?? null) : (file.display_name ?? file.filename ?? null),
    contentType: file.content_type ?? null,
    size: file.size ?? null,
    url: file.url ?? null,
    previewUrl: file.preview_url ?? null,
    updatedAt: normalizeDateTime(file.updated_at ?? ('modified_at' in file ? file.modified_at ?? null : null))
  }));
}

function confidenceFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 3) {
    return 'high';
  }

  if (score >= 1) {
    return 'medium';
  }

  return 'low';
}

function riskLevelFromEnrollment(enrollment: CanvasEnrollment | null): GradesSummaryResult['riskLevel'] {
  const score = enrollment?.current_score ?? enrollment?.final_score ?? null;
  if (score === null) {
    return 'medium';
  }

  if (score < 5) {
    return 'high';
  }

  if (score < 7) {
    return 'medium';
  }

  return 'low';
}

export class CanvasService {
  private readonly client: CanvasHttpClient;
  private readonly profileDir: string;
  private readonly browserContext?: BrowserContext;

  constructor(options: CanvasServiceOptions) {
    this.client = new CanvasHttpClient({
      baseUrl: options.baseUrl,
      storageState: options.storageState,
      browserContext: options.browserContext
    });
    this.profileDir = options.profileDir;
    this.browserContext = options.browserContext;
  }

  async close(): Promise<void> {
    await this.browserContext?.close();
  }

  async getProfile(): Promise<ProfileResult> {
    const profile = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasProfile>(api, '/api/v1/users/self/profile')
    );

    await writeAuthState(this.profileDir, {
      lastValidatedAt: new Date().toISOString(),
      lastKnownUserId: profile.id,
      lastKnownLoginId: profile.login_id ?? null
    });

    return {
      id: profile.id,
      name: profile.name,
      loginId: profile.login_id ?? null,
      primaryEmail: profile.primary_email ?? null,
      timeZone: profile.time_zone ?? null,
      locale: profile.locale ?? profile.effective_locale ?? null
    };
  }

  async listCurrentCourses(includeHistorical = false): Promise<CourseResult[]> {
    const params = new URLSearchParams();
    params.append('include[]', 'account');
    params.append('include[]', 'term');
    params.append('per_page', '100');

    const courses = await this.client.getPaginatedJson<CanvasCourse>('/api/v1/users/self/courses', params);
    const visibleCourses = includeHistorical ? courses : courses.filter((course) => isCurrentCourse(course));

    return visibleCourses.map((course) => ({
      id: course.id,
      name: course.name,
      courseCode: course.course_code ?? null,
      workflowState: course.workflow_state ?? null,
      termName: course.term?.name ?? null,
      accountName: course.account?.name ?? null,
      startAt: course.start_at ?? course.term?.start_at ?? null,
      endAt: course.end_at ?? course.term?.end_at ?? null
    }));
  }

  async getCourseAnnouncements(courseId: number, limit = 10, since?: string): Promise<AnnouncementResult[]> {
    const params = new URLSearchParams();
    params.append('context_codes[]', `course_${courseId}`);
    params.append('active_only', 'true');
    params.append('latest_only', 'false');
    params.append('per_page', String(Math.max(limit, 1)));

    if (since) {
      params.append('start_date', since);
    }

    const topics = await this.client.getPaginatedJson<CanvasDiscussionTopic>('/api/v1/announcements', params, 3);

    return topics.slice(0, limit).map((topic) => ({
      id: topic.id,
      title: topic.title,
      postedAt: topic.posted_at ?? null,
      delayedPostAt: topic.delayed_post_at ?? null,
      authorName: topic.author?.display_name ?? null,
      htmlUrl: topic.html_url ?? null
    }));
  }

  async getDiscussionTopicDetail(courseId: number, topicId: number): Promise<DiscussionTopicDetailResult> {
    const topic = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasDiscussionTopic>(api, `/api/v1/courses/${courseId}/discussion_topics/${topicId}`)
    );

    let entries: CanvasDiscussionEntry[] = [];
    try {
      entries = await this.client.withRequestContext((api) =>
        this.client.getJson<CanvasDiscussionEntry[]>(api, `/api/v1/courses/${courseId}/discussion_topics/${topicId}/view`)
      );
    } catch (error) {
      if (!(error instanceof CanvasRequestError) || error.status !== 404) {
        throw error;
      }
    }

    return {
      courseId,
      topicId: topic.id,
      title: topic.title,
      body: {
        html: topic.message ?? null,
        text: stripHtml(topic.message)
      },
      authorName: topic.author?.display_name ?? null,
      postedAt: normalizeDateTime(topic.posted_at ?? null),
      delayedPostAt: normalizeDateTime(topic.delayed_post_at ?? null),
      htmlUrl: topic.html_url ?? null,
      attachments: mapFiles(topic.attachments),
      comments: entries.map((entry) => ({
        id: entry.id,
        authorName: entry.user_name ?? null,
        message: {
          html: entry.message ?? null,
          text: stripHtml(entry.message)
        },
        createdAt: normalizeDateTime(entry.created_at ?? null),
        updatedAt: normalizeDateTime(entry.updated_at ?? null)
      }))
    };
  }

  async getCourseAssignments(courseId: number, bucket: AssignmentBucket, limit = 20): Promise<AssignmentResult[]> {
    const assignments = await this.fetchAssignments(courseId);
    const mapped = assignments.map((assignment) => ({
      id: assignment.id,
      name: assignment.name,
      dueAt: assignment.due_at ?? null,
      htmlUrl: assignment.html_url ?? null,
      bucket: classifyAssignment(assignment),
      submittedAt: assignment.submission?.submitted_at ?? null,
      missing: Boolean(assignment.submission?.missing)
    }));

    return filterAssignmentsByBucket(mapped, bucket).slice(0, limit);
  }

  async getAssignmentDetail(courseId: number, assignmentId: number): Promise<AssignmentDetailResult> {
    const params = new URLSearchParams();
    params.append('include[]', 'submission');
    params.append('include[]', 'rubric');

    const assignment = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasAssignment>(api, `/api/v1/courses/${courseId}/assignments/${assignmentId}`, params)
    );

    return {
      courseId,
      assignmentId: assignment.id,
      title: assignment.name,
      body: {
        html: assignment.description ?? null,
        text: stripHtml(assignment.description)
      },
      dueAt: normalizeDateTime(assignment.due_at ?? null),
      unlockAt: normalizeDateTime(assignment.unlock_at ?? null),
      lockAt: normalizeDateTime(assignment.lock_at ?? null),
      htmlUrl: assignment.html_url ?? null,
      submissionTypes: assignment.submission_types ?? [],
      allowedAttempts: assignment.allowed_attempts ?? null,
      pointsPossible: assignment.points_possible ?? null,
      rubric: (assignment.rubric ?? []).map((criterion) => ({
        id: criterion.id ?? null,
        description: criterion.description ?? null,
        longDescription: criterion.long_description ?? null,
        points: criterion.points ?? null
      })),
      attachments: mapFiles(assignment.attachments)
    };
  }

  async getSubmissionStatus(courseId: number, assignmentId: number): Promise<SubmissionStatusResult> {
    const assignment = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasAssignment>(api, `/api/v1/courses/${courseId}/assignments/${assignmentId}`, new URLSearchParams([['include[]', 'submission']]))
    );
    const submission = assignment.submission ?? {};

    return {
      courseId,
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      submitted: Boolean(submission.submitted_at),
      missing: Boolean(submission.missing),
      late: Boolean(submission.late),
      workflowState: submission.workflow_state ?? null,
      submittedAt: normalizeDateTime(submission.submitted_at ?? null),
      attempt: submission.attempt ?? null,
      score: submission.score ?? null,
      grade: submission.grade ?? null,
      feedback: (submission.submission_comments ?? []).map((comment) => ({
        id: comment.id ?? null,
        authorName: comment.author_name ?? null,
        comment: comment.comment ?? null,
        createdAt: normalizeDateTime(comment.created_at ?? null)
      }))
    };
  }

  async getCourseActivity(courseId: number, days = 14): Promise<CourseActivityResult> {
    const summary = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasActivitySummaryItem[]>(api, `/api/v1/courses/${courseId}/activity_stream/summary`)
    );
    const recentItems = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasActivityStreamItem[]>(api, `/api/v1/courses/${courseId}/activity_stream`)
    );

    return {
      summary: summary.map((item) => ({
        type: item.type ?? null,
        unreadCount: item.unread_count ?? 0,
        count: item.count ?? 0,
        notificationCategory: item.notification_category ?? null
      })),
      recentItems: filterRecentActivity(recentItems, days).map((item) => ({
        title: item.title ?? null,
        type: item.type ?? null,
        updatedAt: item.updated_at ?? item.created_at ?? null,
        htmlUrl: item.html_url ?? null
      }))
    };
  }

  async getCourseCalendarEvents(courseId: number, from: string, to: string): Promise<CalendarEventResult[]> {
    const params = new URLSearchParams();
    params.append('context_codes[]', `course_${courseId}`);
    params.append('start_date', from);
    params.append('end_date', to);
    params.append('per_page', '100');

    const events = await this.client.getPaginatedJson<CanvasCalendarEvent>('/api/v1/calendar_events', params, 3);

    return events.map((event) => ({
      id: `calendar-${event.id}`,
      title: event.title ?? null,
      body: {
        html: event.description ?? null,
        text: stripHtml(event.description)
      },
      courseId,
      startAt: normalizeDateTime(event.start_at ?? null),
      endAt: normalizeDateTime(event.end_at ?? null),
      htmlUrl: event.html_url ?? null,
      sourceType: 'calendar'
    }));
  }

  async getUserTodo(from: string, to: string): Promise<CalendarEventResult[]> {
    const items = await this.client.withRequestContext((api) =>
      this.client.getJson<CanvasPlannerItem[]>(api, '/api/v1/users/self/todo')
    );

    return items
      .filter((item) => isDateWithinRange(item.todo_date ?? null, from, to))
      .map((item) => ({
        id: `todo-${item.id}`,
        title: item.title ?? null,
        body: {
          html: null,
          text: item.title ?? null
        },
        courseId: item.course_id ?? null,
        startAt: normalizeDateTime(item.todo_date ?? null),
        endAt: normalizeDateTime(item.todo_date ?? null),
        htmlUrl: item.html_url ?? null,
        sourceType: 'todo'
      }));
  }

  async getCourseModules(courseId: number): Promise<ModuleResult[]> {
    const params = new URLSearchParams();
    params.append('per_page', '100');
    const modules = await this.client.getPaginatedJson<CanvasModule>(`/api/v1/courses/${courseId}/modules`, params, 3);

    return modules.map((module) => ({
      id: module.id,
      name: module.name ?? null,
      position: module.position ?? null,
      unlockAt: normalizeDateTime(module.unlock_at ?? null),
      state: module.state ?? null
    }));
  }

  async getModuleItems(courseId: number, moduleId: number): Promise<ModuleItemResult[]> {
    const params = new URLSearchParams();
    params.append('per_page', '100');
    const items = await this.client.getPaginatedJson<CanvasModuleItem>(
      `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
      params,
      3
    );

    return items.map((item) => ({
      courseId,
      moduleId,
      itemId: item.id,
      title: item.title ?? null,
      type: item.type ?? null,
      htmlUrl: item.html_url ?? null,
      url: item.url ?? null,
      published: item.published ?? null,
      completionRequirement: item.completion_requirement
        ? {
            type: item.completion_requirement.type ?? null,
            completed: item.completion_requirement.completed ?? null
          }
        : null
    }));
  }

  async getCourseFiles(courseId: number, query?: string, limit = 25): Promise<FileMetadataResult[]> {
    const params = new URLSearchParams();
    params.append('per_page', String(Math.min(Math.max(limit, 1), 100)));
    if (query) {
      params.append('search_term', query);
    }

    const files = await this.client.getPaginatedJson<CanvasFile>(`/api/v1/courses/${courseId}/files`, params, 3);
    return mapFiles(files).slice(0, limit);
  }

  async getGradesSummary(courseId: number): Promise<GradesSummaryResult> {
    const params = new URLSearchParams();
    params.append('user_id', 'self');
    params.append('per_page', '10');

    const enrollments = await this.client.getPaginatedJson<CanvasEnrollment>(`/api/v1/courses/${courseId}/enrollments`, params, 2);
    const enrollment = enrollments[0] ?? null;

    return {
      courseId,
      currentScore: enrollment?.current_score ?? null,
      finalScore: enrollment?.final_score ?? null,
      currentGrade: enrollment?.current_grade ?? null,
      finalGrade: enrollment?.final_grade ?? null,
      unpostedCurrentScore: enrollment?.unposted_current_score ?? null,
      unpostedFinalScore: enrollment?.unposted_final_score ?? null,
      riskLevel: riskLevelFromEnrollment(enrollment)
    };
  }

  async searchCourseContent(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    const [assignmentHits, announcementHits, activityHits, calendarHits, todoHits, moduleHits] = await Promise.all([
      this.searchAssignments(courseId, query, from, to),
      this.searchAnnouncements(courseId, query, from, to),
      this.searchActivity(courseId, query, from, to),
      this.searchCalendar(courseId, query, from, to),
      this.searchTodo(courseId, query, from, to),
      this.searchModuleItems(courseId, query)
    ]);

    return [...assignmentHits, ...announcementHits, ...activityHits, ...calendarHits, ...todoHits, ...moduleHits].sort(
      (left, right) => right.signalScore - left.signalScore
    );
  }

  async getWeeklyDigest(
    from: string,
    to: string,
    includeHistorical = false,
    includeSignals = true
  ): Promise<WeeklyDigestResult> {
    const courses = await this.listCurrentCourses(includeHistorical);
    const userTodo = await this.getUserTodo(from, to);
    const courseEntries = await Promise.all(
      courses.map(async (course) => ({
        course,
        assignments: await this.getCourseAssignments(course.id, 'all', 100),
        announcements: await this.getCourseAnnouncements(course.id, 20, from),
        activity: await this.getCourseActivity(course.id, 30),
        calendar: await this.getCourseCalendarEvents(course.id, from, to),
        modules: await this.getCourseModules(course.id)
      }))
    );

    const items: DigestItemResult[] = [];
    const warnings: string[] = [];

    for (const entry of courseEntries) {
      const courseName = entry.course.name;

      for (const assignment of entry.assignments) {
        if (!isDateWithinRange(assignment.dueAt, from, to)) {
          continue;
        }

        items.push({
          classification: 'formal_deadline',
          courseId: entry.course.id,
          courseName,
          title: assignment.name,
          sourceType: 'assignment',
          itemId: String(assignment.id),
          htmlUrl: assignment.htmlUrl,
          relevantDate: normalizeDateTime(assignment.dueAt),
          snippet: null,
          confidence: 'high',
          matchedTerms: []
        });
      }

      for (const announcement of entry.announcements) {
        const detail = await this.getDiscussionTopicDetail(entry.course.id, announcement.id);
        const signal = extractDeadlineSignal(detail.body.text);
        if (includeSignals && signal.score > 0) {
          items.push({
            classification: 'possible_deadline',
            courseId: entry.course.id,
            courseName,
            title: detail.title,
            sourceType: 'announcement',
            itemId: String(detail.topicId),
            htmlUrl: detail.htmlUrl,
            relevantDate: detail.postedAt,
            snippet: createSnippet(detail.body.text, signal.matches[0] ?? detail.title),
            confidence: confidenceFromScore(signal.score),
            matchedTerms: signal.matches
          });
        } else {
          items.push({
            classification: 'announcement',
            courseId: entry.course.id,
            courseName,
            title: detail.title,
            sourceType: 'announcement',
            itemId: String(detail.topicId),
            htmlUrl: detail.htmlUrl,
            relevantDate: detail.postedAt,
            snippet: createSnippet(detail.body.text, detail.title),
            confidence: 'low',
            matchedTerms: []
          });
        }
      }

      for (const event of entry.calendar) {
        items.push({
          classification: 'calendar_event',
          courseId: event.courseId,
          courseName,
          title: event.title,
          sourceType: event.sourceType,
          itemId: event.id,
          htmlUrl: event.htmlUrl,
          relevantDate: event.startAt,
          snippet: event.body.text,
          confidence: 'medium',
          matchedTerms: []
        });
      }

      for (const module of entry.modules) {
        const moduleItems = await this.getModuleItems(entry.course.id, module.id);
        for (const moduleItem of moduleItems.filter((item) => item.completionRequirement !== null)) {
          items.push({
            classification: 'module_requirement',
            courseId: entry.course.id,
            courseName,
            title: moduleItem.title,
            sourceType: 'module_item',
            itemId: `${module.id}-${moduleItem.itemId}`,
            htmlUrl: moduleItem.htmlUrl,
            relevantDate: null,
            snippet: moduleItem.completionRequirement?.type ?? null,
            confidence: 'medium',
            matchedTerms: []
          });
        }
      }

      const activitySignals = entry.activity.recentItems.flatMap((item) => {
        const text = [item.title, item.type].filter(Boolean).join(' ');
        const signal = extractDeadlineSignal(text);
        return signal.score > 0
          ? [{
              classification: 'risk_signal' as const,
              courseId: entry.course.id,
              courseName,
              title: item.title,
              sourceType: 'activity',
              itemId: item.htmlUrl ?? item.title ?? 'activity',
              htmlUrl: item.htmlUrl,
              relevantDate: normalizeDateTime(item.updatedAt),
              snippet: createSnippet(text, signal.matches[0] ?? item.title ?? ''),
              confidence: confidenceFromScore(signal.score),
              matchedTerms: signal.matches
            }]
          : [];
      });
      items.push(...activitySignals);
    }

    for (const todo of userTodo) {
      items.push({
        classification: 'calendar_event',
        courseId: todo.courseId,
        courseName: null,
        title: todo.title,
        sourceType: todo.sourceType,
        itemId: todo.id,
        htmlUrl: todo.htmlUrl,
        relevantDate: todo.startAt,
        snippet: todo.body.text,
        confidence: 'medium',
        matchedTerms: []
      });
    }

    const formalCount = items.filter((item) => item.classification === 'formal_deadline').length;
    const softCount = items.filter((item) => item.classification === 'possible_deadline').length;
    if (formalCount <= 1 && softCount > 0) {
      warnings.push('Few formal deadlines were found; additional soft signals were detected in announcements or activity.');
    }

    const confidence: WeeklyDigestResult['confidence'] = softCount > formalCount ? 'medium' : 'high';

    return {
      from,
      to,
      includeHistorical,
      items: items.sort((left, right) => {
        const leftTime = left.relevantDate?.raw ? Date.parse(left.relevantDate.raw) : Number.MAX_SAFE_INTEGER;
        const rightTime = right.relevantDate?.raw ? Date.parse(right.relevantDate.raw) : Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      }),
      sourcesChecked: ['assignments', 'announcements', 'activity', 'calendar', 'todo', 'modules'],
      confidence,
      warnings
    };
  }

  private async fetchAssignments(courseId: number): Promise<CanvasAssignment[]> {
    const params = new URLSearchParams();
    params.append('include[]', 'submission');
    params.append('per_page', '100');
    return this.client.getPaginatedJson<CanvasAssignment>(`/api/v1/courses/${courseId}/assignments`, params, 4);
  }

  private async searchAssignments(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    const assignments = await this.fetchAssignments(courseId);
    return assignments
      .filter((assignment) => {
        const haystack = `${assignment.name} ${stripHtml(assignment.description) ?? ''}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) || extractDeadlineSignal(haystack).score > 0;
      })
      .filter((assignment) => !from || !to || isDateWithinRange(assignment.due_at ?? assignment.unlock_at ?? null, from, to))
      .map((assignment) => {
        const text = `${assignment.name} ${stripHtml(assignment.description) ?? ''}`.trim();
        const signal = extractDeadlineSignal(text);
        return {
          sourceType: 'assignment',
          courseId,
          itemId: String(assignment.id),
          title: assignment.name,
          snippet: createSnippet(text, query),
          htmlUrl: assignment.html_url ?? null,
          matchedTerms: signal.matches,
          signalScore: Math.max(signal.score, text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0),
          relevantDate: normalizeDateTime(assignment.due_at ?? assignment.unlock_at ?? null)
        };
      });
  }

  private async searchAnnouncements(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    const announcements = await this.getCourseAnnouncements(courseId, 30, from);
    const details = await Promise.all(announcements.map((announcement) => this.getDiscussionTopicDetail(courseId, announcement.id)));
    return details
      .filter((detail) => {
        const haystack = `${detail.title} ${detail.body.text ?? ''}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) || extractDeadlineSignal(haystack).score > 0;
      })
      .filter((detail) => !from || !to || isDateWithinRange(detail.postedAt.raw, from, to))
      .map((detail) => {
        const text = `${detail.title} ${detail.body.text ?? ''}`.trim();
        const signal = extractDeadlineSignal(text);
        return {
          sourceType: 'announcement',
          courseId,
          itemId: String(detail.topicId),
          title: detail.title,
          snippet: createSnippet(text, query),
          htmlUrl: detail.htmlUrl,
          matchedTerms: signal.matches,
          signalScore: Math.max(signal.score, text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0),
          relevantDate: detail.postedAt
        };
      });
  }

  private async searchActivity(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    const activity = await this.getCourseActivity(courseId, 30);
    return activity.recentItems
      .filter((item) => {
        const haystack = `${item.title ?? ''} ${item.type ?? ''}`.toLowerCase();
        return haystack.includes(query.toLowerCase()) || extractDeadlineSignal(haystack).score > 0;
      })
      .filter((item) => !from || !to || isDateWithinRange(item.updatedAt, from, to))
      .map((item) => {
        const text = `${item.title ?? ''} ${item.type ?? ''}`.trim();
        const signal = extractDeadlineSignal(text);
        return {
          sourceType: 'activity',
          courseId,
          itemId: item.htmlUrl ?? item.title ?? 'activity',
          title: item.title,
          snippet: createSnippet(text, query),
          htmlUrl: item.htmlUrl,
          matchedTerms: signal.matches,
          signalScore: Math.max(signal.score, text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0),
          relevantDate: normalizeDateTime(item.updatedAt)
        };
      });
  }

  private async searchCalendar(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    if (!from || !to) {
      return [];
    }

    const events = await this.getCourseCalendarEvents(courseId, from, to);
    return events
      .filter((event) => `${event.title ?? ''} ${event.body.text ?? ''}`.toLowerCase().includes(query.toLowerCase()))
      .map((event) => ({
        sourceType: 'calendar',
        courseId,
        itemId: event.id,
        title: event.title,
        snippet: createSnippet(`${event.title ?? ''} ${event.body.text ?? ''}`, query),
        htmlUrl: event.htmlUrl,
        matchedTerms: [],
        signalScore: 1,
        relevantDate: event.startAt
      }));
  }

  private async searchTodo(courseId: number, query: string, from?: string, to?: string): Promise<SearchHitResult[]> {
    if (!from || !to) {
      return [];
    }

    const items = await this.getUserTodo(from, to);
    return items
      .filter((item) => item.courseId === courseId)
      .filter((item) => `${item.title ?? ''} ${item.body.text ?? ''}`.toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({
        sourceType: 'todo',
        courseId,
        itemId: item.id,
        title: item.title,
        snippet: createSnippet(`${item.title ?? ''} ${item.body.text ?? ''}`, query),
        htmlUrl: item.htmlUrl,
        matchedTerms: [],
        signalScore: 1,
        relevantDate: item.startAt
      }));
  }

  private async searchModuleItems(courseId: number, query: string): Promise<SearchHitResult[]> {
    const modules = await this.getCourseModules(courseId);
    const items = (await Promise.all(modules.map((module) => this.getModuleItems(courseId, module.id)))).flat();

    return items
      .filter((item) => `${item.title ?? ''} ${item.type ?? ''}`.toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({
        sourceType: 'module_item',
        courseId,
        itemId: String(item.itemId),
        title: item.title,
        snippet: createSnippet(`${item.title ?? ''} ${item.type ?? ''}`, query),
        htmlUrl: item.htmlUrl,
        matchedTerms: [],
        signalScore: 1,
        relevantDate: null
      }));
  }
}
