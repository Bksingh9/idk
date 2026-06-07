/**
 * MongoDB document types + typed collection accessors.
 *
 * We use string UUIDs for `_id` (matching the JWT subject and keeping ids stable
 * and human-traceable) rather than ObjectIds. Authorization is enforced in the
 * service layer; integrity constraints (uniqueness) are enforced by indexes
 * declared in ensure-indexes.ts.
 */
import { collection } from "@/lib/wrappers/mongo";

export type Role = "developer" | "tester";
export type ExperienceLevel = "new" | "casual" | "experienced" | "pro";
export type ProjectStatus = "open" | "closed";
export type InviteStatus = "invited" | "accepted" | "declined" | "completed";
export type PlanTier = "free" | "indie" | "studio";

export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface ProfileDoc {
  _id: string; // = user id
  role: Role;
  displayName: string;
  country: string | null;
  createdAt: Date;
  plan: PlanTier;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  planCurrentPeriodEnd?: Date | null;
}

export interface TesterProfileDoc {
  _id: string; // = user id
  genres: string[];
  platforms: string[];
  languages: string[];
  experienceLevel: ExperienceLevel;
  reputationScore: number;
  testsCompleted: number;
  isActive: boolean;
}

export interface ProjectDoc {
  _id: string;
  developerId: string;
  title: string;
  description: string;
  platform: string;
  buildUrl: string | null;
  buildFilePath: string | null;
  targetGenres: string[];
  targetPlatforms: string[];
  targetCountries: string[];
  feedbackQuestions: string[];
  status: ProjectStatus;
  createdAt: Date;
}

export interface TestInviteDoc {
  _id: string;
  projectId: string;
  testerId: string;
  status: InviteStatus;
  createdAt: Date;
}

export interface FeedbackDoc {
  _id: string;
  projectId: string;
  testerId: string;
  bugsFound: string | null;
  funRating: number;
  whereDidYouDropOff: string | null;
  wouldYouPay: boolean | null;
  generalComments: string | null;
  createdAt: Date;
}

export interface RatingDoc {
  _id: string;
  feedbackId: string;
  developerId: string;
  stars: number;
  createdAt: Date;
}

// Engine collections (Layer 6 usage log, Layer 8 history, Layer 3 proof).
export interface UsageEventDoc {
  _id: string;
  requestId: string | null;
  userId: string | null;
  dependency: string;
  operation: string;
  units: number;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface ConversationSessionDoc {
  _id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageDoc {
  _id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "summary";
  content: string;
  createdAt: Date;
}

export interface HealthCheckDoc {
  _id: string;
  note: string;
  createdAt: Date;
}

export const collections = {
  users: () => collection<UserDoc>("users"),
  profiles: () => collection<ProfileDoc>("profiles"),
  testerProfiles: () => collection<TesterProfileDoc>("tester_profiles"),
  projects: () => collection<ProjectDoc>("projects"),
  testInvites: () => collection<TestInviteDoc>("test_invites"),
  feedback: () => collection<FeedbackDoc>("feedback"),
  ratings: () => collection<RatingDoc>("ratings"),
  usageEvents: () => collection<UsageEventDoc>("usage_events"),
  conversationSessions: () => collection<ConversationSessionDoc>("conversation_sessions"),
  conversationMessages: () => collection<ConversationMessageDoc>("conversation_messages"),
  healthChecks: () => collection<HealthCheckDoc>("health_checks"),
};
