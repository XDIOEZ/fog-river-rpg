(function playRiver() {
  "use strict";
  const R=globalThis.River, V=R.travelView;
  const $=selector=>document.querySelector(selector);
  const game=$("#game"), plane=$("#plane"), painting=$("#painting"), pins=$("#landmarks"), layer=$("#layer"), hud=$("#hud"), overlays=$("#overlays"), effects=$("#effects"), context=$("#context"), notice=$("#notice");
  let g=R.loadGame(), onTitle=true, artKey="", lastScene="", panelKey="", busy=false, timer=0;
  let panelOpener=null;
  const ui={modal:null,stack:[],say:"",card:null,skill:null,enemy:null,reserve:null,equipped:null,spell:null,journalFilter:"all",shopLevel:0,page:0,lastDoor:""};
  const camera={x:0,y:0,z:1,drag:null};
  const optionsKey="fog-river.settings.v1";
  let options={sound:true,volume:45,large:false};
  try { Object.assign(options,JSON.parse(localStorage.getItem(optionsKey)||"{}")); } catch {}
  let audioContext,paperSound;
  const reduced=()=>window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  function saveOptions() {
    try { localStorage.setItem(optionsKey,JSON.stringify(options)); } catch {}
  }
  function sound(cue="tap") {
    if(!options.sound||!options.volume) return;
    const Engine=window.AudioContext||window.webkitAudioContext;
    if(!Engine) return;
    audioContext||=new Engine();
    if(audioContext.state==="suspended") audioContext.resume().catch(()=>{});
    if(cue==="paper") {
      if(!paperSound) {
        paperSound=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.075),audioContext.sampleRate);
        const samples=paperSound.getChannelData(0);
        for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*Math.sin(i/samples.length*Math.PI)**2;
      }
      const paper=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
      paper.buffer=paperSound;filter.type="bandpass";filter.frequency.value=2400;gain.gain.value=options.volume*.0009;
      paper.connect(filter).connect(gain).connect(audioContext.destination);paper.start();
      return;
    }
    const notes={tap:[360],travel:[392,493.88],hit:[587.33,783.99],miss:[220,196],split:[270,320],skill:[392,587.33,783.99],reward:[392,493.88,587.33,783.99]};
    (notes[cue]||notes.tap).forEach((frequency,i)=>{
      const now=audioContext.currentTime+i*.065, osc=audioContext.createOscillator(),gain=audioContext.createGain();
      osc.type=cue==="miss"?"triangle":"sine";
      osc.frequency.setValueAtTime(frequency,now);
      if(cue==="split") osc.frequency.exponentialRampToValueAtTime(105,now+.13);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001,.0007*options.volume),now+.013);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.24);
      osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+.25);
    });
  }
  function speakWord(wordId) {
    if (!options.sound || !options.volume) return;
    if (R.cards[wordId]) R.pronunciation.play(wordId, options.volume / 100, () => tell("这张词卡暂无可用的日语语音。", 3200));
  }
  function speakCard(instanceId) { speakWord(g.collection[instanceId]); }
  function tell(message,duration=2300) {
    window.clearTimeout(timer);
    notice.textContent=message||"";
    notice.classList.toggle("visible",!!message);
    if(message) timer=window.setTimeout(()=>notice.classList.remove("visible"),duration);
  }
  function persist() {
    if(!R.saveGame(g)) tell("当前浏览器未能保存这次旅程。",4200);
  }
  function setBusy(flag) { busy=flag;game.dataset.busy=String(flag); }
  const mapScene=()=>!onTitle&&["world","town","road"].includes(g?.scene);
  function applyCamera() {
    const w=game.clientWidth,h=game.clientHeight;
    camera.x=Math.max(-w*(camera.z-1)/2,Math.min(w*(camera.z-1)/2,camera.x));
    camera.y=Math.max(-h*(camera.z-1)/2,Math.min(h*(camera.z-1)/2,camera.y));
    plane.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  }
  function centerMap() { Object.assign(camera,{x:0,y:0,z:1,drag:null});applyCamera(); }
  function zoom(factor,cx=game.clientWidth/2,cy=game.clientHeight/2) {
    const previous=camera.z;
    camera.z=Math.min(2.3,Math.max(1,previous*factor));
    const ratio=camera.z/previous;
    camera.x=cx-game.clientWidth/2-(cx-game.clientWidth/2-camera.x)*ratio;
    camera.y=cy-game.clientHeight/2-(cy-game.clientHeight/2-camera.y)*ratio;
    applyCamera();
  }
  function draw() {
    const focus=document.activeElement;
    const scene=onTitle?"title":g.scene;
    game.dataset.scene=scene;
    game.classList.toggle("large-type",options.large);
    if(lastScene!==scene) centerMap();
    lastScene=scene;
    const type=["battle","loot","defeat"].includes(scene)?"battle":scene==="ending"?"ending":scene;
    const region=onTitle?0:g.region,room=onTitle?"":g.room;
    const flags=onTitle?[]:g.progress.map(p=>p.lit);
    const lit=onTitle?false:flags[region];
    const key=[type,region,room,...flags].join("/");
    if(key!==artKey) {
      painting.innerHTML=R.art.scene(type,region,lit,room,flags);
      artKey=key;
    }
    const oldFan=layer.querySelector(".hand-fan");
    const handScroll=oldFan&&Number(oldFan.dataset.round)===g?.battle?.round?oldFan.scrollLeft:0;
    pins.innerHTML=onTitle?"":V.landmarks(g,ui);
    hud.innerHTML=V.header(g,onTitle,options);
    if(onTitle) layer.innerHTML=V.titleView(g);
    else if(mapScene()) layer.innerHTML=V.walkView(g);
    else if(scene==="room") layer.innerHTML=V.roomView(g,ui);
    else if(scene==="battle") {
      layer.innerHTML=R.combatView(g,ui);
      if(handScroll) layer.querySelector(".hand-fan").scrollLeft=handScroll;
    } else if(scene==="ending"||scene==="defeat") layer.innerHTML=V.conclusion(g);
    else layer.innerHTML="";
    const current=ui.modal||(!onTitle&&scene==="loot"?"loot":null);
    for(const outside of [layer,pins,hud]) outside.inert=!!current;
    overlays.innerHTML=current?((g&&R.panelView(g,{...ui,modal:current}))||V.modal(g,{...ui,modal:current},options,onTitle)):"";
    if(current&&!panelKey) panelOpener=focus;
    const from=!current&&panelKey?panelOpener:focus;
    const area=current?overlays:game;
    const match=from?.dataset.act&&[...area.querySelectorAll("button[data-act]:not(:disabled)")].find(el=>
      el.dataset.act===from.dataset.act&&el.dataset.val===from.dataset.val&&el.dataset.enemy===from.dataset.enemy&&el.tabIndex>=0);
    const target=current?(current===panelKey&&match||overlays.querySelector("button:not(:disabled)")):match;
    if(target) target.focus({preventScroll:true});
    if(!current) panelOpener=null;
    panelKey=current;
  }
  function resetInteraction() {
    Object.assign(ui,{modal:null,stack:[],card:null,skill:null,enemy:null,say:"",reserve:null,equipped:null,spell:null,page:0});
    context.replaceChildren();
    effects.replaceChildren();
  }
  function openModal(which) {
    if(!onTitle&&g.scene==="battle"&&["deck","upgrades","spells","journal","shop"].includes(which)) return;
    if(ui.modal==="pause"&&["settings","help"].includes(which)) ui.stack.push("pause");
    else if(ui.modal!==which) ui.stack=[];
    Object.assign(ui,{modal:which,reserve:null,equipped:null,spell:null,journalFilter:"all",shopLevel:0,page:0});
    context.replaceChildren();tell("");draw();
  }
  function closeModal() {
    ui.modal=ui.stack.pop()||null;
    context.replaceChildren();draw();
  }
  function newJourney(resume) {
    R.pronunciation.stop();
    if(!resume) {g=R.newGame();R.beginTutorial(g);}
    else g=R.loadGame()||g;
    if(!g) return;
    onTitle=false;resetInteraction();ui.lastDoor="";
    if(!resume) ui.modal="tutorial";
    sound("travel");draw();persist();
  }
  function animateTrip(pin,finish) {
    const pawn=pins.querySelector(".traveler-token");
    if(!pin||!pawn||reduced()) {finish();return;}
    setBusy(true);
    const rect=pawn.getBoundingClientRect(),target=pin.getBoundingClientRect();
    const dx=(target.left+target.width*.5-rect.left-rect.width*.5)/camera.z;
    const dy=(target.bottom-rect.top)/camera.z;
    pawn.animate([{translate:"0 0"},{translate:`${dx}px ${dy}px`}],{duration:195,fill:"forwards",easing:"ease-in-out"});
    setTimeout(()=>{setBusy(false);finish();},200);
  }
  function travel(action,value,pin=null) {
    const previous=g.scene,oldRoom=g.room;
    const message=R.worldAction(g,action,value);
    if(!message) {
      const why=action==="side"&&g.trip?.kind==="merchant"?"铜币不足，行商这张牌要八枚铜币。":
        action==="deck"&&value?.add&&!value?.remove&&g.deck.length>=R.capacity(g)?"牌匣已满，拖到随身卡牌上可以交换。":
        action==="deck"&&value?.remove&&!value?.add&&g.deck.length<=5?"至少需要五张符卡，拖到收藏牌上可以交换。":
        action==="deck"&&value?.add?"同一个词最多带两张，试试换出同词符卡。":"现在无法进行这项操作。";
      tell(why);return;
    }
    if(oldRoom&&g.scene==="town") ui.lastDoor=oldRoom;
    else if(g.scene==="town"&&previous!=="town") ui.lastDoor="";
    if(action==="take"||action==="side"||previous!==g.scene) {ui.modal=null;ui.stack=[];}
    ui.card=null;ui.skill=null;ui.enemy=null;
    ui.say=previous==="room"&&g.scene==="room"&&!["back","upgrade"].includes(action)?message:"";
    if(action==="upgrade") speakCard(value);
    persist();
    const nav=previous!==g.scene&&pin?.classList.contains("map-pin");
    animateTrip(nav?pin:null,()=>{
      draw();
      const purchase=action==="buy"||action==="take"||action==="claim"||action==="upgrade";
      sound(purchase||action==="light"?"reward":previous!==g.scene?"travel":"tap");
      if(!ui.say&&(purchase||["accept","work","finish","side","deck","slot","revive","wait"].includes(action))) tell(message);
      else tell("");
    });
  }
  function centerOf(element,fx=.5,fy=.5) {
    const rect=element?.getBoundingClientRect()||game.getBoundingClientRect();
    return {x:rect.left+fx*rect.width,y:rect.top+fy*rect.height};
  }
  function flying(text,start,end,miss,duration) {
    if(reduced()) return;
    const fly=document.createElement("span");
    fly.className="flying-sign";fly.textContent=text;
    fly.style.left=start.x+"px";fly.style.top=start.y+"px";effects.append(fly);
    const dx=end.x-start.x,dy=end.y-start.y;
    const endAt=`translate(${dx}px,${dy}px) scale(.78)`;
    const anim=fly.animate([{transform:"translate(-50%,-50%) rotate(-5deg)",opacity:.9},
      {transform:`translate(${dx*.55}px,${dy*.5-53}px) rotate(${miss?-12:9}deg)`,opacity:1,offset:.48},
      {transform:endAt,opacity:0}],{duration,easing:"ease-out"});
    anim.onfinish=()=>fly.remove();
  }
  function damageText(text,point) {
    if(reduced()) return;
    const label=document.createElement("span");label.className="float-damage";label.textContent=text;
    label.style.left=point.x+"px";label.style.top=point.y+"px";effects.append(label);
    label.animate([{transform:"translate(-50%,0)",opacity:1},{transform:"translate(-50%,-42px)",opacity:0}],{duration:570}).onfinish=()=>label.remove();
  }
  function battleMove(action,first,second,third) {
    const cardId=action==="attack"?first:typeof second==="string"?second:null;
    const card=cardId?layer.querySelector(`[data-act="card"][data-val="${cardId}"]`):null;
    const from=centerOf(card||layer.querySelector(".combat-hero"));
    const foeId=action==="attack"?second:second?.enemyId;
    const fighter=foeId?layer.querySelector(`[data-fighter="${foeId}"]`):null;
    const to=centerOf(fighter,.5,.58), head=centerOf(layer.querySelector(".combat-hero"),.48,.06);
    const event=action==="attack"?R.attack(g,first,second,third):R.cast(g,first,second);
    if(!event) {tell("请重新选择有效目标。");return;}
    const resolution=R.advanceBattle(g);
    persist();
    ui.card=null;ui.skill=null;
    setBusy(true);
    const miss=event.type==="miss",hit=event.type==="hit";
    sound(miss?"miss":hit?"hit":"skill");
    if(event.wordId) flying(R.cards[event.wordId].jp,from,miss?head:to,miss,300);
    if(hit) damageText("−"+event.damage,to);
    if(g.scene==="world"&&resolution) tell(resolution,5400);
    else if(miss) {
      const firstMistake=g.battle?.tutorial&&g.battle.stats.wrong===1;
      tell(event.text+(firstMistake?" 指向旅人头顶的错卡可重看译义。":""),firstMistake?5200:3300);
    }
    else if(!hit) tell(event.text,2300);
    else if(event.newRound) tell(`第 ${event.newRound} 回合`,950);
    else tell("");
    let lastMistake;
    if(miss&&event.newRound) {
      if(card) card.style.visibility="hidden";
      lastMistake=document.createElement("span");
      lastMistake.className="mistake-note";
      const word=R.cards[event.wordId];
      lastMistake.textContent=word.jp+" · "+word.zh;
      lastMistake.style.left=head.x+"px";lastMistake.style.top=head.y+"px";
      effects.append(lastMistake);
    }
    const wait=lastMistake?1200:reduced()?35:hit?135:210;
    setTimeout(()=>{
      lastMistake?.remove();
      draw();
      const actor=foeId?layer.querySelector(`[data-fighter="${foeId}"]`):null;
      if(hit&&actor) actor.classList.add("struck");
      const reply=event.enemyAction;
      if(reply&&actor) actor.classList.add(reply.type==="attack"?"lunging":["split","summon"].includes(reply.type)?"unfurling":"channeling");
      if(reply?.type==="split") sound("split");
      if(reply?.damage) {
        layer.querySelector(".combat-hero")?.classList.add("struck");
        damageText("−"+reply.damage,head);
      }
      if(event.type==="skill") layer.querySelector(".combat-hero")?.classList.add("casting");
      setBusy(false);
    },wait);
  }
  function pickCard(id) {
    if(ui.skill&&R.skills[ui.skill].target==="card") {speakCard(id);return battleMove("cast",ui.skill,id);}
    ui.card=ui.card===id?null:id;ui.skill=null;sound("paper");
    if(ui.card) speakCard(id);
    draw();
  }
  function pickTag(enemyId,tagId) {
    if(ui.skill&&R.skills[ui.skill].target==="tag") return battleMove("cast",ui.skill,{enemyId,tagId});
    if(!ui.card) return tell("先从手里选一张日语符卡。");
    battleMove("attack",ui.card,enemyId,tagId);
  }
  function pickSpell(id) {
    if(!R.canCast(g,id)) return;
    if(R.skills[id].target==="self") return battleMove("cast",id);
    ui.skill=ui.skill===id?null:id;ui.card=null;sound();draw();
  }
  function fullscreen() {
    const operation=document.fullscreenElement?document.exitFullscreen?.():game.requestFullscreen?.();
    operation?.then(()=>{if(ui.modal==="settings") draw();}).catch(()=>tell("浏览器当前无法切换全屏，可使用 F11。"));
  }
  function handle(action,val,element) {
    context.replaceChildren();
    if(busy) return;
    switch(action) {
      case "start": return newJourney(false);
      case "continue": return newJourney(true);
      case "to-title":
        R.pronunciation.stop();resetInteraction();onTitle=true;tell("");draw();return;
      case "modal": return openModal(val);
      case "close": return closeModal();
      case "sound": options.sound=!options.sound;saveOptions();if(options.sound)sound("skill");else R.pronunciation.stop();draw();return;
      case "text-size": options.large=!options.large;saveOptions();draw();return;
      case "fullscreen": return fullscreen();
    }
    if(onTitle||!g) return;
    switch(action) {
      case "locked": return tell(`点亮${R.regions[Number(val)-1].lamp}并交付委托，就能前往这里。`);
      case "no-road": return tell(`先去${R.regions[g.region].lodge}接下委托。`);
      case "no-lamp": return tell(g.progress[g.region].road?R.nextObjective(g):"先通过桥头的遭遇。");
      case "side-info": return openModal("side");
      case "talk": ui.say="";sound();draw();return;
      case "log": return openModal("log");
      case "inspect": ui.enemy=val;return openModal("inspect");
      case "zoom-in": zoom(1.2);return;
      case "zoom-out": zoom(1/1.2);return;
      case "zoom-reset": centerMap();return;
      case "card": return pickCard(val);
      case "buy": case "take": speakWord(val);return travel(action,val,element);
      case "upgrade": return travel("upgrade",val,element);
      case "tag": return pickTag(element.dataset.enemy,val);
      case "spell": return pickSpell(val);
      case "fan-prev": case "fan-next": {
        const fan=layer.querySelector(".hand-fan");
        fan?.scrollBy({left:(action==="fan-prev"?-.7:.7)*fan.clientWidth,behavior:reduced()?"instant":"smooth"});return;
      }
      case "cancel-selection": R.pronunciation.stop();ui.card=null;ui.skill=null;draw();return;
      case "reserve": case "equipped":
        ui[action]=ui[action]===val?null:val;
        if(ui[action]) speakCard(val);
        draw();return;
      case "skill-choice": ui.spell=val;draw();return;
      case "journal-filter": ui.journalFilter=val;ui.page=0;draw();return;
      case "shop-level": ui.shopLevel=Number(val);ui.page=0;draw();return;
      case "page": ui.page=Number(val);draw();return;
      case "gear-apply": {
        const pair={add:ui.reserve,remove:ui.equipped};
        ui.reserve=null;ui.equipped=null;return travel("deck",pair);
      }
      case "slot":
        if(ui.spell===null) {
          if(g.slots[Number(val)]) {ui.spell=g.slots[Number(val)];sound("paper");draw();}
          return;
        }
        if(g.slots[Number(val)]===ui.spell) {ui.spell=null;draw();return;}
        return travel("slot",{index:Number(val),skill:ui.spell||null});
      default: return travel(action,val,element);
    }
  }
  R.installDragDrop(game,{
    getGame:()=>g,
    enabled:()=>!busy&&!onTitle,
    execute:command=>{
      if(command.action==="attack") {speakCard(command.card);return battleMove("attack",command.card,command.enemy,command.tag);}
      if(command.action==="cast") {
        if(typeof command.target==="string") speakCard(command.target);
        return battleMove("cast",command.skill,command.target);
      }
      if(command.action==="deck"&&command.add) speakCard(command.add);
      ui.reserve=null;ui.equipped=null;ui.spell=null;
      if(command.action==="deck") return travel("deck",{add:command.add,remove:command.remove});
      if(command.action==="deck-order") return travel("deck-order",{from:command.from,to:command.to});
      if(command.action==="slot") return travel("slot",{index:command.index,skill:command.skill});
    }
  });
  game.addEventListener("click",event=>{
    const target=event.target.closest("button[data-act]");
    if(!target) {context.replaceChildren();return;}
    if(target.disabled) return;
    handle(target.dataset.act,target.dataset.val,target);
  });
  game.addEventListener("input",event=>{
    if(!event.target.matches("[data-volume]")) return;
    options.volume=Number(event.target.value);saveOptions();R.pronunciation.setVolume(options.volume/100);
  });
  game.addEventListener("change",e=>{if(e.target.matches("[data-volume]")) sound("skill");});
  game.addEventListener("wheel",event=>{
    if(ui.modal) return;
    const fan=event.target.closest(".hand-fan");
    if(fan&&fan.scrollWidth>fan.clientWidth) {event.preventDefault();fan.scrollLeft+=event.deltaY||event.deltaX;return;}
    if(mapScene()&&!event.target.closest(".route-sheet,#hud,.map-tools")) {
      event.preventDefault();zoom(event.deltaY<0?1.12:1/1.12,event.clientX,event.clientY);
    }
  },{passive:false});
  game.addEventListener("pointerdown",event=>{
    if(!mapScene()||ui.modal) return;
    const dragTouch=event.pointerType==="touch"&&event.isPrimary&&camera.z>1&&!event.target.closest("button,.route-sheet,#hud");
    const dragMouse=event.pointerType==="mouse"&&event.button===0&&camera.z>1&&!event.target.closest("button,.route-sheet,#hud,.map-tools");
    if(event.button!==1&&!dragTouch&&!dragMouse) return;
    event.preventDefault();
    if(camera.z===1) zoom(1.18,event.clientX,event.clientY);
    camera.drag={x:event.clientX,y:event.clientY,ox:camera.x,oy:camera.y};
    game.setPointerCapture(event.pointerId);
  });
  game.addEventListener("pointermove",event=>{
    if(!camera.drag) return;
    camera.x=camera.drag.ox+event.clientX-camera.drag.x;camera.y=camera.drag.oy+event.clientY-camera.drag.y;
    applyCamera();
  });
  game.addEventListener("lostpointercapture",()=>{camera.drag=null;});
  game.addEventListener("pointerup",e=>{
    if(camera.drag&&game.hasPointerCapture(e.pointerId)) game.releasePointerCapture(e.pointerId);
    camera.drag=null;
  });
  game.addEventListener("contextmenu",event=>{
    event.preventDefault();
    if(onTitle||busy||ui.modal||["loot","defeat","ending"].includes(g.scene)) return;
    const enemy=event.target.closest("[data-fighter]");
    let choices;
    if(g.scene==="battle") {
      choices=V.button("取消选牌","cancel-selection")+(enemy?V.button("查看行动预告","inspect",enemy.dataset.fighter):"")+V.button("查看战斗记事","log");
    } else {
      choices=V.button("展开旅途手札","modal","journal")+V.button("查看随身牌匣","modal","deck");
      if(g.scene!=="world") choices+=V.button("展开河道图","world");
    }
    context.style.left=Math.max(0,Math.min(event.clientX,innerWidth-170))+"px";
    context.style.top=Math.max(0,Math.min(event.clientY,innerHeight-145))+"px";
    context.innerHTML='<div class="context-box" role="group" aria-label="场景操作">'+choices+"</div>";
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Tab"&&panelKey) {
      const controls=[...overlays.querySelectorAll("button:not(:disabled),summary,input")].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(first&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))) {
        event.preventDefault();(event.shiftKey?last:first).focus();
      }
      return;
    }
    if(busy||event.repeat) return;
    if(event.key==="Escape") {
      event.preventDefault();
      if(context.childElementCount) context.replaceChildren();
      else if(ui.modal) closeModal();
      else if(!onTitle&&g.scene!=="loot") openModal("pause");
      else if(onTitle) openModal("settings");
    } else if(event.key==="Enter"&&onTitle&&!ui.modal&&!event.target.closest("button,summary,input")) {
      event.preventDefault();newJourney(!!g);
    } else if(!onTitle&&!ui.modal&&g.scene==="battle"&&/^[1-9]$/.test(event.key)) {
      const id=g.battle.hand[Number(event.key)-1];if(id) pickCard(id);
    }
  });
  window.addEventListener("resize",applyCamera);
  setBusy(false);draw();
})();
