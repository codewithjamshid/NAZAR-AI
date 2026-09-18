from pydantic import BaseModel, ConfigDict, Field

BEFAST_KEYS = ("balance", "eyes", "face", "arms", "speech")
FLAG_KEYS = ("unconscious", "breathing_difficulty", "chest_pain")


class AnamnesisIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    befast: dict[str, bool] | None = None
    flags: dict[str, bool] = Field(default_factory=dict)
    chief_complaint: str | None = Field(default=None, max_length=2000)
    voice_transcript: str | None = Field(default=None, max_length=5000)

    def cleaned_befast(self) -> dict[str, bool] | None:
        if self.befast is None:
            return None
        return {key: bool(self.befast.get(key, False)) for key in BEFAST_KEYS}

    def cleaned_flags(self) -> dict[str, bool]:
        return {key: bool(self.flags.get(key, False)) for key in FLAG_KEYS}


class LabValuesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: dict[str, float] = Field(default_factory=dict)


class DecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(pattern="^(confirm|modify|reject_ai)$")
    note: str | None = Field(default=None, max_length=2000)
    route_final: str | None = Field(default=None, pattern="^(onsite|district|regional)$")
