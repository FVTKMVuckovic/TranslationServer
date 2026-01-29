import asyncio
import logging
from typing import Optional
import httpx

from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class AzureSpeechService:
    """Azure Speech Services wrapper using REST API for TTS"""

    def __init__(self):
        self.speech_key = settings.azure_speech_key
        self.speech_region = settings.azure_speech_region
        self.tts_endpoint = f"https://{self.speech_region}.tts.speech.microsoft.com/cognitiveservices/v1"

    async def text_to_speech(self, text: str, language: str = "en") -> bytes:
        """Convert text to speech audio using REST API"""
        # Language to voice mapping
        voice_map = {
            "en": "en-US-JennyNeural",
            "sr-Cyrl": "sr-RS-NicholasNeural",
            "sr": "sr-RS-NicholasNeural",
            "de": "de-DE-KatjaNeural",
            "it": "it-IT-ElsaNeural",
            "hr": "hr-HR-GabrijelaNeural"
        }

        voice = voice_map.get(language, "en-US-JennyNeural")

        # Build SSML
        ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{language}'>
            <voice name='{voice}'>
                {text}
            </voice>
        </speak>"""

        headers = {
            "Ocp-Apim-Subscription-Key": self.speech_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
            "User-Agent": "TranslationServer"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.tts_endpoint,
                    content=ssml,
                    headers=headers,
                    timeout=30.0
                )
                response.raise_for_status()

                logger.info(f"TTS successful for text: '{text[:30]}...' in {language}")
                return response.content

        except httpx.HTTPStatusError as e:
            logger.error(f"TTS HTTP error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"TTS failed: {e.response.status_code}")
        except Exception as e:
            logger.error(f"TTS error: {e}")
            raise


# Singleton instance
_speech_service: Optional[AzureSpeechService] = None


def get_speech_service() -> AzureSpeechService:
    """Get or create speech service singleton"""
    global _speech_service
    if _speech_service is None:
        _speech_service = AzureSpeechService()
    return _speech_service
