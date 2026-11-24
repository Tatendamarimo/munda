/**
 * Cloud Gemini models get overloaded ("high demand", timeouts). One retry on a second, lighter
 * model (Remote Config: cloud_fallback_model) keeps Munda answering; if both fail, the caller's
 * offline queue takes over. The main model's error is the one reported.
 */
export async function withFallback<T>(call: (model: string) => Promise<T>, main: string, fallback: string): Promise<T> {
  try {
    return await call(main);
  } catch (e) {
    if (!fallback || fallback === main) throw e;
    console.warn(`Cloud model ${main} failed; trying ${fallback}`, e);
    try { return await call(fallback); } catch { throw e; }
  }
}
