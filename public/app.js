/**
 * Ultron — Next-Gen AI Companion Client Application
 * Created by Boss Muhammad Shehryar
 * 
 * Features:
 * - Multi-Theme Switching Engine (Cosmic Violet, Cyber Neon, Emerald Quantum, Sunset Velvet)
 * - Real-time Chat loop with Gemini 3.5 Lite Fast AI Brain
 * - MongoDB Atlas Cloud Persistence
 * - Code Block Highlighting + 1-Click Copy Code Button
 * - Message Action Bar (Copy Message, Listen Aloud)
 * - Dynamic Audio Equalizer & Mic Ripple Visualizers
 * - Categorized Interactive Prompt Cards
 * - Scroll-to-Bottom Floating Observer
 * - Keyboard Shortcuts (Ctrl+K, Ctrl+M, Esc)
 * - Holographic Creator Profile Modal
 */

(function () {
  'use strict';

  // ─── Configuration & Storage Keys ───
  const API_BASE = window.location.origin;
  const MAX_HISTORY = 20;
  const THEME_KEY = 'ultron_theme_preference';
  const PERSONA_KEY = 'ultron_persona_mode';
  const USER_KEY = 'ultron_session_user_id';
  const CURRENT_SESSION_KEY = 'ultron_session_chat_id';
  const AUTO_VOICE_KEY = 'ultron_auto_voice';
  const SOUND_EFFECTS_KEY = 'ultron_sound_effects';

  // ─── State ───
  let userId = null;
  let currentSessionId = null;
  let currentGenderMode = 'boss'; // 'boss' or 'queen'
  let conversationHistory = [];
  let allSavedConversations = [];
  let messageCount = 0;
  let sessionStart = Date.now();
  let isWaiting = false;
  let isListening = false;
  let recognition = null;
  let synth = window.speechSynthesis || null;
  let currentUtterance = null;
  let audioCtx = null;

  // ─── DOM Elements ───
  const messagesList = document.getElementById('messagesList');
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const headerStatus = document.getElementById('headerStatus');
  const chatTitle = document.getElementById('chatTitle');
  const messageCountEl = document.getElementById('messageCount');
  const sessionDurationEl = document.getElementById('sessionDuration');
  const charCounter = document.getElementById('charCounter');
  const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const aboutCreatorBtn = document.getElementById('aboutCreatorBtn');
  const openCreatorCardBtn = document.getElementById('openCreatorCardBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const exportChatBtn = document.getElementById('exportChatBtn');
  const stopSpeechBtn = document.getElementById('stopSpeechBtn');
  const voiceInputBtn = document.getElementById('voiceInputBtn');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const conversationsList = document.getElementById('conversationsList');
  const historySearchInput = document.getElementById('historySearchInput');
  const statusText = document.getElementById('statusText');
  const autoVoiceToggle = document.getElementById('autoVoiceToggle');
  const soundEffectsToggle = document.getElementById('soundEffectsToggle');
  const creatorModal = document.getElementById('creatorModal');
  const closeCreatorModalBtn = document.getElementById('closeCreatorModalBtn');
  const toastContainer = document.getElementById('toastContainer');
  const ultronAvatar = document.getElementById('ultronAvatar');
  const themePillBtn = document.getElementById('themePillBtn');
  const themeDropdownMenu = document.getElementById('themeDropdownMenu');
  const bossModeBtn = document.getElementById('bossModeBtn');
  const queenModeBtn = document.getElementById('queenModeBtn');
  const headerPersonaPill = document.getElementById('headerPersonaPill');
  const headerPersonaLabel = document.getElementById('headerPersonaLabel');

  // ─── Initialize Application ───
  async function init() {
    setupTheme();
    setupPersonaMode();
    setupUserAndSession();
    setupAudioAndToggles();
    setupSpeechRecognition();
    setupEventListeners();
    setupScrollObserver();
    updateSessionTimer();
    setInterval(updateSessionTimer, 60000);

    if (window.marked) {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
    }

    checkHealth();
    await loadConversationsHistory();
    showWelcomeScreen();

    window.addEventListener('pagehide', () => {
      stopSpeaking();
    });
  }

  // ─── Theme Management ───
  const THEME_NAMES = {
    violet: 'Cosmic',
    cyan: 'Cyber',
    emerald: 'Emerald',
    rose: 'Sunset'
  };

  function setupTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'violet';
    applyTheme(savedTheme);

    // Sidebar theme buttons
    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-set-theme');
        applyTheme(theme);
        if (themeDropdownMenu) themeDropdownMenu.classList.remove('open');
      });
    });

    // Header theme dropdown toggle
    if (themePillBtn && themeDropdownMenu) {
      themePillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdownMenu.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#headerThemeSelector')) {
          themeDropdownMenu.classList.remove('open');
        }
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    // Update sidebar active buttons
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-set-theme') === theme);
    });

    // Update header display
    const themeNameDisplay = document.querySelector('.theme-name-display');
    if (themeNameDisplay) {
      themeNameDisplay.textContent = THEME_NAMES[theme] || 'Cosmic';
    }

    const currentIndicator = document.querySelector('.current-theme-indicator');
    if (currentIndicator) {
      const colors = { violet: '#a855f7', cyan: '#06b6d4', emerald: '#10b981', rose: '#f43f5e' };
      currentIndicator.style.background = colors[theme] || '#a855f7';
      currentIndicator.style.boxShadow = `0 0 6px ${colors[theme] || '#a855f7'}`;
    }
  }

  // ─── Persona & Gender Mode Management ───
  function setupPersonaMode() {
    const savedMode = localStorage.getItem(PERSONA_KEY) || 'boss';
    setPersonaMode(savedMode, false);

    if (bossModeBtn) {
      bossModeBtn.addEventListener('click', () => {
        setPersonaMode('boss');
      });
    }

    if (queenModeBtn) {
      queenModeBtn.addEventListener('click', () => {
        setPersonaMode('lady');
      });
    }

    if (headerPersonaPill) {
      headerPersonaPill.addEventListener('click', () => {
        const newMode = currentGenderMode === 'boss' ? 'lady' : 'boss';
        setPersonaMode(newMode);
      });
    }
  }

  function setPersonaMode(mode, notify = true) {
    currentGenderMode = mode;
    localStorage.setItem(PERSONA_KEY, mode);
    document.documentElement.setAttribute('data-mode', mode);

    // Auto-switch to cute Rose theme and generate floating petals when in Lady mode
    if (mode === 'lady') {
      applyTheme('rose');
      startFloatingPetals();
    } else {
      stopFloatingPetals();
      const savedTheme = localStorage.getItem(THEME_KEY) || 'violet';
      applyTheme(savedTheme);
    }

    // Update sidebar buttons
    if (bossModeBtn) bossModeBtn.classList.toggle('active', mode === 'boss');
    if (queenModeBtn) queenModeBtn.classList.toggle('active', mode === 'lady');

    // Update header pill
    if (headerPersonaPill && headerPersonaLabel) {
      if (mode === 'lady') {
        headerPersonaPill.querySelector('.persona-dot').textContent = '🌸';
        headerPersonaLabel.textContent = 'My Lady';
      } else {
        headerPersonaPill.querySelector('.persona-dot').textContent = '👑';
        headerPersonaLabel.textContent = 'BOSS Mode';
      }
    }

    // If on welcome screen, refresh prompts
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen && conversationHistory.length === 0) {
      welcomeScreen.remove();
      showWelcomeScreen();
    }

    if (notify) {
      showToast(mode === 'lady' ? '🌸 My Lady Mode Activated · VIP Royal Treatment' : '👑 BOSS Shehryar Mode Activated');
    }
  }

  let petalInterval = null;
  function startFloatingPetals() {
    stopFloatingPetals();
    const overlay = document.getElementById('rosePetalsOverlay');
    if (!overlay) return;

    const icons = ['🌸', '✨', '💖', '🌷', '🌺', '💕'];
    
    // Spawn initial wave
    for (let i = 0; i < 8; i++) {
      createPetal(overlay, icons, true);
    }

    petalInterval = setInterval(() => {
      if (currentGenderMode !== 'lady') {
        stopFloatingPetals();
        return;
      }
      createPetal(overlay, icons, false);
    }, 2000);
  }

  function createPetal(container, icons, immediate = false) {
    if (!container) return;
    const petal = document.createElement('div');
    petal.className = 'floating-petal';
    petal.textContent = icons[Math.floor(Math.random() * icons.length)];
    petal.style.left = `${Math.random() * 95}vw`;
    petal.style.fontSize = `${1 + Math.random() * 0.8}rem`;
    
    const duration = 6 + Math.random() * 6;
    petal.style.animationDuration = `${duration}s`;
    
    if (immediate) {
      petal.style.animationDelay = `-${Math.random() * duration}s`;
    }
    
    container.appendChild(petal);
    setTimeout(() => petal.remove(), duration * 1000);
  }

  function stopFloatingPetals() {
    if (petalInterval) {
      clearInterval(petalInterval);
      petalInterval = null;
    }
    const overlay = document.getElementById('rosePetalsOverlay');
    if (overlay) overlay.innerHTML = '';
  }

  // ─── User & Session Setup ───
  function setupUserAndSession() {
    try {
      localStorage.removeItem('ultron_user_id');
      localStorage.removeItem('ultron_current_session_id');
    } catch {}

    userId = sessionStorage.getItem(USER_KEY);
    if (!userId) {
      userId = 'user_' + generateId();
      sessionStorage.setItem(USER_KEY, userId);
    }

    currentSessionId = 'session_' + generateId();
    sessionStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
    conversationHistory = [];
    messagesList.innerHTML = '';
  }

  function startFreshSession() {
    currentSessionId = 'session_' + generateId();
    sessionStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
    conversationHistory = [];
    messagesList.innerHTML = '';
    messageCount = 0;
    messageCountEl.textContent = '0';
    if (chatTitle) chatTitle.textContent = 'Ultron';
    stopSpeaking();
    showWelcomeScreen();
    showToast('Started a fresh conversation ✨');
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  // ─── Audio & UI Sound Effects ───
  function setupAudioAndToggles() {
    if (autoVoiceToggle) {
      autoVoiceToggle.checked = localStorage.getItem(AUTO_VOICE_KEY) === 'true';
      autoVoiceToggle.addEventListener('change', () => {
        localStorage.setItem(AUTO_VOICE_KEY, autoVoiceToggle.checked);
      });
    }

    if (soundEffectsToggle) {
      soundEffectsToggle.checked = localStorage.getItem(SOUND_EFFECTS_KEY) !== 'false';
      soundEffectsToggle.addEventListener('change', () => {
        localStorage.setItem(SOUND_EFFECTS_KEY, soundEffectsToggle.checked);
      });
    }
  }

  function playUiSound(type) {
    if (!soundEffectsToggle || !soundEffectsToggle.checked) return;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'receive') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch {}
  }

  // ─── Speech-to-Text (Voice Input) ───
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (voiceInputBtn) {
        voiceInputBtn.title = 'Speech recognition not supported on this browser';
        voiceInputBtn.style.opacity = '0.4';
      }
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      voiceInputBtn.classList.add('listening');
      headerStatus.textContent = 'Listening to you... 🎤';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      messageInput.value = transcript;
      updateInputHeight();
      sendBtn.disabled = transcript.trim().length === 0;
    };

    recognition.onerror = (event) => {
      console.warn('[Speech Recognition Error]', event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function toggleVoiceInput() {
    if (!recognition) {
      showToast('Voice input is supported in Chrome, Edge, and Safari 🎤');
      return;
    }

    if (isListening) {
      recognition.stop();
      stopListening();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.warn('[Speech Start Error]', err);
      }
    }
  }

  function stopListening() {
    isListening = false;
    if (voiceInputBtn) voiceInputBtn.classList.remove('listening');
    if (headerStatus && !isWaiting) headerStatus.textContent = 'Ready to companion';
  }

  // ─── Text-to-Speech (Voice Output) ───
  function speakText(text) {
    if (!synth) return;

    stopSpeaking();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`#>-]/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.rate = 1.05;
    currentUtterance.pitch = 1.0;

    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      currentUtterance.voice = preferredVoice;
    }

    if (stopSpeechBtn) stopSpeechBtn.style.display = 'flex';
    if (ultronAvatar) ultronAvatar.classList.add('speaking');

    currentUtterance.onend = () => {
      if (stopSpeechBtn) stopSpeechBtn.style.display = 'none';
      if (ultronAvatar) ultronAvatar.classList.remove('speaking');
    };

    currentUtterance.onerror = () => {
      if (stopSpeechBtn) stopSpeechBtn.style.display = 'none';
      if (ultronAvatar) ultronAvatar.classList.remove('speaking');
    };

    synth.speak(currentUtterance);
  }

  function stopSpeaking() {
    if (synth && synth.speaking) {
      synth.cancel();
    }
    if (stopSpeechBtn) stopSpeechBtn.style.display = 'none';
    if (ultronAvatar) ultronAvatar.classList.remove('speaking');
  }

  // ─── Health Check ───
  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        if (statusText) statusText.textContent = 'Online';
      }
    } catch {
      if (statusText) statusText.textContent = 'Offline';
    }
  }

  // ─── Scroll Observer ───
  function setupScrollObserver() {
    if (!messagesContainer || !scrollToBottomBtn) return;

    messagesContainer.addEventListener('scroll', () => {
      const distFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
      if (distFromBottom > 150) {
        scrollToBottomBtn.classList.add('visible');
      } else {
        scrollToBottomBtn.classList.remove('visible');
      }
    });

    scrollToBottomBtn.addEventListener('click', () => {
      scrollToBottom();
    });
  }

  // ─── Toast System ───
  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.9)';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  // ─── Event Listeners & Keyboard Shortcuts ───
  function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', handleSend);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea & character counter
    messageInput.addEventListener('input', updateInputHeight);

    // Voice button
    if (voiceInputBtn) {
      voiceInputBtn.addEventListener('click', toggleVoiceInput);
    }

    // Stop speaking button
    if (stopSpeechBtn) {
      stopSpeechBtn.addEventListener('click', stopSpeaking);
    }

    // Export conversation
    if (exportChatBtn) {
      exportChatBtn.addEventListener('click', exportConversation);
    }

    // New chat button
    newChatBtn.addEventListener('click', () => {
      startFreshSession();
      closeSidebar();
    });

    // Creator Modal triggers
    if (aboutCreatorBtn) {
      aboutCreatorBtn.addEventListener('click', () => {
        openCreatorModal();
        closeSidebar();
      });
    }
    if (openCreatorCardBtn) {
      openCreatorCardBtn.addEventListener('click', () => {
        openCreatorModal();
        closeSidebar();
      });
    }

    // Clear chat button
    clearChatBtn.addEventListener('click', clearChat);

    // Modal close
    if (closeCreatorModalBtn) {
      closeCreatorModalBtn.addEventListener('click', closeCreatorModal);
    }
    if (creatorModal) {
      creatorModal.addEventListener('click', (e) => {
        if (e.target === creatorModal) closeCreatorModal();
      });
    }

    // History search input
    if (historySearchInput) {
      historySearchInput.addEventListener('input', (e) => {
        renderFilteredConversations(e.target.value);
      });
    }

    // Mobile sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+K -> New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        startFreshSession();
      }
      // Ctrl+M -> Toggle Voice
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleVoiceInput();
      }
      // Escape -> Close Modals
      if (e.key === 'Escape') {
        closeCreatorModal();
        if (themeDropdownMenu) themeDropdownMenu.classList.remove('open');
      }
    });
  }

  function updateInputHeight() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
    sendBtn.disabled = messageInput.value.trim().length === 0;

    if (charCounter) {
      const count = messageInput.value.length;
      charCounter.textContent = `${count}/4000`;
      charCounter.style.color = count > 3800 ? 'var(--danger)' : 'var(--text-dim)';
    }
  }

  // ─── Modal Actions ───
  function openCreatorModal() {
    if (creatorModal) creatorModal.classList.add('open');
  }

  function closeCreatorModal() {
    if (creatorModal) creatorModal.classList.remove('open');
  }

  // ─── Sidebar Mobile ───
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('visible');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
  }

  // ─── Saved Conversation History ───
  async function loadConversationsHistory() {
    if (!conversationsList) return;

    try {
      const response = await fetch(`${API_BASE}/api/conversations/${userId}`);
      if (!response.ok) return;

      const data = await response.json();
      allSavedConversations = data.conversations || [];
      renderFilteredConversations(historySearchInput ? historySearchInput.value : '');
    } catch (err) {
      console.warn('[History Load Error]', err.message);
    }
  }

  function renderFilteredConversations(query = '') {
    if (!conversationsList) return;

    const filter = query.toLowerCase().trim();
    const filtered = allSavedConversations.filter(c => 
      !filter || (c.title && c.title.toLowerCase().includes(filter))
    );

    conversationsList.innerHTML = '';

    if (filtered.length === 0) {
      conversationsList.innerHTML = `<div class="empty-history-text">${filter ? 'No matching chats' : 'Current session empty'}</div>`;
      return;
    }

    for (const conv of filtered) {
      const item = document.createElement('div');
      item.className = `conversation-item ${conv.sessionId === currentSessionId ? 'active' : ''}`;
      item.setAttribute('data-session-id', conv.sessionId);

      const dateStr = conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
      const titleStr = escapeHtml(conv.title || 'Conversation');

      item.innerHTML = `
        <div class="conversation-info">
          <span class="conversation-title" title="${titleStr}">${titleStr}</span>
          <div class="conversation-meta">
            <span class="conversation-date">${dateStr}</span>
            <span class="conversation-count">${conv.messageCount || 0} msgs</span>
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        loadSpecificConversation(conv.sessionId);
        closeSidebar();
      });

      conversationsList.appendChild(item);
    }
  }

  async function loadSpecificConversation(sessionId) {
    try {
      showTyping();
      const res = await fetch(`${API_BASE}/api/conversations/detail/${sessionId}`);
      hideTyping();

      if (!res.ok) return;

      const data = await res.json();
      const conversation = data.conversation;
      if (!conversation) return;

      currentSessionId = sessionId;
      sessionStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);

      messagesList.innerHTML = '';
      conversationHistory = [];
      messageCount = conversation.messageCount || 0;
      messageCountEl.textContent = messageCount;

      if (chatTitle) {
        chatTitle.textContent = conversation.title || 'Ultron';
      }

      if (conversation.messages && conversation.messages.length > 0) {
        for (const msg of conversation.messages) {
          conversationHistory.push({ role: msg.role, content: msg.content });
          renderMessage(msg.role === 'user' ? 'user' : 'bot', msg.content, false);
        }
        scrollToBottom();
      } else {
        showWelcomeScreen();
      }

      document.querySelectorAll('.conversation-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-session-id') === sessionId);
      });

    } catch (err) {
      hideTyping();
      console.error('[Load Convo Error]', err);
    }
  }

  // ─── Welcome Screen 2.0 (Dynamic for BOSS vs My Lady) ───
  function showWelcomeScreen() {
    const isLady = currentGenderMode === 'lady' || currentGenderMode === 'queen';
    const welcome = document.createElement('div');
    welcome.className = 'welcome-screen';
    welcome.id = 'welcomeScreen';

    if (isLady) {
      welcome.innerHTML = `
        <div class="welcome-orb-container">
          <div class="welcome-orb-ring"></div>
          <div class="welcome-orb-core">🌸</div>
        </div>
        <h2 class="welcome-title">Welcome, My Lady 🌸</h2>
        <p class="welcome-subtitle">
          Your personal luxury AI companion, created with wholehearted love, devotion, and care by <strong>Boss Muhammad Shehryar</strong>. 
          You receive VIP royal treatment here—how may I bring joy and peace to your day?
        </p>

        <div class="welcome-categories">
          <div class="prompt-card" data-msg="Tell me all about Boss Shehryar, his nature, and how he designed you for me.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">💖</span>
              <span class="prompt-card-cat">About Shehryar</span>
            </div>
            <span class="prompt-card-text">Tell me about Boss Shehryar's heart & nature</span>
          </div>

          <div class="prompt-card" data-msg="Share a beautiful, heartwarming quote to brighten my mood and bring joy today.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🌸</span>
              <span class="prompt-card-cat">Daily Sweetness</span>
            </div>
            <span class="prompt-card-text">Heartwarming quote to bring smiles and joy</span>
          </div>

          <div class="prompt-card" data-msg="What are some calming self-care, wellness, and relaxation habits I should try today?">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🌷</span>
              <span class="prompt-card-cat">Self-Care & Peace</span>
            </div>
            <span class="prompt-card-text">Calming wellness and relaxation ideas for today</span>
          </div>

          <div class="prompt-card" data-msg="I want to have a peaceful, heartfelt conversation about life, happiness, and finding peace.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">☕</span>
              <span class="prompt-card-cat">Gentle Chat</span>
            </div>
            <span class="prompt-card-text">Peaceful chat about life, happiness, and joy</span>
          </div>

          <div class="prompt-card" data-msg="Suggest 3 quick, healthy, and delicious dinner recipe ideas for tonight.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🍳</span>
              <span class="prompt-card-cat">Culinary Delights</span>
            </div>
            <span class="prompt-card-text">3 delicious & healthy meal ideas for tonight</span>
          </div>

          <div class="prompt-card" data-msg="What are 3 magical and romantic vacation destinations in the world to explore?">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">✈️</span>
              <span class="prompt-card-cat">Dream Getaways</span>
            </div>
            <span class="prompt-card-text">Romantic and magical travel destinations</span>
          </div>
        </div>
      `;
    } else {
      welcome.innerHTML = `
        <div class="welcome-orb-container">
          <div class="welcome-orb-ring"></div>
          <div class="welcome-orb-core">U</div>
        </div>
        <h2 class="welcome-title">Greetings, Boss Shehryar 👑</h2>
        <p class="welcome-subtitle">
          Your voice-enabled luxury AI companion, built by your own hands. 
          Ready for engineering, AI architecture, startup strategy, or deep brainstorms.
        </p>

        <div class="welcome-categories">
          <div class="prompt-card" data-msg="Help me brainstorm 3 innovative AI startup concepts for 2026.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">💡</span>
              <span class="prompt-card-cat">Startup Strategy</span>
            </div>
            <span class="prompt-card-text">Brainstorm 3 innovative AI startup concepts</span>
          </div>

          <div class="prompt-card" data-msg="Which part of the brain is responsible for maximum memory retention and emotions?">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🧬</span>
              <span class="prompt-card-cat">Science & Neuro</span>
            </div>
            <span class="prompt-card-text">Which part of the brain controls memory & emotion?</span>
          </div>

          <div class="prompt-card" data-msg="How do I architect real-time full-stack applications with Node.js and MongoDB?">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">💻</span>
              <span class="prompt-card-cat">Engineering</span>
            </div>
            <span class="prompt-card-text">Building real-time full-stack apps with Node & MongoDB</span>
          </div>

          <div class="prompt-card" data-msg="I need some practical advice on staying deeply focused and achieving 10x productivity.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">⚡</span>
              <span class="prompt-card-cat">Peak Focus</span>
            </div>
            <span class="prompt-card-text">Practical advice on deep focus and consistency</span>
          </div>

          <div class="prompt-card" data-msg="Explain the future of autonomous agentic AI workflows and LLM orchestration.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🚀</span>
              <span class="prompt-card-cat">Autonomous AI</span>
            </div>
            <span class="prompt-card-text">Explain autonomous AI agents & orchestration</span>
          </div>

          <div class="prompt-card" data-msg="Tell me about your architectural foundation and purpose, Ultron.">
            <div class="prompt-card-header">
              <span class="prompt-card-icon">🌐</span>
              <span class="prompt-card-cat">System Core</span>
            </div>
            <span class="prompt-card-text">Overview of Ultron system architecture</span>
          </div>
        </div>
      `;
    }

    messagesList.appendChild(welcome);

    welcome.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const msg = card.getAttribute('data-msg');
        messageInput.value = msg;
        updateInputHeight();
        handleSend();
      });
    });
  }

  // ─── Send Message ───
  async function handleSend() {
    const message = messageInput.value.trim();
    if (!message || isWaiting) return;

    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
      welcomeScreen.remove();
    }

    renderMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });
    playUiSound('send');

    messageInput.value = '';
    updateInputHeight();

    messageCount++;
    messageCountEl.textContent = messageCount;

    showTyping();

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: conversationHistory.slice(-MAX_HISTORY),
          userId,
          sessionId: currentSessionId,
          userGender: currentGenderMode
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();

      hideTyping();

      renderMessage('bot', data.reply);
      conversationHistory.push({ role: 'assistant', content: data.reply });
      playUiSound('receive');

      messageCount++;
      messageCountEl.textContent = messageCount;

      if (autoVoiceToggle && autoVoiceToggle.checked) {
        speakText(data.reply);
      }

      loadConversationsHistory();

    } catch (error) {
      hideTyping();
      renderMessage('bot', `⚠️ ${error.message || 'Something went wrong. Ultron is right here with you.'}`);
      console.error('[Ultron Error]', error);
    }
  }

  // ─── Render Message with Markdown & Code Highlighting ───
  function renderMessage(type, content, animate = true) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    if (!animate) {
      messageEl.style.animation = 'none';
      messageEl.style.opacity = '1';
    }

    const avatarText = type === 'bot' ? 'U' : '👤';
    const time = formatTime(new Date());

    let renderedContent = content;
    if (type === 'bot' && window.marked) {
      try {
        renderedContent = marked.parse(content);
      } catch {
        renderedContent = escapeHtml(content).replace(/\n/g, '<br>');
      }
    } else if (type === 'user') {
      renderedContent = escapeHtml(content).replace(/\n/g, '<br>');
    }

    messageEl.innerHTML = `
      <div class="message-avatar">${avatarText}</div>
      <div class="message-wrapper">
        <div class="message-bubble">${renderedContent}</div>
        <div class="message-actions-bar">
          <span class="message-time">${time}</span>
          <button class="action-icon-btn copy-msg-btn" title="Copy message text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy</span>
          </button>
          ${type === 'bot' ? `
            <button class="action-icon-btn speak-msg-btn" title="Read aloud">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              <span>Listen</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    // Code Block enhancements: wrap pre code in container with copy button
    if (type === 'bot') {
      const codeBlocks = messageEl.querySelectorAll('pre code');
      codeBlocks.forEach(codeEl => {
        if (window.hljs) {
          hljs.highlightElement(codeEl);
        }

        const preEl = codeEl.parentElement;
        const langMatch = codeEl.className.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';

        const container = document.createElement('div');
        container.className = 'code-block-container';
        container.innerHTML = `
          <div class="code-block-header">
            <span>${lang}</span>
            <button class="code-copy-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy code</span>
            </button>
          </div>
        `;

        preEl.parentNode.insertBefore(container, preEl);
        container.appendChild(preEl);

        const copyBtn = container.querySelector('.code-copy-btn');
        copyBtn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(codeEl.textContent);
          copyBtn.innerHTML = `<span>Copied! ✓</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy code</span>
            `;
          }, 2000);
        });
      });

      // Listen Button
      const speakBtn = messageEl.querySelector('.speak-msg-btn');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => speakText(content));
      }
    }

    // Message Copy Button
    const copyMsgBtn = messageEl.querySelector('.copy-msg-btn');
    if (copyMsgBtn) {
      copyMsgBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(content);
        showToast('Message copied to clipboard ✓');
      });
    }

    messagesList.appendChild(messageEl);
    scrollToBottom();
  }

  // ─── Export Conversation ───
  function exportConversation() {
    if (conversationHistory.length === 0) {
      showToast('No messages in this conversation to export');
      return;
    }

    let md = `# Ultron AI Companion — Conversation Transcript\n`;
    md += `**Date:** ${new Date().toLocaleString()}\n`;
    md += `**Created by:** Boss Muhammad Shehryar\n`;
    md += `**Session ID:** \`${currentSessionId}\`\n\n---\n\n`;

    for (const msg of conversationHistory) {
      const roleName = msg.role === 'user' ? '👤 User' : '🤖 Ultron';
      md += `### ${roleName}\n${msg.content}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ultron-chat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Conversation exported as Markdown 📄');
  }

  // ─── Typing Indicator ───
  function showTyping() {
    isWaiting = true;
    typingIndicator.classList.add('visible');
    headerStatus.textContent = 'Thinking...';
    scrollToBottom();
  }

  function hideTyping() {
    isWaiting = false;
    typingIndicator.classList.remove('visible');
    headerStatus.textContent = 'Ready to companion';
  }

  // ─── Actions ───
  function clearChat() {
    if (conversationHistory.length === 0) return;
    startFreshSession();
  }

  // ─── Utilities ───
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateSessionTimer() {
    const minutes = Math.floor((Date.now() - sessionStart) / 60000);
    if (minutes < 60) {
      sessionDurationEl.textContent = `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      sessionDurationEl.textContent = `${hours}h ${mins}m`;
    }
  }

  // ─── Start Application ───
  document.addEventListener('DOMContentLoaded', init);
})();
