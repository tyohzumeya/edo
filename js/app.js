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
   ループ
========================= */
loopToggle.addEventListener("change", () => {
    isLooping = loopToggle.checked;
    if (currentAudio) currentAudio.loop = isLooping;
});

/* =========================
   初期化
========================= */
async function init() {
    const treeJson = await fetch("data/tree.json").then(r => r.json());
    treeVersion = treeJson.version;
    masterData = treeJson.data;

    audioData = await fetch("data/audio.json").then(r => r.json());

    const saved = loadSavedTree();

    if (saved) {
        treeData = mergeWithMaster(masterData, saved);
    } else {
        treeData = structuredClone(masterData);
    }

    renderTree(treeData, sidebar);
}
init();

/* =========================
   マスターとマージ
========================= */
function mergeWithMaster(master, saved) {

    const masterMap = new Map(master.map(n => [n.id, n]));
    const savedMap  = new Map(saved.map(n => [n.id, n]));

    const result = [];

    // ① 保存順を優先
    for (const savedNode of saved) {
        const masterNode = masterMap.get(savedNode.id);
        if (!masterNode) continue; // マスターにない → 削除

        const newNode = structuredClone(masterNode);
        newNode.open = savedNode.open;

        if (masterNode.children) {
            newNode.children = mergeWithMaster(
                masterNode.children,
                savedNode.children || []
            );
        }

        result.push(newNode);
    }

    // ② マスターにあって保存にないものは最後尾追加
    for (const masterNode of master) {
        if (!savedMap.has(masterNode.id)) {
            result.push(structuredClone(masterNode));
        }
    }

    return result;
}

/* =========================
   保存
========================= */
function saveTree() {
    localStorage.setItem("treeSaved", JSON.stringify(treeData));
}

/* =========================
   読み込み
========================= */
function loadSavedTree() {
    const saved = localStorage.getItem("treeSaved");
    if (!saved) return null;
    return JSON.parse(saved);
}

/* =========================
   ツリー描画
========================= */
function renderTree(nodes, parent, path = []) {
    nodes.forEach((node, index) => {
        const btn = document.createElement("button");
        btn.className = "menu-item";
        btn.textContent = node.title;
        btn.draggable = true;

        const currentPath = [...path, index];
        btn.dataset.path = JSON.stringify(currentPath);
        parent.appendChild(btn);

        /* ドラッグ */
        btn.ondragstart = e => {
            e.dataTransfer.setData("text/plain", btn.dataset.path);
        };

        btn.ondragover = e => e.preventDefault();

        btn.ondrop = e => {
            e.preventDefault();
            const fromPath = JSON.parse(e.dataTransfer.getData("text/plain"));
            reorder(treeData, fromPath, currentPath);
            saveTree();
            refresh();
        };

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
            btn.onclick = () => {
                activate(btn);
                showAudio(node.id);
            };
        }
    });
}

/* =========================
   並び替え
========================= */
function reorder(data, fromPath, toPath) {
    const fromParent = getParent(data, fromPath);
    const toParent = getParent(data, toPath);

    if (fromParent !== toParent) return;

    const fromIndex = fromPath.at(-1);
    const toIndex = toPath.at(-1);

    const moved = fromParent.splice(fromIndex, 1)[0];
    fromParent.splice(toIndex, 0, moved);
}

function getParent(data, path) {
    let ref = data;
    for (let i = 0; i < path.length - 1; i++) {
        ref = ref[path[i]].children;
    }
    return ref;
}

/* =========================
   音声
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

/* ========================= */
function activate(btn) {
    if (activeBtn) activeBtn.classList.remove("active");
    btn.classList.add("active");
    activeBtn = btn;
}

function refresh() {
    sidebar.innerHTML = "";
    renderTree(treeData, sidebar);
}