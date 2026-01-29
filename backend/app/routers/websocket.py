from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional
import asyncio
import json
import logging
import azure.cognitiveservices.speech as speechsdk

from ..services.session_manager import get_session_manager
from ..services.azure_speech import get_speech_service
from ..services.azure_translator import get_translator_service
from ..services.speech_translation import get_speech_translation_service, create_push_stream
from ..utils.auth import verify_token
from ..config import get_settings

settings = get_settings()
router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

# Store active recognizers per session
active_recognizers = {}


@router.websocket("/ws/leader/{session_id}")
async def leader_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...)
):
    """
    WebSocket endpoint for session leader.
    Receives audio from leader's microphone and broadcasts transcripts.
    """
    # Verify token
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    session_manager = get_session_manager()
    translator_service = get_translator_service()
    speech_translation_service = get_speech_translation_service()

    # For audio streaming
    push_stream = None
    recognizer = None
    loop = asyncio.get_event_loop()

    try:
        # Connect leader
        await session_manager.connect_leader(session_id, websocket)

        # Send initial status
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id
        })

        while True:
            try:
                # Receive message from leader
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if "bytes" in message:
                    # Audio data received
                    audio_data = message["bytes"]

                    # Push audio to the stream if active
                    if push_stream:
                        push_stream.write(audio_data)

                elif "text" in message:
                    # JSON message received
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "start_streaming":
                        # Start Speech Translation
                        logger.info(f"Starting audio streaming for session {session_id}")

                        # Create push stream
                        push_stream = create_push_stream()

                        # Callbacks for recognition results
                        def on_recognizing(text, translations):
                            """Called for interim results - now with translations!"""
                            # Send interim to leader
                            asyncio.run_coroutine_threadsafe(
                                session_manager.send_to_leader(session_id, {
                                    "type": "interim_transcript",
                                    "text": text,
                                    "translations": translations
                                }),
                                loop
                            )
                            # Also broadcast interim translations to participants for real-time display
                            asyncio.run_coroutine_threadsafe(
                                session_manager.broadcast_transcript(
                                    session_id=session_id,
                                    original_text=text,
                                    translations=translations,
                                    is_final=False  # Mark as interim
                                ),
                                loop
                            )

                        def on_recognized(text, translations):
                            """Called for final results"""
                            asyncio.run_coroutine_threadsafe(
                                broadcast_translation(
                                    session_id, text, translations,
                                    session_manager, websocket
                                ),
                                loop
                            )

                        # Create recognizer - translate to all supported languages
                        recognizer = await speech_translation_service.translate_audio_stream(
                            audio_stream=push_stream,
                            on_recognized=on_recognized,
                            on_recognizing=on_recognizing,
                            source_language="de-DE",
                            target_languages=["en", "sr-Cyrl", "it", "hr"]
                        )

                        # Start continuous recognition
                        recognizer.start_continuous_recognition()
                        active_recognizers[session_id] = recognizer

                        await websocket.send_json({
                            "type": "streaming_started"
                        })

                    elif msg_type == "stop_streaming":
                        # Stop Speech Translation
                        logger.info(f"Stopping audio streaming for session {session_id}")

                        if recognizer:
                            recognizer.stop_continuous_recognition()
                            recognizer = None

                        if push_stream:
                            push_stream.close()
                            push_stream = None

                        if session_id in active_recognizers:
                            del active_recognizers[session_id]

                        await websocket.send_json({
                            "type": "streaming_stopped"
                        })

                    elif msg_type == "mic_state":
                        # Microphone state changed
                        enabled = data.get("enabled", False)
                        await session_manager.set_mic_state(session_id, enabled)

                    elif msg_type == "text_input":
                        # Manual text input (fallback)
                        text = data.get("text", "")
                        if text:
                            await process_text(
                                session_id,
                                text,
                                session_manager,
                                translator_service
                            )

                    elif msg_type == "text_update":
                        # Update last entry (for extended sentences)
                        text = data.get("text", "")
                        if text:
                            await process_text_update(
                                session_id,
                                text,
                                session_manager,
                                translator_service
                            )

            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"Leader WebSocket error: {e}")
    finally:
        # Cleanup
        if recognizer:
            try:
                recognizer.stop_continuous_recognition()
            except:
                pass

        if push_stream:
            try:
                push_stream.close()
            except:
                pass

        if session_id in active_recognizers:
            del active_recognizers[session_id]

        await session_manager.disconnect_leader(session_id)


async def broadcast_translation(
    session_id: str,
    original_text: str,
    translations: dict,
    session_manager,
    leader_websocket: WebSocket
):
    """Broadcast translation to all participants and leader"""
    try:
        # Broadcast to participants
        await session_manager.broadcast_transcript(
            session_id=session_id,
            original_text=original_text,
            translations=translations,
            is_final=True
        )

        # Send to leader for display
        await leader_websocket.send_json({
            "type": "transcript_sent",
            "original": original_text,
            "translations": translations
        })

        logger.info(f"Broadcast translation: '{original_text[:30]}...'")

    except Exception as e:
        logger.error(f"Broadcast error: {e}")


@router.websocket("/ws/participant/{session_code}")
async def participant_websocket(
    websocket: WebSocket,
    session_code: str,
    language: str = Query(default="en")
):
    """
    WebSocket endpoint for participants.
    Receives transcripts and audio in their selected language.
    """
    await websocket.accept()

    session_manager = get_session_manager()
    translator_service = get_translator_service()
    connection_id = None

    try:
        # Validate session
        session = session_manager.get_session_by_code(session_code)
        if not session:
            await websocket.send_json({
                "type": "error",
                "message": "Session not found"
            })
            await websocket.close(code=4004)
            return

        if not session.is_active:
            await websocket.send_json({
                "type": "error",
                "message": "Session is not active"
            })
            await websocket.close(code=4004)
            return

        # Connect participant
        connection_id = await session_manager.connect_participant(
            session_code,
            websocket,
            language
        )

        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "session_code": session_code,
            "language": language,
            "connection_id": connection_id
        })

        # Keep connection alive
        while True:
            try:
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if "text" in message:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

                    elif msg_type == "change_language":
                        new_language = data.get("language")
                        if new_language:
                            await session_manager.disconnect_participant(session_code, connection_id)
                            connection_id = await session_manager.connect_participant(
                                session_code,
                                websocket,
                                new_language
                            )
                            await websocket.send_json({
                                "type": "language_changed",
                                "language": new_language
                            })

                    elif msg_type == "question":
                        question_text = data.get("text")
                        question_language = data.get("source_language", language)

                        if question_text:
                            # Translate question to German for the leader
                            german_text = question_text
                            if question_language != "de":
                                try:
                                    # Map language codes for translator (use as-is, Azure supports all)
                                    translations = await translator_service.translate(
                                        text=question_text,
                                        target_languages=["de"],
                                        source_language=question_language
                                    )
                                    german_text = translations.get("de", question_text)
                                except Exception as e:
                                    logger.error(f"Question translation error: {e}")

                            await session_manager.send_to_leader(
                                session.session_id,
                                {
                                    "type": "participant_question",
                                    "text": german_text,
                                    "original_text": question_text,
                                    "source_language": question_language,
                                    "participant_id": connection_id
                                }
                            )

            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"Participant WebSocket error: {e}")
    finally:
        if connection_id:
            await session_manager.disconnect_participant(session_code, connection_id)


# Maximum text length to prevent Azure cost abuse
MAX_TEXT_LENGTH = 2000  # 2000 characters max per message


async def process_text(
    session_id: str,
    text: str,
    session_manager,
    translator_service
):
    """Process text: translate and broadcast to participants."""
    if not text.strip():
        return

    # Limit text length to prevent cost abuse
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]
        logger.warning(f"Text truncated to {MAX_TEXT_LENGTH} characters")

    try:
        # Get active languages (only translate to languages with participants)
        active_languages = session_manager.get_active_languages(session_id)

        if not active_languages:
            # No participants - skip translation entirely to save costs
            logger.info(f"No participants - skipping translation")
            # Still send original text to leader
            await session_manager.send_to_leader(session_id, {
                "type": "transcript_sent",
                "original": text,
                "translations": {}
            })
            return

        # Only translate to languages that have active participants
        target_langs = list(active_languages)
        logger.info(f"Translating to active languages: {target_langs}")

        translations = await translator_service.translate(
            text=text,
            target_languages=target_langs,
            source_language="de"
        )

        await session_manager.broadcast_transcript(
            session_id=session_id,
            original_text=text,
            translations=translations,
            is_final=True
        )

        await session_manager.send_to_leader(session_id, {
            "type": "transcript_sent",
            "original": text,
            "translations": translations
        })

    except Exception as e:
        logger.error(f"Text processing error: {e}")


async def process_text_update(
    session_id: str,
    text: str,
    session_manager,
    translator_service
):
    """Process text UPDATE: translate and update the last entry (not create new)."""
    if not text.strip():
        return

    # Limit text length to prevent cost abuse
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]
        logger.warning(f"Text truncated to {MAX_TEXT_LENGTH} characters")

    try:
        # Get active languages (only translate to languages with participants)
        active_languages = session_manager.get_active_languages(session_id)

        if not active_languages:
            # No participants - skip translation entirely to save costs
            logger.info(f"No participants - skipping translation (update)")
            # Still send original text to leader
            await session_manager.send_to_leader(session_id, {
                "type": "transcript_updated",
                "original": text,
                "translations": {}
            })
            return

        # Only translate to languages that have active participants
        target_langs = list(active_languages)
        logger.info(f"Updating translation to active languages: {target_langs}")

        translations = await translator_service.translate(
            text=text,
            target_languages=target_langs,
            source_language="de"
        )

        # Broadcast as UPDATE to participants
        await session_manager.broadcast_transcript_update(
            session_id=session_id,
            original_text=text,
            translations=translations
        )

        # Send UPDATE to leader
        await session_manager.send_to_leader(session_id, {
            "type": "transcript_updated",
            "original": text,
            "translations": translations
        })

    except Exception as e:
        logger.error(f"Text update processing error: {e}")


@router.websocket("/ws/tts/{session_code}")
async def tts_websocket(
    websocket: WebSocket,
    session_code: str,
    language: str = Query(default="en")
):
    """
    WebSocket for Text-to-Speech audio streaming.
    """
    await websocket.accept()

    session_manager = get_session_manager()
    speech_service = get_speech_service()

    try:
        session = session_manager.get_session_by_code(session_code)
        if not session or not session.is_active:
            await websocket.close(code=4004)
            return

        while True:
            try:
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if "text" in message:
                    data = json.loads(message["text"])

                    if data.get("type") == "synthesize":
                        text = data.get("text", "")
                        # Limit TTS text length to prevent cost abuse
                        if text and len(text) <= MAX_TEXT_LENGTH:
                            audio_data = await speech_service.text_to_speech(
                                text=text[:MAX_TEXT_LENGTH],  # Extra safety
                                language=language
                            )
                            await websocket.send_bytes(audio_data)

            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"TTS WebSocket error: {e}")
