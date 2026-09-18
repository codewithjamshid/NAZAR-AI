// Thin fetch wrapper around the NAZAR AI API.
//
// Two error kinds matter to the screens:
//   NetworkError -> the device is offline; the caller may queue the request.
//   ApiError     -> the server answered with a status code and an Uzbek message.

import type {
  AnamnesisPayload, CaseCreated, CaseDetail, CaseListItem, Facility, LoginResponse,
  Meta, PatientCreated, Sex, Study, StudyType,
} from './types'

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'nazar.token'
const USER_KEY = 'nazar.user'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class NetworkError extends Error {
  constructor(message = 'Internet aloqasi yoʻq') {
    super(message)
    this.name = 'NetworkError'
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSession(token: string, user: unknown): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* private mode: the session simply does not survive a reload */
  }
}

export function readStoredUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

type OnUnauthorized = () => void
let onUnauthorized: OnUnauthorized | null = null
export function setUnauthorizedHandler(handler: OnUnauthorized | null): void {
  onUnauthorized = handler
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string }
      if (first?.msg) return first.msg
    }
  } catch {
    /* not JSON */
  }
  return `Server xatosi (${res.status})`
}

interface RequestOptions {
  method?: string
  json?: unknown
  auth?: boolean
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, auth = true, signal } = options
  const headers: Record<string, string> = {}
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new NetworkError()
  }

  if (res.status === 401 && auth) {
    onUnauthorized?.()
    throw new ApiError(401, 'Sessiya tugadi, qaytadan kiring')
  }
  if (!res.ok) throw new ApiError(res.status, await parseError(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Multipart upload with a progress callback (XHR: fetch has no upload progress). */
export function upload<T>(
  path: string,
  fields: Record<string, string>,
  file: Blob,
  fileName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.append(key, value)
    form.append('file', file, fileName)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        onUnauthorized?.()
        reject(new ApiError(401, 'Sessiya tugadi, qaytadan kiring'))
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          resolve(undefined as T)
        }
        return
      }
      let message = `Server xatosi (${xhr.status})`
      try {
        const detail = (JSON.parse(xhr.responseText) as { detail?: unknown }).detail
        if (typeof detail === 'string') message = detail
      } catch {
        /* not JSON */
      }
      reject(new ApiError(xhr.status, message))
    }
    xhr.onerror = () => reject(new NetworkError())
    xhr.ontimeout = () => reject(new NetworkError())
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(form)
  })
}

export const api = {
  login: (phone: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', json: { phone, password }, auth: false }),

  meta: () => request<Meta>('/meta'),

  facilities: () => request<Facility[]>('/facilities'),

  cases: (q?: string) =>
    request<CaseListItem[]>(q ? `/cases?q=${encodeURIComponent(q)}` : '/cases'),

  caseDetail: (id: number, signal?: AbortSignal) =>
    request<CaseDetail>(`/cases/${id}`, { signal }),

  createPatient: (body: {
    full_name: string
    birth_year: number
    sex: Sex
    phone?: string | null
    district?: string | null
  }) => request<PatientCreated>('/patients', { method: 'POST', json: body }),

  createCase: (body: { patient_id: number; symptom_onset_at?: string | null }) =>
    request<CaseCreated>('/cases', { method: 'POST', json: body }),

  saveAnamnesis: (caseId: number, body: AnamnesisPayload) =>
    request<CaseDetail>(`/cases/${caseId}/anamnesis`, { method: 'POST', json: body }),

  confirmLabs: (caseId: number, values: Record<string, number>) =>
    request<CaseDetail>(`/cases/${caseId}/labs`, { method: 'POST', json: { values } }),

  closeCase: (caseId: number) =>
    request<CaseDetail>(`/cases/${caseId}/close`, { method: 'POST' }),

  uploadStudy: (
    caseId: number,
    type: StudyType,
    file: Blob,
    fileName: string,
    onProgress?: (percent: number) => void,
  ) => upload<Study>(`/cases/${caseId}/studies`, { type }, file, fileName, onProgress),

  uploadVoice: (caseId: number, file: Blob, fileName: string, onProgress?: (p: number) => void) =>
    upload<Study>(`/cases/${caseId}/voice`, {}, file, fileName, onProgress),

  studyResult: (studyId: number) => request<Study>(`/studies/${studyId}/result`),
}
