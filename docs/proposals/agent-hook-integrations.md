---
title: Agent Hook Integrations Proposal
layout: default
---

# Agent hook integrations proposal

> **Status:** Non-shipping review proposal. Agent hook integrations are out of
> scope for v0.7. This document does not specify an implementation commitment.

## Evidence

Claude Code and OpenCode expose different extension models and cannot share one
hook configuration:

- [Claude Code hooks](https://code.claude.com/docs/en/hooks) are configured in
  `.claude/settings.json` (or another Claude settings scope). A command hook
  executes its configured static command and receives event context as JSON on
  stdin.
- [OpenCode plugins](https://opencode.ai/docs/plugins/) are JavaScript or
  TypeScript modules loaded by OpenCode. OpenCode does not consume Claude
  Code's `.claude/settings.json`. A RoadRaven integration for OpenCode would
  need a native OpenCode plugin using `tool.execute.after` for completed tool
  calls and the `event` hook's `session.idle` event for completed turns.

The host-specific lifecycle and payload differences mean a Claude Code command
hook is not an OpenCode integration, and a shared one-shot command cannot infer
the correct roadmap node safely.

## Future design requirements

No Claude Code or OpenCode hook integration should ship until its design and
tests demonstrate all of the following:

1. **Explicit node mapping.** Each host session, project, or task maps to a
   specific RoadRaven node through an intentional configuration or selection;
   the integration must not guess from tool names or working-directory text.
2. **Server acknowledgement.** A status change is successful only after the
   RoadRaven Event API acknowledges that it accepted the target node and
   status. Opening a socket or sending a frame is not proof of delivery.
3. **Hook-silent absence.** When the RoadRaven app is not running, hooks produce
   no user-facing output, do not fail the host operation, and return promptly.
4. **Node.js 22 or newer.** Any shipped package and test matrix support the
   project's Node.js `>=22` runtime baseline.
5. **Host-native end-to-end coverage.** Tests run through each supported host's
   real hook/plugin loading path and verify event mapping, acknowledgement,
   absent-app behavior, and failure isolation. Unit tests of a transport helper
   alone are insufficient.

Claude Code and OpenCode integrations should remain separate host adapters over
a shared, acknowledgement-aware RoadRaven transport only if that shared layer
is justified during implementation review. Neither integration is implemented
or shipped as part of v0.7.
