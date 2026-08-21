/**
 * DentiNexa AI — Speech-to-Text utility
 * -----------------------------------------------------------------
 * Adds a mic button next to any input/textarea marked with
 * data-voice-input, using the browser's built-in Web Speech API
 * (no external service, no API key).
 *
 * IMPORTANT LIMITATION: browsers only allow microphone access on a
 * "secure context" — https:// or http://localhost. It will NOT work
 * when this file is opened directly (file://). If you want to try
 * voice input, serve this folder with a simple local static server
 * (e.g. `npx serve` or `python -m http.server`) and open it via
 * http://localhost instead. The mic button below detects this and
 * explains itself rather than failing silently.
 *
 * Transcribed text always lands in the field as EDITABLE text the
 * person can review before submitting — it's never auto-submitted.
 * -----------------------------------------------------------------
 */

function speechRecognitionSupportInfo() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSecureContext = window.isSecureContext; // false under file://, true under https:// or localhost
  return {
    hasApi: !!SpeechRecognitionCtor,
    isSecureContext,
    usable: !!SpeechRecognitionCtor && isSecureContext,
    Ctor: SpeechRecognitionCtor
  };
}

function initVoiceInputs(root = document) {
  const support = speechRecognitionSupportInfo();
  root.querySelectorAll('[data-voice-input]').forEach(el => attachVoiceButton(el, support));
}

function attachVoiceButton(field, support) {
  if (field.dataset.voiceAttached) return; // don't double-attach
  field.dataset.voiceAttached = 'true';

  const wrap = field.closest('.field') || field.parentElement;
  if (!wrap) return;
  wrap.classList.add('has-voice-input');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-btn';
  btn.setAttribute('aria-label', 'Dictate this field by voice');
  const iconRoot = typeof appRoot === 'function' ? appRoot() : './';
  btn.innerHTML = `<img src="${iconRoot}assets/icons/icon-mic.svg" alt="" width="15" height="15">`;
  wrap.appendChild(btn);

  if (!support.usable) {
    btn.classList.add('voice-btn-disabled');
    btn.addEventListener('click', () => {
      const reason = !support.hasApi
        ? 'Voice input isn\'t supported in this browser — try Chrome or Edge.'
        : 'Voice input needs a secure connection (https:// or localhost). It can\'t run when this page is opened directly as a file — try serving it with a local server instead.';
      showToast(reason, 'warning', 6000);
    });
    return;
  }

  let recognition = null;
  let listening = false;

  btn.addEventListener('click', () => {
    if (listening) { recognition.stop(); return; }

    recognition = new support.Ctor();
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseText = field.value ? field.value.replace(/\s*$/, ' ') : '';

    recognition.onstart = () => {
      listening = true;
      btn.classList.add('voice-btn-listening');
      wrap.classList.add('voice-listening');
    };
    recognition.onerror = (e) => {
      showToast(e.error === 'not-allowed' ? 'Microphone access was blocked.' : 'Voice input error — please try again.', 'error');
    };
    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      field.value = baseText + transcript;
    };
    recognition.onend = () => {
      listening = false;
      btn.classList.remove('voice-btn-listening');
      wrap.classList.remove('voice-listening');
      field.focus(); // land the cursor in the field so it's obviously still editable
    };

    recognition.start();
  });
}

document.addEventListener('DOMContentLoaded', () => initVoiceInputs());
