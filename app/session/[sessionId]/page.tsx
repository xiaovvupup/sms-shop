import { SessionClient } from "./session-client";

export default function SessionPage({
  params,
  searchParams
}: {
  params: { sessionId: string };
  searchParams?: { resumed?: string };
}) {
  return <SessionClient sessionId={params.sessionId} initialResumed={searchParams?.resumed === "1"} />;
}
