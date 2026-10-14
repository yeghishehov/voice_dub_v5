// js/tts.js - Client-Side Microsoft Edge TTS (Strict Edge TTS Engine Only)

export class EdgeTTS {
    /**
     * Synthesize text to MP3 Blob using Microsoft Edge TTS.
     * @param {string} text 
     * @param {string} voice 
     * @param {string} rate e.g. "+0%", "+10%", "-10%"
     * @returns {Promise<Blob>}
     */
    static async synthesize(text, voice = "ru-RU-DmitryNeural", rate = "+0%", pitch = "+0Hz") {
        const endpoints = ['/api/tts'];
        const isSecure = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
        if (!isSecure) {
            const defaultPorts = ['8080', '8081', '8082', '8083'];
            for (const port of defaultPorts) {
                const h1 = `http://localhost:${port}/api/tts`;
                const h2 = `http://127.0.0.1:${port}/api/tts`;
                if (!endpoints.includes(h1)) endpoints.push(h1);
                if (!endpoints.includes(h2)) endpoints.push(h2);
            }
        }

        let lastServerError = null;
        for (const ep of endpoints) {
            for (let tryIdx = 0; tryIdx < 2; tryIdx++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 16000);

                    const res = await fetch(ep, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text, voice, rate, pitch }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const blob = await res.blob();
                        if (blob && blob.size > 0) return blob;
                    } else {
                        const errData = await res.json().catch(() => null);
                        if (errData && errData.error) {
                            lastServerError = errData.error;
                            console.warn(`[EdgeTTS] Endpoint ${ep} error (attempt ${tryIdx + 1}):`, errData.error);
                        }
                    }
                } catch (err) {
                    // Candidate endpoint unreachable or aborted
                }
                if (tryIdx === 0) {
                    await new Promise(r => setTimeout(r, 700));
                }
            }
        }

        // Priority 2: Direct Client-Side Browser WebSocket with dynamic Sec-MS-GEC
        const secMsGec = await this.generateSecMsGec();
        const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
        const requestId = this.generateGuid();

        let wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}&ConnectionId=${requestId}`;
        if (secMsGec) {
            wsUrl += `&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-130.0.2849.68`;
        }

        return new Promise((resolve, reject) => {
            let ws;
            try {
                ws = new WebSocket(wsUrl);
            } catch (err) {
                return reject(new Error(lastServerError 
                    ? `Edge TTS Error: ${lastServerError}` 
                    : `Edge TTS Connection failed: ${err.message}`));
            }

            ws.binaryType = "arraybuffer";
            const audioChunks = [];

            const timeoutId = setTimeout(() => {
                try { ws.close(); } catch (e) { }
                reject(new Error(lastServerError
                    ? `Edge TTS Timeout (Сервер: ${lastServerError})`
                    : "Microsoft Edge TTS WebSocket timeout (нет ответа от Microsoft)"));
            }, 12000);

            ws.onopen = () => {
                const dateStr = new Date().toString();

                // 1. Send speech config
                const speechConfig =
                    `X-Timestamp:${dateStr}\r\n` +
                    `Content-Type:application/json; charset=utf-8\r\n` +
                    `Path:speech.config\r\n\r\n` +
                    JSON.stringify({
                        context: {
                            synthesis: {
                                audio: {
                                    metadataoptions: {
                                        sentenceBoundaryEnabled: "false",
                                        wordBoundaryEnabled: "false"
                                    },
                                    outputFormat: "audio-24khz-48kbitrate-mono-mp3"
                                }
                            }
                        }
                    });
                ws.send(speechConfig);

                // 2. Send SSML request using valid prosody tag
                const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const langLocale = (voice && voice.includes('-')) ? voice.split('-').slice(0, 2).join('-') : 'en-US';
                const ssml =
                    `X-RequestId:${requestId}\r\n` +
                    `X-Timestamp:${dateStr}\r\n` +
                    `Content-Type:application/ssml+xml\r\n` +
                    `Path:ssml\r\n\r\n` +
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${langLocale}'>` +
                    `<voice name='${voice}'><prosody rate='${rate}' pitch='${pitch}'>${escapedText}</prosody></voice>` +
                    `</speak>`;
                ws.send(ssml);
            };

            ws.onmessage = (event) => {
                if (typeof event.data === "string") {
                    if (event.data.includes("Path:turn.end")) {
                        clearTimeout(timeoutId);
                        ws.close();
                        if (audioChunks.length === 0) {
                            reject(new Error("Empty audio received from Edge TTS"));
                        } else {
                            const blob = new Blob(audioChunks, { type: "audio/mp3" });
                            resolve(blob);
                        }
                    }
                } else if (event.data instanceof ArrayBuffer) {
                    const data = new DataView(event.data);
                    const headerLength = data.getUint16(0);
                    const audioData = event.data.slice(2 + headerLength);
                    if (audioData.byteLength > 0) {
                        audioChunks.push(audioData);
                    }
                }
            };

            ws.onerror = () => {
                clearTimeout(timeoutId);
                const detail = lastServerError 
                    ? `Сервер сообщил: "${lastServerError}". Попробуйте обновить: pip install -U edge-tts`
                    : "Прямое подключение к Microsoft заблокировано. Убедитесь, что запущен 'python server.py' на http://localhost:8080";
                reject(new Error(`Microsoft Edge TTS WebSocket network error (${detail})`));
            };
        });
    }

    static async generateSecMsGec() {
        try {
            const WIN_EPOCH = 11644473600n;
            const nowUnixSec = BigInt(Math.floor(Date.now() / 1000));
            let ticks = nowUnixSec + WIN_EPOCH;
            ticks -= (ticks % 300n);
            const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
            const strToHash = `${ticks}${TRUSTED_TOKEN}`;
            const enc = new TextEncoder();
            const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(strToHash));
            const hashArr = Array.from(new Uint8Array(hashBuf));
            return hashArr.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        } catch (e) {
            return null;
        }
    }

    static generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

export class TTSManager {
    /**
     * Synthesize audio for all translated phrases strictly using Edge TTS.
     * @param {Array<Object>} phrases 
     * @param {string} voice 
     * @param {function(string):void} progressCb 
     * @param {string} uiLang
     * @returns {Promise<Array<Object>>}
     */
    static async synthesizePhrases(phrases, voice = "ru-RU-DmitryNeural", progressCb = console.log, uiLang = 'en') {
        const validPhrases = phrases.filter(p => p.targetText && p.targetText.trim().length > 0);
        const total = validPhrases.length;
        const isRu = uiLang === 'ru';

        progressCb(isRu 
            ? `🎙️ Озвучивание ${total} фраз через Microsoft Edge TTS (${voice})...`
            : `🎙️ Voicing ${total} phrases via Microsoft Edge TTS (${voice})...`);

        let count = 0;
        for (let i = 0; i < validPhrases.length; i++) {
            const phrase = validPhrases[i];
            const text = phrase.targetText.trim();
            const voiceToUse = phrase.voice || voice;
            const rateToUse = phrase.rate || '+0%';
            const pitchToUse = phrase.pitch || '+0Hz';

            progressCb(`🎙️ [${i + 1}/${total}] Edge TTS: "${text.substring(0, 40)}..." (${voiceToUse}, ${rateToUse}, ${pitchToUse})`);

            try {
                const mp3Blob = await EdgeTTS.synthesize(text, voiceToUse, rateToUse, pitchToUse);
                const audioUrl = URL.createObjectURL(mp3Blob);

                const durationSec = await this.getAudioDuration(audioUrl);

                phrase.audioBlob = mp3Blob;
                phrase.audioUrl = audioUrl;
                phrase.audioDuration = durationSec;

                count++;
            } catch (err) {
                progressCb(isRu 
                    ? `❌ Ошибка Edge TTS для фразы #${phrase.id}: ${err.message}`
                    : `❌ Edge TTS error for phrase #${phrase.id}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 800));
        }

        if (count === 0) {
            throw new Error(isRu 
                ? "Не удалось озвучить ни одну фразу через Edge TTS. Убедитесь, что доступен интернет или запущен локальный сервер."
                : "Failed to synthesize phrases via Edge TTS. Please check your internet connection or local server.");
        }

        progressCb(isRu 
            ? `✅ Успешно озвучено фраз через Edge TTS: ${count}/${total}`
            : `✅ Successfully voiced phrases via Edge TTS: ${count}/${total}`);
        return phrases;
    }

    static getAudioDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration || 1.0);
            };
            audio.onerror = () => resolve(1.0);
            audio.src = url;
        });
    }
}
