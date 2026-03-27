"""
WebSocket bridge: browser (linear16 PCM) <-> Deepgram Live streaming STT.
"""

import asyncio
import json
import logging
import urllib.parse

import websockets
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


async def deepgram_live_proxy(websocket: WebSocket, api_key: str) -> None:
    """Proxy audio from browser to Deepgram Live API; forward Deepgram JSON to browser."""
    await websocket.accept()
    if not api_key:
        await websocket.send_text(json.dumps({"error": "DEEPGRAM_API_KEY not configured", "type": "bridge_error"}))
        await websocket.close(code=4001)
        return

    params = {
        "encoding": "linear16",
        "sample_rate": "48000",
        "channels": "1",
        "model": "nova-2",
        "interim_results": "true",
        "smart_format": "true",
        "punctuate": "true",
    }
    q = urllib.parse.urlencode(params)
    uri = f"wss://api.deepgram.com/v1/listen?{q}"
    # Legacy websockets API uses extra_headers (not additional_headers — unknown kwargs go to asyncio.create_connection and crash)
    extra_headers = [("Authorization", f"Token {api_key}")]

    dg_ws = None
    try:
        dg_ws = await websockets.connect(
            uri,
            extra_headers=extra_headers,
            max_size=None,
            ping_interval=20,
            ping_timeout=20,
        )
    except Exception as e:
        logger.exception("Deepgram connect failed: %s", e)
        await websocket.send_text(json.dumps({"error": str(e), "type": "bridge_error"}))
        await websocket.close(code=4002)
        return

    async def browser_to_deepgram():
        try:
            while True:
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg["type"] == "websocket.receive":
                    if "bytes" in msg and msg["bytes"] is not None:
                        await dg_ws.send(msg["bytes"])
                    elif "text" in msg and msg["text"] is not None:
                        await dg_ws.send(msg["text"])
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.debug("browser_to_deepgram: %s", e)

    async def deepgram_to_browser():
        try:
            while True:
                try:
                    message = await dg_ws.recv()
                except websockets.exceptions.ConnectionClosed:
                    break
                if isinstance(message, str):
                    await websocket.send_text(message)
                else:
                    await websocket.send_bytes(message)
        except Exception as e:
            logger.debug("deepgram_to_browser: %s", e)

    t_browser = asyncio.create_task(browser_to_deepgram())
    t_deepgram = asyncio.create_task(deepgram_to_browser())
    try:
        done, pending = await asyncio.wait(
            [t_browser, t_deepgram],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
    finally:
        try:
            await dg_ws.close()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
