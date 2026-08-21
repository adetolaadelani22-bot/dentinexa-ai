/**
 * DentiNexa AI — Landing page chat widget
 * -----------------------------------------------------------------
 * This is a DEMO assistant only — it pattern-matches keywords and
 * returns a canned, plausible response. There is no real AI model
 * behind this. It exists to show what the experience would feel
 * like once a real provider (OpenAI, Gemini, etc.) is wired in.
 * -----------------------------------------------------------------
 */

const AI_CHAT_RULES = [
  {
    keywords: ['hurt', 'pain', 'ache', 'sore', 'sensitive', 'sensitivity'],
    responses: [
      "That sounds uncomfortable — pain like that can mean anything from sensitivity to early decay. I can't diagnose it, but it's worth having a dentist take a look soon. Want me to check the next available slot?",
      "Sorry you're dealing with that. Tooth pain is one of the things we recommend not waiting on. Would you like help booking a visit?"
    ]
  },
  {
    keywords: ['cold', 'hot', 'sweet'],
    responses: [
      "Sensitivity to cold or sweet things is pretty common and often treatable. A dentist can check whether it's your enamel, a small cavity, or something else. Want me to help you book a checkup?"
    ]
  },
  {
    keywords: ['clean', 'cleaning', 'checkup', 'check up', 'routine'],
    responses: [
      "Great — routine cleanings are one of the best things you can do for your teeth. I can help you find a time that works. Do you have a preferred dentist, or no preference?"
    ]
  },
  {
    keywords: ['whiten', 'whitening', 'stain', 'yellow'],
    responses: [
      "We offer professional whitening — it's safer and more even than most at-home kits. Would you like me to point you to that service, or help you book a consult first?"
    ]
  },
  {
    keywords: ['cost', 'price', 'expensive', 'much', 'insurance', 'pay', 'billing'],
    responses: [
      "Pricing depends on the treatment — you can see plans under Pricing on this page. Once you're a patient, your dashboard shows itemized invoices too, so nothing's a surprise."
    ]
  },
  {
    keywords: ['emergency', 'swelling', 'swollen', 'bleeding', 'knocked out', 'trauma'],
    responses: [
      "That could be urgent — please don't wait on this. Use the emergency line at the bottom of this page to reach the clinic directly, right now."
    ]
  },
  {
    keywords: ['appointment', 'book', 'schedule', 'visit'],
    responses: [
      "I'd be happy to help you book. You'll get the full scheduling experience — with your real history and preferred dentist — once you create a free patient account. Want me to take you there?"
    ]
  },
  {
    keywords: ['child', 'kid', 'son', 'daughter', 'pediatric'],
    responses: [
      "We have dentists who specialize in gentle, kid-friendly care. I can point you to pediatric dentistry, or help you book a first visit for them."
    ]
  },
  {
    keywords: ['language', 'yoruba', 'hausa', 'igbo', 'french', 'spanish', 'arabic'],
    responses: [
      "We support English, French, Spanish, Arabic, Yoruba, Hausa, and Igbo across the portal and this assistant. Which would you like to continue in?"
    ]
  },
  {
    keywords: ['thank', 'thanks', 'appreciate'],
    responses: ["You're welcome! Anything else I can help you figure out before your visit?"]
  },
  {
    keywords: ['hi', 'hello', 'hey'],
    responses: ["Hi there! Tell me a bit about what's going on, or what you're looking to book, and I'll point you in the right direction."]
  }
];

const AI_CHAT_FALLBACKS = [
  "I'm a demo assistant right now, so I work off a few common topics — try asking about pain, cleanings, pricing, or booking. A real version of me would understand a lot more.",
  "I don't have a scripted answer for that yet, but our real dentists definitely will. Want me to help you book a visit so you can ask them directly?",
  "I'm not fully trained on that one yet (I'm just a frontend demo!). For anything specific to your health, booking a visit is the best next step."
];

document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('ai-chat-body');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');
  const resetBtn = document.getElementById('ai-chat-reset');
  if (!body || !input || !sendBtn) return; // widget not on this page

  function addBubble(text, who) {
    const bubble = document.createElement('div');
    bubble.className = `bubble bubble-${who}`;
    bubble.textContent = text;
    body.appendChild(bubble);
    body.scrollTop = body.scrollHeight;
    return bubble;
  }

  function showTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble bubble-ai typing-bubble';
    bubble.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
    body.appendChild(bubble);
    body.scrollTop = body.scrollHeight;
    return bubble;
  }

  function pickResponse(userText) {
    const lower = userText.toLowerCase();
    for (const rule of AI_CHAT_RULES) {
      if (rule.keywords.some(kw => lower.includes(kw))) {
        return rule.responses[Math.floor(Math.random() * rule.responses.length)];
      }
    }
    return AI_CHAT_FALLBACKS[Math.floor(Math.random() * AI_CHAT_FALLBACKS.length)];
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    addBubble(text, 'user');
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    const typingBubble = showTyping();
    const delay = 500 + Math.random() * 700; // feels more natural than an instant reply

    setTimeout(() => {
      typingBubble.remove();
      addBubble(pickResponse(text), 'ai');
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }, delay);
  }

  sendBtn.addEventListener('click', handleSend);

  const micBtn = document.getElementById('ai-chat-mic');
  if (micBtn) wireChatMicButton(micBtn, input);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      body.innerHTML = `
        <div class="bubble bubble-ai">
          Hi, I'm the DentiNexa Assistant. Tell me what's going on and I'll help you figure out next steps —
          try something like "my tooth hurts" or "I want a cleaning."
        </div>`;
      input.value = '';
      input.focus();
    });
  }
});

/** Chat input isn't wrapped in a .field, so it gets its own small mic wiring using the same speech support check. */
function wireChatMicButton(btn, input) {
  const support = typeof speechRecognitionSupportInfo === 'function' ? speechRecognitionSupportInfo() : { usable: false };
  if (!support.usable) {
    btn.addEventListener('click', () => {
      const reason = !support.hasApi
        ? "Voice input isn't supported in this browser — try Chrome or Edge."
        : "Voice input needs https:// or localhost — it can't run when this page is opened directly as a file.";
      showToast(reason, 'warning', 6000);
    });
    return;
  }

  let recognition = null, listening = false;
  btn.addEventListener('click', () => {
    if (listening) { recognition.stop(); return; }
    recognition = new support.Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    const base = input.value ? input.value.replace(/\s*$/, ' ') : '';

    recognition.onstart = () => { listening = true; btn.classList.add('voice-btn-listening'); };
    recognition.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = base + t;
    };
    recognition.onerror = () => showToast('Voice input error — please try again.', 'error');
    recognition.onend = () => { listening = false; btn.classList.remove('voice-btn-listening'); input.focus(); };
    recognition.start();
  });
}
