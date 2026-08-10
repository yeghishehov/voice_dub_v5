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
     * @returns {Promise<Array<Object>>}
     */
    static async translatePhrases(phrases, targetLang = "Русский", sourceLangKey = "Армянский", apiKey = CONFIG.DEFAULT_API_KEY, progressCb = console.log) {
        if (!phrases || phrases.length === 0) return phrases;

        const langName = CONFIG.LANG_NAMES[targetLang] || targetLang;
        const sourceLangName = CONFIG.SOURCE_LANGS[sourceLangKey]?.prompt_lang || "Armenian";
        const modelId = CONFIG.MODEL_ID;

        const batchSize = 10;
        const total = phrases.length;

        progressCb(`🌐 Перевод ${total} фраз на ${targetLang} (${langName})...`);

        for (let i = 0; i < total; i += batchSize) {
            const batch = phrases.slice(i, i + batchSize);
            const sourceTexts = batch.map(p => p.sourceText);

            progressCb(`🌐 Перевод фраз ${i + 1}–${Math.min(i + batchSize, total)} из ${total}...`);

            const prompt = 
                `Translate these ${sourceTexts.length} ${sourceLangName} phrases into ${langName}.\n` +
                `Return ONLY a JSON array of strings in the exact same order.\n` +
                `Use natural, fluent language. Do NOT transliterate — use native script.\n\n` +
                `Phrases:\n${JSON.stringify(sourceTexts)}`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
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
                    const rawContent = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;

                    if (rawContent) {
                        const result = JSON.parse(rawContent);
                        if (Array.isArray(result) && result.length === sourceTexts.length) {
                            translatedList = result;
                        }
                    }
                } catch (err) {
                    attempts--;
                    progressCb(`⚠️ Ошибка перевода в чанке ${i + 1} (${err.message}). Осталось попыток: ${attempts}`);
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

        progressCb(`✅ Перевод завершен! Готово фраз: ${total}`);
        return phrases;
    }
}
