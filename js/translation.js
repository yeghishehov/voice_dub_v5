// js/translation.js - Gemini API Batch Translation

import { CONFIG } from './config.js';

export class Translator {
    /**
     * Translates phrases to target language in batches using Gemini API.
     * @param {Array<Object>} phrases 
     * @param {string} targetLang 
     * @param {string} sourceLangKey 
     * @param {string} apiKey 
     * @param {function(string):void} progressCb 
     * @param {string} uiLang
     * @returns {Promise<Array<Object>>}
     */
    static async translatePhrases(phrases, targetLang = "Русский", sourceLangKey = "Армянский", apiKey = CONFIG.DEFAULT_API_KEY, progressCb = console.log, uiLang = 'en') {
        if (!phrases || phrases.length === 0) return phrases;

        const langName = CONFIG.LANG_NAMES[targetLang] || targetLang;
        const sourceLangName = CONFIG.SOURCE_LANGS[sourceLangKey]?.prompt_lang || "Armenian";
        const modelId = CONFIG.MODEL_ID;

        const batchSize = 10;
        const total = phrases.length;
        const isRu = uiLang === 'ru';

        progressCb(isRu 
            ? `🌐 Перевод ${total} фраз на ${targetLang} (${langName})...` 
            : `🌐 Translating ${total} phrases into ${targetLang} (${langName})...`);

        // Professional dubbing & localization system instruction
        const systemInstruction = {
            parts: [{
                text: "You are an elite, highly accurate film, documentary, and dialogue localization translator for audio/video dubbing.\n" +
                      "Your task is to produce strictly faithful, precise, and contextually accurate translations while preserving the exact meaning, speaker tone, grammatical gender, idioms, terminology, numbers, and natural speech rhythm.\n\n" +
                      "CRITICAL RULES:\n" +
                      "1. ACCURACY & FIDELITY: Never omit, invent, summarize, or hallucinate content. Translate every phrase accurately.\n" +
                      "2. CONTEXTUAL COHERENCE: Maintain consistent gender (masculine/feminine), pronouns, honorifics (formal/informal), and narrative continuity across all sequential lines.\n" +
                      "3. DUBBING FIT: Ensure spoken naturalness and suitable sentence cadence for speech synthesis.\n" +
                      "4. SCRIPT & ORTHOGRAPHY: Output purely in the native script of the target language (e.g. Cyrillic for Russian, Arabic script for Egyptian/Persian, Latin for English/Spanish). Never transliterate.\n" +
                      "5. OUTPUT FORMAT: Output ONLY the requested JSON array of strings with the exact same number of items and order."
            }]
        };

        for (let i = 0; i < total; i += batchSize) {
            const batch = phrases.slice(i, i + batchSize);
            const sourceTexts = batch.map(p => p.sourceText);

            progressCb(isRu 
                ? `🌐 Перевод фраз ${i + 1}–${Math.min(i + batchSize, total)} из ${total}...` 
                : `🌐 Translating phrases ${i + 1}–${Math.min(i + batchSize, total)} of ${total}...`);

            // Build dialogue context from previous and upcoming phrases
            let contextHeader = "";
            if (i > 0) {
                const prevPhrases = phrases.slice(Math.max(0, i - 3), i);
                contextHeader += "--- PREVIOUS DIALOGUE CONTEXT (for continuity reference only, DO NOT re-translate) ---\n";
                prevPhrases.forEach(p => {
                    contextHeader += `[Source: "${p.sourceText}"] -> [Translated: "${p.targetText || ''}"]\n`;
                });
                contextHeader += "\n";
            }

            if (i + batchSize < total) {
                const nextPhrases = phrases.slice(i + batchSize, Math.min(total, i + batchSize + 2));
                contextHeader += "--- UPCOMING DIALOGUE (for context reference if sentences continue across cuts) ---\n";
                nextPhrases.forEach(p => {
                    contextHeader += `[Upcoming: "${p.sourceText}"]\n`;
                });
                contextHeader += "\n";
            }

            const prompt = 
                `${contextHeader}` +
                `--- PHRASES TO TRANSLATE (${sourceTexts.length} items from ${sourceLangName} to ${langName}) ---\n` +
                `Return ONLY a JSON array of strings containing the exact translations for these ${sourceTexts.length} phrases in the exact same order.\n\n` +
                `Phrases:\n${JSON.stringify(sourceTexts, null, 2)}`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const requestBody = {
                systemInstruction: systemInstruction,
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1,
                    topP: 0.95
                }
            };

            let attempts = 3;
            let translatedList = null;

            while (attempts > 0 && !translatedList) {
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
                    let rawContent = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;

                    if (rawContent) {
                        rawContent = rawContent.trim();
                        if (rawContent.startsWith('```')) {
                            rawContent = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
                        }
                        const result = JSON.parse(rawContent);
                        if (Array.isArray(result) && result.length === sourceTexts.length) {
                            translatedList = result;
                        }
                    }
                } catch (err) {
                    attempts--;
                    progressCb(isRu 
                        ? `⚠️ Ошибка перевода в чанке ${i + 1} (${err.message}). Осталось попыток: ${attempts}`
                        : `⚠️ Translation error in batch ${i + 1} (${err.message}). Retries left: ${attempts}`);
                    if (attempts > 0) {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }

            if (translatedList) {
                for (let j = 0; j < batch.length; j++) {
                    batch[j].targetText = translatedList[j];
                }
            } else {
                for (let j = 0; j < batch.length; j++) {
                    if (!batch[j].targetText) {
                        batch[j].targetText = batch[j].sourceText; // fallback to source
                    }
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        progressCb(isRu 
            ? `✅ Перевод завершен! Готово фраз: ${total}`
            : `✅ Translation completed! Total phrases: ${total}`);
        return phrases;
    }
}
