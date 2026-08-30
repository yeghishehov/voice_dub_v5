// js/app.js - Main Application Orchestrator

import { CONFIG } from './config.js';
import { AudioExtractor } from './audioExtractor.js';
import { Transcriber } from './transcription.js';
import { Translator } from './translation.js';
import { TTSManager, EdgeTTS } from './tts.js';
import { VideoAssembler } from './videoAssembler.js';
import { I18N } from './i18n.js';

class VoiceDubApp {
    constructor() {
        this.state = {
            videoFile: null,
            audioBuffer: null,
            phrases: [],
            apiKey: localStorage.getItem('gemini_api_key') || CONFIG.DEFAULT_API_KEY,
            uiLang: localStorage.getItem('ui_lang') || 'en',
            currentStep: 1,
            mixedAudioBlob: null,
            mixedAudioUrl: null,
            timedPhrases: [],
            isPlayingDub: false,
            dubAudioElement: null,
            animationFrameId: null
        };

        this.initUI();
        this.updateUiLanguage();
    }

    initUI() {
        // API Key input
        const apiKeyInput = document.getElementById('apiKeyInput');

        if (apiKeyInput) {
            apiKeyInput.value = this.state.apiKey;
            apiKeyInput.addEventListener('input', (e) => {
                this.state.apiKey = e.target.value.trim();
                localStorage.setItem('gemini_api_key', this.state.apiKey);
            });
        }

        // Language switcher button
        const langToggleBtn = document.getElementById('langToggleBtn');
        if (langToggleBtn) {
            langToggleBtn.addEventListener('click', () => {
                const nextLang = this.state.uiLang === 'en' ? 'ru' : 'en';
                this.setLanguage(nextLang);
            });
        }

        // Stepper Navigation
        for (let i = 1; i <= 5; i++) {
            const stepNav = document.getElementById(`stepNav${i}`);
            if (stepNav) {
                stepNav.addEventListener('click', () => {
                    if (this.canNavigateToStep(i)) {
                        this.goToStep(i);
                    }
                });
            }
        }

        // Stage 1: Native Video & Text File Input
        const videoInput = document.getElementById('videoFileInput');
        if (videoInput) {
            videoInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleVideoFile(e.target.files[0]);
                }
            });
        }

        const origTextInput = document.getElementById('origTextFileInput');
        if (origTextInput) {
            origTextInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleTextImport(e.target.files[0], 'sourceText');
                }
            });
        }

        const transTextInput = document.getElementById('transTextFileInput');
        if (transTextInput) {
            transTextInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleTextImport(e.target.files[0], 'targetText');
                }
            });
        }

        document.getElementById('btnGoToStep2')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('btnBackToStep1')?.addEventListener('click', () => this.goToStep(1));
        document.getElementById('btnGoToStep3')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('btnBackToStep2')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('btnGoToStep4')?.addEventListener('click', () => this.goToStep(4));
        document.getElementById('btnBackToStep3')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('btnGoToStep5')?.addEventListener('click', () => this.goToStep(5));
        document.getElementById('btnBackToStep4')?.addEventListener('click', () => this.goToStep(4));

        // Stage 2: Transcription
        document.getElementById('btnStartTranscription')?.addEventListener('click', () => this.runTranscription());

        // Stage 3 & 4 Language & Voice Selection
        const targetLangSelect = document.getElementById('targetLangSelect');
        if (targetLangSelect) {
            targetLangSelect.addEventListener('change', () => this.updateVoiceOptions('step3'));
        }

        const targetLangSelectStep4 = document.getElementById('targetLangSelectStep4');
        if (targetLangSelectStep4) {
            targetLangSelectStep4.addEventListener('change', () => this.updateVoiceOptions('step4'));
        }

        this.updateVoiceOptions();
        document.getElementById('btnStartTranslation')?.addEventListener('click', () => this.runTranslation());

        // Stage 4: TTS
        document.getElementById('btnStartTTS')?.addEventListener('click', () => this.runTTS());

        // Stage 5: Export Hub
        document.getElementById('btnAssembleDubbedTrack')?.addEventListener('click', () => this.runAssembly());
        document.getElementById('btnDownloadAudio')?.addEventListener('click', () => this.downloadDubbedAudio());

        document.getElementById('btnExportOrigJson')?.addEventListener('click', () => this.exportText('sourceText', 'json'));
        document.getElementById('btnExportOrigTxt')?.addEventListener('click', () => this.exportText('sourceText', 'txt'));
        document.getElementById('btnExportTransJson')?.addEventListener('click', () => this.exportText('targetText', 'json'));
        document.getElementById('btnExportTransTxt')?.addEventListener('click', () => this.exportText('targetText', 'txt'));
        document.getElementById('btnExportIndividualAudio')?.addEventListener('click', () => this.exportIndividualAudio());
    }

    canNavigateToStep(step) {
        if (step === 1) return true;
        if (step === 2 && (this.state.videoFile || this.state.phrases.length > 0)) return true;
        if (step === 3 && this.state.phrases.some(p => p.sourceText && p.sourceText.trim().length > 0)) return true;
        if (step === 4 && this.state.phrases.some(p => p.targetText && p.targetText.trim().length > 0)) return true;
        if (step === 5 && this.state.phrases.length > 0) return true;
        return false;
    }

    goToStep(step) {
        this.state.currentStep = step;
        for (let i = 1; i <= 5; i++) {
            const nav = document.getElementById(`stepNav${i}`);
            const panel = document.getElementById(`panel${i}`);

            if (nav) {
                nav.classList.toggle('active', i === step);
            }
            if (panel) {
                panel.classList.toggle('active', i === step);
            }
        }

        // Move phrases table container into current active panel for steps 2, 3, 4
        if (step >= 2 && step <= 4) {
            const currentPanel = document.getElementById(`panel${step}`);
            const tableBox = document.getElementById('phrasesTableBox');
            if (currentPanel && tableBox) {
                const navButtons = currentPanel.querySelector('div[style*="justify-content"]');
                if (navButtons) {
                    currentPanel.insertBefore(tableBox, navButtons);
                } else {
                    currentPanel.appendChild(tableBox);
                }
                if (this.state.phrases && this.state.phrases.length > 0) {
                    tableBox.style.display = 'block';
                }
                this.renderPhrasesTable();
            }
        }

        if (step === 5) {
            this.runAssembly();
        }
    }

    log(stepNum, message, type = 'info') {
        const logBox = document.getElementById(`logBox${stepNum}`);
        if (!logBox) return;

        logBox.style.display = 'flex';
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }

    async handleVideoFile(file) {
        if (!file) return;
        const dict = I18N[this.state.uiLang] || I18N.en;
        this.state.videoFile = file;
        this.log(1, `${dict.logFileLoaded} ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`, 'success');

        const videoPreview = document.getElementById('sourceVideoPreview');
        const videoSpecsBox = document.getElementById('videoSpecsBox');
        const btnNext = document.getElementById('btnGoToStep2');
        const nav1 = document.getElementById('stepNav1');

        const selectedFileNameDisplay = document.getElementById('selectedFileNameDisplay');
        const btnSelectFile = document.getElementById('btnSelectFile');

        if (selectedFileNameDisplay) {
            selectedFileNameDisplay.textContent = `${dict.logSelectedFile} ${file.name}`;
            selectedFileNameDisplay.style.display = 'block';
        }
        if (btnSelectFile) {
            btnSelectFile.textContent = dict.selectAnotherFileBtn;
        }

        document.getElementById('specFileName').textContent = file.name;
        document.getElementById('specFileSize').textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        document.getElementById('specDuration').textContent = dict.statusLoading;
        document.getElementById('specResolution').textContent = dict.statusLoading;

        if (videoSpecsBox) {
            videoSpecsBox.style.display = 'grid';
        }
        if (btnNext) btnNext.disabled = false;
        if (nav1) nav1.classList.add('completed');

        if (videoPreview) {
            if (videoPreview.src && videoPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoPreview.src);
            }

            const updateMeta = () => {
                if (videoPreview.duration && !isNaN(videoPreview.duration)) {
                    const totalSecs = videoPreview.duration;
                    const mins = Math.floor(totalSecs / 60);
                    const secs = Math.floor(totalSecs % 60);
                    document.getElementById('specDuration').textContent =
                        mins > 0 ? `${mins} ${dict.minsLabel} ${secs} ${dict.secsLabel}` : `${totalSecs.toFixed(1)} ${dict.secsLabel}`;
                }
                if (videoPreview.videoWidth && videoPreview.videoHeight) {
                    document.getElementById('specResolution').textContent = `${videoPreview.videoWidth}x${videoPreview.videoHeight}`;
                }
            };

            videoPreview.onloadedmetadata = () => {
                updateMeta();
                try {
                    videoPreview.currentTime = 0.05;
                } catch (e) { }
            };

            videoPreview.onloadeddata = updateMeta;

            videoPreview.onerror = () => {
                document.getElementById('specDuration').textContent = dict.statusExtracting;
                document.getElementById('specResolution').textContent = dict.specAudioContainer;
            };

            const objectUrl = URL.createObjectURL(file);
            videoPreview.src = objectUrl;
            videoPreview.load();

            if (videoPreview.readyState >= 1) {
                updateMeta();
            }
        }
    }

    setLanguage(lang) {
        this.state.uiLang = lang;
        localStorage.setItem('ui_lang', lang);
        this.updateUiLanguage();
        this.renderPhrasesTable();
    }

    updateUiLanguage() {
        const dict = I18N[this.state.uiLang] || I18N.en;

        if (dict.docTitle) {
            document.title = dict.docTitle;
        }

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });

        const langToggleBtn = document.getElementById('langToggleBtn');
        if (langToggleBtn) {
            langToggleBtn.textContent = dict.langToggleBtn;
        }

        const btnSelectFile = document.getElementById('btnSelectFile');
        if (btnSelectFile) {
            btnSelectFile.textContent = this.state.videoFile ? dict.selectAnotherFileBtn : dict.selectVideoBtn;
        }

        const selectedFileNameDisplay = document.getElementById('selectedFileNameDisplay');
        if (selectedFileNameDisplay && this.state.videoFile) {
            selectedFileNameDisplay.textContent = `${dict.logSelectedFile} ${this.state.videoFile.name}`;
        }
    }

    checkApiKey() {
        const key = (this.state.apiKey || '').trim();
        if (!key) {
            const dict = I18N[this.state.uiLang] || I18N.en;
            alert(dict.enterApiKeyAlert);
            const input = document.getElementById('apiKeyInput');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }
        return true;
    }

    async runTranscription() {
        if (!this.state.videoFile) return;
        if (!this.checkApiKey()) return;

        const dict = I18N[this.state.uiLang] || I18N.en;
        const btn = document.getElementById('btnStartTranscription');
        btn.disabled = true;

        try {
            this.log(2, dict.logAudioDecoding, 'info');
            this.state.audioBuffer = await AudioExtractor.decodeAudioFromFile(this.state.videoFile);

            this.log(2, `${dict.logAudioExtracted} ${this.state.audioBuffer.duration.toFixed(1)}s, ${this.state.audioBuffer.sampleRate}Hz`, 'success');

            const chunks = await AudioExtractor.extractChunks(this.state.audioBuffer, 60, (msg) => this.log(2, msg, 'info'));

            const sourceLang = document.getElementById('sourceLangSelect').value;
            this.state.phrases = await Transcriber.transcribeChunks(chunks, sourceLang, this.state.apiKey, (msg) => this.log(2, msg, 'info'), this.state.uiLang);

            this.renderPhrasesTable();
            document.getElementById('btnGoToStep3').disabled = false;
            document.getElementById('stepNav2').classList.add('completed');
        } catch (err) {
            this.log(2, `${dict.logTranscriptionFailed} ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    updateVoiceOptions(changedFrom = 'step3') {
        const langSelect3 = document.getElementById('targetLangSelect');
        const langSelect4 = document.getElementById('targetLangSelectStep4');

        let targetLang = "Русский";
        if (changedFrom === 'step3' && langSelect3) {
            targetLang = langSelect3.value;
            if (langSelect4) langSelect4.value = targetLang;
        } else if (changedFrom === 'step4' && langSelect4) {
            targetLang = langSelect4.value;
            if (langSelect3) langSelect3.value = targetLang;
        } else if (langSelect3) {
            targetLang = langSelect3.value;
        }

        const voiceSelect = document.getElementById('voiceSelect');
        if (!voiceSelect) return;

        voiceSelect.innerHTML = '';
        const voices = CONFIG.VOICES[targetLang] || CONFIG.VOICES["Русский"];

        for (const [voiceLabel, voiceId] of Object.entries(voices)) {
            const opt = document.createElement('option');
            opt.value = voiceId;
            opt.textContent = voiceLabel;
            voiceSelect.appendChild(opt);
        }

        if (this.state.phrases && this.state.phrases.length > 0) {
            const defaultVoice = voiceSelect.value;
            this.state.phrases.forEach(p => {
                p.voice = defaultVoice;
            });
            this.renderPhrasesTable();
        }
    }

    async runTranslation() {
        if (!this.state.phrases || this.state.phrases.length === 0) return;
        if (!this.checkApiKey()) return;

        const dict = I18N[this.state.uiLang] || I18N.en;
        const btn = document.getElementById('btnStartTranslation');
        btn.disabled = true;

        try {
            const targetLang = document.getElementById('targetLangSelect').value;
            const sourceLang = document.getElementById('sourceLangSelect').value;

            this.state.phrases = await Translator.translatePhrases(
                this.state.phrases,
                targetLang,
                sourceLang,
                this.state.apiKey,
                (msg) => this.log(3, msg, 'info'),
                this.state.uiLang
            );

            this.renderPhrasesTable();
            document.getElementById('btnGoToStep4').disabled = false;
            document.getElementById('stepNav3').classList.add('completed');
        } catch (err) {
            this.log(3, `${dict.logTranslationFailed} ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async runTTS() {
        if (!this.state.phrases || this.state.phrases.length === 0) return;

        const dict = I18N[this.state.uiLang] || I18N.en;
        const btn = document.getElementById('btnStartTTS');
        btn.disabled = true;

        try {
            const voice = document.getElementById('voiceSelect').value;
            this.state.phrases = await TTSManager.synthesizePhrases(
                this.state.phrases,
                voice,
                (msg) => this.log(4, msg, 'info'),
                this.state.uiLang
            );

            this.renderPhrasesTable();

            this.log(4, dict.logAutoAssembly, 'info');
            await this.runAssembly();

            document.getElementById('btnGoToStep5').disabled = false;
            document.getElementById('stepNav4').classList.add('completed');
        } catch (err) {
            this.log(4, `${dict.logTtsFailed} ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    renderPhrasesTable() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const box = document.getElementById('phrasesTableBox');
        const tbody = document.getElementById('phrasesTableBody');
        if (!box || !tbody) return;

        box.style.display = 'block';
        tbody.innerHTML = '';

        const isStep4 = this.state.currentStep === 4;
        const thVoice = document.querySelector('.col-voice');
        if (thVoice) {
            thVoice.style.display = isStep4 ? '' : 'none';
        }

        const targetLang = document.getElementById('targetLangSelect')?.value || 'Русский';
        const voices = CONFIG.VOICES[targetLang] || CONFIG.VOICES["Русский"];
        const defaultVoice = document.getElementById('voiceSelect')?.value || Object.values(voices)[0];

        this.state.phrases.forEach((phrase, idx) => {
            if (!phrase.voice) {
                phrase.voice = defaultVoice;
            }

            const tr = document.createElement('tr');

            let voiceOptionsHtml = '';
            for (const [voiceLabel, voiceId] of Object.entries(voices)) {
                const selected = phrase.voice === voiceId ? 'selected' : '';
                voiceOptionsHtml += `<option value="${voiceId}" ${selected}>${voiceLabel}</option>`;
            }

            tr.innerHTML = `
                <td style="color: var(--text-dim);">${idx + 1}</td>
                <td class="cell-time">${phrase.start}</td>
                <td class="cell-time">${phrase.end}</td>
                <td class="cell-editable" contenteditable="true" data-field="sourceText" data-id="${phrase.id}">
                    ${phrase.sourceText || ''}
                </td>
                <td class="cell-editable" contenteditable="true" data-field="targetText" data-id="${phrase.id}">
                    ${phrase.targetText || ''}
                </td>
                <td class="col-voice" style="${isStep4 ? '' : 'display: none;'}">
                    <select class="form-select select-phrase-voice" data-id="${phrase.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: 100%;">
                        ${voiceOptionsHtml}
                    </select>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    ${phrase.audioUrl ? `<button class="btn-play-mini btn-play-audio" data-url="${phrase.audioUrl}" title="${dict.playTooltip}">▶️</button>` : ''}
                    ${isStep4 ? `<button class="btn-play-mini btn-re-tts" data-id="${phrase.id}" title="${dict.reTtsTooltip}">🔄</button>` : ''}
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Add inline edit listeners
        tbody.querySelectorAll('.cell-editable').forEach(cell => {
            cell.addEventListener('input', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const field = e.target.getAttribute('data-field');
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    phrase[field] = e.target.innerText.trim();
                }
            });
        });

        // Add per-phrase voice change listeners
        tbody.querySelectorAll('.select-phrase-voice').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    phrase.voice = e.target.value;
                }
            });
        });

        // Add audio preview listeners
        tbody.querySelectorAll('.btn-play-audio').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                if (url) {
                    const a = new Audio(url);
                    a.play();
                }
            });
        });

        // Add single-phrase TTS resynthesis listeners
        tbody.querySelectorAll('.btn-re-tts').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    await this.synthesizeSinglePhrase(phrase);
                }
            });
        });
    }

    async synthesizeSinglePhrase(phrase) {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const text = (phrase.targetText || phrase.sourceText || '').trim();
        if (!text) {
            alert(dict.emptyPhraseAlert);
            return;
        }

        const voice = phrase.voice || document.getElementById('voiceSelect')?.value || "ru-RU-DmitryNeural";
        this.log(4, `${dict.logSynthesizingPhrase}${phrase.id + 1}: "${text.substring(0, 30)}..." (${voice})`, 'info');

        try {
            const mp3Blob = await EdgeTTS.synthesize(text, voice);
            const audioUrl = URL.createObjectURL(mp3Blob);
            const durationSec = await TTSManager.getAudioDuration(audioUrl);

            phrase.audioBlob = mp3Blob;
            phrase.audioUrl = audioUrl;
            phrase.audioDuration = durationSec;

            this.renderPhrasesTable();
            this.log(4, `${dict.logPhraseSuccess}${phrase.id + 1} ${dict.logPhraseSuccessSuffix}`, 'success');

            // Auto-update final audio mix
            await this.runAssembly();
        } catch (err) {
            this.log(4, `${dict.logPhraseError}${phrase.id + 1}: ${err.message}`, 'error');
        }
    }

    async runAssembly() {
        if (!this.state.phrases || this.state.phrases.length === 0) return;
        const dict = I18N[this.state.uiLang] || I18N.en;

        try {
            const mixMode = "Заменить оригинал"; // Pure dubbing audio track for CapCut

            const { timedPhrases, shiftedCount, totalDuration } = VideoAssembler.calculateTimings(this.state.phrases);
            this.state.timedPhrases = timedPhrases;

            this.log(5, `${dict.logTimingsCalculated} ${timedPhrases.length} ${dict.logShiftedOverlaps} ${shiftedCount}`, 'info');

            const videoPreview = document.getElementById('sourceVideoPreview');
            const videoDuration = (videoPreview && !isNaN(videoPreview.duration)) ? videoPreview.duration : totalDuration;

            this.state.mixedAudioBlob = await VideoAssembler.mixAudioTracks(
                timedPhrases,
                null,
                videoDuration,
                mixMode,
                (msg) => this.log(5, msg, 'info'),
                this.state.uiLang
            );

            this.state.mixedAudioUrl = URL.createObjectURL(this.state.mixedAudioBlob);

            const btnDownloadAudio = document.getElementById('btnDownloadAudio');
            if (btnDownloadAudio) {
                btnDownloadAudio.style.display = 'inline-flex';
            }
            document.getElementById('stepNav5').classList.add('completed');
            this.log(5, dict.logAssemblyCompleted, 'success');
        } catch (err) {
            this.log(5, `${dict.logAssemblyFailed} ${err.message}`, 'error');
        }
    }

    async handleTextImport(file, targetField = 'auto') {
        if (!file) return;
        const dict = I18N[this.state.uiLang] || I18N.en;

        try {
            const textContent = await file.text();
            let importedPhrases = [];

            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(textContent);
                if (Array.isArray(parsed)) {
                    importedPhrases = parsed.map((item, idx) => {
                        const src = item.sourceText || item.text || (targetField === 'sourceText' ? item.content || '' : '');
                        const tgt = item.targetText || item.translation || (targetField === 'targetText' ? item.content || '' : '');

                        return {
                            id: idx,
                            start: item.start || '00:00',
                            end: item.end || '00:05',
                            startSec: Transcriber.toSeconds(item.start || '00:00'),
                            endSec: Transcriber.toSeconds(item.end || '00:05'),
                            sourceText: targetField === 'targetText' ? (src || '') : (src || item.content || ''),
                            targetText: targetField === 'sourceText' ? (tgt || '') : (tgt || (targetField === 'targetText' ? item.content || '' : ''))
                        };
                    });
                }
            } else {
                const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
                importedPhrases = lines.map((line, idx) => {
                    const parts = line.split('|').map(p => p.trim());
                    if (parts.length >= 2) {
                        const times = parts[0].split('-').map(t => t.trim());
                        return {
                            id: idx,
                            start: times[0] || '00:00',
                            end: times[1] || '00:05',
                            startSec: Transcriber.toSeconds(times[0] || '00:00'),
                            endSec: Transcriber.toSeconds(times[1] || '00:05'),
                            sourceText: targetField === 'targetText' ? (parts[2] ? parts[1] : '') : parts[1],
                            targetText: targetField === 'targetText' ? (parts[2] || parts[1]) : (parts[2] || '')
                        };
                    } else {
                        return {
                            id: idx,
                            start: Transcriber.toTimestamp(idx * 5),
                            end: Transcriber.toTimestamp((idx + 1) * 5),
                            startSec: idx * 5,
                            endSec: (idx + 1) * 5,
                            sourceText: targetField === 'targetText' ? '' : line,
                            targetText: targetField === 'targetText' ? line : ''
                        };
                    }
                });
            }

            if (importedPhrases.length > 0) {
                // If phrases already exist, merge field
                if (this.state.phrases && this.state.phrases.length > 0 && targetField !== 'auto') {
                    importedPhrases.forEach((p, idx) => {
                        if (this.state.phrases[idx]) {
                            if (targetField === 'sourceText') this.state.phrases[idx].sourceText = p.sourceText;
                            if (targetField === 'targetText') this.state.phrases[idx].targetText = p.targetText;
                        } else {
                            this.state.phrases.push(p);
                        }
                    });
                } else {
                    this.state.phrases = importedPhrases;
                }

                this.renderPhrasesTable();

                const label = targetField === 'targetText' ? dict.importedTransTextLabel : dict.importedOrigTextLabel;
                const selectedFileNameDisplay = document.getElementById('selectedFileNameDisplay');
                if (selectedFileNameDisplay) {
                    selectedFileNameDisplay.textContent = `${dict.importedTextLabel} ${label}: ${file.name} (${importedPhrases.length})`;
                    selectedFileNameDisplay.style.display = 'block';
                }

                this.log(1, `${dict.logImportSuccess} ${label} (${importedPhrases.length}) - ${file.name}`, 'success');

                document.getElementById('stepNav2')?.classList.add('completed');
                document.getElementById('btnGoToStep2').disabled = false;

                if (targetField === 'sourceText' || this.state.phrases.some(p => p.sourceText)) {
                    document.getElementById('btnGoToStep3').disabled = false;
                }
                if (targetField === 'targetText' || this.state.phrases.some(p => p.targetText)) {
                    document.getElementById('stepNav3')?.classList.add('completed');
                    document.getElementById('btnGoToStep4').disabled = false;
                    document.getElementById('btnGoToStep5').disabled = false;
                    this.log(1, dict.translationLoadedInfo, 'info');
                }
            }
        } catch (err) {
            this.log(1, `${dict.logImportError} ${err.message}`, 'error');
        }
    }

    downloadDubbedAudio() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const hasVoicedPhrases = this.state.phrases && this.state.phrases.some(p => p.audioBlob);
        if (!this.state.mixedAudioBlob || !hasVoicedPhrases) {
            alert(dict.missingAudioBlobAlert);
            return;
        }

        const a = document.createElement('a');
        a.href = this.state.mixedAudioUrl;
        const targetLang = document.getElementById('targetLangSelect')?.value || 'dubbed';
        a.download = `dubbed_audio_${targetLang}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    exportText(field, format) {
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.phrases || this.state.phrases.length === 0) {
            alert(dict.noPhrasesAlert);
            return;
        }

        const available = this.state.phrases.filter(p => p[field] && p[field].trim().length > 0);
        if (available.length === 0) {
            if (field === 'sourceText') {
                alert(dict.missingOrigTextAlert);
            } else {
                alert(dict.missingTransTextAlert);
            }
            return;
        }

        let content = '';
        let mime = 'text/plain';
        const ext = format === 'json' ? 'json' : 'txt';

        if (format === 'json') {
            const data = available.map(p => ({
                id: p.id,
                start: p.start,
                end: p.end,
                [field]: p[field] || ''
            }));
            content = JSON.stringify(data, null, 2);
            mime = 'application/json';
        } else {
            content = available
                .map(p => `${p.start} - ${p.end} | ${p[field] || ''}`)
                .join('\n');
        }

        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dubbing_${field}_export.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async exportIndividualAudio() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const voicedPhrases = this.state.phrases.filter(p => p.audioBlob);
        if (voicedPhrases.length === 0) {
            alert(dict.missingIndividualAudioAlert);
            return;
        }

        this.log(5, `${dict.logDownloadIndividual} ${voicedPhrases.length} ${dict.logDownloadIndividualSuffix}`, 'info');
        voicedPhrases.forEach((phrase, idx) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = phrase.audioUrl;
                a.download = `phrase_${idx + 1}_${phrase.start.replace(':', '-')}.mp3`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }, idx * 300);
        });
    }
}

// Initialize application reliably for ES modules
function initApp() {
    if (!window.app) {
        window.app = new VoiceDubApp();
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
