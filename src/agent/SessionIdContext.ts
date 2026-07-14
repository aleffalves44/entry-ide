/**
 * SessionIdContext — the session id of the AgentSessionView subtree.
 *
 * Lets deep block renderers (e.g. TaskToolBlock's live-activity strip)
 * subscribe to their session's store without threading the id through
 * every intermediate component.  Null outside an agent view.
 */
import { createContext, useContext } from "react";

export const SessionIdContext = createContext<string | null>(null);

export function useSessionId(): string | null {
  return useContext(SessionIdContext);
}
