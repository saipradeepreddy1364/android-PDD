/**
 * Shared API utility for the ClinLab backend hosted on Render.
 * Base URL is read from VITE_BACKEND_URL (set in .env / Vercel env vars).
 * Falls back to the production Render URL.
 */

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "https://pdd-backend-ztqc.onrender.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map of procedure name → available subtypes  (from GET /api/procedures) */
export type ProceduresResponse = Record<string, string[]>;

/** A single step transition entry returned by GET /api/workflow */
export interface WorkflowStep {
  step_number: number;
  current_step: string;
  current_description: string;
  next_step: string;
  next_description: string;
  confidence: number;
  source: string;
}

/** Full response from GET /api/workflow */
export interface WorkflowResponse {
  procedure: string;
  subtype: string;
  total_steps: number;
  workflow: WorkflowStep[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches all procedure names and their available subtypes.
 * GET /api/procedures
 */
export async function fetchProcedures(): Promise<ProceduresResponse> {
  const res = await fetch(`${BACKEND_URL}/api/procedures`);
  if (!res.ok) {
    throw new Error(`Failed to fetch procedures (${res.status})`);
  }
  return res.json() as Promise<ProceduresResponse>;
}

/**
 * Fetches the full ordered workflow for a given procedure + subtype.
 * GET /api/workflow?procedure=<name>&subtype=<subtype>
 */
export async function fetchWorkflow(
  procedure: string,
  subtype: string
): Promise<WorkflowResponse> {
  const params = new URLSearchParams({ procedure, subtype });
  const res = await fetch(`${BACKEND_URL}/api/workflow?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch workflow (${res.status})`);
  }
  return res.json() as Promise<WorkflowResponse>;
}
