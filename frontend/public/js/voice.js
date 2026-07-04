'use strict';
/* ============================================================
   VOICE INPUT — Web Speech API for chat input
   ============================================================ */
const VoiceInput = {
  _recognition: null,
  _listening: false,
  _target: null,
  _pendingRestart: null,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceInput] SpeechRecognition not supported');
      document.querySelectorAll('[data-voice]').forEach(btn => {
        btn.style.display = 'none';
      });
      return;
    }
    // The Web Speech API silently refuses to run outside a secure context.
    // On Termux this is the #1 reason voice input "just doesn't work":
    // opening OrinIDE via a plain http://LAN-IP instead of http://localhost.
    if (!window.isSecureContext) {
      console.warn('[VoiceInput] Insecure context — Speech Recognition requires HTTPS or localhost');
      document.querySelectorAll('[data-voice]').forEach(btn => {
        btn.disabled = true;
        btn.title = 'Voice input needs HTTPS or localhost — open OrinIDE via http://localhost, not a LAN IP';
      });
      return;
    }
    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = 'en-US';

    this._recognition.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (this._target) {
        this._target.value = transcript;
        this._target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    this._recognition.onend = () => {
      this._listening = false;
      this._target = null;
      this._updateButton(false);
      if (this._pendingRestart) {
        const { target, btn } = this._pendingRestart;
        this._pendingRestart = null;
        this.start(target, btn);
      }
    };

    this._recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        toast('Microphone permission denied. Allow mic access in browser settings.', 'wrn', 4000);
      } else if (e.error === 'no-speech') {
        toast('No speech detected. Try again.', 'inf', 2000);
      } else if (e.error === 'audio-capture') {
        toast('No microphone found.', 'wrn', 3000);
      } else {
        toast('Voice input error: ' + e.error, 'err');
      }
      this._listening = false;
      this._updateButton(false);
    };

    // Bind voice buttons
    document.querySelectorAll('[data-voice]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.voice;
        const target = document.getElementById(targetId);
        if (target) this.toggle(target, btn);
      });
    });
  },

  toggle(target, btn) {
    if (this._listening && this._target === target) {
      this.stop();
    } else if (this._listening) {
      // Switching mics mid-dictation — stop cleanly first instead of
      // calling start() on an already-running recognizer, which throws
      // "already started" and used to leave the button stuck as active.
      this._pendingRestart = { target, btn };
      this.stop();
    } else {
      this.start(target, btn);
    }
  },

  start(target, btn) {
    if (!this._recognition) {
      toast('Voice input not supported in this browser', 'wrn');
      return;
    }
    this._target = target;
    this._listening = true;
    this._updateButton(true, btn);
    try {
      this._recognition.start();
      toast('Listening... speak now', 'inf', 2000);
    } catch (e) {
      this._listening = false;
      this._target = null;
      this._updateButton(false);
      toast('Could not start voice input — try again', 'wrn', 2000);
    }
  },

  stop() {
    if (this._recognition) {
      try { this._recognition.stop(); } catch {}
    }
    this._listening = false;
    this._updateButton(false);
  },

  _updateButton(listening, btn) {
    const buttons = document.querySelectorAll('[data-voice]');
    buttons.forEach(b => {
      b.classList.toggle('voice-active', listening);
      if (listening) {
        b.title = 'Stop voice input';
      } else {
        b.title = 'Voice input';
      }
    });
  },

  get isListening() { return this._listening; },
  get isSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
};
window.VoiceInput = VoiceInput;
