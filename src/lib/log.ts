/**
 * Tiny server-side structured logger (no dependencies).
 *
 * In production (NODE_ENV === "production") each call emits a single line of
 * JSON ({ level, message, ...fields, ts }), which a log drain (Vercel,
 * Logtail) or an APM (Sentry, Datadog) can parse without a custom format. In
 * development it emits a readable line so local debugging stays legible.
 *
 * This is the seam a future Sentry / log-drain integration plugs into: route
 * code calls log.error / log.warn / log.info, and only this file decides where
 * the bytes go. Keep it simple and synchronous (no async, no batching) so it is
 * safe to call from anywhere, including inside a catch block.
 *
 * Usage:
 *   log.error("pokedex unlock failed", { context: "answers", err });
 *   log.warn("rate limit hit", { context: "answers", userId });
 *   log.info("digest sent", { context: "cron/digest", sent, failed });
 */

type LogLevel = "error" | "warn" | "info";

/**
 * Extra structured context for a log line. `err` is accepted as `unknown`
 * (the type of a caught value) and normalised to a serialisable shape so a
 * raw Error does not collapse to "{}" when emitted as JSON.
 */
export type LogFields = Record<string, unknown>;

/**
 * Errors do not JSON.stringify usefully (name/message/stack are non-enumerable),
 * so pull them out by hand. Non-Error values pass through unchanged.
 */
function normaliseError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function normaliseFields(fields: LogFields): LogFields {
  if (!("err" in fields)) return fields;
  return { ...fields, err: normaliseError(fields.err) };
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const normalised = fields ? normaliseFields(fields) : {};
  const ts = new Date().toISOString();

  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify({ level, message, ...normalised, ts });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // Development: a readable single line. Any structured fields trail as a
  // pretty object so they are still inspectable while debugging locally.
  const hasFields = Object.keys(normalised).length > 0;
  const prefix = `[${level}] ${message}`;
  if (level === "error") console.error(prefix, hasFields ? normalised : "");
  else if (level === "warn") console.warn(prefix, hasFields ? normalised : "");
  else console.log(prefix, hasFields ? normalised : "");
}

export const log = {
  error(message: string, fields?: LogFields): void {
    emit("error", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit("warn", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    emit("info", message, fields);
  },
};
