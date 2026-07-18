import { test } from 'playwright/test';

// A complete invite journey requires a disposable Supabase project and an issued invite.
// CI runs the browser suite without those credentials, so this test documents the
// boundary while component and route tests cover the deterministic behavior.
test.skip('an invited user chooses a current term and reaches curriculum import', async () => {});
