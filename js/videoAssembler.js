// js/videoAssembler.js - Web Audio Mixing & Video Subtitle Compositor

export class VideoAssembler {
    /**
     * Calculates anti-collision start times for audio phrases.
     * @param {Array<Object>} phrases 
     * @returns {Array<Object>}
     */
    static calculateTimings(phrases) {
        let lastEnd = 0.0;
        let shiftedCount = 0;

        const timedPhrases = phrases.map((phrase) => {
            const targetStart = phrase.startSec || 0;
            const startAt = Math.max(targetStart, lastEnd);
            if (startAt > targetStart) {
                shiftedCount++;
            }
            const duration = phrase.audioDuration || 2.0;
            lastEnd = startAt + duration;

            return {
                ...phrase,
                actualStartSec: startAt,
                actualEndSec: lastEnd,
                duration: duration
            };
        });

        return { timedPhrases, shiftedCount, totalDuration: lastEnd };
    }

    /**
     * Mixes synthesized TTS audio tracks with background video audio using Web Audio API OfflineAudioContext.
     * @param {Array<Object>} timedPhrases 
     * @param {AudioBuffer|null} origAudioBuffer 
     * @param {number} totalVideoDuration 
     * @param {string} mixMode "Заменить оригинал" | "Микшировать с оригиналом"
     * @param {function(string):void} progressCb 
     * @param {string} uiLang
     * @returns {Promise<Blob>}
     */
    static async mixAudioTracks(timedPhrases, origAudioBuffer, totalVideoDuration, mixMode = "Заменить оригинал", progressCb = console.log, uiLang = 'en') {
        const isRu = uiLang === 'ru';
        progressCb(isRu ? "🔧 Сборка и микширование звуковых дорожек..." : "🔧 Assembling and mixing audio tracks...");

        const sampleRate = 44100;
        const totalDuration = Math.max(
            totalVideoDuration,
            timedPhrases.length > 0 ? timedPhrases[timedPhrases.length - 1].actualEndSec : 0
        );

        const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

        // 1. Add background original audio if requested
        if (mixMode !== "Заменить оригинал" && origAudioBuffer) {
            const bgSource = offlineCtx.createBufferSource();
            bgSource.buffer = origAudioBuffer;

            const gainNode = offlineCtx.createGain();
            gainNode.gain.value = 0.15; // 15% background volume ducking

            bgSource.connect(gainNode);
            gainNode.connect(offlineCtx.destination);
            bgSource.start(0);
        }

        // 2. Add each phrase audio buffer
        let loadedCount = 0;
        for (const phrase of timedPhrases) {
            if (!phrase.audioBlob) continue;

            try {
                const arrayBuffer = await phrase.audioBlob.arrayBuffer();
                const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
                const phraseBuffer = await tempCtx.decodeAudioData(arrayBuffer);
                tempCtx.close();

                const phraseSource = offlineCtx.createBufferSource();
                phraseSource.buffer = phraseBuffer;

                const gainNode = offlineCtx.createGain();
                gainNode.gain.value = 1.0;

                phraseSource.connect(gainNode);
                gainNode.connect(offlineCtx.destination);
                phraseSource.start(phrase.actualStartSec);

                loadedCount++;
            } catch (err) {
                console.warn(`Could not decode audio phrase #${phrase.id}:`, err);
            }
        }

        progressCb(isRu 
            ? `🎛️ Загружено ${loadedCount} звуковых фрагментов для микширования...`
            : `🎛️ Loaded ${loadedCount} audio clips for mixing...`);

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = this.audioBufferToWav(renderedBuffer);

        progressCb(isRu ? "✅ Микширование звука завершено!" : "✅ Audio mixing completed!");
        return wavBlob;
    }

    /**
     * Converts AudioBuffer to WAV Blob
     */
    static audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        
        let result;
        if (numChannels === 2) {
            result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        const dataLength = result.length * 2;
        const bufferLength = 44 + dataLength;
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        this.floatTo16BitPCM(view, 44, result);

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    static floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    static interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);

        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    static writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}
