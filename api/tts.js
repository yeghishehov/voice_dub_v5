// api/tts.js - Vercel Serverless Function Proxy using native WebSocket & Edge TTS DRM v2
import WebSocket from 'ws';
import crypto from 'crypto';
import { generateSecMsGecV2 } from './drm.js';

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const SEC_MS_GEC_VERSION = '2-143.0.3650.75';

function removeIncompatibleCharacters(str) {
    if (!str) return '';
    return str.split('').map(c => {
        const code = c.charCodeAt(0);
        if ((code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31)) {
            return ' ';
        }
        return c;
    }).join('');
}

function getHeaders() {
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
    return {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Version': '13',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `muid=${muid};`
    };
}

function synthesizeOnce(text, voice, rate, pitch = '+0Hz', timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID().replace(/-/g, '');
        const secMsGec = generateSecMsGecV2();
        const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${requestId}`;

        const ws = new WebSocket(url, { headers: getHeaders() });
        const chunks = [];
        let isDone = false;

        const timer = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                try { ws.close(); } catch (e) {}
                reject(new Error('Edge TTS WebSocket connection timed out'));
            }
        }, timeoutMs);

        ws.on('open', () => {
            const dateStr = new Date().toString();
            const configMsg =
                `X-Timestamp:${dateStr}\r\n` +
                `Content-Type:application/json; charset=utf-8\r\n` +
                `Path:speech.config\r\n\r\n` +
                JSON.stringify({
                    context: {
                        synthesis: {
                            audio: {
                                metadataoptions: {
                                    sentenceBoundaryEnabled: 'false',
                                    wordBoundaryEnabled: 'false'
                                },
                                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
                            }
                        }
                    }
                }) + '\r\n';
            ws.send(configMsg);

            const cleaned = removeIncompatibleCharacters(text);
            const escapedText = cleaned
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const prosodyRate = rate || '+0%';
            const prosodyPitch = pitch || '+0Hz';

            const ssml =
                `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
                `<voice name='${voice}'>` +
                `<prosody pitch='${prosodyPitch}' rate='${prosodyRate}' volume='+0%'>${escapedText}</prosody>` +
                `</voice>` +
                `</speak>`;

            const ssmlMsg =
                `X-RequestId:${requestId}\r\n` +
                `X-Timestamp:${dateStr}\r\n` +
                `Content-Type:application/ssml+xml\r\n` +
                `Path:ssml\r\n\r\n` +
                ssml;

            ws.send(ssmlMsg);
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                if (data.length < 2) return;
                const headerLength = data.readUInt16BE(0);
                if (headerLength + 2 <= data.length) {
                    const audio = data.subarray(2 + headerLength);
                    if (audio.length > 0) {
                        chunks.push(audio);
                    }
                }
            } else {
                const str = data.toString('utf-8');
                if (str.includes('Path:turn.end')) {
                    if (!isDone) {
                        isDone = true;
                        clearTimeout(timer);
                        try { ws.close(); } catch (e) {}
                        if (chunks.length === 0) {
                            reject(new Error('Received empty audio from Edge TTS'));
                        } else {
                            resolve(Buffer.concat(chunks));
                        }
                    }
                }
            }
        });

        ws.on('error', (err) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                reject(err);
            }
        });

        ws.on('close', () => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                if (chunks.length > 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error('Edge TTS WebSocket closed without receiving complete audio'));
                }
            }
        });
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch(e) {}
        }

        const { text, voice = 'ru-RU-DmitryNeural', rate = '+0%', pitch = '+0Hz' } = body || {};

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text parameter required' });
        }

        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const buffer = await synthesizeOnce(text.trim(), voice, rate, pitch);
                if (buffer && buffer.length > 0) {
                    res.setHeader('Content-Type', 'audio/mpeg');
                    res.setHeader('Content-Length', buffer.length);
                    return res.status(200).send(buffer);
                }
            } catch (err) {
                lastErr = err;
                console.warn(`[Vercel TTS] Attempt ${attempt + 1} failed:`, err.message);
                if (attempt < 2) {
                    const waitMs = attempt === 0 ? 800 : 1500;
                    await new Promise((r) => setTimeout(r, waitMs));
                }
            }
        }

        throw lastErr || new Error('Failed to receive audio from Edge TTS');
    } catch (err) {
        console.error('Vercel Edge TTS Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
