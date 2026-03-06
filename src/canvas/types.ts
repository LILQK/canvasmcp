import type { NormalizedDateTime } from './date.js';

export interface CanvasProfile {
  id: number;
  name: string;
  primary_email?: string | null;
  login_id?: string | null;
  locale?: string | null;
  effective_locale?: string | null;
  time_zone?: string | null;
}

export interface CanvasTerm {
  id?: number;
  name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
}

export interface CanvasAccount {
  id?: number;
  name?: string | null;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string | null;
  workflow_state?: string | null;
  access_restricted_by_date?: boolean | null;
  start_at?: string | null;
  end_at?: string | null;
  term?: CanvasTerm | null;
  account?: CanvasAccount | null;
  image_download_url?: string | null;
}

export interface CanvasAttachment {
  id: number;
  filename?: string | null;
  display_name?: string | null;
  content_type?: string | null;
  size?: number | null;
  url?: string | null;
  preview_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CanvasRubricCriterion {
  id?: string | null;
  description?: string | null;
  long_description?: string | null;
  points?: number | null;
}

export interface CanvasSubmission {
  id?: number;
  assignment_id?: number;
  missing?: boolean;
  late?: boolean;
  submitted_at?: string | null;
  workflow_state?: string | null;
  attempt?: number | null;
  score?: number | null;
  grade?: string | null;
  submission_comments?: Array<{
    id?: number | null;
    comment?: string | null;
    created_at?: string | null;
    author_name?: string | null;
  }> | null;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  html_url?: string | null;
  submission_types?: string[] | null;
  allowed_attempts?: number | null;
  points_possible?: number | null;
  has_submitted_submissions?: boolean | null;
  rubric?: CanvasRubricCriterion[] | null;
  attachments?: CanvasAttachment[] | null;
  submission?: CanvasSubmission | null;
}

export interface CanvasDiscussionEntry {
  id: number;
  message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user_name?: string | null;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message?: string | null;
  posted_at?: string | null;
  delayed_post_at?: string | null;
  html_url?: string | null;
  attachments?: CanvasAttachment[] | null;
  author?: {
    display_name?: string | null;
  } | null;
}

export interface CanvasActivitySummaryItem {
  type?: string | null;
  unread_count?: number | null;
  count?: number | null;
  notification_category?: string | null;
}

export interface CanvasActivityStreamItem {
  title?: string | null;
  message?: string | null;
  type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  html_url?: string | null;
}

export interface CanvasPlannerItem {
  id: string | number;
  title?: string | null;
  plannable_type?: string | null;
  course_id?: number | null;
  html_url?: string | null;
  todo_date?: string | null;
  planner_override?: {
    marked_complete?: boolean | null;
  } | null;
}

export interface CanvasCalendarEvent {
  id: number;
  title?: string | null;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  html_url?: string | null;
  context_code?: string | null;
}

export interface CanvasModule {
  id: number;
  name?: string | null;
  position?: number | null;
  unlock_at?: string | null;
  state?: string | null;
}

export interface CanvasModuleItem {
  id: number;
  title?: string | null;
  type?: string | null;
  html_url?: string | null;
  url?: string | null;
  completion_requirement?: {
    type?: string | null;
    completed?: boolean | null;
  } | null;
  published?: boolean | null;
}

export interface CanvasFile {
  id: number;
  display_name?: string | null;
  filename?: string | null;
  content_type?: string | null;
  size?: number | null;
  updated_at?: string | null;
  modified_at?: string | null;
  url?: string | null;
  preview_url?: string | null;
  folder_id?: number | null;
}

export interface CanvasEnrollment {
  current_score?: number | null;
  final_score?: number | null;
  current_grade?: string | null;
  final_grade?: string | null;
  unposted_current_score?: number | null;
  unposted_final_score?: number | null;
  total_activity_time?: number | null;
}

export interface ProfileResult extends Record<string, unknown> {
  id: number;
  name: string;
  loginId: string | null;
  primaryEmail: string | null;
  timeZone: string | null;
  locale: string | null;
}

export interface CourseResult extends Record<string, unknown> {
  id: number;
  name: string;
  courseCode: string | null;
  workflowState: string | null;
  termName: string | null;
  accountName: string | null;
  startAt: string | null;
  endAt: string | null;
}

export interface RichTextResult extends Record<string, unknown> {
  html: string | null;
  text: string | null;
}

export interface FileMetadataResult extends Record<string, unknown> {
  id: number;
  name: string | null;
  contentType: string | null;
  size: number | null;
  url: string | null;
  previewUrl: string | null;
  updatedAt: NormalizedDateTime;
}

export interface AnnouncementResult extends Record<string, unknown> {
  id: number;
  title: string;
  postedAt: string | null;
  delayedPostAt: string | null;
  authorName: string | null;
  htmlUrl: string | null;
}

export interface DiscussionTopicDetailResult extends Record<string, unknown> {
  courseId: number;
  topicId: number;
  title: string;
  body: RichTextResult;
  authorName: string | null;
  postedAt: NormalizedDateTime;
  delayedPostAt: NormalizedDateTime;
  htmlUrl: string | null;
  attachments: FileMetadataResult[];
  comments: Array<{
    id: number;
    authorName: string | null;
    message: RichTextResult;
    createdAt: NormalizedDateTime;
    updatedAt: NormalizedDateTime;
  }>;
}

export type AssignmentBucket = 'upcoming' | 'missing' | 'all';

export interface AssignmentResult extends Record<string, unknown> {
  id: number;
  name: string;
  dueAt: string | null;
  htmlUrl: string | null;
  bucket: 'upcoming' | 'missing' | 'submitted' | 'other';
  submittedAt: string | null;
  missing: boolean;
}

export interface AssignmentDetailResult extends Record<string, unknown> {
  courseId: number;
  assignmentId: number;
  title: string;
  body: RichTextResult;
  dueAt: NormalizedDateTime;
  unlockAt: NormalizedDateTime;
  lockAt: NormalizedDateTime;
  htmlUrl: string | null;
  submissionTypes: string[];
  allowedAttempts: number | null;
  pointsPossible: number | null;
  rubric: Array<{
    id: string | null;
    description: string | null;
    longDescription: string | null;
    points: number | null;
  }>;
  attachments: FileMetadataResult[];
}

export interface SubmissionStatusResult extends Record<string, unknown> {
  courseId: number;
  assignmentId: number;
  assignmentName: string;
  submitted: boolean;
  missing: boolean;
  late: boolean;
  workflowState: string | null;
  submittedAt: NormalizedDateTime;
  attempt: number | null;
  score: number | null;
  grade: string | null;
  feedback: Array<{
    id: number | null;
    authorName: string | null;
    comment: string | null;
    createdAt: NormalizedDateTime;
  }>;
}

export interface CalendarEventResult extends Record<string, unknown> {
  id: string;
  title: string | null;
  body: RichTextResult;
  courseId: number | null;
  startAt: NormalizedDateTime;
  endAt: NormalizedDateTime;
  htmlUrl: string | null;
  sourceType: 'calendar' | 'todo';
}

export interface ModuleResult extends Record<string, unknown> {
  id: number;
  name: string | null;
  position: number | null;
  unlockAt: NormalizedDateTime;
  state: string | null;
}

export interface ModuleItemResult extends Record<string, unknown> {
  courseId: number;
  moduleId: number;
  itemId: number;
  title: string | null;
  type: string | null;
  htmlUrl: string | null;
  url: string | null;
  published: boolean | null;
  completionRequirement: {
    type: string | null;
    completed: boolean | null;
  } | null;
}

export interface GradesSummaryResult extends Record<string, unknown> {
  courseId: number;
  currentScore: number | null;
  finalScore: number | null;
  currentGrade: string | null;
  finalGrade: string | null;
  unpostedCurrentScore: number | null;
  unpostedFinalScore: number | null;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SearchHitResult extends Record<string, unknown> {
  sourceType: 'assignment' | 'announcement' | 'activity' | 'calendar' | 'todo' | 'module_item';
  courseId: number | null;
  itemId: string;
  title: string | null;
  snippet: string | null;
  htmlUrl: string | null;
  matchedTerms: string[];
  signalScore: number;
  relevantDate: NormalizedDateTime | null;
}

export interface DigestItemResult extends Record<string, unknown> {
  classification: 'formal_deadline' | 'possible_deadline' | 'announcement' | 'calendar_event' | 'module_requirement' | 'risk_signal';
  courseId: number | null;
  courseName: string | null;
  title: string | null;
  sourceType: string;
  itemId: string;
  htmlUrl: string | null;
  relevantDate: NormalizedDateTime | null;
  snippet: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: string[];
}

export interface CourseActivityResult extends Record<string, unknown> {
  summary: Array<{
    type: string | null;
    unreadCount: number;
    count: number;
    notificationCategory: string | null;
  }>;
  recentItems: Array<{
    title: string | null;
    type: string | null;
    updatedAt: string | null;
    htmlUrl: string | null;
  }>;
}

export interface WeeklyDigestResult extends Record<string, unknown> {
  from: string;
  to: string;
  includeHistorical: boolean;
  items: DigestItemResult[];
  sourcesChecked: string[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}
