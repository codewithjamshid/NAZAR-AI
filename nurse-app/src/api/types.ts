// Shapes returned by the NAZAR AI backend (docs/API.md). Only the fields the
// nurse app actually reads are typed; the backend may send more.

export type Zone = 'red' | 'yellow' | 'green'
export type Sex = 'male' | 'female'
export type Role = 'nurse' | 'operator' | 'specialist' | 'admin'
export type StudyType = 'ct_head' | 'cxr' | 'lab_photo' | 'voice'

export interface User {
  id: number
  full_name: string
  role: Role
  specialty: string | null
  facility_id: number | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Meta {
  rules_version: string
  befast: {
    points: Record<string, number>
    stroke_min_score: number
    stroke_any_of: string[]
  }
  stroke_window: {
    warning_min: number
    thrombolysis_min: number
  }
  disclaimer: string
}

export interface StrokeInfo {
  score: number | null
  onset_at: string | null
  suspected: boolean
  befast_done: boolean
  elapsed_min: number | null
  window_state: string | null
  remaining_min: number | null
}

export interface CaseListItem {
  case_id: number
  zone: Zone | null
  status: string
  specialist_type: string | null
  route: string | null
  district: string | null
  facility_name: string | null
  age: number | null
  sex: Sex | null
  summary: string | null
  reasons: string[]
  readers_agree: boolean | null
  time_window_min: number | null
  stroke: Partial<StrokeInfo>
  waiting_min: number
  created_at: string
  has_decision: boolean
}

export interface Facility {
  id: number
  name: string
  type: string
  district: string | null
  has_ct?: boolean
  has_xray?: boolean
  distance_km?: number
}

export interface AIResult {
  id: number
  module: string
  output: Record<string, unknown> | null
  confidence: number | null
  model_version: string | null
  duration_ms: number | null
  error: string | null
  heatmap_url: string | null
  processed_at: string | null
}

export interface Study {
  id: number
  case_id: number
  type: StudyType
  source: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  error: string | null
  uploaded_at: string
  images: { kind: string; base: string[]; heatmap: string[]; key_index: number }
  ai_results: AIResult[]
}

export interface Triage {
  id: number
  zone: Zone
  specialist_type: string
  route: string
  reasons: string[]
  signals: string[]
  time_window_min: number | null
  readers_agree: boolean | null
  rules_version: string
  stroke: Partial<StrokeInfo>
  summary_nurse: string | null
  summary_specialist: string | null
  report_model: string | null
  computed_at: string
}

export interface Decision {
  id: number
  specialist_id: number
  specialist_name: string | null
  specialty: string | null
  action: 'confirm' | 'modify' | 'reject_ai'
  note: string | null
  route_final: string | null
  decided_at: string
}

export interface Patient {
  id: number
  full_name: string | null
  birth_year: number | null
  age: number | null
  sex: Sex | null
  phone: string | null
  district: string | null
}

export interface Anamnesis {
  befast: Record<string, boolean> | null
  flags: Record<string, boolean>
  labs: Record<string, number>
  chief_complaint: string | null
  voice_transcript: string | null
}

export interface CaseDetail {
  id: number
  status: string
  zone: Zone | null
  specialist_type: string | null
  route: string | null
  symptom_onset_at: string | null
  created_at: string
  closed_at: string | null
  facility: Facility | null
  patient: Patient
  anamnesis: Anamnesis | null
  studies: Study[]
  triage: Triage | null
  decisions: Decision[]
  nearest_ct: Facility[]
  disclaimer: string
}

export interface PatientCreated {
  id: number
  full_name: string
  birth_year: number
  sex: string
  phone: string | null
  district: string | null
}

export interface CaseCreated {
  id: number
  patient_id: number
  facility_id: number
  status: string
  zone: Zone | null
  symptom_onset_at: string | null
  created_at: string
}

export const BEFAST_KEYS = ['balance', 'eyes', 'face', 'arms', 'speech'] as const
export type BefastKey = (typeof BEFAST_KEYS)[number]
export type Befast = Record<BefastKey, boolean>

export const FLAG_KEYS = ['unconscious', 'breathing_difficulty', 'chest_pain'] as const
export type FlagKey = (typeof FLAG_KEYS)[number]
export type Flags = Record<FlagKey, boolean>

export interface AnamnesisPayload {
  befast: Befast
  flags: Flags
  chief_complaint?: string | null
  voice_transcript?: string | null
}
