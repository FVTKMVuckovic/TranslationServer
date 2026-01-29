from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://user:pass@localhost:5432/db"

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Azure Speech Services
    azure_speech_key: str = ""
    azure_speech_region: str = "westeurope"

    # Azure Translator
    azure_translator_key: str = ""
    azure_translator_region: str = "westeurope"
    azure_translator_endpoint: str = "https://api.cognitive.microsofttranslator.com/"

    # CORS
    frontend_url: str = "http://localhost:3000"

    # Registration
    invite_code: str = "CHANGE_THIS_SECRET_INVITE_CODE"

    # Supported languages
    source_language: str = "de-DE"
    target_languages: list[str] = ["en", "sr-Cyrl", "it", "hr"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
