import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";

/**
 * Next.js instrumentation hook — runs once when the server boots.
 * Registers OpenTelemetry with auto-instrumentation (HTTP, fetch, Next.js
 * internals) and exports traces to Honeycomb over OTLP/HTTP (protobuf).
 *
 * Auth is the `x-honeycomb-team` header (HONEYCOMB_API_KEY). Traces route to a
 * Honeycomb dataset named after the service (OTEL_SERVICE_NAME).
 */
export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "equilibris-web",
    traceExporter: new OTLPHttpProtoTraceExporter({
      url: "https://api.honeycomb.io/v1/traces",
      headers: {
        "x-honeycomb-team": process.env.HONEYCOMB_API_KEY ?? "",
      },
    }),
  });
}
