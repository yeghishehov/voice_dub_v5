// api/tts.js - Vercel Serverless Function Proxy using msedge-tts

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

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
        
        const { text, voice = 'ru-RU-DmitryNeural', rate = '+0%' } = body || {};

        if (!text) {
            return res.status(400).json({ error: 'Text parameter required' });
        }

        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const tts = new MsEdgeTTS();
                await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
                const { audioStream } = await tts.toStream(text, { rate });

                const chunks = [];
                for await (const chunk of audioStream) {
                    chunks.push(chunk);
                }

                if (chunks.length > 0) {
                    const buffer = Buffer.concat(chunks);
                    res.setHeader('Content-Type', 'audio/mpeg');
                    res.setHeader('Content-Length', buffer.length);
                    return res.status(200).send(buffer);
                }
            } catch (retryErr) {
                lastErr = retryErr;
                console.warn(`[Vercel TTS] Attempt ${attempt + 1} failed:`, retryErr.message);
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        throw lastErr || new Error("Failed to receive audio from Edge TTS");
    } catch (err) {
        console.error("Vercel Edge TTS Error:", err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
