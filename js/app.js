// ===== グローバル =====
let treeData=[], masterData=[], audioData={}, activeBtn=null, currentAudio=null;
let queue=[], isPlayingQueue=false, stopRequested=false;

const sidebar=document.getElementById("sidebar");
const content=document.getElementById("content");
const loopToggle=document.getElementById("loop-toggle");
const volumeSlider=document.getElementById("volume-slider");
const volumeValue=document.getElementById("volume-value");
const queueList=document.getElementById("queue-list");

// ===== localStorage =====
function saveTree(){ localStorage.setItem("treeSaved",JSON.stringify(treeData)); }
function loadSavedTree(){ const s=localStorage.getItem("treeSaved"); return s?JSON.parse(s):null; }
function saveQueue(){ localStorage.setItem("audioQueue",JSON.stringify(queue)); }
function loadQueue(){ const s=localStorage.getItem("audioQueue"); if(s) queue=JSON.parse(s); }

// ===== マスターと保存マージ =====
function mergeWithMaster(master,saved){
    const masterMap=new Map(master.map(n=>[n.id,n]));
    const savedMap=new Map(saved.map(n=>[n.id,n]));
    const result=[];
    for(const savedNode of saved){
        const m=masterMap.get(savedNode.id); if(!m) continue;
        const newNode=structuredClone(m); newNode.open=savedNode.open;
        if(m.children) newNode.children=mergeWithMaster(m.children,savedNode.children||[]);
        result.push(newNode);
    }
    for(const m of master){ if(!savedMap.has(m.id)) result.push(structuredClone(m)); }
    return result;
}

// ===== 初期化 =====
async function init(){
    const treeJson=await fetch("data/tree.json").then(r=>r.json());
    masterData=treeJson.data;
    audioData=await fetch("data/audio.json").then(r=>r.json());

    const saved=loadSavedTree();
    treeData=saved?mergeWithMaster(masterData,saved):structuredClone(masterData);

    const savedVol=localStorage.getItem("volumeValue");
    if(savedVol) volumeSlider.value=savedVol;
    volumeValue.textContent=Math.round(volumeSlider.value*100)+"%";

    loopToggle.checked=true;

    loadQueue();
    renderQueue();
    refresh();
}

// ===== 音量 =====
volumeSlider.addEventListener("input",()=>{
    volumeValue.textContent=Math.round(volumeSlider.value*100)+"%";
});

// ===== ツリー描画 =====
function renderTree(nodes,parent=sidebar,path=[]){
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
            img.src=`images/${node.id}.png`; img.alt=node.title; img.classList.add("tree-icon");
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
            const submenu=document.createElement("div"); submenu.className="submenu";
            parent.appendChild(submenu);
            btn.onclick=()=>{
                submenu.classList.toggle("open");
                node.open=submenu.classList.contains("open");
                saveTree();
            };
            if(node.open) submenu.classList.add("open");
            renderTree(node.children,submenu,currentPath);
        } else {
            btn.onclick=()=>{ activate(btn); showAudio(node.id); };
        }
    });
}

function reorder(data,fromPath,toPath){
    const fromParent=getParent(data,fromPath);
    const toParent=getParent(data,toPath);
    if(fromParent!==toParent) return;
    const fromIndex=fromPath.at(-1);
    const toIndex=toPath.at(-1);
    const moved=fromParent.splice(fromIndex,1)[0];
    fromParent.splice(toIndex,0,moved);
}

function getParent(data,path){ let ref=data; for(let i=0;i<path.length-1;i++) ref=ref[path[i]].children; return ref; }

function showAudio(id){
    content.innerHTML="";
    const list=audioData[id]||[];
    list.forEach(item=>{
        const b=document.createElement("button");
        b.className="audio-btn";
        b.textContent=item.title;
        b.onclick=()=>{ addToQueue(item.title,item.file); };
        content.appendChild(b);
    });
}

function activate(btn){ if(activeBtn) activeBtn.classList.remove("active"); btn.classList.add("active"); activeBtn=btn; }

function refresh(){ sidebar.innerHTML=""; renderTree(treeData,sidebar); }

// ===== キュー =====
function addToQueue(title,file){ queue.push({title,file,delay:0,speed:1}); saveQueue(); renderQueue(); }

function renderQueue(){
    queueList.innerHTML="";
    queue.forEach((item,index)=>{
        const li=document.createElement("li"); li.draggable=true;

        const span=document.createElement("span"); span.textContent=item.title; span.className="col-title";

        const delayInput=document.createElement("input");
        delayInput.type="number"; delayInput.min=0; delayInput.step=0.1; delayInput.value=item.delay;
        delayInput.className="col-delay";
        delayInput.onchange=e=>{
            let val=parseFloat(e.target.value); 
            if(isNaN(val)||val<0){ alert("0以上の数値を入力してください"); e.target.value=item.delay; return; }
            item.delay=val; saveQueue();
        };

        const speedInput=document.createElement("input");
        speedInput.type="number"; speedInput.min=0.1; speedInput.max=4; speedInput.step=0.05; 
        speedInput.value=item.speed||1;
        speedInput.className="col-speed";
        speedInput.onchange=e=>{
            let val=parseFloat(e.target.value);
            if(isNaN(val)||val<=0){ alert("0より大きい数値を入力してください"); e.target.value=item.speed; return; }
            item.speed=val; saveQueue();
        };

        const delBtn=document.createElement("button"); delBtn.textContent="削除"; delBtn.className="col-delete queue-del-btn";
        delBtn.onclick=()=>{ queue.splice(index,1); saveQueue(); renderQueue(); };

        li.appendChild(span); li.appendChild(delayInput); li.appendChild(speedInput); li.appendChild(delBtn);

        li.ondragstart=e=>e.dataTransfer.setData("text/plain",index);
        li.ondragover=e=>e.preventDefault();
        li.ondrop=e=>{
            e.preventDefault();
            const from=parseInt(e.dataTransfer.getData("text/plain"));
            const moved=queue.splice(from,1)[0];
            queue.splice(index,0,moved);
            saveQueue();
            renderQueue();
        };

        queueList.appendChild(li);
    });
}

// ===== 再生 =====
async function playAudio(file,speed){
    return new Promise(resolve=>{
        if(!isFinite(speed)||speed<=0){ alert("無効な再生速度です"); resolve(); return; }
        currentAudio=new Audio(file);
        currentAudio.volume=parseFloat(volumeSlider.value);
        currentAudio.playbackRate=speed;
        currentAudio.play();
        currentAudio.onended=()=>{ currentAudio=null; resolve(); };
    });
}

document.getElementById("play-queue").onclick=async ()=>{
    if(isPlayingQueue||queue.length===0) return;
    stopRequested=false; isPlayingQueue=true;

    do{
        for(let item of queue){
            if(stopRequested) break;
            if(!isFinite(item.speed)||item.speed<=0){ alert("無効な再生速度です"); continue; }
            if(!isFinite(item.delay)||item.delay<0){ alert("無効なディレイです"); continue; }
            await playAudio(item.file,item.speed);
            if(stopRequested) break;
            if(item.delay>0) await new Promise(r=>setTimeout(r,item.delay*1000));
        }
    }while(loopToggle.checked && !stopRequested);

    isPlayingQueue=false; currentAudio=null; stopRequested=false;
};

document.getElementById("stop-queue").onclick=()=>{
    stopRequested=true;
    if(currentAudio){ currentAudio.pause(); currentAudio=null; }
    isPlayingQueue=false;
};

document.getElementById("clear-queue").onclick=()=>{
    queue=[]; saveQueue(); renderQueue();
};

// ===== WAV書き出し =====
document.getElementById("export-queue").onclick=async ()=>{
    if(queue.length===0) return;
    for(let item of queue){
        if(!isFinite(item.speed)||item.speed<=0 || !isFinite(item.delay)||item.delay<0){
            alert("キュー内に無効な値があります"); return;
        }
    }

    const fileName=prompt("保存ファイル名を入力してください","queue_export");
    if(!fileName) return;

    const audioContext=new (window.AudioContext||window.webkitAudioContext)();
    const buffers=[];
    for(let item of queue){
        const response=await fetch(item.file);
        const arrayBuffer=await response.arrayBuffer();
        const audioBuffer=await audioContext.decodeAudioData(arrayBuffer);
        buffers.push({buffer:audioBuffer,delay:item.delay});
    }

    let totalLength=0;
    for(let b of buffers){
        totalLength+=b.buffer.length;
        totalLength+=Math.floor(audioContext.sampleRate*b.delay);
    }

    const outputBuffer=audioContext.createBuffer(2,totalLength,audioContext.sampleRate);
    let offset=0;
    for(let item of buffers){
        for(let ch=0;ch<2;ch++){
            outputBuffer.getChannelData(ch).set(
                item.buffer.getChannelData(ch%item.buffer.numberOfChannels),
                offset
            );
        }
        offset+=item.buffer.length;
        offset+=Math.floor(audioContext.sampleRate*item.delay);
    }

    const wavBlob=bufferToWave(outputBuffer,totalLength);
    const url=URL.createObjectURL(wavBlob);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName+".wav";
    a.click();
    URL.revokeObjectURL(url);
};

function bufferToWave(abuffer,len){
    const numOfChan=abuffer.numberOfChannels;
    const length=len*numOfChan*2+44;
    const buffer=new ArrayBuffer(length);
    const view=new DataView(buffer);
    const channels=[];
    let pos=0;
    function setUint16(data){ view.setUint16(pos,data,true); pos+=2; }
    function setUint32(data){ view.setUint32(pos,data,true); pos+=4; }
    setUint32(0x46464952); setUint32(length-8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate*2*numOfChan); setUint16(numOfChan*2); setUint16(16);
    setUint32(0x61746164); setUint32(length-pos-4);
    for(let i=0;i<abuffer.numberOfChannels;i++) channels.push(abuffer.getChannelData(i));
    let offset=0;
    while(pos<length){
        for(let i=0;i<numOfChan;i++){
            let sample=Math.max(-1,Math.min(1,channels[i][offset]));
            sample=sample<0?sample*32768:sample*32767;
            view.setInt16(pos,sample,true);
            pos+=2;
        }
        offset++;
    }
    return new Blob([buffer],{type:"audio/wav"});
}

// ===== 初期化 =====
init();