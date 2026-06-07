/**
 * Layer 2 — Resend email wrapper (the ONLY module that imports the Resend SDK;
 * rule 1).
 *
 * When RESEND_API_KEY is unset, emails are logged to the console instead of
 * sent — so the full notify flow is testable with zero external setup. Sends
 * route through the resilience policy and record a usage unit.
 */
import { Resend } from "resend";
import { env, features } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { recordUsage } from "@/lib/observability/metrics";
import { withResilience } from "@/lib/resilience/with-resilience";

const logger = log("resend");
const DEP = "resend";

let resend: Resend | null = null;
function client(): Resend {
  if (!resend) resend = new Resend(env.RESEND_API_KEY!);
  return resend;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export const email = {
  enabled: features.resend,

  async send(msg: EmailMessage): Promise<{ id: string | null; delivered: boolean }> {
    if (!features.resend) {
      // Console fallback — the email "happened" for dev/test purposes.
      logger.info(
        { to: msg.to, subject: msg.subject, mode: "console-fallback" },
        `[email:console] To: ${msg.to} | Subject: ${msg.subject}`
      );
      return { id: null, delivered: false };
    }
    return withResilience({ dependency: DEP, operation: "send" }, async () => {
      const { data, error } = await client().emails.send({
        from: env.EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      if (error) throw new Error(error.message);
      recordUsage(DEP, "send");
      logger.info({ id: data?.id, to: msg.to }, "email sent");
      return { id: data?.id ?? null, delivered: true };
    });
  },

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    return { ok: true, detail: features.resend ? "configured" : "console-fallback" };
  },
};
