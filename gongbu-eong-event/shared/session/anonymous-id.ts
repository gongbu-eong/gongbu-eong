const ANONYMOUS_ID_STORAGE_KEY = "gongbu-eong-anonymous-id";

export function getAnonymousId() {
  const savedId = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);

  if (savedId) {
    return savedId;
  }

  const newId = crypto.randomUUID();
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, newId);

  return newId;
}
