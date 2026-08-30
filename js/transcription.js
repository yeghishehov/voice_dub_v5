// js/transcription.js - Gemini API Transcription with Structured Output

import { CONFIG } from './config.js';

export class Transcriber {
    /**
     * Converts seconds to MM:SS string
     */
    static toTimestamp(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Converts MM:SS string to seconds
     */
    static toSeconds(ts) {
        if (!ts) return 0;
        const p = ts.toString().split(':');
        if (p.length === 1) return parseInt(p[0]) || 0;
        return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
    }

    /**
     * Transcribe audio chunks using Gemini API.
     * @param {Array<{index: number, startSec: number, base64: string}>} chunks 
     * @param {string} sourceLangKey 
     * @param {string} apiKey 
     * @param {function(string):void} progressCb 
     * @param {string} uiLang
     * @returns {Promise<Array<{id: number, start: string, end: string, sourceText: string, targetText: string}>>}
     */
    static async transcribeChunks(chunks, sourceLangKey = "Армянский", apiKey = CONFIG.DEFAULT_API_KEY, progressCb = console.log, uiLang = 'en') {
        const langMeta = CONFIG.SOURCE_LANGS[sourceLangKey] || CONFIG.SOURCE_LANGS["Армянский"];
        const promptLang = langMeta.prompt_lang;
        const modelId = CONFIG.MODEL_ID;

        const allSegments = [];
        let phraseId = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isRu = uiLang === 'ru';
            progressCb(isRu 
                ? `🛰️ Транскрибация фрагмента ${i + 1}/${chunks.length} (${chunk.startSec}с)...` 
                : `🛰️ Transcribing chunk ${i + 1}/${chunks.length} (${chunk.startSec}s)...`);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const systemInstructionText = 
                `Ты — профессиональная система нативной транскрибации аудио. ` +
                `Прослушай аудиофайл и преобразуй речь в текст с таймкодами.\n\n` +
                `Правила:\n` +
                `1. Пиши текст дословно на языке оригинала (${promptLang}).\n` +
                `2. Разбивай на фразы по паузам спикера.\n` +
                `3. Для каждой фразы укажи start_time и end_time относительно начала фрагмента.\n` +
                `4. Формат времени: строго 'MM:SS' (например '00:14'). Без миллисекунд.\n` +
                `5. Тишина или музыка — вернуть пустой массив [].`;

            const requestBody = {
                systemInstruction: {
                    parts: [{ text: systemInstructionText }]
                },
                contents: [
                    {
                        parts: [
                            {
                                inline_data: {
                                    mime_type: "audio/wav",
                                    data: chunk.base64
                                }
                            },
                            { text: "Транскрибируй это аудио согласно системной инструкции." }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                start_time: { type: "STRING" },
                                end_time: { type: "STRING" },
                                text: { type: "STRING" }
                            },
                            required: ["start_time", "end_time", "text"]
                        }
                    }
                }
            };

            let attempts = 3;
            let success = false;

            while (attempts > 0 && !success) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errText}`);
                    }

                    const jsonRes = await response.json();
                    const rawContent = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;

                    if (rawContent) {
                        const items = JSON.parse(rawContent);
                        if (Array.isArray(items)) {
                            for (const item of items) {
                                const text = (item.text || '').trim();
                                if (!text) continue;

                                const startSec = chunk.startSec + this.toSeconds(item.start_time || '00:00');
                                const endSec = chunk.startSec + this.toSeconds(item.end_time || '00:00');

                                allSegments.push({
                                    id: phraseId++,
                                    start: this.toTimestamp(startSec),
                                    end: this.toTimestamp(endSec),
                                    startSec: startSec,
                                    endSec: endSec,
                                    sourceText: text,
                                    targetText: ""
                                });
                            }
                        }
                    }
                    success = true;
                } catch (err) {
                    attempts--;
                    progressCb(isRu 
                        ? `⚠️ Ошибка API в чанке ${i + 1} (${err.message}). Осталось попыток: ${attempts}`
                        : `⚠️ API error in chunk ${i + 1} (${err.message}). Retries left: ${attempts}`);
                    if (attempts > 0) {
                        await new Promise(r => setTimeout(r, 4000));
                    }
                }
            }

            if (!success) {
                progressCb(isRu 
                    ? `❌ Пропущен фрагмент ${i + 1} из-за ошибок API.`
                    : `❌ Skipped chunk ${i + 1} due to API errors.`);
            }
        }

        // Sort by startSec
        allSegments.sort((a, b) => a.startSec - b.startSec);
        const isRu = uiLang === 'ru';
        progressCb(isRu 
            ? `🎉 Транскрибация завершена! Распознано фраз: ${allSegments.length}`
            : `🎉 Transcription completed! Recognized phrases: ${allSegments.length}`);
        return allSegments;
    }
}
