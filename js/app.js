// グローバル
let treeData = [];
let masterData = [];
let audioData = {};
let activeBtn = null;
let currentAudio = null;

// ループ・音量・速度
let isLooping = false;
let currentVolume = 1;
let currentSpeed = 1;

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("center-panel");

const loopToggle = document.getElementById("loop-toggle");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");

// ===== 初期化 =====
async function init() {
    masterData = (await fetch("data/tree.json").then(r=>r.json())).data;
    audioData = await fetch("data/audio.json").then(r=>r.json());

    const saved = loadSavedTree();
    treeData = saved ? mergeWithMaster(masterData,saved) : structuredClone(masterData);

    const savedLoop = localStorage.getItem("loopState");
    isLooping = savedLoop !== null ? savedLoop === "true" : false;
    loopToggle.checked = isLooping;

    const savedVolume = localStorage.getItem("volumeValue");
    currentVolume = savedVolume !== null ? parseFloat(savedVolume) : 1;
    volumeSlider.value = currentVolume;
    volumeValue.textContent = currentVolume.toFixed(2);

    const savedSpeed = localStorage.getItem("speedValue");
    currentSpeed = savedSpeed !== null ? parseFloat(savedSpeed) : 1;
    speedSlider.value = currentSpeed;
    speedValue.textContent = currentSpeed + "x";

    refresh();
}

// ===== localStorage =====
function saveTree(){ localStorage.setItem("treeSaved", JSON.stringify(treeData)); }
function loadSavedTree(){ const s=localStorage.getItem("treeSaved"); return s?JSON.parse(s):null; }

// ===== ループ・音量・速度変更 =====
loopToggle.addEventListener("change", ()=>{
    isLooping = loopToggle.checked;
    if(currentAudio) currentAudio.loop = isLooping;
    localStorage.setItem("loopState", isLooping);
});

volumeSlider.addEventListener("input", ()=>{
    currentVolume = parseFloat(volumeSlider.value);
    if(currentAudio) currentAudio.volume = currentVolume;
    volumeValue.textContent = currentVolume.toFixed(2);
    localStorage.setItem("volumeValue", currentVolume);
});

speedSlider.addEventListener("input", ()=>{
    currentSpeed = parseFloat(speedSlider.value);
    speedValue.textContent = currentSpeed + "x";
    if(currentAudio) currentAudio.playbackRate = currentSpeed;
    localStorage.setItem("speedValue", currentSpeed);
});

// ===== ツリー描画 =====
function renderTree(nodes,parent,path=[]){
    nodes.forEach((node,index)=>{
        const btn=document.createElement("button");
        btn.className="menu-item";
        btn.textContent=node.title;
        btn.draggable=true;
        const currentPath=[...path,index];
        btn.dataset.path=JSON.stringify(currentPath);
        parent.appendChild(btn);

        if(!node.children && node.id){
            const img=document.createElement("img");
            img.src=`images/${node.id}.png`;
            img.alt=node.title;
            img.classList.add("tree-icon");
            img.onerror=()=>img.remove();
            btn.prepend(img);
        }

        btn.ondragstart=e=>e.dataTransfer.setData("text/plain",btn.dataset.path);
        btn.ondragover=e=>e.preventDefault();
        btn.ondrop=e=>{
            e.preventDefault();
            const fromPath=JSON.parse(e.dataTransfer.getData("text/plain"));
            reorder(treeData,fromPath,currentPath);
            saveTree();
            refresh();
        };

        if(node.children){
            const submenu=document.createElement("div");
            submenu.className="submenu";
            parent.appendChild(submenu);

            btn.onclick=()=>{
                submenu.classList.toggle("open");
                node.open=submenu.classList.contains("open");
                saveTree();
            };
            if(node.open) submenu.classList.add("open");

            renderTree(node.children,submenu,currentPath);
        }else{
            btn.onclick=()=>{
                activate(btn);
                showAudio(node.id);
            };
        }
    });
}

// ===== 並び替え =====
function reorder(data,fromPath,toPath){
    const fromParent=getParent(data,fromPath);
    const toParent=getParent(data,toPath);
    if(fromParent!==toParent) return;
    const fromIndex=fromPath.at(-1);
    const toIndex=toPath.at(-1);
    const moved=fromParent.splice(fromIndex,1)[0];
    fromParent.splice(toIndex,0,moved);
}

function getParent(data,path){
    let ref=data;
    for(let i=0;i<path.length-1;i++) ref=ref[path[i]].children;
    return ref;
}

// ===== 音声表示 =====
function showAudio(id){
    content.innerHTML="";
    const list=audioData[id]||[];
    list.forEach(item=>{
        const b=document.createElement("button");
        b.className="audio-btn";
        b.textContent=item.title;
        b.onclick=()=>{
            if(!currentSpeed||isNaN(currentSpeed)||currentSpeed<=0) return;
            if(currentAudio){currentAudio.pause(); currentAudio=null; return;}
            currentAudio=new Audio(item.file);
            currentAudio.loop=isLooping;
            currentAudio.volume=currentVolume;
            currentAudio.playbackRate=currentSpeed;
            currentAudio.play();
            currentAudio.onended=()=>currentAudio=null;
        };
        content.appendChild(b);
    });
}

// ===== アクティブ表示 =====
function activate(btn){ if(activeBtn) activeBtn.classList.remove("active"); btn.classList.add("active"); activeBtn=btn; }

// ===== 再描画 =====
function refresh(){ sidebar.innerHTML=""; renderTree(treeData,sidebar); }

// ===== 初期化呼び出し =====
init();