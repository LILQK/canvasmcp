import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import type { BrowserSessionManager } from '../auth/browser-session.js';
import { CanvasAuthError, CanvasRequestError } from '../canvas/errors.js';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true
} as const;

const normalizedDateSchema = z.object({
  raw: z.string().nullable(),
  localDateTime: z.string().nullable()
});

const richTextSchema = z.object({
  html: z.string().nullable(),
  text: z.string().nullable()
});

const fileSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  contentType: z.string().nullable(),
  size: z.number().nullable(),
  url: z.string().nullable(),
  previewUrl: z.string().nullable(),
  updatedAt: normalizedDateSchema
});

function toTextPayload(title: string, payload: unknown): string {
  return `${title}\n${JSON.stringify(payload, null, 2)}`;
}

function formatToolError(error: unknown): never {
  if (error instanceof CanvasAuthError || error instanceof CanvasRequestError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new Error(`Unexpected Canvas MCP error: ${error.message}`);
  }

  throw new Error('Unexpected Canvas MCP error.');
}

export function registerTools(
  server: McpServer,
  dependencies: {
    sessionManager: BrowserSessionManager;
  }
): void {
  server.registerTool(
    'get_auth_status',
    {
      description: 'Use this when you need to verify whether the local UOC Canvas session is configured and still valid.',
      annotations: readOnlyAnnotations,
      outputSchema: {
        isAuthenticated: z.boolean(),
        profileAvailable: z.boolean(),
        lastValidatedAt: z.string().nullable(),
        profileDir: z.string(),
        browserName: z.string(),
        browserOpen: z.boolean(),
        profile: z
          .object({
            id: z.number(),
            name: z.string(),
            loginId: z.string().nullable(),
            primaryEmail: z.string().nullable(),
            timeZone: z.string().nullable(),
            locale: z.string().nullable()
          })
          .nullable()
      }
    },
    async () => {
      const status = await dependencies.sessionManager.getAuthStatus();
      return {
        content: [{ type: 'text', text: toTextPayload('Canvas auth status', status) }],
        structuredContent: status
      };
    }
  );

  server.registerTool(
    'get_profile',
    {
      description: 'Use this when you need the current authenticated user profile from Canvas.',
      annotations: readOnlyAnnotations,
      outputSchema: {
        id: z.number(),
        name: z.string(),
        loginId: z.string().nullable(),
        primaryEmail: z.string().nullable(),
        timeZone: z.string().nullable(),
        locale: z.string().nullable()
      }
    },
    async () => {
      try {
        const service = await dependencies.sessionManager.getService();
        const profile = await service.getProfile();
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas profile', profile) }],
          structuredContent: profile
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'list_current_courses',
    {
      description: 'Use this when you need the user courses from UOC Canvas, filtered to active courses by default.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        includeHistorical: z.boolean().default(false)
      },
      outputSchema: {
        courses: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            courseCode: z.string().nullable(),
            workflowState: z.string().nullable(),
            termName: z.string().nullable(),
            accountName: z.string().nullable(),
            startAt: z.string().nullable(),
            endAt: z.string().nullable()
          })
        )
      }
    },
    async ({ includeHistorical }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const courses = await service.listCurrentCourses(includeHistorical);
        const payload = { courses };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas courses', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_announcements',
    {
      description: 'Use this when you need course announcements for a specific Canvas course.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        limit: z.number().int().positive().max(50).default(10),
        since: z.string().datetime().optional()
      },
      outputSchema: {
        courseId: z.number(),
        announcements: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            postedAt: z.string().nullable(),
            delayedPostAt: z.string().nullable(),
            authorName: z.string().nullable(),
            htmlUrl: z.string().nullable()
          })
        )
      }
    },
    async ({ courseId, limit, since }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const announcements = await service.getCourseAnnouncements(courseId, limit, since);
        const payload = { courseId, announcements };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course announcements', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_discussion_topic_detail',
    {
      description: 'Use this when you need the full body, attachments, and comments for an announcement or discussion topic.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        topicId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        topicId: z.number(),
        title: z.string(),
        body: richTextSchema,
        authorName: z.string().nullable(),
        postedAt: normalizedDateSchema,
        delayedPostAt: normalizedDateSchema,
        htmlUrl: z.string().nullable(),
        attachments: z.array(fileSchema),
        comments: z.array(
          z.object({
            id: z.number(),
            authorName: z.string().nullable(),
            message: richTextSchema,
            createdAt: normalizedDateSchema,
            updatedAt: normalizedDateSchema
          })
        )
      }
    },
    async ({ courseId, topicId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const detail = await service.getDiscussionTopicDetail(courseId, topicId);
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas discussion topic detail', detail) }],
          structuredContent: detail
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_assignments',
    {
      description: 'Use this when you need assignments for a course, optionally filtered to upcoming, missing, or all.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        bucket: z.enum(['upcoming', 'missing', 'all']).default('upcoming'),
        limit: z.number().int().positive().max(100).default(20)
      },
      outputSchema: {
        courseId: z.number(),
        bucket: z.enum(['upcoming', 'missing', 'all']),
        assignments: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            dueAt: z.string().nullable(),
            htmlUrl: z.string().nullable(),
            bucket: z.enum(['upcoming', 'missing', 'submitted', 'other']),
            submittedAt: z.string().nullable(),
            missing: z.boolean()
          })
        )
      }
    },
    async ({ courseId, bucket, limit }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const assignments = await service.getCourseAssignments(courseId, bucket, limit);
        const payload = { courseId, bucket, assignments };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course assignments', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_assignment_detail',
    {
      description: 'Use this when you need the full assignment description, dates, rubric, and attachments.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        assignmentId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        assignmentId: z.number(),
        title: z.string(),
        body: richTextSchema,
        dueAt: normalizedDateSchema,
        unlockAt: normalizedDateSchema,
        lockAt: normalizedDateSchema,
        htmlUrl: z.string().nullable(),
        submissionTypes: z.array(z.string()),
        allowedAttempts: z.number().nullable(),
        pointsPossible: z.number().nullable(),
        rubric: z.array(
          z.object({
            id: z.string().nullable(),
            description: z.string().nullable(),
            longDescription: z.string().nullable(),
            points: z.number().nullable()
          })
        ),
        attachments: z.array(fileSchema)
      }
    },
    async ({ courseId, assignmentId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const detail = await service.getAssignmentDetail(courseId, assignmentId);
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas assignment detail', detail) }],
          structuredContent: detail
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_submission_status',
    {
      description: 'Use this when you need the real submission state for a specific assignment.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        assignmentId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        assignmentId: z.number(),
        assignmentName: z.string(),
        submitted: z.boolean(),
        missing: z.boolean(),
        late: z.boolean(),
        workflowState: z.string().nullable(),
        submittedAt: normalizedDateSchema,
        attempt: z.number().nullable(),
        score: z.number().nullable(),
        grade: z.string().nullable(),
        feedback: z.array(
          z.object({
            id: z.number().nullable(),
            authorName: z.string().nullable(),
            comment: z.string().nullable(),
            createdAt: normalizedDateSchema
          })
        )
      }
    },
    async ({ courseId, assignmentId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const status = await service.getSubmissionStatus(courseId, assignmentId);
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas submission status', status) }],
          structuredContent: status
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_activity',
    {
      description: 'Use this when you need the activity summary and recent activity items for a Canvas course.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        days: z.number().int().positive().max(90).default(14)
      },
      outputSchema: {
        courseId: z.number(),
        days: z.number(),
        activity: z.object({
          summary: z.array(
            z.object({
              type: z.string().nullable(),
              unreadCount: z.number(),
              count: z.number(),
              notificationCategory: z.string().nullable()
            })
          ),
          recentItems: z.array(
            z.object({
              title: z.string().nullable(),
              type: z.string().nullable(),
              updatedAt: z.string().nullable(),
              htmlUrl: z.string().nullable()
            })
          )
        })
      }
    },
    async ({ courseId, days }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const activity = await service.getCourseActivity(courseId, days);
        const payload = { courseId, days, activity };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course activity', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_calendar_events',
    {
      description: 'Use this when you need calendar events for a course within a time range.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        from: z.string().datetime(),
        to: z.string().datetime()
      },
      outputSchema: {
        courseId: z.number(),
        events: z.array(
          z.object({
            id: z.string(),
            title: z.string().nullable(),
            body: richTextSchema,
            courseId: z.number().nullable(),
            startAt: normalizedDateSchema,
            endAt: normalizedDateSchema,
            htmlUrl: z.string().nullable(),
            sourceType: z.enum(['calendar', 'todo'])
          })
        )
      }
    },
    async ({ courseId, from, to }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const events = await service.getCourseCalendarEvents(courseId, from, to);
        const payload = { courseId, events };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course calendar events', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_user_todo',
    {
      description: 'Use this when you need the current user todo items within a date range.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        from: z.string().datetime(),
        to: z.string().datetime()
      },
      outputSchema: {
        todos: z.array(
          z.object({
            id: z.string(),
            title: z.string().nullable(),
            body: richTextSchema,
            courseId: z.number().nullable(),
            startAt: normalizedDateSchema,
            endAt: normalizedDateSchema,
            htmlUrl: z.string().nullable(),
            sourceType: z.enum(['calendar', 'todo'])
          })
        )
      }
    },
    async ({ from, to }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const todos = await service.getUserTodo(from, to);
        const payload = { todos };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas user todo', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_modules',
    {
      description: 'Use this when you need the module sequence for a course.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        modules: z.array(
          z.object({
            id: z.number(),
            name: z.string().nullable(),
            position: z.number().nullable(),
            unlockAt: normalizedDateSchema,
            state: z.string().nullable()
          })
        )
      }
    },
    async ({ courseId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const modules = await service.getCourseModules(courseId);
        const payload = { courseId, modules };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course modules', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_module_items',
    {
      description: 'Use this when you need the items inside a specific course module.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        moduleId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        moduleId: z.number(),
        items: z.array(
          z.object({
            courseId: z.number(),
            moduleId: z.number(),
            itemId: z.number(),
            title: z.string().nullable(),
            type: z.string().nullable(),
            htmlUrl: z.string().nullable(),
            url: z.string().nullable(),
            published: z.boolean().nullable(),
            completionRequirement: z
              .object({
                type: z.string().nullable(),
                completed: z.boolean().nullable()
              })
              .nullable()
          })
        )
      }
    },
    async ({ courseId, moduleId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const items = await service.getModuleItems(courseId, moduleId);
        const payload = { courseId, moduleId, items };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas module items', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_course_files',
    {
      description: 'Use this when you need file metadata and URLs for a course.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        query: z.string().min(1).optional(),
        limit: z.number().int().positive().max(100).default(25)
      },
      outputSchema: {
        courseId: z.number(),
        files: z.array(fileSchema)
      }
    },
    async ({ courseId, query, limit }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const files = await service.getCourseFiles(courseId, query, limit);
        const payload = { courseId, files };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course files', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_grades_summary',
    {
      description: 'Use this when you need the course-level grading summary and a simple risk indicator.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive()
      },
      outputSchema: {
        courseId: z.number(),
        currentScore: z.number().nullable(),
        finalScore: z.number().nullable(),
        currentGrade: z.string().nullable(),
        finalGrade: z.string().nullable(),
        unpostedCurrentScore: z.number().nullable(),
        unpostedFinalScore: z.number().nullable(),
        riskLevel: z.enum(['low', 'medium', 'high'])
      }
    },
    async ({ courseId }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const summary = await service.getGradesSummary(courseId);
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas grades summary', summary) }],
          structuredContent: summary
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'search_course_content',
    {
      description: 'Use this when you need to search for possible hidden deadlines or matching text inside course content.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        courseId: z.number().int().positive(),
        query: z.string().min(1),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional()
      },
      outputSchema: {
        courseId: z.number(),
        query: z.string(),
        hits: z.array(
          z.object({
            sourceType: z.enum(['assignment', 'announcement', 'activity', 'calendar', 'todo', 'module_item']),
            courseId: z.number().nullable(),
            itemId: z.string(),
            title: z.string().nullable(),
            snippet: z.string().nullable(),
            htmlUrl: z.string().nullable(),
            matchedTerms: z.array(z.string()),
            signalScore: z.number(),
            relevantDate: normalizedDateSchema.nullable()
          })
        )
      }
    },
    async ({ courseId, query, from, to }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const hits = await service.searchCourseContent(courseId, query, from, to);
        const payload = { courseId, query, hits };
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas course content search', payload) }],
          structuredContent: payload
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );

  server.registerTool(
    'get_weekly_digest',
    {
      description: 'Use this when you need a combined weekly digest of formal deadlines, soft signals, calendar events, and module requirements.',
      annotations: readOnlyAnnotations,
      inputSchema: {
        from: z.string().datetime(),
        to: z.string().datetime(),
        includeHistorical: z.boolean().default(false),
        includeSignals: z.boolean().default(true)
      },
      outputSchema: {
        from: z.string(),
        to: z.string(),
        includeHistorical: z.boolean(),
        items: z.array(
          z.object({
            classification: z.enum(['formal_deadline', 'possible_deadline', 'announcement', 'calendar_event', 'module_requirement', 'risk_signal']),
            courseId: z.number().nullable(),
            courseName: z.string().nullable(),
            title: z.string().nullable(),
            sourceType: z.string(),
            itemId: z.string(),
            htmlUrl: z.string().nullable(),
            relevantDate: normalizedDateSchema.nullable(),
            snippet: z.string().nullable(),
            confidence: z.enum(['high', 'medium', 'low']),
            matchedTerms: z.array(z.string())
          })
        ),
        sourcesChecked: z.array(z.string()),
        confidence: z.enum(['high', 'medium', 'low']),
        warnings: z.array(z.string())
      }
    },
    async ({ from, to, includeHistorical, includeSignals }) => {
      try {
        const service = await dependencies.sessionManager.getService();
        const digest = await service.getWeeklyDigest(from, to, includeHistorical, includeSignals);
        return {
          content: [{ type: 'text', text: toTextPayload('Canvas weekly digest', digest) }],
          structuredContent: digest
        };
      } catch (error) {
        formatToolError(error);
      }
    }
  );
}
