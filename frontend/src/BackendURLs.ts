function getBackendURL(path: string) {
  const host = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000/";
  return new URL(path, host).toString();
}

const BACKEND_URLS = {
  LOGIN: getBackendURL("login"),
  LOGOUT: getBackendURL("logout"),
} as const;

export default BACKEND_URLS;
