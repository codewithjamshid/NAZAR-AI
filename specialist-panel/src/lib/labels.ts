// Uzbek (Latin) display strings. Mirrors backend/app/i18n.py so the panel and the
// nurse app speak the same words.

import type { Zone } from "../api/types";

export const ZONE_WORD: Record<string, string> = {
  red: "QIZIL",
  yellow: "SARIQ",
  green: "YASHIL",
};

export const ZONE_HINT: Record<string, string> = {
  red: "shoshilinch",
  yellow: "ehtiyot",
  green: "xavf past",
};

export const SPECIALIST_UZ: Record<string, string> = {
  neurologist: "nevrolog",
  neurosurgeon: "neyroxirurg",
  pulmonologist: "pulmonolog",
  surgeon: "xirurg",
  therapist: "terapevt",
  cardiologist: "kardiolog",
  oncologist: "onkolog",
  radiologist: "radiolog",
  family_doctor: "oilaviy shifokor",
};

export const ROUTE_UZ: Record<string, string> = {
  onsite: "joyida davolash",
  district: "tuman shifoxonasi",
  regional: "viloyat markazi",
};

export const STATUS_UZ: Record<string, string> = {
  created: "ochildi",
  uploading: "yuklanmoqda",
  processing: "AI o'qimoqda",
  triaged: "triyaj tayyor",
  ai_failed: "AI natijasi yo'q",
  in_review: "ko'rilmoqda",
  decided: "qaror qabul qilindi",
  closed: "yopildi",
};

export const SEX_UZ: Record<string, string> = {
  male: "erkak",
  female: "ayol",
};

export const BEFAST_UZ: Record<string, string> = {
  balance: "Muvozanat (Balance)",
  eyes: "Ko'rish (Eyes)",
  face: "Yuz osilishi (Face)",
  arms: "Qo'l kuchsizligi (Arms)",
  speech: "Nutq buzilishi (Speech)",
};

export const FLAG_UZ: Record<string, string> = {
  unconscious: "Hushsizlik",
  breathing_difficulty: "Nafas qiyinlashuvi",
  chest_pain: "Ko'krak og'rig'i",
};

export const STUDY_TYPE_UZ: Record<string, string> = {
  ct_head: "Bosh KT",
  cxr: "Ko'krak rentgeni",
  lab_photo: "Tahlil surati",
  voice: "Ovoz yozuvi",
};

export const STUDY_STATUS_UZ: Record<string, string> = {
  queued: "navbatda",
  processing: "o'qilmoqda",
  done: "o'qildi",
  failed: "xato",
};

export const MODULE_UZ: Record<string, string> = {
  ich: "Qon quyilishi CNN (ikkinchi o'quvchi)",
  cxr: "Ko'krak rentgeni klassifikatori",
  ocr: "Tahlil qog'ozi OCR",
  stt: "Ovozdan matn",
  medgemma_ct: "MedGemma — bosh KT",
  medgemma_cxr: "MedGemma — ko'krak rentgeni",
  medgemma_lab: "MedGemma — tahlil varaqasi",
};

export const PATHOLOGY_UZ: Record<string, string> = {
  Atelectasis: "Atelektaz",
  Consolidation: "Konsolidatsiya",
  Infiltration: "Infiltratsiya",
  Pneumothorax: "Pnevmotoraks",
  Edema: "Shish (o'pka)",
  Emphysema: "Emfizema",
  Fibrosis: "Fibroz",
  Effusion: "Plevral suyuqlik",
  Pneumonia: "Pnevmoniya",
  Pleural_Thickening: "Plevra qalinlashuvi",
  Cardiomegaly: "Kardiomegaliya",
  Nodule: "Tugun",
  Mass: "Hosila",
  Hernia: "Churra",
  "Lung Lesion": "O'pka o'chog'i",
  Fracture: "Sinish",
  "Lung Opacity": "O'pka xiralashuvi",
  "Enlarged Cardiomediastinum": "Kengaygan mediastinum",
};

export const ACTION_UZ: Record<string, string> = {
  confirm: "Tasdiqlandi",
  modify: "O'zgartirildi",
  reject_ai: "AI xato deb belgilandi",
};

export function zoneWord(zone: Zone | null | undefined): string {
  if (!zone) return "ZONA YO'Q";
  return ZONE_WORD[zone] ?? zone.toUpperCase();
}

export function specialist(value: string | null | undefined): string {
  if (!value) return "—";
  return SPECIALIST_UZ[value] ?? value;
}

export function route(value: string | null | undefined): string {
  if (!value) return "—";
  return ROUTE_UZ[value] ?? value;
}

export function moduleName(value: string): string {
  return MODULE_UZ[value] ?? value;
}

export function pathology(value: string): string {
  return PATHOLOGY_UZ[value] ?? value;
}
