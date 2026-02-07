const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("access_token");
}

async function callApi(path: string, init?: RequestInit) {
  const token = getAccessToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

export function apiGet(path: string) {
  return callApi(path, { method: "GET" });
}

export function apiPost(path: string, body: unknown) {
  return callApi(path, { method: "POST", body: JSON.stringify(body) });
}
