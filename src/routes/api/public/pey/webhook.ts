import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pey/webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const { receiveLiveWebhook } = await import("@/lib/pey/live-inbox.server");
      return receiveLiveWebhook(request, "pey");
    },
  } },
});