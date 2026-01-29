import asyncio
import logging
import httpx
from typing import Dict, List, Optional

from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class AzureTranslatorService:
    """Azure Translator Service - tries multiple endpoints with Speech key"""

    def __init__(self):
        self.key = settings.azure_translator_key or settings.azure_speech_key
        self.region = settings.azure_translator_region or settings.azure_speech_region
        self._working_endpoint = None
        self._use_fallback = False

        # Endpoints to try (in order)
        self._endpoints = [
            # Regional Cognitive Services endpoint (works with multi-service keys)
            f"https://{self.region}.api.cognitive.microsoft.com/translator/text/v3.0",
            # Global Translator endpoint
            "https://api.cognitive.microsofttranslator.com",
        ]

    async def translate(
        self,
        text: str,
        target_languages: List[str],
        source_language: str = "de"
    ) -> Dict[str, str]:
        """Translate text to multiple target languages."""
        if not text.strip():
            return {lang: "" for lang in target_languages}

        if self._use_fallback:
            return self._create_fallback_translations(text, target_languages)

        # If we found a working endpoint, use it
        if self._working_endpoint:
            return await self._try_translate(
                self._working_endpoint, text, target_languages, source_language
            )

        # Try each endpoint until one works
        for endpoint in self._endpoints:
            try:
                result = await self._try_translate(
                    endpoint, text, target_languages, source_language
                )
                # If successful, remember this endpoint
                self._working_endpoint = endpoint
                logger.info(f"Using translation endpoint: {endpoint}")
                return result
            except Exception as e:
                logger.warning(f"Endpoint {endpoint} failed: {e}")
                continue

        # All endpoints failed
        logger.error("All translation endpoints failed, using fallback")
        self._use_fallback = True
        return self._create_fallback_translations(text, target_languages)

    async def _try_translate(
        self,
        endpoint: str,
        text: str,
        target_languages: List[str],
        source_language: str
    ) -> Dict[str, str]:
        """Try to translate using a specific endpoint."""
        url = f"{endpoint}/translate"

        params = {
            "api-version": "3.0",
            "from": source_language,
            "to": target_languages
        }

        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Ocp-Apim-Subscription-Region": self.region,
            "Content-Type": "application/json"
        }

        body = [{"text": text}]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                params=params,
                headers=headers,
                json=body,
                timeout=10.0
            )
            response.raise_for_status()

            result = response.json()

            translations = {}
            if result and len(result) > 0:
                for translation in result[0].get("translations", []):
                    lang = translation.get("to")
                    translated_text = translation.get("text")
                    translations[lang] = translated_text

            logger.info(f"Translation successful: '{text[:30]}...' -> {list(translations.keys())}")
            return translations

    def _create_fallback_translations(
        self,
        text: str,
        target_languages: List[str]
    ) -> Dict[str, str]:
        """Fallback: return original text for all languages."""
        logger.warning(f"Using fallback (no translation) for: {text[:30]}...")
        return {lang: text for lang in target_languages}


# Singleton instance
_translator_service: Optional[AzureTranslatorService] = None


def get_translator_service() -> AzureTranslatorService:
    """Get or create translator service singleton"""
    global _translator_service
    if _translator_service is None:
        _translator_service = AzureTranslatorService()
    return _translator_service
