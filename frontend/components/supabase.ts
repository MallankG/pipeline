"use client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

type AuthUser = {
  id: string;
  email?: string;
};

type AuthSession = {
  access_token: string;
};

type AuthResponse = {
  user?: AuthUser;
  session?: AuthSession | null;
};

function authHeaders(token?: string) {
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function signInWithPassword(email: string, password: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || "Failed to sign in");
  }
  return data as AuthSession;
}

export async function signUp(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || "Failed to sign up");
  }
  return data as AuthResponse;
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return { id: data.id, email: data.email || undefined };
}

export async function signOut(token: string) {
  if (!token) {
    return;
  }
  await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: authHeaders(token),
  });
}
