// ===============================
// NV-Control Panel Script
// ===============================

// URL DO WORKER NV-ENAVIA
const BASE_URL = "https://nv-enavia.brunovasque.workers.dev";

// DOM Elements
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const messagesDiv = document.getElementById("messages");
const statusBadge = document.getElementById("statusBadge");

// ===============================
// FUNÇÃO: Atualiza o badge de status
// ===============================
function setStatus(type, text) {
    statusBadge.className = ""; // limpa classes
    statusBadge.classList.add("badge");

    if (type === "ok") statusBadge.classList.add("green");
    if (type === "warn") statusBadge.classList.add("yellow");
    if (type === "error") statusBadge.classList.add("red");

    statusBadge.innerText = text;
}

// ===============================
// FUNÇÃO: adiciona mensagem no chat
// ===============================
function addMessage(sender, text, color = "#fff") {
    const msg = document.createElement("div");
    msg.classList.add("message");

    msg.innerHTML = `
        <strong style="color:${color}">${sender}:</strong><br>
        <span>${text}</span>
    `;

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ===============================
// FUNÇÃO: Envia mensagem ao Worker
// ===============================
async function sendToWorker(endpoint, payload) {
    try {
        setStatus("warn", "Processando...");

        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            setStatus("error", "Erro na resposta");
            addMessage("Erro", JSON.stringify(data, null, 2), "red");
            return null;
        }

        setStatus("ok", "OK");
        return data;

    } catch (err) {
        setStatus("error", "Falha de conexão");
        addMessage("Sistema", `Erro: ${err.message}`, "red");
        return null;
    }
}

// ===============================
// EVENTO: Enviar mensagem do usuário
// ===============================
sendBtn.addEventListener("click", async () => {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage("Você", text, "#00d0ff");
    userInput.value = "";

    // Detecta automaticamente modo engenheiro
    let endpoint = "/";
    let payload = { message: text };

    if (text.startsWith("ENAVIA,") || text.startsWith("{")) {
        endpoint = "/engineer";
        payload = { action: text };
    }

    const result = await sendToWorker(endpoint, payload);

    if (!result) return;

    // cor dependendo do ok
    const color = result.ok ? "lightgreen" : "red";

    addMessage(
        "ENAVIA",
        JSON.stringify(result, null, 2),
        color
    );
});

// ENTER para enviar
userInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendBtn.click();
});
