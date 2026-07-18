import { test } from 'playwright/test';

// Authentication fixtures are configured in deployment environments; the owner-only
// guard is covered in unit tests until a seeded Supabase Playwright project is added.
test.skip('a member receives a 403 response from the owner dashboard', async () => {});
