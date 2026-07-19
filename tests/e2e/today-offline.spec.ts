import { test } from 'playwright/test';

// Keep the browser-level offline contract visible until authenticated browser fixtures
// can create, reconnect, and verify one real synced task end to end.
test.skip('a task created offline survives reload and syncs after reconnecting', async () => {});
