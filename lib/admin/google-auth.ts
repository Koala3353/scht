const DEFAULT_GOOGLE_CLOUD_PROJECT_ID = "scht-502902";

function normalizedProjectId(projectId?: string) {
  return projectId?.trim() || DEFAULT_GOOGLE_CLOUD_PROJECT_ID;
}

/**
 * Opens Google Auth Platform's Test users screen. This is where an owner adds
 * people who may authorize an OAuth app that is still in Google's testing mode.
 */
export function googleAudienceUrl(projectId?: string) {
  return `https://console.cloud.google.com/auth/audience?project=${encodeURIComponent(normalizedProjectId(projectId))}`;
}

/** The one-time Google Cloud Console page for creating the app's OAuth client. */
export function googleClientCreationUrl(projectId?: string) {
  return `https://console.cloud.google.com/auth/clients/create?project=${encodeURIComponent(normalizedProjectId(projectId))}`;
}

export { DEFAULT_GOOGLE_CLOUD_PROJECT_ID };
