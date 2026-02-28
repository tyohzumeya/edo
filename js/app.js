// ===== グローバル =====
let treeData = [];
let masterData = [];
let audioData = {};
let activeBtn = null;
let currentAudio = null;
let isLooping = false;

let queue = [];
let isPlayingQueue = false;
let stopRequested = false;

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");
const loopToggle = document.getElementById("loop-toggle");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const queueList = document.getElementById("queue-list");

// ===== localStorage ツリー保存 =====
function saveTree() {
    localStorage.setItem("treeSaved", JSON.stringify(treeData));
}

function loadSavedTree() {
    const saved = localStorage.getItem("treeSaved");
    return saved ? JSON.parse(saved) : null;
}

// ===== マスターと保存データをマージ =====
function mergeWithMaster(master, saved) {
    const masterMap = new Map(master.map(n => [n.id, n]));
    const savedMap = new Map(saved.map(n => [n.id, n]));

    const result = [];

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

    for (const masterNode of master) {
        if (!savedMap.has(masterNode.id)) result.push(structuredClone(masterNode));
    }

    return result;
}

// ===== 初期化 =====
async function init() {
    const treeJson = await fetch("data/tree.json").then(r => r.json());
    masterData = treeJson.data;
    audioData = await fetch("data/audio.json").then(r => r.json());

    const saved = loadSavedTree();
    treeData = saved ? mergeWithMaster(masterData, saved) : structuredClone(masterData);

    // 再生速度初期化
    const savedSpeed = localStorage.getItem("speedValue");
    if (savedSpeed) speedSlider.value = savedSpeed;
    speedValue.textContent = speedSlider.value + "x";

    // 音量初期化
    const savedVolume = localStorage.getItem("volumeValue");
    if (savedVolume) volumeSlider.value = savedVolume;
    volumeValue.textContent = Math.round(volumeSlider.value * 100) + "%";

    // ループ初期化
    const savedLoop = localStorage.getItem("loopState");
    isLooping = savedLoop === "true";
    loopToggle.checked = isLooping;

    // キュー初期化
    loadQueue();
    renderQueue();

    // ツリー描画
    refresh();
}

// ===== ループ & 再生速度 & 音量 =====
loopToggle.addEventListener("change", () => {
    isLooping = loopToggle.checked;
    if (currentAudio) currentAudio.loop = isLooping;
    localStorage.setItem("loopState", isLooping);
});

speedSlider.addEventListener("input", () => {
    const speed = parseFloat(speedSlider.value);
    speedValue.textContent = speed + "x";
    if (currentAudio) currentAudio.playbackRate = speed;
    localStorage.setItem("speedValue", speed);
});

volumeSlider.addEventListener("input", () => {
    const vol = parseFloat(volumeSlider.value);
    volumeValue.textContent = Math.round(vol * 100) + "%";
    if (currentAudio) currentAudio.volume = vol;
    localStorage.setItem("volumeValue", vol);
});

// ===== ツリー描画 =====
function renderTree(nodes, parent = sidebar, path = []) {
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
            img.src = `images/${node.id}.png`;
            img.alt = node.title;
            img.classList.add("tree-icon");
            img.onerror = () => img.remove();
            btn.prepend(img);
        }

        // ドラッグ＆ドロップ
        btn.ondragstart = e => e.dataTransfer.setData("text/plain", btn.dataset.path);
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

        b.onclick = () => addToQueue(item.title, item.file);

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

// ===== キュー処理 =====
function addToQueue(title, file) {
    queue.push({ title, file, delay: 0 });
    saveQueue();
    renderQueue();
}

function renderQueue() {
    queueList.innerHTML = "";

    queue.forEach((item, index) => {
        const li = document.createElement("li");
        li.draggable = true;

        li.innerHTML = `
            <span>${item.title}</span>
            <input type="number" value="${item.delay}" min="0" step="0.5" style="width:60px">秒
        `;

        li.querySelector("input").onchange = e => {
            item.delay = parseFloat(e.target.value) || 0;
            saveQueue();
        };

        li.ondragstart = e => e.dataTransfer.setData("text/plain", index);
        li.ondragover = e => e.preventDefault();
        li.ondrop = e => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData("text/plain"));
            const moved = queue.splice(from, 1)[0];
            queue.splice(index, 0, moved);
            saveQueue();
            renderQueue();
        };

        queueList.appendChild(li);
    });
}

function saveQueue() {
    localStorage.setItem("audioQueue", JSON.stringify(queue));
}

function loadQueue() {
    const saved = localStorage.getItem("audioQueue");
    if (saved) queue = JSON.parse(saved);
}

// ===== 再生 =====
async function playAudio(file) {
    return new Promise(resolve => {
        currentAudio = new Audio(file);
        currentAudio.volume = parseFloat(volumeSlider.value);
        currentAudio.playbackRate = parseFloat(speedSlider.value);
        currentAudio.loop = false;
        currentAudio.play();
        currentAudio.onended = () => { currentAudio = null; resolve(); };
    });
}

document.getElementById("play-queue").onclick = async () => {
    if (isPlayingQueue || queue.length === 0) return;
    stopRequested = false;
    isPlayingQueue = true;

    for (let item of queue) {
        if (stopRequested) break;
        await playAudio(item.file);
        if (stopRequested) break;
        if (item.delay > 0)
            await new Promise(r => setTimeout(r, item.delay * 1000));
    }

    isPlayingQueue = false;
};

document.getElementById("stop-queue").onclick = () => {
    stopRequested = true;
    if (currentAudio) currentAudio.pause();
};

document.getElementById("clear-queue").onclick = () => {
    queue = [];
    saveQueue();
    renderQueue();
};

// ===== WAV書き出し =====
document.getElementById("export-queue").onclick = async () => {
    if (queue.length === 0) return;

    const fileName = prompt("保存ファイル名を入力してください", "queue_export");
    if (!fileName) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffers = [];

    for (let item of queue) {
        const response = await fetch(item.file);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers.push({ buffer: audioBuffer, delay: item.delay });
    }

    let totalLength = 0;
    for (let b of buffers) {
        totalLength += b.buffer.length;
        totalLength += Math.floor(audioContext.sampleRate * b.delay);
    }

    const outputBuffer = audioContext.createBuffer(2, totalLength, audioContext.sampleRate);
    let offset = 0;

    for (let item of buffers) {
        for (let ch = 0; ch < 2; ch++) {
            outputBuffer.getChannelData(ch).set(
                item.buffer.getChannelData(ch % item.buffer.numberOfChannels),
                offset
            );
        }
        offset += item.buffer.length;
        offset += Math.floor(audioContext.sampleRate * item.delay);
    }

    const wavBlob = bufferToWave(outputBuffer, totalLength);
    const url = URL.createObjectURL(wavBlob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName + ".wav";
    a.click();
    URL.revokeObjectURL(url);
};

// ===== WAV変換 =====
function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    let offset = 0;
    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });
}

// ===== 初期化呼び出し =====
init();