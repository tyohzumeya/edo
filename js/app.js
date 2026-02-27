// ===== グローバル変数 =====
let treeData = [];
let masterData = [];
let audioData = {};
let activeBtn = null;
let currentAudio = null;
let isLooping = false;

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");
const loopToggle = document.getElementById("loop-toggle");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");

// ===== ループトグル =====
loopToggle.addEventListener("change", () => {
    isLooping = loopToggle.checked;
    if (currentAudio) currentAudio.loop = isLooping;
});

// ===== 再生速度スライダー =====
speedSlider.addEventListener("input", () => {
    const speed = parseFloat(speedSlider.value);
    speedValue.textContent = speed + "x";
    if (currentAudio) currentAudio.playbackRate = speed;
});

// ===== 初期化 =====
async function init() {
    // JSON 読み込み
    const treeJson = await fetch("data/tree.json").then(r => r.json());
    masterData = treeJson.data;

    audioData = await fetch("data/audio.json").then(r => r.json());

    // 保存データの読み込み
    const saved = loadSavedTree();
    treeData = saved ? mergeWithMaster(masterData, saved) : structuredClone(masterData);

    // スライダー初期表示更新
    const speed = parseFloat(speedSlider.value);
    speedValue.textContent = speed + "x";
}

// ===== マスターと保存データをマージ =====
function mergeWithMaster(master, saved) {
    const masterMap = new Map(master.map(n => [n.id, n]));
    const savedMap = new Map(saved.map(n => [n.id, n]));

    const result = [];

    // 保存データ順にマスターをマージ
    for (const savedNode of saved) {
        const masterNode = masterMap.get(savedNode.id);
        if (!masterNode) continue;

        const newNode = structuredClone(masterNode);
        newNode.open = savedNode.open;

        if (masterNode.children) {
            newNode.children = mergeWithMaster(masterNode.children, savedNode.children || []);
        }

        result.push(newNode);
    }

    // マスターにあって保存にないものを追加
    for (const masterNode of master) {
        if (!savedMap.has(masterNode.id)) result.push(structuredClone(masterNode));
    }

    return result;
}

// ===== localStorage =====
function saveTree() {
    localStorage.setItem("treeSaved", JSON.stringify(treeData));
}

function loadSavedTree() {
    const saved = localStorage.getItem("treeSaved");
    return saved ? JSON.parse(saved) : null;
}

// ===== ツリー描画 =====
function renderTree(nodes, parent, path = []) {
    nodes.forEach((node, index) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = node.title;
        btn.draggable = true;

        const currentPath = [...path, index];
        btn.dataset.path = JSON.stringify(currentPath);
        parent.appendChild(btn);

        // 子要素のみ画像追加
        if (!node.children && node.id) {
            const img = document.createElement("img");
            img.src = `images/${node.id}.png`; // PNG対応
            img.alt = node.title;
            img.classList.add("tree-icon");
            img.onerror = () => img.remove();
            btn.prepend(img);
        }

        // ===== ドラッグ＆ドロップ =====
        btn.ondragstart = e => e.dataTransfer.setData("text/plain", btn.dataset.path);
        btn.ondragover = e => e.preventDefault();
        btn.ondrop = e => {
            e.preventDefault();
            const fromPath = JSON.parse(e.dataTransfer.getData("text/plain"));
            reorder(treeData, fromPath, currentPath);
            saveTree();
            refresh();
        };

        // ===== 子要素がある場合 =====
        if (node.children) {
            const submenu = document.createElement("div");
            submenu.className = "submenu";
            parent.appendChild(submenu);

            btn.onclick = () => {
                submenu.classList.toggle("open");
                node.open = submenu.classList.contains("open");
                saveTree();
            };

            if (node.open) submenu.classList.add("open");

            renderTree(node.children, submenu, currentPath);
        } else {
            // ===== 子要素ボタン（音声用） =====
            btn.onclick = () => {
                activate(btn);
                showAudio(node.id);
            };
        }
    });
}

// ===== 並び替え =====
function reorder(data, fromPath, toPath) {
    const fromParent = getParent(data, fromPath);
    const toParent = getParent(data, toPath);
    if (fromParent !== toParent) return;

    const fromIndex = fromPath.at(-1);
    const toIndex = toPath.at(-1);

    const moved = fromParent.splice(fromIndex, 1)[0];
    fromParent.splice(toIndex, 0, moved);
}

// ===== 親取得 =====
function getParent(data, path) {
    let ref = data;
    for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]].children;
    return ref;
}

// ===== 音声表示 =====
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
            currentAudio.playbackRate = parseFloat(speedSlider.value);
            currentAudio.play();
            currentAudio.onended = () => currentAudio = null;
        };

        content.appendChild(b);
    });
}

// ===== アクティブ表示 =====
function activate(btn) {
    if (activeBtn) activeBtn.classList.remove("active");
    btn.classList.add("active");
    activeBtn = btn;
}

// ===== 再描画 =====
function refresh() {
    sidebar.innerHTML = "";
    renderTree(treeData, sidebar);
}

// ===== 初期化呼び出し =====
init().then(() => refresh());