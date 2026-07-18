import { test } from 'playwright/test';

// The Today task editor is introduced in the following foundation task. This keeps
// the browser-level offline contract visible without depending on that unfinished UI.
test.skip('a task created offline survives reload and syncs after reconnecting', async () => {});
