// VOICE_DUB_V5 Config & Constants

export const CONFIG = {
    DEFAULT_API_KEY: "AIzaSyA_FTP8jkQtSKfmlO9r-qPltYu1nRZp2h0",
    MODEL_ID: "gemini-3.1-flash-lite", // Matching VOICE_DUB_V4

    // Voice mappings (Edge TTS voices matching VOICE_DUB_V4)
    VOICES: {
        "Русский": {
            "Мужской (Dmitry)": "ru-RU-DmitryNeural",
            "Женский (Svetlana)": "ru-RU-SvetlanaNeural",
        },
        "Английский": {
            "Мужской (Guy)": "en-US-GuyNeural",
            "Женский (Jenny)": "en-US-JennyNeural",
        },
        "Персидский": {
            "Мужской (Farid)": "fa-IR-FaridNeural",
            "Женский (Dilara)": "fa-IR-DilaraNeural",
        },
        "Испанский": {
            "Мужской (Alvaro)": "es-ES-AlvaroNeural",
            "Женский (Elvira)": "es-ES-ElviraNeural",
        },
        "Египетский": {
            "Мужской (Shakir)": "ar-EG-ShakirNeural",
            "Женский (Salma)": "ar-EG-SalmaNeural",
        },
    },

    LANG_CODES: {
        "Русский": "ru",
        "Английский": "en",
        "Персидский": "fa",
        "Испанский": "es",
        "Египетский": "ar",
    },

    LANG_NAMES: {
        "Русский": "Russian",
        "Английский": "English",
        "Персидский": "Persian (Farsi)",
        "Испанский": "Spanish",
        "Египетский": "Egyptian Arabic (Masri dialect)",
    },

    SOURCE_LANGS: {
        "Армянский": {
            "csv_name": "armenian",
            "col_name": "Армянский",
            "prompt_lang": "Armenian (Armenian alphabet)",
        },
        "Русский": {
            "csv_name": "russian",
            "col_name": "Русский",
            "prompt_lang": "Russian (Cyrillic alphabet)",
        },
    }
};
