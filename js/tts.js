// js/tts.js - Client-Side Microsoft Edge TTS (Strict Edge TTS Engine Only)

export class EdgeTTS {
    /**
     * Synthesize text to MP3 Blob using Microsoft Edge TTS.
     * @param {string} text 
     * @param {string} voice 
     * @param {string} rate e.g. "+0%", "+10%", "-10%"
     * @returns {Promise<Blob>}
     */
    static async synthesize(text, voice = "ru-RU-DmitryNeural", rate = "+0%") {
        // Priority 1: Call /api/tts endpoint (works with local server.py and Vercel/Netlify Serverless)
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate })
            });

            if (res.ok) {
                const blob = await res.blob();
                if (blob && blob.size > 0) return blob;
            }
        } catch (err) {
            console.warn("Local /api/tts unavailable, trying public Edge TTS gateway...", err);
        }

        // Priority 2: Call public Edge TTS CORS gateway
        try {
            const gatewayUrl = `https://edge-tts-cors-api.vercel.app/api/tts`;
            const res = await fetch(gatewayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, rate })
            });

            if (res.ok) {
                const blob = await res.blob();
                if (blob && blob.size > 0) return blob;
            }
        } catch (err) {
            console.warn("Public Edge TTS gateway failed...", err);
        }

        // Priority 3: Direct browser WebSocket to Microsoft Edge TTS
        return new Promise((resolve, reject) => {
            const TRUSTED_TOKEN = "6A5AA1D4EA5942B4195C714257E2E89A";
            const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}`;

            let ws;
            try {
                ws = new WebSocket(wsUrl);
            } catch (err) {
                return reject(new Error(`Edge TTS Connection failed: ${err.message}`));
            }

            ws.binaryType = "arraybuffer";
            const audioChunks = [];
            const requestId = this.generateGuid();

            const timeoutId = setTimeout(() => {
                try { ws.close(); } catch (e) {}
                reject(new Error("Microsoft Edge TTS WebSocket timeout"));
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

                // 2. Send SSML request
                const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const langLocale = (voice && voice.includes('-')) ? voice.split('-').slice(0, 2).join('-') : 'en-US';
                const ssml = 
                    `X-RequestId:${requestId}\r\n` +
                    `X-Timestamp:${dateStr}\r\n` +
                    `Content-Type:application/ssml+xml\r\n` +
                    `Path:ssml\r\n\r\n` +
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${langLocale}'>` +
                    `<voice name='${voice}'><rate value='${rate}'>${escapedText}</rate></voice>` +
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

            ws.onerror = (err) => {
                clearTimeout(timeoutId);
                reject(new Error("Microsoft Edge TTS WebSocket network error"));
            };
        });
    }

    static generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
     * @returns {Promise<Array<Object>>}
     */
    static async synthesizePhrases(phrases, voice = "ru-RU-DmitryNeural", progressCb = console.log) {
        const validPhrases = phrases.filter(p => p.targetText && p.targetText.trim().length > 0);
        const total = validPhrases.length;

        progressCb(`🎙️ Озвучивание ${total} фраз СТРОГО через Microsoft Edge TTS (${voice})...`);

        let count = 0;
        for (let i = 0; i < validPhrases.length; i++) {
            const phrase = validPhrases[i];
            const text = phrase.targetText.trim();
            const voiceToUse = phrase.voice || voice;

            progressCb(`🎙️ [${i + 1}/${total}] Edge TTS: "${text.substring(0, 40)}..." (${voiceToUse})`);

            try {
                const mp3Blob = await EdgeTTS.synthesize(text, voiceToUse);
                const audioUrl = URL.createObjectURL(mp3Blob);
                
                const durationSec = await this.getAudioDuration(audioUrl);

                phrase.audioBlob = mp3Blob;
                phrase.audioUrl = audioUrl;
                phrase.audioDuration = durationSec;

                count++;
            } catch (err) {
                progressCb(`❌ Ошибка Edge TTS для фразы #${phrase.id}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 200));
        }

        if (count === 0) {
            throw new Error("Не удалось озвучить ни одну фразу через Edge TTS. Убедитесь, что запущен server.py или доступен интернет.");
        }

        progressCb(`✅ Успешно озвучено фраз через Edge TTS: ${count}/${total}`);
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
