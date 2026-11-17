const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatMessages = document.getElementById("chatMessages");
const chatStage = document.getElementById("chatStage");
const welcomeScreen = document.getElementById("welcomeScreen");
const newChatBtn = document.getElementById("newChatBtn");
const sendBtn = document.getElementById("sendBtn");
const suggestionCards = document.querySelectorAll(".suggestion-card");

let chatHistory = [];

function scrollToBottom() {
  chatStage.scrollTop = chatStage.scrollHeight;
}

function appendUserMessage(text) {
  welcomeScreen.classList.add("hidden");
  const div = document.createElement("div");
  div.className = "user-turn";
  div.textContent = text;
  chatMessages.appendChild(div);
  scrollToBottom();
}

function appendBotTurn() {
  const turn = document.createElement("div");
  turn.className = "bot-turn";

  const avatar = document.createElement("div");
  avatar.className = "sparkle-avatar thinking";
  avatar.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#34d399">
      <path d="M12 2C12.4 7.2 16.8 11.6 22 12C16.8 12.4 12.4 16.8 12 22C11.6 16.8 7.2 12.4 2 12C7.2 11.6 11.6 7.2 12 2Z" />
    </svg>
  `;

  const content = document.createElement("div");
  content.className = "bot-content";
  content.textContent = "Sedang berpikir...";

  turn.appendChild(avatar);
  turn.appendChild(content);
  chatMessages.appendChild(turn);
  scrollToBottom();

  return { avatar, content };
}

async function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  appendUserMessage(cleanText);
  chatHistory.push({ role: "user", content: cleanText });

  userInput.value = "";
  sendBtn.disabled = true;

  const { avatar, content } = appendBotTurn();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: chatHistory }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      avatar.classList.remove("thinking");
      content.textContent = `Error: ${errData.error || "Gagal terhubung ke AI"}`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullReply = "";
    let isFirstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const chunk = JSON.parse(data);
          if (isFirstChunk) {
            content.textContent = "";
            isFirstChunk = false;
          }
          fullReply += chunk;
          content.textContent = fullReply;
          scrollToBottom();
        } catch (err) {
          console.error("Gagal parsing chunk:", err);
        }
      }
    }

    avatar.classList.remove("thinking");
    if (fullReply) {
      chatHistory.push({ role: "assistant", content: fullReply });
    }
  } catch (error) {
    avatar.classList.remove("thinking");
    content.textContent = "Terjadi kesalahan koneksi ke server.";
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(userInput.value);
});

suggestionCards.forEach((card) => {
  card.addEventListener("click", () => {
    const prompt = card.getAttribute("data-prompt");
    sendMessage(prompt);
  });
});

newChatBtn.addEventListener("click", () => {
  chatHistory = [];
  chatMessages.innerHTML = "";
  welcomeScreen.classList.remove("hidden");
  userInput.focus();
});
