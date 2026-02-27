let treeData = [];
let masterData = [];
let audioData = {};
let treeVersion = "";

let activeBtn = null;
let currentAudio = null;
let isLooping = false;

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");
const loopToggle = document.getElementById("loop-toggle");

/* =========================
   ループ切替
========================= */
loopToggle.addEventListener("change", () => {
    isLooping = loopToggle.checked;
    if (currentAudio) currentAudio.loop = isLooping;
    loopToggle.classList.toggle("checked", isLooping);
});

/* =========================
   初期化（マスター優先方式）
========================= */
async function init() {
    try {
        const treeJson = await fetch("data/tree.json").then(r => r.json());
        treeVersion = treeJson.version;
        masterData = treeJson.data;

        audioData = await fetch("data/audio.json").then(r => r.json());

        // マスターをコピー
        treeData = structuredClone(masterData);

        // UI状態だけ復元
        loadUIState();

    } catch (error) {
        console.error("データ読み込み失敗", error);
    }

    renderTree(treeData, sidebar);
}
init();

/* =========================
   ツリー描画
========================= */
function renderTree(nodes, parent, path = []) {
    nodes.forEach((node, index) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = node.title;

        const currentPath = [...path, index];
        parent.appendChild(btn);

        if (node.children) {
            const submenu = document.createElement("div");
            submenu.className = "submenu";
            parent.appendChild(submenu);

            btn.onclick = () => {
                submenu.classList.toggle("open");
                node.open = submenu.classList.contains("open");
                saveUIState();
            };

            if (node.open) submenu.classList.add("open");

            renderTree(node.children, submenu, currentPath);
        } else {
            btn.onclick = () => {
                activate(btn);
                showAudio(node.id);
            };
        }
    });
}

/* =========================
   音声表示
========================= */
function showAudio(id) {
    content.innerHTML = "";
    const list = audioData[id] || [];

    list.forEach(item => {
        const b = document.createElement("button");
        b.className = "audio-btn";
        b.textContent = item.title;

        b.onclick = () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
                return;
            }

            currentAudio = new Audio(item.file);
            currentAudio.loop = isLooping;
            currentAudio.play();
            currentAudio.onended = () => currentAudio = null;
        };

        content.appendChild(b);
    });
}

/* =========================
   アクティブ表示
========================= */
function activate(btn) {
    if (activeBtn) activeBtn.classList.remove("active");
    btn.classList.add("active");
    activeBtn = btn;
}

/* =========================
   UI状態保存（開閉のみ）
========================= */
function saveUIState() {
    const state = {
        version: treeVersion,
        openState: extractOpenState(treeData)
    };
    localStorage.setItem("treeUIState", JSON.stringify(state));
}

/* =========================
   UI状態読込
========================= */
function loadUIState() {
    const saved = localStorage.getItem("treeUIState");
    if (!saved) return;

    const parsed = JSON.parse(saved);

    // バージョン違いなら破棄
    if (parsed.version !== treeVersion) {
        localStorage.removeItem("treeUIState");
        return;
    }

    applyOpenState(treeData, parsed.openState);
}

/* =========================
   開閉状態抽出
========================= */
function extractOpenState(nodes) {
    return nodes.map(node => ({
        open: node.open || false,
        children: node.children ? extractOpenState(node.children) : null
    }));
}

/* =========================
   開閉状態適用
========================= */
function applyOpenState(nodes, state) {
    if (!state) return;

    nodes.forEach((node, i) => {
        if (!state[i]) return;

        node.open = state[i].open;

        if (node.children && state[i].children) {
            applyOpenState(node.children, state[i].children);
        }
    });
}