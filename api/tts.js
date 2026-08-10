// api/tts.js - Vercel Serverless Function for Edge TTS (Free Cloud Hosting)

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, voice = 'ru-RU-DmitryNeural', rate = '+0%' } = req.body || {};

        if (!text) {
            return res.status(400).json({ error: 'Text parameter required' });
        }

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = await tts.toStream(text, { rate });

        const chunks = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buffer.length);
        return res.status(200).send(buffer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
