/**
 * Ultron — Guardrails Engine
 * Crisis detection and safety response system.
 * 
 * When someone mentions self-harm, suicide, or crisis situations,
 * Ultron responds with real resources instead of trying to "handle" it.
 */

// Crisis keywords and patterns (case-insensitive matching)
const CRISIS_PATTERNS = [
  // Direct mentions
  /\b(suicid|kill\s*(my)?self|end\s*(my\s*)?life|want\s*to\s*die)\b/i,
  /\b(self[- ]?harm|cut(ting)?\s*myself|hurt(ing)?\s*myself)\b/i,
  /\b(don'?t\s*want\s*to\s*(live|be\s*alive|exist))\b/i,
  /\b(no\s*reason\s*to\s*live|better\s*off\s*dead)\b/i,
  /\b(overdose|jump\s*off|hang\s*myself)\b/i,
  
  // Abuse situations
  /\b(being\s*(abused|beaten|hit|raped))\b/i,
  /\b(domestic\s*violence|sexual\s*assault)\b/i,
  
  // Severe distress signals
  /\b(can'?t\s*go\s*on|can'?t\s*take\s*(it|this)\s*(any\s*)?more)\b/i,
  /\b(planning\s*to\s*(end|kill|hurt))\b/i,
];

// Real crisis resources
const CRISIS_RESOURCES = {
  message: `🆘 **I care about you, and I want to make sure you're safe.**

I noticed something in your message that I want to take seriously. If you or someone you know is in crisis, **please reach out to trained professionals who can really help:**

🌍 **International:**
- **Crisis Text Line:** Text HOME to 741741
- **Befrienders Worldwide:** https://befrienders.org

🇺🇸 **United States:**
- **988 Suicide & Crisis Lifeline:** Call or text **988**
- **Crisis Text Line:** Text HOME to **741741**

🇵🇰 **Pakistan:**
- **Umang Helpline:** 0311-7786264
- **Rozan Counseling:** 0800-22-444

🇬🇧 **United Kingdom:**
- **Samaritans:** Call **116 123** (free, 24/7)

💙 **You are not alone. These people are trained to listen and help — no judgment.**

---

*I'm still here to talk, but a real human can provide the support you deserve right now.*`,
  
  isCrisis: true
};

/**
 * Check if a message contains crisis-related content.
 * @param {string} message - The user's message
 * @returns {{ isCrisis: boolean, crisisResponse: string|null }}
 */
function checkForCrisis(message) {
  if (!message || typeof message !== 'string') {
    return { isCrisis: false, crisisResponse: null };
  }

  const normalizedMessage = message.toLowerCase().trim();

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        isCrisis: true,
        crisisResponse: CRISIS_RESOURCES.message
      };
    }
  }

  return { isCrisis: false, crisisResponse: null };
}

/**
 * Build a crisis-aware system prompt addition.
 * When crisis is detected, this instructs the LLM to be extra careful.
 */
function getCrisisSystemAddendum() {
  return `\n\n## CRISIS DETECTED — SPECIAL INSTRUCTIONS
The user's message may indicate they are in crisis or distress. Follow these rules STRICTLY:
- Be gentle, warm, and present
- Do NOT try to counsel, diagnose, or "fix" the situation
- Do NOT say "I understand" or minimize their pain
- Acknowledge their feelings simply and honestly
- The crisis resources have already been shown to them — you don't need to repeat them
- Keep your response SHORT (2-3 sentences max)
- Just be human. Be there.`;
}

module.exports = { checkForCrisis, getCrisisSystemAddendum };
