import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "es";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    getMessageFallback({ key }) {
      // Return the key as-is for unknown keys (e.g. raw Supabase error strings)
      return key;
    },
  };
});
