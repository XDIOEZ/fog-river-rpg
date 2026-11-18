(() => {
  'use strict';
  const R = globalThis.River ??= {};
  const saveKey = 'fog-river.journey.v1';
  const regions = [
    {
      name: '白苇渡口', town: '白苇镇', lodge: '渡口船屋', temple: '村庄教堂',
      road: '白苇道', site: '芦苇河滩', lamp: '旧灯房', keeper: '摆渡人卢卡斯', mentor: '修女艾琳',
      quest: '重燃渡灯', request: '巡夜钟都敲过了，对岸还是黑的。带上这根灯芯吧，我年轻时用的符卡也借你一趟。',
      work: '', litText: '灯芯噼啪亮起。远岸有人举起船灯，第一根缆绳终于松开了。',
      roadEnemy: 'slime', sideEnemy: 'spirit', bossEnemy: 'guardian'
    },
    {
      name: '苔桥集市', town: '苔桥集市', lodge: '河岸货栈', temple: '法师小屋', witch: '林缘女巫小屋',
      road: '青石栈道', site: '回水浅滩', lamp: '驳船灯架', keeper: '公会管事米拉', mentor: '符文师诺亚', witchMentor: '女巫薇拉',
      quest: '寻回驳船', request: '公会的驳船一夜没进港。岸边的货签上还粘着双羽蜡印，请顺着它们找找那艘船。',
      work: '辨认货签', workText: '你抹去货签上的泥，认出公会的双羽蜡印。搁浅的驳船就在河湾后。',
      litText: '驳船上的六角铜灯亮了。集市敲响短钟，装满货箱的船沿灯号靠岸。',
      roadEnemy: 'armor', sideEnemy: 'scribe', bossEnemy: 'warden'
    },
    {
      name: '雾钟港', town: '雾钟港', lodge: '引航人值房', temple: '法术学院',
      road: '雾钟堤岸', site: '钟影河汊', lamp: '港口主灯', keeper: '引航官奥恩', mentor: '导师希尔维',
      quest: '长河复航', request: '我给你留了首班船的船头。等闸门升起、塔顶重新发光，我们就沿着三盏航灯一起回白苇。',
      work: '开启水闸', workText: '闸柄上的银纹透出微光，齿轮终于松动了。水闸升起，塔顶传来一声长钟。',
      litText: '主灯的光扫过雾钟港，中下游的航灯逐一回应。奥恩在码头摘帽，首班船等你归航。',
      roadEnemy: 'caller', sideEnemy: 'mimic', bossEnemy: 'beacon'
    }
  ];
  const canTravel = g => ['world', 'town', 'room', 'road'].includes(g.scene);
  const inside = (g, room) => g.scene === 'room' && g.room === room;
  const capacity = g => Math.min(50, 10 + (g.level - 1) * 2);
  const canGear = g => g.scene === 'town' || (g.scene === 'room' && (g.room !== 'lamp' || g.progress[g.region].lit));
  const canVisit = (g, region) => Number.isInteger(region) && region >= 0 && region <= g.unlocked;
  const needXP = level => 8 + 2 * (level - 1);
  const shopPrice = 8;
  const afterVoyage = g => g.endingSeen;
  const tutors = [
    ['ward', 0, 'temple'], ['insight', 0, 'temple', g => g.progress[0].claimed],
    ['redraw', 1, 'temple'], ['foretell', 1, 'temple', afterVoyage],
    ['burst', 1, 'witch'], ['chain', 1, 'witch', afterVoyage],
    ['pages', 2, 'temple'], ['reveal', 2, 'temple', afterVoyage]
  ];

  function newGame(seed = Date.now()) {
    return {
      version: 1, rng: seed >>> 0, scene: 'world', room: null, region: 0, unlocked: 0,
      progress: regions.map(() => ({ accepted: false, road: false, work: false, boss: false, lit: false, claimed: false })),
      visited: ['0:world'], trip: null, checkpoint: null, endingSeen: false, tutorialSeen: false,
      level: 1, xp: 0, hp: 12, maxHp: 12, mp: 4, maxMp: 4, gold: 0,
      collection: {}, nextCard: 1, deck: [], learned: [], slots: [null, null, null, null], profile: {},
      battle: null, encounter: null, loot: null
    };
  }

  function saveGame(g, storage) {
    try {
      (storage ?? globalThis.localStorage).setItem(saveKey, JSON.stringify(g));
      return true;
    } catch {
      return false;
    }
  }

  function loadGame(storage) {
    try {
      const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(saveKey));
      return saved?.version === 1 ? saved : null;
    } catch {
      return null;
    }
  }

  function visit(g, scene, room = null) {
    g.scene = scene;
    g.room = room;
    const location = g.region + ':' + (room ?? scene);
    if (!g.visited.includes(location)) g.visited.push(location);
  }

  function addCard(g, wordId) {
    const instance = 'c' + g.nextCard++;
    g.collection[instance] = wordId;
    g.profile[wordId] ??= { correct: 0, wrong: 0, firstRegion: g.region, lastRegion: g.region, lastMiss: null };
    return instance;
  }

  function receiveXP(g, xp) {
    g.xp += xp;
    while (g.xp >= needXP(g.level)) {
      g.xp -= needXP(g.level);
      g.level++;
      g.maxHp++;
      g.maxMp = 4 + Math.min(4, Math.floor((g.level - 1) / 5));
    }
  }

  function enterTown(g, value = g.region) {
    const region = Number(value);
    if (!canTravel(g) || !canVisit(g, region)) return false;
    g.region = region;
    g.trip = null;
    visit(g, 'town');
    return '抵达' + regions[region].town;
  }

  function openRoom(g, room) {
    const place = regions[g.region];
    if (room === 'lamp') {
      if (g.scene !== 'road' || !g.progress[g.region].boss) return false;
    } else if (g.scene !== 'town' || !['lodge', 'temple', 'witch'].includes(room) || !place[room]) {
      return false;
    }
    visit(g, 'room', room);
    return '走进' + place[room];
  }

  function takeRoad(g, value = g.region) {
    const region = Number(value);
    if (!canTravel(g) || !canVisit(g, region) || !g.progress[region].accepted) return false;
    // Changing river sections goes through a town. Opening the map keeps the current outing.
    if (g.trip && g.trip.region !== region) return false;
    g.region = region;
    if (!g.trip) {
      const kind = ['chest', 'merchant', 'spirit'][Math.floor(R.random(g) * 3)];
      const pool = R.pools[region];
      const offer = kind === 'merchant' ? pool[Math.floor(R.random(g) * pool.length)] : null;
      g.trip = { region, kind, used: false, offer };
    }
    visit(g, 'road');
    return '踏上' + regions[region].road;
  }

  function closeScene(g) {
    if (inside(g, 'lamp')) return takeRoad(g);
    if (g.scene === 'room') return enterTown(g);
    if (g.scene !== 'road' && g.scene !== 'town') return false;
    visit(g, 'world');
    return '展开河道图';
  }

  function acceptQuest(g) {
    const p = g.progress[g.region];
    if (!inside(g, 'lodge') || p.accepted) return false;
    p.accepted = true;
    if (g.region === 0) {
      g.deck = R.starter.map(wordId => addCard(g, wordId));
      return '卢卡斯递来一根干灯芯，又把装着十张符卡的旧牌匣塞进你手里。';
    }
    return '接下委托「' + regions[g.region].quest + '」。';
  }

  function claimQuest(g) {
    const p = g.progress[g.region];
    if (!inside(g, 'lodge') || !p.lit || p.claimed) return false;
    p.claimed = true;
    const reward = R.questCards[g.region];
    addCard(g, reward);
    if (g.region === regions.length - 1) {
      g.scene = 'ending';
      g.room = null;
      return '港口响起三声船钟。首班船正等你登船。';
    }
    g.unlocked = Math.max(g.unlocked, g.region + 1);
    return '收下「' + R.cards[reward].jp + '」，前往' + regions[g.region + 1].name + '的渡船通航了。';
  }

  function lessonsAt(g) {
    return tutors.filter(([, region, room, ready]) =>
      g.region === region && inside(g, room) && (!ready || ready(g))).map(([skill]) => skill);
  }

  function learn(g, skill) {
    if (!lessonsAt(g).includes(skill) || g.learned.includes(skill)) return false;
    g.learned.push(skill);
    const slot = g.slots.indexOf(null);
    if (slot >= 0) g.slots[slot] = skill;
    return '学会「' + R.skills[skill].name + '」' + (slot >= 0 ? '，已挂上法术腰带。' : '，可以在牌匣中调整装备。');
  }

  function changeSlot(g, { index, skill } = {}) {
    if (!canGear(g) || !Number.isInteger(index) || index < 0 || index >= 4) return false;
    if (g.slots[index] === skill || (skill !== null && !g.learned.includes(skill))) return false;
    const previous = skill === null ? -1 : g.slots.indexOf(skill);
    if (previous >= 0) g.slots[previous] = g.slots[index];
    g.slots[index] = skill;
    return skill === null ? '取下了护符。' : '将「' + R.skills[skill].name + '」挂到腰带上。';
  }

  function changeDeck(g, { add, remove } = {}) {
    if (!canGear(g) || (!add && !remove) || (add && (!g.collection[add] || g.deck.includes(add)))) return false;
    const index = remove ? g.deck.indexOf(remove) : g.deck.length;
    if (index < 0) return false;
    const next = [...g.deck];
    next.splice(index, remove ? 1 : 0, ...(add ? [add] : []));
    if (next.length < 5 || next.length > capacity(g)) return false;
    if (add && next.filter(id => g.collection[id] === g.collection[add]).length > 2) return false;
    g.deck = next;
    return '牌匣已整理，带上 ' + next.length + ' 张符卡。';
  }

  function beginFight(g, source) {
    const p = g.progress[g.region], place = regions[g.region];
    let kind;
    if (source === 'trial') {
      if (g.region !== 2 || !inside(g, 'temple')) return false;
      kind = 'trial';
    } else {
      if (g.scene !== 'road' || !g.trip) return false;
      if (source === 'road') kind = place.roadEnemy;
      else if (source === 'side' && p.road && g.trip.kind === 'spirit' && !g.trip.used) kind = place.sideEnemy;
      else if (source === 'boss' && p.road && (!place.work || p.work) && !p.boss) kind = place.bossEnemy;
      else return false;
    }
    if (g.deck.length < 5) return false;
    const first = g.region === 0 && source === 'road' && !g.tutorialSeen;
    if (first) g.tutorialSeen = true;
    g.encounter = { source, region: g.region, kind };
    g.scene = 'battle';
    g.room = null;
    R.battleStart(g, kind, first);
    return '遭遇' + R.enemies[kind].name;
  }

  function advanceBattle(g) {
    if (g.scene !== 'battle' || !g.battle || g.battle.status === 'active') return false;
    if (g.battle.status === 'lost') {
      g.scene = 'defeat';
      return '旅人倒在了河岸边。';
    }
    if (g.battle.status !== 'won') return false;
    const { region, source } = g.encounter;
    const purse = 4 * (region + 1) * (source === 'boss' ? 2 : 1);
    g.loot = { source, choices: R.shuffle(g, R.pools[region]).slice(0, 3), gold: purse, xp: purse };
    g.scene = 'loot';
    return '胜利。挑一张符卡收入牌匣。';
  }

  function takeLoot(g, wordId) {
    if (g.scene !== 'loot' || !g.loot.choices.includes(wordId)) return false;
    const { source, gold, xp } = g.loot, p = g.progress[g.region];
    addCard(g, wordId);
    g.gold += gold;
    receiveXP(g, xp);
    if (source === 'road') p.road = true;
    if (source === 'boss') p.boss = true;
    if (source === 'side') g.trip.used = true;
    g.loot = g.battle = g.encounter = null;
    if (source === 'trial') visit(g, 'room', 'temple');
    else visit(g, 'road');
    return '收下「' + R.cards[wordId].jp + '」和 ' + gold + ' 枚铜币。';
  }

  function revive(g) {
    if (g.scene !== 'defeat') return false;
    g.hp = g.maxHp;
    g.battle = g.encounter = g.loot = null;
    g.region = g.checkpoint ?? 0;
    const lamp = g.checkpoint !== null;
    if (!lamp || g.trip?.region !== g.region) g.trip = null;
    const room = lamp ? 'lamp' : 'lodge';
    visit(g, 'room', room);
    return '你在' + regions[g.region][room] + '醒来，生命已经恢复。';
  }

  function buy(g, wordId) {
    if (!inside(g, 'lodge') || g.gold < shopPrice || !R.pools[g.region].includes(wordId)) return false;
    g.gold -= shopPrice;
    addCard(g, wordId);
    return '花 ' + shopPrice + ' 枚铜币收下「' + R.cards[wordId].jp + '」。';
  }

  function side(g) {
    if (g.scene !== 'road' || !g.progress[g.region].road || !g.trip || g.trip.used) return false;
    if (g.trip.kind === 'spirit') return beginFight(g, 'side');
    if (g.trip.kind === 'merchant') {
      if (g.gold < shopPrice) return false;
      g.gold -= shopPrice;
      addCard(g, g.trip.offer);
      g.trip.used = true;
      return '从行商手中收下「' + R.cards[g.trip.offer].jp + '」。';
    }
    g.gold += 4;
    g.trip.used = true;
    return '撬开漂来的货箱，找到 4 枚铜币。';
  }

  const actions = {
    town: enterTown, room: openRoom, road: takeRoad, back: closeScene, accept: acceptQuest,
    claim: claimQuest, learn, deck: changeDeck, slot: changeSlot, fight: beginFight,
    take: takeLoot, revive, buy, side,
    world(g) {
      if (!canTravel(g)) return false;
      visit(g, 'world');
      return '展开河道图';
    },
    work(g) {
      const p = g.progress[g.region], place = regions[g.region];
      if (g.scene !== 'road' || !place.work || !p.road || p.work) return false;
      p.work = true;
      return place.workText;
    },
    light(g) {
      const p = g.progress[g.region];
      if (!inside(g, 'lamp') || !p.boss || p.lit) return false;
      p.lit = true;
      g.hp = g.maxHp;
      g.checkpoint = g.region;
      return regions[g.region].litText;
    },
    rest(g) {
      const lamp = inside(g, 'lamp') && g.progress[g.region].lit;
      if (!lamp && !inside(g, 'lodge')) return false;
      if (lamp) g.checkpoint = g.region;
      g.hp = g.maxHp;
      return '在灯下歇了片刻，生命已恢复。';
    },
    finish(g) {
      if (g.scene !== 'ending') return false;
      g.endingSeen = true;
      g.region = 0;
      g.trip = null;
      visit(g, 'town');
      return '首班船抵达白苇镇。三段河道已可自由往返。';
    }
  };

  function nextObjective(g) {
    const p = g.progress[g.region], place = regions[g.region];
    if (!p.accepted) return '到' + place.lodge + '找' + place.keeper;
    if (g.region === 0 && !p.road && !g.learned.includes('ward')) return '到' + place.temple + '拜访' + place.mentor;
    if (!p.road) return '穿过' + place.road;
    if (place.work && !p.work) return place.work;
    if (!p.boss) return '击退' + R.enemies[place.bossEnemy].name;
    if (!p.lit) return '走进' + place.lamp + '，点亮航灯';
    if (!p.claimed) return '回到' + place.lodge + '向' + place.keeper + '报信';
    if (g.region + 1 < regions.length && !g.progress[g.region + 1].claimed) return '搭船前往' + regions[g.region + 1].name;
    return '沿已经点亮的河道自由航行';
  }

  function worldAction(g, action, value) {
    return Object.hasOwn(actions, action) ? actions[action](g, value) : false;
  }
  Object.assign(R, { regions, newGame, saveGame, loadGame, saveKey, capacity, canGear, needXP, shopPrice, lessonsAt, worldAction, nextObjective, advanceBattle });
})();
