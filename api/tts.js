// api/tts.js - Vercel Serverless Function Proxy for Edge TTS with Custom Chrome Headers

import WebSocket from 'ws';

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
        const { text, voice = 'ru-RU-DmitryNeural', rate = '+0%' } = req.body || {};
        if (!text) {
            return res.status(400).json({ error: 'Text parameter required' });
        }

        const langLocale = (voice && voice.includes('-')) ? voice.split('-').slice(0, 2).join('-') : 'en-US';
        const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const TRUSTED_TOKEN = "6A5AA1D4EA5942B4195C714257E2E89A";
        const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}`;

        const ws = new WebSocket(wsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
                'Origin': 'chrome-extension://jdiccldimpdaibhpobmhopjdcmbcalih'
            }
        });

        const audioChunks = [];

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                try { ws.close(); } catch (e) {}
                reject(new Error('Microsoft Edge TTS timeout'));
            }, 15000);

            ws.on('open', () => {
                const dateStr = new Date().toString();
                const speechConfig = 
                    `X-Timestamp:${dateStr}\r\n` +
                    `Content-Type:application/json; charset=utf-8\r\n` +
                    `Path:speech.config\r\n\r\n` +
                    JSON.stringify({
                        context: {
                            synthesis: {
                                audio: {
                                    metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                                    outputFormat: "audio-24khz-48kbitrate-mono-mp3"
                                }
                            }
                        }
                    });
                ws.send(speechConfig);

                const ssml = 
                    `X-RequestId:${generateGuid()}\r\n` +
                    `X-Timestamp:${dateStr}\r\n` +
                    `Content-Type:application/ssml+xml\r\n` +
                    `Path:ssml\r\n\r\n` +
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${langLocale}'>` +
                    `<voice name='${voice}'><rate value='${rate}'>${escapedText}</rate></voice>` +
                    `</speak>`;
                ws.send(ssml);
            });

            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    const headerLength = view.getUint16(0);
                    const audioData = data.subarray(2 + headerLength);
                    if (audioData.length > 0) {
                        audioChunks.push(audioData);
                    }
                } else {
                    const str = data.toString();
                    if (str.includes("Path:turn.end")) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                }
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        const finalBuffer = Buffer.concat(audioChunks);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', finalBuffer.length);
        return res.status(200).send(finalBuffer);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

function generateGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
