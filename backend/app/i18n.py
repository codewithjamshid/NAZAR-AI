"""Uzbek (Latin) display strings for values that come out of the AI modules."""

PATHOLOGY_UZ = {
    "Atelectasis": "Atelektaz",
    "Consolidation": "Konsolidatsiya",
    "Infiltration": "Infiltratsiya",
    "Pneumothorax": "Pnevmotoraks",
    "Edema": "Shish (o'pka)",
    "Emphysema": "Emfizema",
    "Fibrosis": "Fibroz",
    "Effusion": "Plevral suyuqlik",
    "Pneumonia": "Pnevmoniya",
    "Pleural_Thickening": "Plevra qalinlashuvi",
    "Cardiomegaly": "Kardiomegaliya",
    "Nodule": "Tugun",
    "Mass": "Hosila",
    "Hernia": "Churra",
    "Lung Lesion": "O'pka o'chog'i",
    "Fracture": "Sinish",
    "Lung Opacity": "O'pka xiralashuvi",
    "Enlarged Cardiomediastinum": "Kengaygan mediastinum",
}

HEMORRHAGE_TYPE_UZ = {
    "epidural": "epidural",
    "subdural": "subdural",
    "subarachnoid": "subaraxnoidal",
    "intraparenchymal": "intraparenximal",
    "intraventricular": "intraventrikulyar",
    "none": "yo'q",
}

BEFAST_UZ = {
    "balance": "muvozanat",
    "eyes": "ko'rish",
    "face": "yuz osilishi",
    "arms": "qo'l kuchsizligi",
    "speech": "nutq buzilishi",
}

FLAG_UZ = {
    "unconscious": "hushsizlik",
    "breathing_difficulty": "nafas qiyinlashuvi",
    "chest_pain": "ko'krak og'rig'i",
}

ZONE_UZ = {"red": "QIZIL", "yellow": "SARIQ", "green": "YASHIL"}

SPECIALIST_UZ = {
    "neurologist": "nevrolog",
    "neurosurgeon": "neyroxirurg",
    "pulmonologist": "pulmonolog",
    "surgeon": "xirurg",
    "therapist": "terapevt",
    "cardiologist": "kardiolog",
    "oncologist": "onkolog",
    "radiologist": "radiolog",
    "family_doctor": "oilaviy shifokor",
}

ROUTE_UZ = {
    "onsite": "joyida davolash",
    "district": "tuman shifoxonasi",
    "regional": "viloyat markazi",
}


def pathology(name: str) -> str:
    return PATHOLOGY_UZ.get(name, name)


def number(value: float, digits: int = 2) -> str:
    """Uzbek decimal comma, e.g. 0.84 -> '0,84'."""
    return f"{value:.{digits}f}".replace(".", ",")


def hours(minutes: float) -> str:
    return f"{minutes / 60:g}".replace(".", ",")
