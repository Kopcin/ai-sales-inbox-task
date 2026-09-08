import type { Lead, Message } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const api = {
  listMessages: () => getJson<Message[]>("/api/messages"),
  getMessage: (messageId: string) => getJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`),
  listLeads: () => getJson<Lead[]>("/api/leads"),
  extract: (messageId: string) => postJson<Extraction>("/api/ai/extract", { messageId }),
  createLead: (payload: CreateLeadPayload) => postJson<Lead>("/api/leads", payload),
  markContacted: (leadId: string) => patchJson<Lead>(`/api/leads/${encodeURIComponent(leadId)}/status`, { status: "CONTACTED" }),
};

export type Extraction = {
  product?: string;
  quantity?: number | null;
  material?: string | null;
  budget?: number | null;
};

export type CreateLeadPayload = {
  sourceMessageId: string;
  product: string;
  quantity: number;
  material: string | null;
  budget: number | null;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
