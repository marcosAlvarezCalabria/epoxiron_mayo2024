const productionApiUrl = "https://api.wwwmarcos-alvarez.com";
const localApiUrl = "http://localhost:3001";

export const resolveApiUrl = (
  configuredUrl: string | undefined,
  isDevelopment: boolean
): string => {
  const normalizedUrl = configuredUrl?.trim();
  if (normalizedUrl) {
    return normalizedUrl.replace(/\/$/, "");
  }

  return isDevelopment ? localApiUrl : productionApiUrl;
};

export const API_URL = resolveApiUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV
);
