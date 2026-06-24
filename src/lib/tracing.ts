import {
  trace,
  SpanStatusCode,
  type Attributes,
  type Span,
} from "@opentelemetry/api";

/** Shared tracer for application (custom) spans. */
export const tracer = trace.getTracer("equilibris-web");

/**
 * Add business attributes to the current auto-instrumented span (the request
 * span). Highest-impact instrumentation: no new spans, just more dimensions to
 * slice on in Honeycomb. No-op if there's no active span.
 */
export function annotate(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
}

/**
 * Run `fn` inside a child span. Sets attributes, records exceptions, marks the
 * span errored on throw, and always ends it.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
