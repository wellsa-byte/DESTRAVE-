const $ = id => document.getElementById(id);
let db, recorder, stream, chunks = [], startedAt = 0, timerInterval, currentMode = 'destravar', latestResult = '';
const DB_NAME = 'destrave-local', STORE = 'ideas';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function allIdeas() {
  return new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result.sort((a,b)=>b.created-a.created)); r.onerror=()=>reject(r.error); });
}
function saveIdea(item) {
  return new Promise((resolve, reject) => { const r = db.transaction(STORE,'readwrite').objectStore(STORE).add({...item, created:Date.now()}); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function deleteIdea(id) {
  return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(Number(id));r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dateLabel(t){return new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
function showView(name){
  $('homeView').classList.toggle('hidden',name!=='home');
  $('libraryView').classList.toggle('hidden',name!=='library');
  $('creativeView').classList.toggle('hidden',name!=='creative');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='library') renderLibrary();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',()=>showView('home')));
$('settingsBtn').addEventListener('click',async()=>{ $('settingsDialog').showModal(); try {const r=await fetch('/api/status');const d=await r.json();$('backendStatus').textContent=d.aiConfigured?'IA online configurada no servidor.':'IA online ainda não configurada; o modo local continua disponível.';}catch{$('backendStatus').textContent='Servidor indisponível. O armazenamento local continua disponível.';}});
$('closeSettings').addEventListener('click',()=>$('settingsDialog').close());

async function startRecording(){
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){alert('Este navegador não oferece gravação de áudio aqui. Abra o app em HTTPS no Safari atualizado.');return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];
    const mime = ['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{
      clearInterval(timerInterval); stream?.getTracks().forEach(t=>t.stop());
      const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
      const title=prompt('Dê um nome para essa ideia:','Ideia '+new Date().toLocaleDateString('pt-BR')) || 'Ideia sem título';
      try{await saveIdea({type:'audio',title,description:'Gravação de voz ou melodia',blob,mime:blob.type});$('hint').textContent='Gravação guardada neste aparelho.';await renderLibrary();}
      catch{$('hint').textContent='Não consegui salvar. Confira o espaço disponível no aparelho.';}
      $('recordBtn').classList.remove('recording');$('recordGlyph').textContent='●';$('recordLabel').textContent='TOQUE PARA GRAVAR';$('timer').textContent='00:00';
    };
    recorder.start();startedAt=Date.now();$('recordBtn').classList.add('recording');$('recordGlyph').textContent='■';$('recordLabel').textContent='TOQUE PARA ENCERRAR';
    timerInterval=setInterval(()=>{const s=Math.floor((Date.now()-startedAt)/1000);$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},250);
  }catch(e){alert('Não foi possível acessar o microfone. Permita o acesso nas configurações do navegador.');}
}
$('recordBtn').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();else startRecording();});

$('saveNoteBtn').addEventListener('click',async()=>{
  const text=$('quickNote').value.trim();if(!text){$('quickNote').focus();return;}
  await saveIdea({type:'text',title:text.length>55?text.slice(0,52)+'…':text,description:text});
  $('quickNote').value='';$('hint').textContent='Ideia guardada.';renderLibrary();
});
$('quickNote').addEventListener('keydown',e=>{if(e.key==='Enter')$('saveNoteBtn').click();});
$('searchInput').addEventListener('input',renderLibrary);

async function renderLibrary(){
  const ideas=await allIdeas(),q=($('searchInput').value||'').toLocaleLowerCase('pt-BR');
  const filtered=ideas.filter(x=>(x.title+' '+(x.description||'')).toLocaleLowerCase('pt-BR').includes(q));
  $('ideaCount').textContent=ideas.length;$('libraryList').innerHTML='';$('emptyLibrary').classList.toggle('hidden',filtered.length>0);
  filtered.forEach(item=>{
    const card=document.createElement('article');card.className='idea-card';
    const audio=item.blob?`<audio class="audio-player" controls preload="none" src="${URL.createObjectURL(item.blob)}"></audio>`:'';
    card.innerHTML=`<div class="idea-top"><span class="idea-type">${item.type==='audio'?'ÁUDIO':'TEXTO'}</span><span class="idea-date">${dateLabel(item.created)}</span></div><div class="idea-title">${escapeHTML(item.title)}</div><div class="idea-desc">${escapeHTML(item.description||'')}</div>${audio}<div class="card-actions"><button class="small-btn" data-use="${item.id}">Usar com IA</button><button class="small-btn" data-delete="${item.id}">Excluir</button></div>`;
    $('libraryList').appendChild(card);
  });
  $('libraryList').querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Excluir esta ideia deste aparelho?')){await deleteIdea(b.dataset.delete);renderLibrary();}}));
  $('libraryList').querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',async()=>{const it=(await allIdeas()).find(x=>x.id===Number(b.dataset.use));$('creativePrompt').value=`Minha ideia: ${it.title}\n${it.description||''}`;showView('creative');}));
}
$('exportBtn').addEventListener('click',async()=>{
  const ideas=await allIdeas();const data=ideas.map(({id,type,title,description,created})=>({id,type,title,description,created:new Date(created).toISOString()}));
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='destrave-ideias.json';a.click();URL.revokeObjectURL(a.href);
});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{currentMode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));}));
function localIdeas(prompt,mode){
  const p=prompt.trim();
  const openers={
    frases:['“Tem coisa que a saudade faz a gente chamar de acaso.”','“Eu mudei o caminho, mas não o destino que era você.”','“O silêncio também sabe exatamente onde machuca.”'],
    rimas:['Experimente rimar pela sonoridade, não só pelo final: “partida / avenida / vida”; “sumiu / viu / fingiu”.','Troque a rima óbvia por uma imagem: em vez de “coração/paixão”, tente “mensagem apagada / luz da fachada”.'],
    historia:['Comece com uma atitude pequena que entrega o personagem: ele passa na rua “por acaso”, mas já sabe qual janela fica acesa.','Dê uma virada: a pessoa que ele procura já seguiu em frente — e agora é ele quem recebe uma mensagem inesperada.'],
    'refrão':['Escolha uma frase curta que possa ser dita numa conversa e dê a ela um segundo sentido no refrão.','Faça o refrão responder a uma pergunta que o verso deixou no ar.'],
    destravar:['O detalhe que torna essa ideia sua pode ser um hábito, um lugar ou uma desculpa que só esse personagem usaria.','Em vez de explicar o sentimento, mostre uma ação que contradiz o que a pessoa diz.','Vire a cena ao contrário: e se a pessoa que parece ter superado tudo for a que mais está tentando provar isso?']
  };
  const arr=openers[mode]||openers.destravar;
  return `UM CAMINHO\n${arr[Math.floor(Math.random()*arr.length)]}\n\nTRÊS JEITOS DE SEGUIR\n• Conte a cena por um detalhe concreto.\n• Mostre o que a pessoa diz — e o que faz escondido.\n• Inclua uma pequena surpresa que mude o sentido da frase.\n\nSEU PONTO DE PARTIDA\n${p?`Use “${p.slice(0,180)}” como núcleo e procure uma imagem que ninguém esperaria.`:'Escolha uma lembrança específica de hoje e pergunte: o que havia ali que eu não contei pra ninguém?'}\n\nEste é o modo local básico. Configure uma API no servidor para respostas de IA online.`;
}
$('generateBtn').addEventListener('click',async()=>{
  const prompt=$('creativePrompt').value.trim();$('generateBtn').disabled=true;$('generateBtn').textContent='Pensando…';$('aiStatus').textContent='Tentando IA online; se não estiver configurada, usaremos o modo local.';$('creativeResult').classList.add('hidden');$('saveResultBtn').classList.add('hidden');
  try{
    const r=await fetch('/api/ideas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,mode:currentMode})});
    const d=await r.json();
    if(r.ok){latestResult=d.text;$('aiStatus').textContent='IA online';}
    else{latestResult=localIdeas(prompt,currentMode);$('aiStatus').textContent='Modo local · IA online não configurada';}
  }catch{latestResult=localIdeas(prompt,currentMode);$('aiStatus').textContent='Modo local · servidor de IA indisponível';}
  $('creativeResult').textContent=latestResult;$('creativeResult').classList.remove('hidden');$('saveResultBtn').classList.remove('hidden');$('generateBtn').disabled=false;$('generateBtn').innerHTML='Encontrar um caminho <span>↗</span>';
});
$('saveResultBtn').addEventListener('click',async()=>{await saveIdea({type:'text',title:'Caminho criativo',description:latestResult});$('aiStatus').textContent='Ideia guardada na biblioteca.';$('saveResultBtn').classList.add('hidden');});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
openDB().then(()=>renderLibrary()).catch(()=>{$('hint').textContent='O armazenamento local não está disponível neste navegador.';});
