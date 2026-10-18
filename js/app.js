// js/app.js - Main Application Orchestrator

import { CONFIG } from './config.js';
import { AudioExtractor } from './audioExtractor.js';
import { Transcriber } from './transcription.js';
import { Translator } from './translation.js';
import { TTSManager, EdgeTTS } from './tts.js';
import { VideoAssembler } from './videoAssembler.js';
import { ZipBuilder } from './zipBuilder.js';
import { I18N } from './i18n.js';

class VoiceDubApp {
    constructor() {
        this.state = {
            videoFile: null,
            audioBuffer: null,
            phrases: [],
            apiKey: localStorage.getItem('gemini_api_key') || CONFIG.DEFAULT_API_KEY,
            uiLang: localStorage.getItem('ui_lang') || 'ru',
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
        this.renderPhrasesTable();
        this.updateButtonStates();
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

        // Custom Language Dropdown
        const langDropdown = document.getElementById('langDropdown');
        const langTrigger = document.getElementById('langDropdownTrigger');
        const langMenu = document.getElementById('langDropdownMenu');

        if (langDropdown && langTrigger && langMenu) {
            langTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = langDropdown.classList.toggle('open');
                langTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });

            langMenu.querySelectorAll('.lang-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedLang = item.getAttribute('data-lang');
                    if (selectedLang) {
                        this.setLanguage(selectedLang);
                    }
                    langDropdown.classList.remove('open');
                    langTrigger.setAttribute('aria-expanded', 'false');
                });
            });

            document.addEventListener('click', (e) => {
                if (!langDropdown.contains(e.target)) {
                    langDropdown.classList.remove('open');
                    langTrigger.setAttribute('aria-expanded', 'false');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && langDropdown.classList.contains('open')) {
                    langDropdown.classList.remove('open');
                    langTrigger.setAttribute('aria-expanded', 'false');
                    langTrigger.focus();
                }
            });
        }

        // Import Modal Trigger & Controls
        document.getElementById('openImportModalBtn')?.addEventListener('click', () => this.openImportModal());
        document.getElementById('closeImportModalBtn')?.addEventListener('click', () => this.closeImportModal());
        document.getElementById('btnCancelImport')?.addEventListener('click', () => this.closeImportModal());
        document.getElementById('btnConfirmImport')?.addEventListener('click', () => {
            this.closeImportModal();
            this.goToStep(1);
        });
        document.getElementById('btnOpenImportFromBanner')?.addEventListener('click', () => this.openImportModal());

        const importModal = document.getElementById('importModal');
        if (importModal) {
            importModal.addEventListener('click', (e) => {
                if (e.target === importModal) {
                    this.closeImportModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && importModal?.classList.contains('open')) {
                this.closeImportModal();
            }
        });

        // Warning / Action Required Modal Controls
        document.getElementById('closeWarningModalBtn')?.addEventListener('click', () => this.closeWarningModal());
        document.getElementById('btnConfirmWarningModal')?.addEventListener('click', () => this.closeWarningModal());

        const warningModal = document.getElementById('warningModal');
        if (warningModal) {
            warningModal.addEventListener('click', (e) => {
                if (e.target === warningModal) {
                    this.closeWarningModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && warningModal?.classList.contains('open')) {
                this.closeWarningModal();
            }
        });

        // Stepper Navigation (2 Stages)
        for (let i = 1; i <= 2; i++) {
            const stepNav = document.getElementById(`stepNav${i}`);
            if (stepNav) {
                stepNav.addEventListener('click', () => {
                    if (this.canNavigateToStep(i)) {
                        this.goToStep(i);
                    }
                });
            }
        }

        // Native Video & Text File Inputs inside Import Modal
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

        // Stage Transitions (2 Stages)
        document.getElementById('btnGoToStep2')?.addEventListener('click', () => {
            const hasPhrases = this.state.phrases && this.state.phrases.length > 0;
            const hasText = hasPhrases && this.state.phrases.some(p => (p.targetText && p.targetText.trim().length > 0) || (p.sourceText && p.sourceText.trim().length > 0));
            if (!hasText && !this.state.videoFile) {
                const dict = I18N[this.state.uiLang] || I18N.en;
                this.showWarning(dict.noPhrasesForTtsWarning, () => this.openImportModal(), dict.openImportBtn || '📥 Импорт');
                return;
            }
            this.goToStep(2);
        });
        document.getElementById('btnBackToStep1')?.addEventListener('click', () => this.goToStep(1));

        // Stage 1: Transcription
        document.getElementById('btnStartTranscription')?.addEventListener('click', () => this.runTranscription());

        // Stage 1 & 2 Language & Voice Selection
        const targetLangSelect = document.getElementById('targetLangSelect');
        if (targetLangSelect) {
            targetLangSelect.addEventListener('change', () => this.updateVoiceOptions('step3'));
        }

        const targetLangSelectStep4 = document.getElementById('targetLangSelectStep4');
        if (targetLangSelectStep4) {
            targetLangSelectStep4.addEventListener('change', () => this.updateVoiceOptions('step4'));
        }

        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', () => {
                const newVoice = voiceSelect.value;
                if (this.state.phrases && this.state.phrases.length > 0) {
                    this.state.phrases.forEach(p => {
                        p.voice = newVoice;
                    });
                    this.renderPhrasesTable();
                }
            });
        }

        this.updateVoiceOptions();
        document.getElementById('btnStartTranslation')?.addEventListener('click', () => this.runTranslation());

        // Stage 2: TTS
        document.getElementById('btnStartTTS')?.addEventListener('click', () => this.runTTS());
        document.getElementById('btnAutoRate')?.addEventListener('click', () => this.autoCalculateAllRates());

        // Table Export Actions (Header Icons & Footer Buttons)
        const triggerOrigTxt = () => this.exportText('sourceText', 'txt');
        const triggerTransTxt = () => this.exportText('targetText', 'txt');
        const triggerAudioZip = () => this.exportIndividualAudio();

        document.getElementById('btnExportOrigHeader')?.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerOrigTxt();
        });
        document.getElementById('btnExportTransHeader')?.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerTransTxt();
        });
        document.getElementById('btnExportZipHeader')?.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerAudioZip();
        });

        document.getElementById('btnExportOrigFooter')?.addEventListener('click', triggerOrigTxt);
        document.getElementById('btnExportTransFooter')?.addEventListener('click', triggerTransTxt);
        document.getElementById('btnExportZipFooter')?.addEventListener('click', triggerAudioZip);

        // Fallbacks for any other export triggers
        document.getElementById('btnExportOrigTxt')?.addEventListener('click', triggerOrigTxt);
        document.getElementById('btnExportTransTxt')?.addEventListener('click', triggerTransTxt);
        document.getElementById('btnExportIndividualAudio')?.addEventListener('click', triggerAudioZip);

        // Phrases Table Toolbar & Actions
        document.getElementById('btnAddRowBtn')?.addEventListener('click', () => this.addPhrase());
        document.getElementById('btnBottomAddRow')?.addEventListener('click', () => this.addPhrase());
    }

    openImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    showWarning(message, actionCallback = null, actionBtnText = null, title = null) {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const modal = document.getElementById('warningModal');
        const titleEl = document.getElementById('warningModalTitle');
        const msgEl = document.getElementById('warningModalMessage');
        const actionBox = document.getElementById('warningModalActionBox');
        const actionBtn = document.getElementById('warningModalActionBtn');

        if (!modal || !msgEl) {
            alert(message);
            return;
        }

        if (titleEl) {
            titleEl.textContent = title || dict.warningModalTitle || 'Требуется действие';
        }
        msgEl.textContent = message;

        if (actionCallback && actionBtnText && actionBtn && actionBox) {
            actionBtn.textContent = actionBtnText;
            actionBtn.onclick = () => {
                this.closeWarningModal();
                actionCallback();
            };
            actionBox.style.display = 'block';
        } else if (actionBox) {
            actionBox.style.display = 'none';
            if (actionBtn) actionBtn.onclick = null;
        }

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    closeWarningModal() {
        const modal = document.getElementById('warningModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    updateButtonStates() {
        const hasVideo = !!this.state.videoFile;
        const hasPhrases = this.state.phrases && this.state.phrases.length > 0;
        const hasSourceText = hasPhrases && this.state.phrases.some(p => p.sourceText && p.sourceText.trim().length > 0);
        const hasTargetText = hasPhrases && this.state.phrases.some(p => p.targetText && p.targetText.trim().length > 0);
        const hasVoicedPhrases = hasPhrases && this.state.phrases.some(p => !!p.audioBlob);

        // Transcription button (needs video)
        const btnTranscribe = document.getElementById('btnStartTranscription');
        if (btnTranscribe) {
            btnTranscribe.classList.toggle('btn-needs-data', !hasVideo);
        }

        // Translation button (needs source text)
        const btnTranslate = document.getElementById('btnStartTranslation');
        if (btnTranslate) {
            btnTranslate.classList.toggle('btn-needs-data', !hasSourceText);
        }

        // TTS button (needs translated text)
        const btnTTS = document.getElementById('btnStartTTS');
        if (btnTTS) {
            btnTTS.classList.toggle('btn-needs-data', !hasTargetText);
        }

        // AutoRate button (needs phrases)
        const btnAutoRate = document.getElementById('btnAutoRate');
        if (btnAutoRate) {
            btnAutoRate.classList.toggle('btn-needs-data', !hasPhrases);
        }

        // Export original text buttons (needs source text)
        const btnExportOrigHeader = document.getElementById('btnExportOrigHeader');
        const btnExportOrigFooter = document.getElementById('btnExportOrigFooter');
        if (btnExportOrigHeader) btnExportOrigHeader.classList.toggle('btn-needs-data', !hasSourceText);
        if (btnExportOrigFooter) btnExportOrigFooter.classList.toggle('btn-needs-data', !hasSourceText);

        // Export translated text buttons (needs target text)
        const btnExportTransHeader = document.getElementById('btnExportTransHeader');
        const btnExportTransFooter = document.getElementById('btnExportTransFooter');
        if (btnExportTransHeader) btnExportTransHeader.classList.toggle('btn-needs-data', !hasTargetText);
        if (btnExportTransFooter) btnExportTransFooter.classList.toggle('btn-needs-data', !hasTargetText);

        // Export individual audio zip buttons (needs synthesized audio clips)
        const btnExportZipHeader = document.getElementById('btnExportZipHeader');
        const btnExportZipFooter = document.getElementById('btnExportZipFooter');
        if (btnExportZipHeader) btnExportZipHeader.classList.toggle('btn-needs-data', !hasVoicedPhrases);
        if (btnExportZipFooter) btnExportZipFooter.classList.toggle('btn-needs-data', !hasVoicedPhrases);

        // Next step button (needs phrases or video)
        const btnGo2 = document.getElementById('btnGoToStep2');
        if (btnGo2) {
            btnGo2.disabled = false;
            btnGo2.classList.toggle('btn-needs-data', !hasTargetText && !hasSourceText && !hasVideo);
        }
    }

    canNavigateToStep(step) {
        return step === 1 || step === 2;
    }

    goToStep(step) {
        if (!this.canNavigateToStep(step)) return;
        this.state.currentStep = step;
        for (let i = 1; i <= 2; i++) {
            const nav = document.getElementById(`stepNav${i}`);
            const panel = document.getElementById(`panel${i}`);

            if (nav) {
                nav.classList.toggle('active', i === step);
            }
            if (panel) {
                panel.classList.toggle('active', i === step);
            }
        }

        // Move phrases table container into current active panel for steps 1 and 2
        if (step >= 1 && step <= 2) {
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

        if (step === 2) {
            this.updateVoiceOptions('step3');
        }
    }

    log(stepNum, message, type = 'info') {
        let logBox = document.getElementById(`logBox${stepNum}`);
        if (!logBox) {
            logBox = document.getElementById('logBox4') || document.getElementById('logBox2');
        }
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

        // Update Step 1 Status Banner
        const banner = document.getElementById('videoStatusBanner');
        const bannerIcon = document.getElementById('videoStatusIcon');
        const bannerTitle = document.getElementById('videoStatusTitle');
        const bannerSub = document.getElementById('videoStatusSub');
        const bannerBtn = document.getElementById('btnOpenImportFromBanner');
        const bannerBtnText = document.getElementById('bannerBtnText');
        const bannerBtnIcon = document.getElementById('bannerBtnIcon');

        if (banner) banner.classList.add('loaded');
        if (bannerIcon) bannerIcon.textContent = '✅';
        if (bannerTitle) bannerTitle.textContent = `${dict.videoLoadedTitle || 'Видео загружено:'} ${file.name}`;
        if (bannerSub) bannerSub.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • ${dict.videoReadySub || 'Готово к извлечению аудио и транскрибации'}`;
        if (bannerBtnText) {
            bannerBtnText.textContent = (dict.changeVideoBtn || 'Сменить видео / текст').replace(/^[^\w\sа-яА-ЯёЁ]+/, '').trim();
        } else if (bannerBtn) {
            bannerBtn.textContent = dict.changeVideoBtn || '🔄 Сменить видео / сценарий';
        }
        if (bannerBtnIcon) bannerBtnIcon.innerHTML = '🔄';

        if (videoPreview) {
            if (videoPreview.src && videoPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoPreview.src);
            }

            const updateMeta = () => {
                if (videoPreview.duration && !isNaN(videoPreview.duration)) {
                    const totalSecs = videoPreview.duration;
                    const mins = Math.floor(totalSecs / 60);
                    const secs = Math.floor(totalSecs % 60);
                    const formattedDuration = mins > 0 ? `${mins} ${dict.minsLabel} ${secs} ${dict.secsLabel}` : `${totalSecs.toFixed(1)} ${dict.secsLabel}`;
                    document.getElementById('specDuration').textContent = formattedDuration;
                    if (bannerSub) {
                        bannerSub.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • ${formattedDuration} • ${dict.videoReadySub || 'Готово к извлечению аудио и транскрибации'}`;
                    }
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
        this.updateButtonStates();
    }

    updateUiLanguage() {
        const dict = I18N[this.state.uiLang] || I18N.en;

        if (dict.docTitle) {
            document.title = dict.docTitle;
        }
        document.documentElement.lang = this.state.uiLang;

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

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key]) {
                el.title = dict[key];
            }
        });

        // Update Custom Language Dropdown UI
        const isRu = this.state.uiLang === 'ru';
        const langCurrentLabel = document.getElementById('langCurrentLabel');
        const langTrigger = document.getElementById('langDropdownTrigger');

        if (langCurrentLabel) {
            langCurrentLabel.textContent = isRu ? 'RU' : 'EN';
        }
        if (langTrigger) {
            langTrigger.title = isRu ? 'Текущий язык: Русский (нажмите для смены)' : 'Current language: English (click to change)';
        }

        document.querySelectorAll('.lang-dropdown-item').forEach(item => {
            const itemLang = item.getAttribute('data-lang');
            const isActive = itemLang === this.state.uiLang;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const btnSelectFile = document.getElementById('btnSelectFile');
        if (btnSelectFile) {
            btnSelectFile.textContent = this.state.videoFile ? dict.selectAnotherFileBtn : dict.selectVideoBtn;
        }

        const selectedFileNameDisplay = document.getElementById('selectedFileNameDisplay');
        if (selectedFileNameDisplay && this.state.videoFile) {
            selectedFileNameDisplay.textContent = `${dict.logSelectedFile} ${this.state.videoFile.name}`;
        }

        // Update Video Status Banner according to loaded state
        const banner = document.getElementById('videoStatusBanner');
        const bannerIcon = document.getElementById('videoStatusIcon');
        const bannerTitle = document.getElementById('videoStatusTitle');
        const bannerSub = document.getElementById('videoStatusSub');
        const bannerBtn = document.getElementById('btnOpenImportFromBanner');
        const bannerBtnText = document.getElementById('bannerBtnText');
        const bannerBtnIcon = document.getElementById('bannerBtnIcon');

        if (this.state.videoFile) {
            if (banner) banner.classList.add('loaded');
            if (bannerIcon) bannerIcon.textContent = '✅';
            if (bannerTitle) bannerTitle.textContent = `${dict.videoLoadedTitle || 'Видео загружено:'} ${this.state.videoFile.name}`;
            if (bannerSub) bannerSub.textContent = `${(this.state.videoFile.size / (1024 * 1024)).toFixed(1)} MB • ${dict.videoReadySub || 'Готово к извлечению аудио и транскрибации'}`;
            if (bannerBtnText) {
                bannerBtnText.textContent = (dict.changeVideoBtn || 'Сменить видео / текст').replace(/^[^\w\sа-яА-ЯёЁ]+/, '').trim();
            } else if (bannerBtn) {
                bannerBtn.textContent = dict.changeVideoBtn || '🔄 Сменить видео / сценарий';
            }
            if (bannerBtnIcon) bannerBtnIcon.innerHTML = '🔄';
        } else {
            if (banner) banner.classList.remove('loaded');
            if (bannerIcon) bannerIcon.textContent = '🎬';
            if (bannerTitle) bannerTitle.textContent = dict.noVideoTitle;
            if (bannerSub) bannerSub.textContent = dict.noVideoSub;
            if (bannerBtnText) {
                bannerBtnText.textContent = (dict.openImportBtn || 'Импорт').replace(/^[^\w\sа-яА-ЯёЁ]+/, '').trim();
            } else if (bannerBtn) {
                bannerBtn.textContent = dict.openImportBtn || '📥 Импорт';
            }
            if (bannerBtnIcon) {
                bannerBtnIcon.innerHTML = `<svg class="import-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
            }
        }
    }

    checkApiKey() {
        const key = (this.state.apiKey || '').trim();
        if (!key) {
            const dict = I18N[this.state.uiLang] || I18N.en;
            this.showWarning(
                dict.enterApiKeyAlert,
                () => {
                    const input = document.getElementById('apiKeyInput');
                    if (input) {
                        input.focus();
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                '🔑 API Key'
            );
            return false;
        }
        return true;
    }

    async runTranscription() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.videoFile) {
            this.showWarning(
                dict.noVideoForTranscriptionWarning,
                () => this.openImportModal(),
                dict.openImportBtn || '📥 Импорт'
            );
            return;
        }
        if (!this.checkApiKey()) return;

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
            this.updateButtonStates();
            document.getElementById('stepNav1')?.classList.add('completed');
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
        } else if (langSelect3) {
            targetLang = langSelect3.value;
            if (langSelect4) langSelect4.value = targetLang;
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
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.phrases || this.state.phrases.length === 0) {
            this.showWarning(
                dict.noPhrasesForTranslationWarning,
                () => this.openImportModal(),
                dict.openImportBtn || '📥 Импорт'
            );
            return;
        }

        const hasSourceText = this.state.phrases.some(p => p.sourceText && p.sourceText.trim().length > 0);
        if (!hasSourceText) {
            this.showWarning(
                dict.noSourceTextForTranslationWarning,
                () => this.openImportModal(),
                dict.openImportBtn || '📥 Импорт'
            );
            return;
        }

        if (!this.checkApiKey()) return;

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

            this.updateVoiceOptions('step3');
            this.renderPhrasesTable();
            this.updateButtonStates();
            document.getElementById('stepNav1')?.classList.add('completed');
        } catch (err) {
            this.log(3, `${dict.logTranslationFailed} ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async translateSinglePhrase(phraseId, btnElement = null) {
        if (!this.checkApiKey()) return;

        const dict = I18N[this.state.uiLang] || I18N.en;
        const phrase = this.state.phrases.find(p => p.id === phraseId);
        if (!phrase) return;

        const text = (phrase.sourceText || '').trim();
        if (!text) {
            this.showWarning(dict.emptyRowSourceAlert || dict.emptyPhraseAlert || 'Исходный текст этой фразы пуст!');
            return;
        }

        const targetLang = document.getElementById('targetLangSelect')?.value || 'Русский';
        const sourceLang = document.getElementById('sourceLangSelect')?.value || 'Армянский';

        if (btnElement) {
            btnElement.disabled = true;
            btnElement.classList.add('loading');
        }

        const phraseNum = this.state.phrases.indexOf(phrase) + 1;
        this.log(3, `${dict.translatingRow || '🌐 Перевод фразы #'} ${phraseNum}: "${text.substring(0, 35)}..."`, 'info');

        try {
            const translatedText = await Translator.translateSinglePhrase(
                phrase,
                this.state.phrases,
                targetLang,
                sourceLang,
                this.state.apiKey,
                (msg) => this.log(3, msg, 'info'),
                this.state.uiLang
            );

            phrase.targetText = translatedText;

            // Update target text cell directly in DOM to avoid losing user selection/scroll
            const targetCell = document.querySelector(`.cell-editable[data-field="targetText"][data-id="${phrase.id}"]`);
            if (targetCell) {
                targetCell.innerText = translatedText;
            }

            this.updateButtonStates();
            document.getElementById('stepNav1')?.classList.add('completed');

            this.log(3, `✅ ${dict.translatedRowSuccess || 'Фраза успешно переведена!'} (#${phraseNum})`, 'success');
        } catch (err) {
            this.log(3, `❌ ${dict.logTranslationFailed || 'Ошибка перевода:'} ${err.message}`, 'error');
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.classList.remove('loading');
            }
        }
    }

    async runTTS() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.phrases || this.state.phrases.length === 0) {
            this.showWarning(
                dict.noPhrasesForTtsWarning,
                () => this.goToStep(1),
                dict.backToScriptBtn || '⬅️ Назад к тексту'
            );
            return;
        }

        const hasTargetText = this.state.phrases.some(p => p.targetText && p.targetText.trim().length > 0);
        if (!hasTargetText) {
            this.showWarning(
                dict.noTargetTextForTtsWarning,
                () => this.goToStep(1),
                dict.startTranslationBtn || '🌐 Перевести фразы'
            );
            return;
        }

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
            this.updateButtonStates();
            document.getElementById('stepNav2')?.classList.add('completed');
        } catch (err) {
            this.log(4, `${dict.logTtsFailed} ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    calculateOptimalRate(phrase) {
        const text = (phrase.targetText || phrase.sourceText || '').trim();
        if (!text) return '+0%';

        const startSec = (phrase.startSec !== undefined && !isNaN(phrase.startSec)) 
            ? phrase.startSec 
            : Transcriber.toSeconds(phrase.start || '00:00');
        const endSec = (phrase.endSec !== undefined && !isNaN(phrase.endSec)) 
            ? phrase.endSec 
            : Transcriber.toSeconds(phrase.end || '00:00');
        const allocatedSec = Math.max(0.6, endSec - startSec);

        // Average normal speaking speed for Russian/English: ~13.5 characters per second
        const estimatedNormalDuration = Math.max(0.8, text.length / 13.5);

        // If audio was already synthesized once, use the exact measured audio duration!
        const neededSec = phrase.audioDuration ? phrase.audioDuration : estimatedNormalDuration;
        const ratio = neededSec / allocatedSec;

        if (ratio >= 1.45) return '+50%';
        if (ratio >= 1.35) return '+40%';
        if (ratio >= 1.25) return '+30%';
        if (ratio >= 1.18) return '+20%';
        if (ratio >= 1.10) return '+15%';
        if (ratio >= 1.05) return '+10%';
        if (ratio <= 0.70) return '-10%';
        return '+0%';
    }

    autoCalculateAllRates() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.phrases || this.state.phrases.length === 0) {
            this.showWarning(
                dict.noPhrasesForAutoRateWarning,
                () => this.goToStep(1),
                dict.backToScriptBtn || '⬅️ Назад к тексту'
            );
            return;
        }
        let adjustedCount = 0;
        this.state.phrases.forEach(phrase => {
            const optimal = this.calculateOptimalRate(phrase);
            if (optimal !== '+0%') adjustedCount++;
            phrase.rate = optimal;
        });
        this.renderPhrasesTable();
        this.log(4, `${dict.logAutoRateCalculated} ${adjustedCount}/${this.state.phrases.length}`, 'info');
    }

    addPhrase(insertIndex = null) {
        const targetLang = document.getElementById('targetLangSelect')?.value || 'Русский';
        const voices = CONFIG.VOICES[targetLang] || CONFIG.VOICES["Русский"];
        const defaultVoice = document.getElementById('voiceSelect')?.value || Object.values(voices)[0];

        let prevEnd = "00:00";
        let prevEndSec = 0;

        const count = this.state.phrases.length;
        const targetIdx = (insertIndex !== null && insertIndex >= 0 && insertIndex <= count) 
            ? insertIndex 
            : count;

        if (targetIdx > 0 && this.state.phrases[targetIdx - 1]) {
            const prev = this.state.phrases[targetIdx - 1];
            prevEnd = prev.end || "00:00";
            prevEndSec = (prev.endSec !== undefined && !isNaN(prev.endSec)) 
                ? prev.endSec 
                : Transcriber.toSeconds(prevEnd);
        }

        const newEndSec = prevEndSec + 4;
        const newEnd = Transcriber.toTimestamp(newEndSec);

        const newPhrase = {
            id: targetIdx,
            start: prevEnd,
            end: newEnd,
            startSec: prevEndSec,
            endSec: newEndSec,
            sourceText: "",
            targetText: "",
            voice: defaultVoice,
            rate: "+0%",
            pitch: "+0Hz",
            audioUrl: null,
            audioBlob: null
        };

        this.state.phrases.splice(targetIdx, 0, newPhrase);
        this.state.phrases.forEach((p, idx) => { p.id = idx; });
        this.renderPhrasesTable();

        // Focus the newly added row's sourceText cell
        setTimeout(() => {
            const newCell = document.querySelector(`.cell-editable[data-field="sourceText"][data-id="${targetIdx}"]`);
            if (newCell) {
                newCell.focus();
            }
        }, 50);
    }

    deletePhrase(index) {
        if (index < 0 || index >= this.state.phrases.length) return;
        const dict = I18N[this.state.uiLang] || I18N.en;
        const phraseNum = index + 1;
        const confirmMsg = dict.confirmDeleteRow 
            ? `${dict.confirmDeleteRow} #${phraseNum}?` 
            : `Вы уверены, что хотите удалить строку #${phraseNum}?`;

        if (!confirm(confirmMsg)) return;

        this.state.phrases.splice(index, 1);
        this.state.phrases.forEach((p, idx) => { p.id = idx; });
        this.renderPhrasesTable();
        this.updateButtonStates();
    }

    renderPhrasesTable() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const box = document.getElementById('phrasesTableBox');
        const tbody = document.getElementById('phrasesTableBody');
        const countBadge = document.getElementById('phrasesCountBadge');
        if (!box || !tbody) return;

        box.style.display = 'block';
        tbody.innerHTML = '';

        if (countBadge) {
            countBadge.textContent = `${this.state.phrases.length} ${dict.phrasesCountLabel || 'фраз'}`;
        }

        const footerBar = box.querySelector('.table-footer-bar');
        if (footerBar) {
            footerBar.style.display = 'flex';
        }

        const isVoiceoverStep = this.state.currentStep === 2;
        const thVoice = document.querySelector('.col-voice');
        if (thVoice) {
            thVoice.style.display = isVoiceoverStep ? '' : 'none';
        }
        const thRate = document.querySelector('.col-rate');
        if (thRate) {
            thRate.style.display = isVoiceoverStep ? '' : 'none';
        }
        const thPitch = document.querySelector('.col-pitch');
        if (thPitch) {
            thPitch.style.display = isVoiceoverStep ? '' : 'none';
        }

        const groupStep1 = document.querySelector('.toolbar-group-step1');
        const groupStep2 = document.querySelector('.toolbar-group-step2');
        if (groupStep1) {
            groupStep1.style.display = isVoiceoverStep ? 'none' : 'flex';
        }
        if (groupStep2) {
            groupStep2.style.display = isVoiceoverStep ? 'flex' : 'none';
        }



        if (this.state.phrases.length === 0) {
            const emptyTr = document.createElement('tr');
            emptyTr.innerHTML = `
                <td colspan="10" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📝</div>
                    <div style="font-size: 0.95rem; margin-bottom: 0.75rem;">${dict.emptyTableMessage}</div>
                    <button type="button" class="btn btn-sm btn-primary" id="btnEmptyAddRow" style="display: inline-flex;">
                        ${dict.addRowBtn}
                    </button>
                </td>
            `;
            tbody.appendChild(emptyTr);
            document.getElementById('btnEmptyAddRow')?.addEventListener('click', () => this.addPhrase());
            return;
        }

        const targetLang = document.getElementById('targetLangSelect')?.value || 'Русский';
        const voices = CONFIG.VOICES[targetLang] || CONFIG.VOICES["Русский"];
        const defaultVoice = document.getElementById('voiceSelect')?.value || Object.values(voices)[0];

        this.state.phrases.forEach((phrase, idx) => {
            if (!phrase.voice) {
                phrase.voice = defaultVoice;
            }
            if (!phrase.rate) {
                phrase.rate = '+0%';
            }
            if (!phrase.pitch) {
                phrase.pitch = '+0Hz';
            }

            const tr = document.createElement('tr');

            let voiceOptionsHtml = '';
            for (const [voiceLabel, voiceId] of Object.entries(voices)) {
                const selected = phrase.voice === voiceId ? 'selected' : '';
                voiceOptionsHtml += `<option value="${voiceId}" ${selected}>${voiceLabel}</option>`;
            }

            const rates = ['-20%', '-10%', '+0%', '+10%', '+15%', '+20%', '+25%', '+30%', '+40%', '+50%'];
            let rateOptionsHtml = '';
            for (const r of rates) {
                const label = r === '+0%' ? '0% (норм)' : r;
                const selected = (phrase.rate === r) ? 'selected' : '';
                rateOptionsHtml += `<option value="${r}" ${selected}>${label}</option>`;
            }

            const pitches = [
                { val: '-20Hz', label: '-20Hz (Бас)' },
                { val: '-10Hz', label: '-10Hz (Низкий)' },
                { val: '+0Hz', label: '0Hz (Норм)' },
                { val: '+10Hz', label: '+10Hz (Высокий)' },
                { val: '+20Hz', label: '+20Hz (Звонкий)' }
            ];
            let pitchOptionsHtml = '';
            for (const p of pitches) {
                const selected = (phrase.pitch === p.val) ? 'selected' : '';
                pitchOptionsHtml += `<option value="${p.val}" ${selected}>${p.label}</option>`;
            }

            tr.innerHTML = `
                <td style="color: var(--text-dim); text-align: center; font-weight: 600;">${idx + 1}</td>
                <td class="cell-time cell-editable" contenteditable="true" data-field="start" data-id="${phrase.id}" title="Формат: MM:SS">
                    ${phrase.start || '00:00'}
                </td>
                <td class="cell-time cell-editable" contenteditable="true" data-field="end" data-id="${phrase.id}" title="Формат: MM:SS">
                    ${phrase.end || '00:04'}
                </td>
                <td class="cell-source" style="vertical-align: middle;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%;">
                        <div class="cell-editable" contenteditable="true" data-field="sourceText" data-id="${phrase.id}" style="flex: 1; outline: none; min-height: 1.5rem;">
                            ${phrase.sourceText || ''}
                        </div>
                        <button type="button" class="btn-translate-row" data-id="${phrase.id}" title="${dict.translateRowTooltip || 'Перевести эту строку (Gemini)'}">
                            🌐
                        </button>
                    </div>
                </td>
                <td class="cell-editable" contenteditable="true" data-field="targetText" data-id="${phrase.id}">
                    ${phrase.targetText || ''}
                </td>
                <td class="col-voice" style="${isVoiceoverStep ? '' : 'display: none;'}">
                    <select class="form-select select-phrase-voice" data-id="${phrase.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: 100%;">
                        ${voiceOptionsHtml}
                    </select>
                </td>
                <td class="col-rate" style="${isVoiceoverStep ? '' : 'display: none;'}">
                    <select class="form-select select-phrase-rate" data-id="${phrase.id}" style="padding: 0.25rem 0.3rem; font-size: 0.8rem; width: 100%;">
                        ${rateOptionsHtml}
                    </select>
                </td>
                <td class="col-pitch" style="${isVoiceoverStep ? '' : 'display: none;'}">
                    <select class="form-select select-phrase-pitch" data-id="${phrase.id}" style="padding: 0.25rem 0.3rem; font-size: 0.8rem; width: 100%;">
                        ${pitchOptionsHtml}
                    </select>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    ${phrase.audioUrl ? `<button class="btn-play-mini btn-play-audio" data-url="${phrase.audioUrl}" title="${dict.playTooltip}">▶️</button>` : ''}
                    ${phrase.audioUrl ? `<button class="btn-play-mini btn-download-single-audio" data-id="${phrase.id}" title="${dict.downloadSingleAudioTooltip}">⬇️</button>` : ''}
                    ${isVoiceoverStep ? `<button class="btn-play-mini btn-re-tts" data-id="${phrase.id}" title="${dict.reTtsTooltip}">🔄</button>` : ''}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                        <button type="button" class="btn-table-action btn-insert-row" data-idx="${idx}" title="${dict.insertRowBelowTooltip || 'Вставить строку ниже'}">
                            ➕
                        </button>
                        <button type="button" class="btn-table-action btn-delete-row" data-idx="${idx}" title="${dict.deleteRowTooltip || 'Удалить строку'}">
                            🗑️
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Add single-phrase translate listeners (🌐 per row)
        tbody.querySelectorAll('.btn-translate-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                this.translateSinglePhrase(id, e.currentTarget);
            });
        });

        // Add row insert listeners (➕ per row)
        tbody.querySelectorAll('.btn-insert-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                this.addPhrase(idx + 1);
            });
        });

        // Add row delete listeners (🗑️ per row)
        tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                this.deletePhrase(idx);
            });
        });

        // Inline edit listeners
        tbody.querySelectorAll('.cell-editable').forEach(cell => {
            cell.addEventListener('input', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const field = e.target.getAttribute('data-field');
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    phrase[field] = e.target.innerText.trim();
                    if (field === 'start') {
                        phrase.startSec = Transcriber.toSeconds(phrase.start);
                    } else if (field === 'end') {
                        phrase.endSec = Transcriber.toSeconds(phrase.end);
                    }
                    if (field === 'sourceText' || field === 'targetText') {
                        this.updateButtonStates();
                    }
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

        // Add per-phrase rate change listeners
        tbody.querySelectorAll('.select-phrase-rate').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    phrase.rate = e.target.value;
                }
            });
        });

        // Add per-phrase pitch change listeners
        tbody.querySelectorAll('.select-phrase-pitch').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase) {
                    phrase.pitch = e.target.value;
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

        // Add single phrase audio download listeners
        tbody.querySelectorAll('.btn-download-single-audio').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                const phrase = this.state.phrases.find(p => p.id === id);
                if (phrase && phrase.audioUrl) {
                    const a = document.createElement('a');
                    a.href = phrase.audioUrl;
                    const rowNum = phrase.id !== undefined ? (phrase.id + 1) : (this.state.phrases.indexOf(phrase) + 1);
                    const timeClean = (phrase.start || '00-00').replace(':', '-');
                    a.download = `phrase_${rowNum}_${timeClean}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
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

        this.updateButtonStates();
    }

    async synthesizeSinglePhrase(phrase) {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const text = (phrase.targetText || phrase.sourceText || '').trim();
        if (!text) {
            this.showWarning(dict.emptyPhraseAlert);
            return;
        }

        const voice = phrase.voice || document.getElementById('voiceSelect')?.value || "ru-RU-DmitryNeural";
        const rate = phrase.rate || '+0%';
        const pitch = phrase.pitch || '+0Hz';
        this.log(4, `${dict.logSynthesizingPhrase}${phrase.id + 1}: "${text.substring(0, 30)}..." (${voice}, ${rate}, ${pitch})`, 'info');

        try {
            const mp3Blob = await EdgeTTS.synthesize(text, voice, rate, pitch);
            const audioUrl = URL.createObjectURL(mp3Blob);
            const durationSec = await TTSManager.getAudioDuration(audioUrl);

            phrase.audioBlob = mp3Blob;
            phrase.audioUrl = audioUrl;
            phrase.audioDuration = durationSec;

            this.renderPhrasesTable();
            this.log(4, `${dict.logPhraseSuccess}${phrase.id + 1} ${dict.logPhraseSuccessSuffix}`, 'success');
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
            this.log(5, dict.logAssemblyCompleted, 'success');
        } catch (err) {
            this.log(5, `${dict.logAssemblyFailed} ${err.message}`, 'error');
        }
    }

    getEnglishLangName(rawLang) {
        if (!rawLang) return "English";
        const fallbackMap = {
            "Русский": "Russian",
            "Английский": "English",
            "Персидский": "Persian",
            "Испанский": "Spanish",
            "Египетский": "Egyptian",
            "Армянский": "Armenian"
        };
        if (typeof CONFIG !== 'undefined' && CONFIG.LANG_FILE_NAMES && CONFIG.LANG_FILE_NAMES[rawLang]) {
            return CONFIG.LANG_FILE_NAMES[rawLang];
        }
        return fallbackMap[rawLang] || rawLang;
    }

    detectLanguageFromFilename(str) {
        if (!str) return null;
        const fn = String(str).toLowerCase();

        const langMap = [
            { key: "Русский", keywords: ["русский", "russian", "ru"] },
            { key: "Английский", keywords: ["английский", "english", "en"] },
            { key: "Персидский", keywords: ["персидский", "persian", "farsi", "fa"] },
            { key: "Испанский", keywords: ["испанский", "spanish", "es"] },
            { key: "Египетский", keywords: ["египетский", "egyptian", "arabic", "ar"] },
            { key: "Армянский", keywords: ["армянский", "armenian", "hy"] }
        ];

        for (const item of langMap) {
            if (item.keywords.some(kw => fn.includes(kw))) {
                return item.key;
            }
        }
        return null;
    }

    async handleTextImport(file, targetField = 'auto') {
        if (!file) return;
        const dict = I18N[this.state.uiLang] || I18N.en;
        let fileLang = null;

        try {
            const textContent = await file.text();
            let importedPhrases = [];

            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(textContent);
                let items = [];
                if (Array.isArray(parsed)) {
                    items = parsed;
                } else if (parsed && Array.isArray(parsed.phrases)) {
                    items = parsed.phrases;
                    if (parsed.language) {
                        const jsonLang = this.detectLanguageFromFilename(parsed.language);
                        if (jsonLang) fileLang = jsonLang;
                    }
                }

                importedPhrases = items.map((item, idx) => {
                    const src = item.sourceText || item.text || (targetField === 'sourceText' ? item.content || '' : '');
                    const tgt = item.targetText || item.translation || (targetField === 'targetText' ? item.content || '' : '');

                    return {
                        id: idx,
                        start: item.start || '00:00',
                        end: item.end || '00:05',
                        startSec: Transcriber.toSeconds(item.start || '00:00'),
                        endSec: Transcriber.toSeconds(item.end || '00:05'),
                        voice: item.voice || undefined,
                        rate: item.rate || '+0%',
                        sourceText: targetField === 'targetText' ? (src || '') : (src || item.content || ''),
                        targetText: targetField === 'sourceText' ? (tgt || '') : (tgt || (targetField === 'targetText' ? item.content || '' : ''))
                    };
                });
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

                const hasText = this.state.phrases.some(p => (p.targetText && p.targetText.trim().length > 0) || (p.sourceText && p.sourceText.trim().length > 0));
                if (hasText || this.state.videoFile) {
                    document.getElementById('stepNav1')?.classList.add('completed');
                    const btnGo2 = document.getElementById('btnGoToStep2');
                    if (btnGo2) btnGo2.disabled = false;
                }
                if (targetField === 'targetText' || this.state.phrases.some(p => p.targetText)) {
                    this.log(1, dict.translationLoadedInfo, 'info');
                }

                // Auto-detect language from file content or filename if present
                const detectedLang = fileLang || this.detectLanguageFromFilename(file.name);
                if (detectedLang) {
                    if (targetField === 'sourceText' && CONFIG.SOURCE_LANGS[detectedLang]) {
                        const sourceLangSelect = document.getElementById('sourceLangSelect');
                        if (sourceLangSelect) sourceLangSelect.value = detectedLang;
                        this.log(1, `${dict.logDetectedLang} ${this.getEnglishLangName(detectedLang)}`, 'info');
                    } else if (CONFIG.VOICES[detectedLang]) {
                        const targetLangSelect = document.getElementById('targetLangSelect');
                        const targetLangSelectStep4 = document.getElementById('targetLangSelectStep4');
                        if (targetLangSelect) targetLangSelect.value = detectedLang;
                        if (targetLangSelectStep4) targetLangSelectStep4.value = detectedLang;
                        this.updateVoiceOptions('step3');
                        this.log(1, `${dict.logDetectedLang} ${this.getEnglishLangName(detectedLang)}`, 'info');
                    }
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
            this.showWarning(
                dict.missingAudioBlobAlert,
                () => {
                    if (this.state.currentStep !== 2) this.goToStep(2);
                    this.runTTS();
                },
                dict.startTTSBtn || '🎙️ Озвучить все фразы'
            );
            return;
        }

        const a = document.createElement('a');
        a.href = this.state.mixedAudioUrl;
        const rawLang = document.getElementById('targetLangSelectStep4')?.value 
                     || document.getElementById('targetLangSelect')?.value 
                     || 'English';
        const englishLang = this.getEnglishLangName(rawLang);
        a.download = `dubbed_audio_${englishLang}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    exportText(field, format) {
        const dict = I18N[this.state.uiLang] || I18N.en;
        if (!this.state.phrases || this.state.phrases.length === 0) {
            this.showWarning(
                dict.noPhrasesAlert,
                () => this.openImportModal(),
                dict.openImportBtn || '📥 Импорт'
            );
            return;
        }

        const available = this.state.phrases.filter(p => p[field] && p[field].trim().length > 0);
        if (available.length === 0) {
            if (field === 'sourceText') {
                this.showWarning(
                    dict.missingOrigTextAlert,
                    () => this.openImportModal(),
                    dict.openImportBtn || '📥 Импорт'
                );
            } else {
                this.showWarning(
                    dict.missingTransTextAlert,
                    () => {
                        if (this.state.currentStep !== 1) this.goToStep(1);
                        this.runTranslation();
                    },
                    dict.startTranslationBtn || '🌐 Перевести текст'
                );
            }
            return;
        }

        let content = '';
        let mime = 'text/plain';
        const ext = format === 'json' ? 'json' : 'txt';

        let rawLang = '';
        if (field === 'sourceText') {
            rawLang = document.getElementById('sourceLangSelect')?.value || 'Armenian';
        } else {
            rawLang = document.getElementById('targetLangSelectStep4')?.value 
                   || document.getElementById('targetLangSelect')?.value 
                   || 'English';
        }
        const englishLang = this.getEnglishLangName(rawLang);
        const prefix = field === 'sourceText' ? 'script_original' : 'script_translated';

        if (format === 'json') {
            const data = {
                language: englishLang,
                phrases: available.map(p => ({
                    id: p.id,
                    start: p.start,
                    end: p.end,
                    voice: p.voice || undefined,
                    rate: p.rate || undefined,
                    [field]: p[field] || ''
                }))
            };
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
        a.download = `${prefix}_${englishLang}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async exportIndividualAudio() {
        const dict = I18N[this.state.uiLang] || I18N.en;
        const voicedPhrases = this.state.phrases.filter(p => p.audioBlob);
        if (voicedPhrases.length === 0) {
            this.showWarning(
                dict.missingIndividualAudioAlert,
                () => {
                    if (this.state.currentStep !== 2) this.goToStep(2);
                    this.runTTS();
                },
                dict.startTTSBtn || '🎙️ Озвучить все фразы'
            );
            return;
        }

        const logStep = this.state.currentStep === 2 ? 4 : 2;
        this.log(logStep, dict.logPackingZip, 'info');

        try {
            const filesToZip = [];
            for (let idx = 0; idx < voicedPhrases.length; idx++) {
                const phrase = voicedPhrases[idx];
                const arrayBuf = await phrase.audioBlob.arrayBuffer();
                const timeClean = (phrase.start || '00-00').replace(':', '-');
                const rowNum = phrase.id !== undefined ? (phrase.id + 1) : (this.state.phrases.indexOf(phrase) + 1);
                const fileName = `phrase_${rowNum}_${timeClean}.mp3`;
                filesToZip.push({
                    name: fileName,
                    data: new Uint8Array(arrayBuf)
                });
            }

            const zipBlob = ZipBuilder.createZip(filesToZip);
            const zipUrl = URL.createObjectURL(zipBlob);

            const a = document.createElement('a');
            a.href = zipUrl;
            const rawLang = document.getElementById('targetLangSelectStep4')?.value 
                         || document.getElementById('targetLangSelect')?.value 
                         || 'English';
            const englishLang = this.getEnglishLangName(rawLang);
            a.download = `phrase_audios_${englishLang}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            this.log(logStep, dict.logZipSuccess, 'success');
        } catch (err) {
            this.log(logStep, `❌ ZIP Error: ${err.message}`, 'error');
        }
    }
}

// Initialize application reliably for ES modules
function initApp() {
    try {
        if (!window.app) {
            window.app = new VoiceDubApp();
        }
    } catch (err) {
        console.error('Fatal initialization error in VoiceDubApp:', err);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
