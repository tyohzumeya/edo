let treeData = [];
let audioData = {};
let activeBtn = null;
let currentAudio = null;
let isLooping = false;  // ループ設定を管理する変数

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");

// ループ切替スイッチの初期化
const loopToggle = document.getElementById("loop-toggle");
loopToggle.addEventListener('change', () => {
    isLooping = loopToggle.checked;  // ループ状態を更新
    if (currentAudio) {
        currentAudio.loop = isLooping;  // 音声のループ設定を変更
    }
});

/* ===== 初期化 ===== */
async function init() {
    try {
        // データの非同期取得
        treeData = await fetch("data/tree.json").then(r => r.json());
        audioData = await fetch("data/audio.json").then(r => r.json());
    } catch (error) {
        console.error("データの読み込みに失敗しました", error);
    }

    // localStorage から状態復元
    loadState();
    // ツリーを描画
    renderTree(treeData, sidebar);
}
init();

/* ===== ツリー描画 ===== */
function renderTree(nodes, parent, path = []) {
    nodes.forEach((node, index) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = node.title;
        btn.draggable = true;

        const currentPath = [...path, index];
        btn.dataset.path = JSON.stringify(currentPath);
        parent.appendChild(btn);

        /* ドラッグ操作 */
        btn.ondragstart = e => {
            e.dataTransfer.setData("text/plain", btn.dataset.path);
        };

        btn.ondragover = e => e.preventDefault();

        btn.ondrop = e => {
            e.preventDefault();
            const fromPath = JSON.parse(e.dataTransfer.getData("text/plain"));
            const toPath = currentPath;
            reorder(treeData, fromPath, toPath);
            saveState();
            refresh();
        };

        /* 子要素があれば再帰的に描画 */
        if (node.children) {
            const submenu = document.createElement("div");
            submenu.className = "submenu";
            parent.appendChild(submenu);

            // 展開状態の設定
            btn.onclick = () => {
                submenu.classList.toggle("open");
                node.open = submenu.classList.contains("open");
                saveState();
            };

            // 展開状態を復元
            if (node.open) submenu.classList.add("open");

            renderTree(node.children, submenu, currentPath);
        } else {
            // 音声ボタン
            btn.onclick = () => {
                activate(btn);
                showAudio(node.id);
                expandParents(currentPath);
            };
        }
    });
}

/* ===== 並び替え ===== */
function reorder(data, fromPath, toPath) {
    const fromParent = getParent(data, fromPath);
    const toParent = getParent(data, toPath);

    if (JSON.stringify(fromParent) !== JSON.stringify(toParent)) return;

    const fromIndex = fromPath.at(-1);
    const toIndex = toPath.at(-1);

    const moved = fromParent.splice(fromIndex, 1)[0];
    fromParent.splice(toIndex, 0, moved);
}

/* ===== 親取得 ===== */
function getParent(data, path) {
    let ref = data;
    for (let i = 0; i < path.length - 1; i++) {
        ref = ref[path[i]].children;
    }
    return ref;
}

/* ===== 親自動展開 ===== */
function expandParents(path) {
    let ref = treeData;
    for (let i = 0; i < path.length - 1; i++) {
        ref[path[i]].open = true;
        ref = ref[path[i]].children;
    }
    saveState();
    refresh();
}

/* ===== アクティブ ===== */
function activate(btn) {
    if (activeBtn) activeBtn.classList.remove("active");
    btn.classList.add("active");
    activeBtn = btn;
}

/* ===== 音声表示 ===== */
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
            } else {
                currentAudio = new Audio(item.file);
                currentAudio.loop = isLooping;  // ループ設定を適用
                currentAudio.play();
                currentAudio.onended = () => currentAudio = null;
            }
        };

        content.appendChild(b);
    });
}

/* ===== 状態保存 ===== */
function saveState() {
    localStorage.setItem("treeState", JSON.stringify(treeData));
}

/* ===== 状態復元 ===== */
function loadState() {
    const saved = localStorage.getItem("treeState");
    if (saved) treeData = JSON.parse(saved);
}

/* ===== 再描画 ===== */
function refresh() {
    sidebar.innerHTML = "";
    renderTree(treeData, sidebar);
}