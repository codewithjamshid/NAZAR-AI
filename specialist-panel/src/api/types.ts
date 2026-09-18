// Shapes returned by the NAZAR AI backend (docs/API.md).

export type Zone = "red" | "yellow" | "green";
export type Route = "onsite" | "district" | "regional";
export type DecisionAction = "confirm" | "modify" | "reject_ai";

export interface User {
  id: number;
  full_name: string;
  role: "nurse" | "operator" | "specialist" | "admin";
  specialty: string | null;
  facility_id: number | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Meta {
  rules_version: string;
  befast: {
    points: Record<string, number>;
    stroke_min_score: number;
    stroke_any_of: string[];
  };
  stroke_window: { warning_min: number; thrombolysis_min: number };
  disclaimer: string;
}

export interface StrokeInfo {
  score: number | null;
  onset_at: string | null;
  suspected: boolean;
  befast_done: boolean;
  elapsed_min: number | null;
  window_state: string | null;
  remaining_min: number | null;
}

export interface QueueItem {
  case_id: number;
  zone: Zone | null;
  status: string;
  specialist_type: string | null;
  route: Route | null;
  district: string | null;
  facility_name: string | null;
  age: number | null;
  sex: string | null;
  summary: string | null;
  reasons: string[];
  readers_agree: boolean | null;
  time_window_min: number | null;
  stroke: StrokeInfo;
  waiting_min: number;
  created_at: string;
  has_decision: boolean;
}

export interface StudyImages {
  kind: string;
  base: string[];
  heatmap: string[];
  key_index: number | null;
}

export interface AIResult {
  id: number;
  module: string;
  output: Record<string, unknown> | null;
  confidence: number | null;
  model_version: string | null;
  duration_ms: number | null;
  error: string | null;
  heatmap_url: string | null;
  processed_at: string | null;
}

export interface Study {
  id: number;
  case_id: number;
  type: string;
  source: string;
  status: string;
  error: string | null;
  uploaded_at: string;
  images: StudyImages;
  ai_results: AIResult[];
}

export interface Triage {
  id: number;
  zone: Zone | null;
  specialist_type: string | null;
  route: Route | null;
  reasons: string[];
  signals: string[];
  time_window_min: number | null;
  readers_agree: boolean | null;
  rules_version: string | null;
  stroke: StrokeInfo | Record<string, never>;
  summary_nurse: string | null;
  summary_specialist: string | null;
  report_model: string | null;
  computed_at: string | null;
}

export interface Decision {
  id: number;
  specialist_id: number;
  specialist_name: string | null;
  specialty: string | null;
  action: DecisionAction;
  note: string | null;
  route_final: Route | null;
  decided_at: string;
}

export interface Anamnesis {
  befast: Record<string, boolean> | null;
  flags: Record<string, boolean> | null;
  labs: Record<string, number> | null;
  chief_complaint: string | null;
  voice_transcript: string | null;
}

export interface Facility {
  id: number;
  name: string;
  district: string | null;
  type: string;
  has_ct: boolean;
  has_xray?: boolean;
  distance_km?: number;
}

export interface Patient {
  id: number;
  full_name: string | null;
  birth_year: number | null;
  age: number | null;
  sex: string | null;
  phone: string | null;
  district: string | null;
}

export interface CaseDetail {
  id: number;
  status: string;
  zone: Zone | null;
  specialist_type: string | null;
  route: Route | null;
  symptom_onset_at: string | null;
  created_at: string;
  closed_at: string | null;
  facility: Facility | null;
  patient: Patient;
  anamnesis: Anamnesis | null;
  studies: Study[];
  triage: Triage | null;
  decisions: Decision[];
  nearest_ct?: Facility[];
  disclaimer?: string;
}

export interface DistrictStat {
  district: string;
  total: number;
  red: number;
  yellow: number;
  green: number;
  avg_response_min: number | null;
  lat: number | null;
  lng: number | null;
}

export interface RegionStats {
  days: number;
  districts: DistrictStat[];
  totals: {
    cases: number;
    red: number;
    yellow: number;
    green: number;
    avg_ai_ms: number | null;
    avg_response_min: number | null;
    ai_error_rate: number | null;
    decisions: number;
  };
}

export interface QueueEvent {
  type: "case.updated" | "case.decided" | "ping" | "ready" | "error";
  case_id?: number;
  zone?: Zone | null;
  status?: string;
  specialist_type?: string | null;
  facility_id?: number | null;
  district?: string | null;
}
