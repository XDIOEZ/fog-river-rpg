(function travelViews() {
  "use strict";
  const R=globalThis.River, icon=R.art.icon;
  const waters=["下游","中游","上游"];
  const townPoints=[[21,61],[51,43],[79,25]];
  const roadPoints=[[35,67],[63,51],[83,38]];
  const doors=[
    {lodge:[29,51],temple:[62,32],road:[83,61]},
    {lodge:[27,50],temple:[67,30],witch:[82,52],road:[85,72]},
    {lodge:[24,54],temple:[66,26],road:[79,58]}
  ];
  const attr=(value)=>value===undefined?"":` data-val="${value}"`;
  function button(label,act,val,style="paper-btn",symbol="") {
    return `<button type="button" class="${style}" data-act="${act}"${attr(val)}>${symbol?icon(symbol,18):""}${label}</button>`;
  }
  function round(label,act,symbol,val) {
    return `<button type="button" class="hud-btn" title="${label}" aria-label="${label}" data-act="${act}"${attr(val)}>${icon(symbol,19)}</button>`;
  }
  function header(g,onTitle,options) {
    if(onTitle) return `<span class="title-crest" aria-hidden="true">${icon("grimoire",32)}</span><div class="hud-right">${round(options.sound?"关闭声音":"开启声音","sound",options.sound?"volume":"mute")}${round("切换全屏","fullscreen","fullscreen")}</div>`;
    const place=R.regions[g.region];
    const name={world:"雾河航路图",town:place.town,road:place.road,room:place[g.room],battle:g.encounter?.source==="trial"?"学院试炼":place.road,loot:"战利品",defeat:"旅人歇息",ending:"三灯复航"}[g.scene];
    const headerMark=`<span class="hud-brand"><span class="emblem">${icon("sail",18)}</span><span><small>${waters[g.region]} · ${place.name}</small><strong>${name||place.name}</strong></span></span>`;
    const back=["town","room","road"].includes(g.scene)?round("返回上一级地图","back","back"):"";
    const battle=g.scene==="battle";
    return `<div class="hud-left">${back}${headerMark}</div><div class="hud-right">
      ${battle?"":`<span class="status-strip"><span class="hud-stat life" title="生命">${icon("heart",16)} ${g.hp}/${g.maxHp}</span><span class="hud-stat" title="铜币">${icon("coin",16)} ${g.gold}</span></span>`}
      ${battle?"":round("随身牌匣","modal","bag","deck")+round("旅途手札","modal","book","journal")}
      ${round("暂停游戏","modal","pause","pause")}</div>`;
  }
  function titleView(saved) {
    return `<section class="title-menu" aria-label="主菜单">
      <div class="title-kicker">日语词卡冒险</div>
      <div class="title-name"><h1>雾河的魔导书</h1></div>
      <div class="title-rule" aria-hidden="true">${icon("star",15)}</div>
      <p class="title-story">白苇渡口的航灯熄灭了。<br>翻开魔导书，沿河点亮三座灯塔。</p>
      <nav class="title-actions" aria-label="旅程选项">
        <button class="start-btn" data-act="${saved?"continue":"start"}">${icon("sail",25)}${saved?"继续旅程":"新的旅程"}<kbd>Enter</kbd></button>
        <span class="title-aux">${saved?button("新的旅程","modal","restart","text-btn","quill"):""}${button("游玩指南","modal","help","text-btn","book")}${button("设置","modal","settings","text-btn","settings")}</span>
      </nav>
      </section><span class="title-foot">${icon("quill",16)}${saved?`已留存 · ${R.regions[saved.region].name} · 旅人 ${saved.level} 级`:"旅程会自动保存在此浏览器"}</span>
      <span class="title-place">${icon("pin",15)} 白苇渡口</span>`;
  }
  function pin(x,y,label,action,val,symbol,status="",mini=false) {
    return `<button class="map-pin ${status}${mini?" mini":""}" style="left:${x}%;top:${y}%" data-act="${action}"${attr(val)}>${icon(symbol,18)}${label}</button>`;
  }
  function spot(x,y,w,h,label,action,val) {
    return `<button class="scene-spot" tabindex="-1" aria-label="${label}" data-act="${action}"${attr(val)} style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></button>`;
  }
  function token(x,y) {
    return `<span class="traveler-token" aria-hidden="true" style="left:${x}%;top:${y}%">${icon("sail",15)}</span>`;
  }
  const journeyRegion=g=>{const next=g.progress.findIndex((p,i)=>i<=g.unlocked&&!p.claimed);return next<0?g.region:next;};
  function landmarks(g,ui) {
    const r=g.region, place=R.regions[r], p=g.progress[r];
    if(g.scene==="world") {
      let marks=R.regions.map((region,i)=>{
        const locked=i>g.unlocked;
        return pin(...townPoints[i],region.town,locked?"locked":"town",i,locked?"lock":"sail",locked?"locked":(journeyRegion(g)===i?"active":""))+
          (g.progress[i].accepted&&!locked?pin(...roadPoints[i],region.road,"road",i,"trail","",true):"");
      }).join("");
      const pos=g.trip?roadPoints[r]:townPoints[r];
      const buildings=R.regions.map((region,i)=>spot(townPoints[i][0]-4,townPoints[i][1]-1,8,7,region.town,i>g.unlocked?"locked":"town",i)).join("");
      return buildings+marks+token(pos[0],pos[1]+2);
    }
    if(g.scene==="town") {
      const sites=doors[r];
      let buildings="",marks="";
      for(const [key,[x,y]] of Object.entries(sites)) {
        const road=key==="road", act=road?(p.accepted?"road":"no-road"):"room", val=road?r:key;
        const active=key==="lodge"&&(!p.accepted||p.lit&&!p.claimed)||key==="temple"&&r===0&&p.accepted&&!g.learned.includes("ward")||road&&p.accepted&&!p.lit;
        buildings+=spot(x-7,y-8,14,24,place[key],act,val);
        marks+=pin(x,y,place[key],act,val,{lodge:"house",temple:"shrine",witch:"leaf",road:"trail"}[key],active?"active":"");
      }
      const [x,y]=sites[ui.lastDoor]||[29,63];
      return buildings+marks+token(x,y+9);
    }
    if(g.scene==="road") {
      const step=place.work&&p.road&&!p.work;
      let marks=pin(27,67,place.road,"fight","road","sword",p.road?"":"active")+
        pin(50,66,place.site,"side-info",undefined,p.road?"leaf":"lock",p.road?"":"locked");
      if(step) marks+=pin(63,48,place.work,"work",undefined,"quill","active");
      const open=p.road&&(!place.work||p.work);
      return marks+pin(76,54,place.lamp,p.boss?"room":open?"fight":"no-lamp",p.boss?"lamp":"boss",open?"lantern":"lock",open&&!p.lit?"active":open?"":"locked")+
        token(p.boss?73:p.road?41:19,p.boss?69:76);
    }
    if(g.scene==="room") {
      if(g.room==="lamp") return spot(52,19,23,46,place.lamp,p.lit?"rest":"light")+pin(64,55,p.lit?"渡灯":"放入灯芯",p.lit?"rest":"light",undefined,"lantern","active");
      const name=g.room==="lodge"?place.keeper:g.room==="witch"?place.witchMentor:place.mentor;
      const person=spot(52,13,27,50,"与"+name+"交谈","talk")+pin(80,49,name,"talk",undefined,"quill","",true);
      if(g.room==="lodge") return person+spot(3,56,18,16,"翻开柜台上的牌匣","modal","shop")+pin(16,65,"柜台牌匣","modal","shop","cards","",true);
      const lesson=R.lessonsAt(g).find(id=>!g.learned.includes(id));
      const altar=[[35,66],[20,62],[17,66]][r];
      return person+(lesson?pin(...altar,R.skills[lesson].name+"护符","learn",lesson,"star","",true):"");
    }
    return "";
  }
  function tools() {
    return `<div class="map-tools"><span class="map-hint">中键平移 · 滚轮缩放</span>${round("缩小地图","zoom-out","minus")}${round("复位地图","zoom-reset","compass")}${round("放大地图","zoom-in","plus")}</div>`;
  }
  function routeSheet(kicker,title,description,action,symbol) {
    return `<section class="route-sheet"><div class="route-copy"><span class="signet">${icon(symbol,26)}</span><div><small>${kicker}</small><h2>${title}</h2><p>${description}</p></div></div><div class="scene-actions">${action}</div></section>`;
  }
  function walkView(g) {
    const r=g.region,place=R.regions[r],p=g.progress[r];
    let title=place.quest,desc=R.nextObjective(g),action="",kicker="当前委托",symbol="quill";
    if(g.scene==="world") {
      const i=journeyRegion(g),target=R.regions[i];
      kicker="河道图";title=target.name;symbol="compass";
      desc=g.trip?"此趟河路仍留在图上，也可搭船返镇。":!g.progress[i].accepted?`进入${target.town}，到${target.lodge}找${target.keeper}。`:g.endingSeen?"沿三盏航灯自由往返。":`可在${target.town}整备，再去${target.road}。`;
      action=g.trip?button("回到"+place.road,"road",r,"gold-btn","trail"):button("前往"+target.town,"town",i,"gold-btn","sail");
    } else if(g.scene==="town") {
      if(!p.accepted||p.lit&&!p.claimed) action=button("进入"+place.lodge,"room","lodge","gold-btn","house");
      else if(r===0&&!g.learned.includes("ward")) action=button("拜访"+place.mentor,"room","temple","gold-btn","shrine");
      else if(p.claimed&&g.unlocked>r) action=button("展开河道图","world",undefined,"gold-btn","compass");
      else action=button("前往"+place.road,"road",r,"gold-btn","trail");
    } else {
      kicker="河岸路标";symbol="trail";
      if(!p.road) action=button("穿过"+place.road,"fight","road","gold-btn","sword");
      else if(place.work&&!p.work) action=button(place.work,"work",undefined,"gold-btn","quill");
      else if(!p.boss) action=button("挑战"+R.enemies[place.bossEnemy].name,"fight","boss","gold-btn","sword");
      else if(!p.lit) action=button("走进"+place.lamp,"room","lamp","gold-btn","lantern");
      else action=button("乘船返镇","town",r,"gold-btn","sail");
      if(!p.lit) action=button("返回城镇","town",r,"text-btn","back")+action;
    }
    return tools()+routeSheet(kicker,title,desc,action,symbol);
  }
  function roomView(g,ui) {
    const r=g.region,p=g.progress[r],place=R.regions[r];
    let who="",speech="",actions="";
    if(g.room==="lodge") {
      who=place.keeper;
      speech=!p.accepted?place.request:p.lit&&!p.claimed?"我看见对岸的灯了。坐吧，这张符卡是为你留的。":
        p.claimed?"船回来了。柜台有新的符卡，桌边也能歇脚。":r===0?"出镇前，去教堂找艾琳吧。桥头那些小家伙最爱挡路。":"沿岸走，遇见路标就停下来看看。";
      if(!p.accepted) actions+=button(r===0?"接下委托，领取牌匣":"接下委托","accept",undefined,"gold-btn","quill");
      if(p.lit&&!p.claimed) actions+=button("交付委托","claim",undefined,"gold-btn","lantern");
      actions+=button("看看货物","modal","shop","paper-btn","cards")+button("歇脚","rest",undefined,"paper-btn","leaf");
    } else if(g.room==="lamp") {
      who=place.lamp;speech=p.lit?place.litText:"灯罩里还留着一点余温。把带来的灯芯安进去，河面就有了路标。";
      actions=p.lit?button("乘船返镇","town",r,"gold-btn","sail")+button("灯下歇脚","rest",undefined,"paper-btn","leaf"):
        button("点亮航灯","light",undefined,"gold-btn","lantern");
    } else {
      const witch=g.room==="witch";
      who=witch?place.witchMentor:place.mentor;
      const skills=R.lessonsAt(g);
      const available=skills.filter(id=>!g.learned.includes(id));
      const next=available[0];
      speech=next?`我教你「${R.skills[next].name}」。${R.skills[next].description}`:
        r===0&&!p.claimed?"「护念」已经挂在你的腰带上了。等看到远岸的灯，我再教你如何看破弱点。":
        r===2?"练习灯偶就在这里。用丰页打开牌匣，试试连出八张牌。":"护符已经交给你了，翻开牌匣可以重新安排腰带上的位置。";
      actions=available.map(id=>button("学习"+R.skills[id].name,"learn",id,"gold-btn","star")).join("");
      if(r===2) actions+=button("学院试炼","fight","trial","paper-btn","sword");
      if(!next) actions+=button("整理法术","modal","spells","paper-btn","bag");
    }
    actions+=button(g.room==="lamp"?"回到岸边":"走出房门","back",undefined,"text-btn","back");
    return `<section class="dialogue-sheet"><div class="dialogue-copy"><div class="dialogue-name"><strong>${who}</strong><small>${place[g.room]}</small></div><p>${ui.say||speech}</p></div><div class="scene-actions">${actions}</div></section>`;
  }
  function conclusion(g) {
    const won=g.scene==="ending", place=R.regions[g.checkpoint??0];
    return `<div class="conclusion"><section class="parchment">${icon(won?"sail":"lantern",46)}<h2>${won?"雾河复航":"灯还在等你"}</h2><p>${won?"港口响起三声船钟。白苇、苔桥、雾钟的灯火，一盏接一盏亮到天边。摆渡人在首班船上给你留了位置。":`这次未能走过河岸。你遇到的词已经记入手札，可以在${g.checkpoint===null?"白苇镇船屋":place.lamp}休整再出发。`}</p>${button(won?"乘首班船返航":"在灯下醒来",won?"finish":"revive",undefined,"gold-btn",won?"sail":"leaf")}</section></div>`;
  }
  function modal(g,ui,options,onTitle) {
    const which=ui.modal;
    const dismiss=round("关闭","close","close").replace('class="hud-btn"','class="hud-btn dismiss"');
    let title="",body="";
    if(which==="help") {
      title="旅人指南";
      body=`<ul class="guide-list"><li><strong>启程</strong>　点河道图上的白苇镇，进入船屋向摆渡人领取符卡。</li><li><strong>出牌</strong>　先选日语手牌，再点怪物头顶意思相同的中文弱点。答对可以继续行动。</li><li><strong>失误</strong>　怪物执行一次预告动作。指向旅人头顶的错卡可复习，手牌用完才换回合。</li><li><strong>法术</strong>　向导师学艺，再点腰带上的护符消耗法力施法。</li><li><strong>操作</strong>　中键拖动地图，滚轮缩放，右键查看对象，Esc 收起浮窗或暂停。</li></ul>`;
    } else if(which==="pause") {
      title="灯下小憩";
      body=`<p>${R.nextObjective(g)}。</p><div class="scene-actions">${button("继续旅程","close",undefined,"gold-btn","sail")}${button("设置","modal","settings")}${button("游玩指南","modal","help")}${button("回到标题","to-title")}</div>`;
    } else if(which==="settings") {
      title="设置";
      body=`<div class="options-row"><span>游戏声音</span>${button(options.sound?"已开启":"已关闭","sound",undefined,"paper-btn",options.sound?"volume":"mute")}</div>
        <label class="options-row">音量<input aria-label="音量" data-volume type="range" min="0" max="100" value="${options.volume}"></label>
        <div class="options-row"><span>文字大小</span>${button(options.large?"放大":"标准","text-size")}</div>
        <div class="options-row"><span>画面</span>${button(document.fullscreenElement?"退出全屏":"进入全屏","fullscreen",undefined,"paper-btn","fullscreen")}</div>`;
    } else if(which==="restart") {
      title="另启旅程";
      body=`<p>当前旅程在${R.regions[g.region].name}。重新启程会覆盖这份本地存档。</p><div class="scene-actions">${button("保留当前旅程","close")}${button("重新启程","start",undefined,"gold-btn","sail")}</div>`;
    } else if(which==="side") {
      const trip=g.trip;
      title=R.regions[g.region].site;
      if(!g.progress[g.region].road) body="<p>先通过桥头的遭遇，再沿小径下河滩。</p>";
      else if(trip.used) body="<p>这一趟的河滩已经探过了。</p>";
      else {
        const merchant=trip.kind==="merchant",spirit=trip.kind==="spirit";
        body=merchant?`<p>行商翻开一张「${R.cards[trip.offer].jp}」（${R.cards[trip.offer].zh}），开价 ${R.shopPrice} 枚铜币。你有 ${g.gold} 枚。</p>`:
          `<p>${spirit?"一盏折纸灯笼浮在浅滩上，像是在邀请你比试。":"芦苇间卡着一只随水漂来的货箱，箱盖还没有打开。"}</p>`;
        body+=`<div class="scene-actions">${button(merchant?"买下词卡":spirit?"接受试炼":"打开货箱","side",undefined,"gold-btn",merchant?"coin":spirit?"sword":"bag")}</div>`;
      }
    } else if(which==="inspect") {
      const enemy=g.battle?.enemies.find(e=>e.id===ui.enemy);
      if(!enemy) return "";
      title=R.enemies[enemy.kind].name;
      body=`<p>${R.enemies[enemy.kind].description}</p><p>生命 ${enemy.hp} / ${enemy.maxHp}　·　下一行动「${R.intent(g.battle,enemy)}」</p>`;
    } else return "";
    return `<div class="shade"><section role="dialog" aria-modal="true" aria-label="${title}" class="parchment">${dismiss}<h2>${title}</h2>${body}</section></div>`;
  }
  R.travelView={header,titleView,landmarks,walkView,roomView,conclusion,modal,button};
})();
