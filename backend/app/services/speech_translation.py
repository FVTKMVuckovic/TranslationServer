import asyncio
import logging
from typing import Callable, Optional, List
import azure.cognitiveservices.speech as speechsdk

from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class SpeechTranslationService:
    """Azure Speech Translation for real-time audio translation"""

    def __init__(self):
        self.speech_key = settings.azure_speech_key
        self.speech_region = settings.azure_speech_region

    def create_translation_config(
        self,
        source_language: str = "de-DE",
        target_languages: List[str] = None
    ) -> speechsdk.translation.SpeechTranslationConfig:
        """Create a translation config"""
        if target_languages is None:
            target_languages = ["en", "sr-Cyrl", "it", "hr"]

        translation_config = speechsdk.translation.SpeechTranslationConfig(
            subscription=self.speech_key,
            region=self.speech_region
        )

        translation_config.speech_recognition_language = source_language

        # Sehr aggressive Pause-Erkennung für kürzere Sätze
        # Segmentation silence timeout: Zeit der Stille, nach der ein Satz als beendet gilt
        # Standard ist ~500ms, wir setzen es auf 100ms für maximale Reaktionsgeschwindigkeit
        translation_config.set_property(
            speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "100"
        )

        # End silence timeout: Maximale Stille am Ende bevor Erkennung stoppt
        translation_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "200"
        )

        for lang in target_languages:
            translation_config.add_target_language(lang)

        return translation_config

    async def translate_audio_stream(
        self,
        audio_stream: speechsdk.audio.PushAudioInputStream,
        on_recognized: Callable[[str, dict], None],
        on_recognizing: Callable[[str], None] = None,
        source_language: str = "de-DE",
        target_languages: List[str] = None
    ):
        """
        Translate audio from a stream in real-time.

        Args:
            audio_stream: Push audio input stream
            on_recognized: Callback for final recognition (text, translations)
            on_recognizing: Callback for interim recognition (text)
            source_language: Source language code
            target_languages: Target language codes
        """
        if target_languages is None:
            target_languages = ["en", "sr-Cyrl", "it", "hr"]

        translation_config = self.create_translation_config(
            source_language=source_language,
            target_languages=target_languages
        )

        audio_config = speechsdk.audio.AudioConfig(stream=audio_stream)

        recognizer = speechsdk.translation.TranslationRecognizer(
            translation_config=translation_config,
            audio_config=audio_config
        )

        # Event handlers
        def handle_recognizing(evt):
            if on_recognizing and evt.result.text:
                # Extract interim translations (Azure provides them during recognizing too!)
                translations = {}
                for lang in target_languages:
                    if lang in evt.result.translations:
                        translations[lang] = evt.result.translations[lang]

                # Run callback in event loop with text AND translations
                try:
                    on_recognizing(evt.result.text, translations)
                except Exception as e:
                    logger.error(f"Error in on_recognizing callback: {e}")

        def handle_recognized(evt):
            if evt.result.reason == speechsdk.ResultReason.TranslatedSpeech:
                text = evt.result.text
                translations = {}

                for lang in target_languages:
                    if lang in evt.result.translations:
                        translations[lang] = evt.result.translations[lang]

                logger.info(f"Translated: '{text}' -> {translations}")

                try:
                    on_recognized(text, translations)
                except Exception as e:
                    logger.error(f"Error in on_recognized callback: {e}")

            elif evt.result.reason == speechsdk.ResultReason.NoMatch:
                logger.debug("No speech recognized")

        def handle_canceled(evt):
            logger.warning(f"Translation canceled: {evt.reason}")
            if evt.reason == speechsdk.CancellationReason.Error:
                logger.error(f"Error details: {evt.error_details}")

        recognizer.recognizing.connect(handle_recognizing)
        recognizer.recognized.connect(handle_recognized)
        recognizer.canceled.connect(handle_canceled)

        return recognizer


def create_push_stream() -> speechsdk.audio.PushAudioInputStream:
    """Create a push audio input stream for streaming audio data"""
    # Default format: 16kHz, 16-bit, mono PCM
    audio_format = speechsdk.audio.AudioStreamFormat(
        samples_per_second=16000,
        bits_per_sample=16,
        channels=1
    )
    return speechsdk.audio.PushAudioInputStream(stream_format=audio_format)


# Singleton instance
_speech_translation_service: Optional[SpeechTranslationService] = None


def get_speech_translation_service() -> SpeechTranslationService:
    """Get or create speech translation service singleton"""
    global _speech_translation_service
    if _speech_translation_service is None:
        _speech_translation_service = SpeechTranslationService()
    return _speech_translation_service
