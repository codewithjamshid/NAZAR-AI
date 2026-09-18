// Uzbek (Latin) UI strings. Zones are never colour alone: the word comes with
// them everywhere (TZ §12, colour-blindness rule).

import type { Zone } from '../api/types'

export const ZONE_WORD: Record<Zone, string> = {
  red: 'QIZIL',
  yellow: 'SARIQ',
  green: 'YASHIL',
}

export const ZONE_URGENCY: Record<Zone, string> = {
  red: 'shoshilinch',
  yellow: 'ehtiyot',
  green: 'kuzatuv',
}

export function zoneLabel(zone: Zone | null | undefined): string {
  if (!zone) return 'Zona hali yoʻq'
  return `${ZONE_WORD[zone]} — ${ZONE_URGENCY[zone]}`
}

export const SPECIALIST: Record<string, string> = {
  neurologist: 'Nevrolog',
  neurosurgeon: 'Neyroxirurg',
  pulmonologist: 'Pulmonolog',
  surgeon: 'Jarroh',
  therapist: 'Terapevt',
  cardiologist: 'Kardiolog',
  oncologist: 'Onkolog',
  radiologist: 'Radiolog',
  family_doctor: 'Oilaviy shifokor',
}

export const ROUTE: Record<string, string> = {
  onsite: 'Joyida davolash',
  district: 'Tuman shifoxonasida qoldirish',
  regional: 'Viloyat markaziga transport',
}

export const STATUS: Record<string, string> = {
  created: 'Yangi holat',
  uploading: 'Fayl yuklanmoqda',
  processing: 'AI oʻqimoqda',
  triaged: 'Triyaj tayyor',
  ai_failed: 'AI natijasi yoʻq — mutaxassis koʻrsin',
  in_review: 'Mutaxassis koʻrmoqda',
  decided: 'Mutaxassis qaror qildi',
  closed: 'Yopilgan',
}

export const DECISION_ACTION: Record<string, string> = {
  confirm: 'Tasdiqladi',
  modify: 'Oʻzgartirdi',
  reject_ai: 'AI xato deb belgiladi',
}

export const STUDY_TYPE: Record<string, string> = {
  ct_head: 'Bosh KT',
  cxr: 'Koʻkrak rentgeni',
  lab_photo: 'Tahlil surati',
  voice: 'Ovozli yozuv',
}

export const STUDY_STATUS: Record<string, string> = {
  queued: 'Navbatda',
  processing: 'AI oʻqimoqda',
  done: 'Oʻqildi',
  failed: 'Oʻqilmadi',
}

export const SEX: Record<string, string> = { male: 'Erkak', female: 'Ayol' }

export const ROLE: Record<string, string> = {
  nurse: 'Hamshira',
  operator: 'Tuman operatori',
  specialist: 'Mutaxassis',
  admin: 'Administrator',
}

export const FLAG_LABEL: Record<string, string> = {
  unconscious: 'Hushsizlik',
  breathing_difficulty: 'Nafas qiyinlashuvi',
  chest_pain: 'Koʻkrak ogʻrigʻi',
}

export const LAB_LABEL: Record<string, string> = {
  hemoglobin: 'Gemoglobin',
  glucose: 'Glyukoza',
  wbc: 'Leykotsitlar',
  rbc: 'Eritrotsitlar',
  platelets: 'Trombotsitlar',
  esr: 'ECHT',
  crp: 'C-reaktiv oqsil',
  creatinine: 'Kreatinin',
  urea: 'Mochevina',
  alt: 'ALT',
  ast: 'AST',
  bilirubin: 'Bilirubin',
  potassium: 'Kaliy',
  sodium: 'Natriy',
  inr: 'INR',
}

/** BE-FAST questions in the order the nurse reads them out loud. */
export const BEFAST_QUESTIONS: { key: string; letter: string; title: string; hint: string }[] = [
  { key: 'balance', letter: 'B', title: 'Muvozanat buzilganmi?', hint: 'Yurishda chayqaladimi, yiqildimi?' },
  { key: 'eyes', letter: 'E', title: 'Koʻrish buzilganmi?', hint: 'Bir koʻzi koʻrmayaptimi, ikkilanib koʻrayaptimi?' },
  { key: 'face', letter: 'F', title: 'Yuzi osilganmi?', hint: '“Jilmaying” — bir tomoni qimirlamayaptimi?' },
  { key: 'arms', letter: 'A', title: 'Qoʻli kuchsizmi?', hint: 'Ikki qoʻlini koʻtarsin — biri tushib ketyaptimi?' },
  { key: 'speech', letter: 'S', title: 'Nutqi buzilganmi?', hint: 'Gapi tushunarsizmi, soʻz topolmayaptimi?' },
]

export function roleLabel(role: string | null | undefined): string {
  return role ? (ROLE[role] ?? role) : '—'
}

export function sexLabel(sex: string | null | undefined): string {
  return sex ? (SEX[sex] ?? sex) : '—'
}

export function specialistLabel(value: string | null | undefined): string {
  return value ? (SPECIALIST[value] ?? value) : '—'
}

export function routeLabel(value: string | null | undefined): string {
  return value ? (ROUTE[value] ?? value) : '—'
}

export function statusLabel(value: string | null | undefined): string {
  return value ? (STATUS[value] ?? value) : '—'
}
