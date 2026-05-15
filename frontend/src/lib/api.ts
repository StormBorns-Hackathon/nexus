const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ?? ""

export function apiUrl(path: string) {
  return `${backendUrl}${path.startsWith("/") ? path : `/${path}`}`
}
