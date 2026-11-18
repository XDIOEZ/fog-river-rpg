(() => {
  'use strict';
  const R = globalThis.River ??= {};
  const cards = {};
  const boatNames = ['船', '船只', '船舶'];

  // Each list also defines an acquisition pool. A shared meaning links genuine synonyms.
  function register(rows) {
    return rows.map(([id, jp, zh, level, kind = 'noun', options = {}]) => {
      cards[id] = {
        jp, zh, level, kind, reading: options.reading ?? jp,
        meaning: options.meaning ?? id, answers: options.answers ?? [zh]
      };
      return id;
    });
  }

  R.starter = register([
    ['mizu', 'みず', '水', 1],
    ['ishi', 'いし', '石头', 1],
    ['kaze', 'かぜ', '风', 1],
    ['fune', 'ふね', '船', 1, 'noun', { answers: boatNames }],
    ['tsuki', 'つき', '月亮', 1],
    ['yama', 'やま', '山', 1],
    ['ie', 'いえ', '房子', 1],
    ['hoshi', 'ほし', '星星', 1],
    ['kasa', 'かさ', '伞', 1],
    ['inu', 'いぬ', '狗', 1]
  ]);

  R.pools = [
    register([
      ['sora', 'そら', '天空', 1],
      ['kutsu', 'くつ', '鞋', 1],
      ['wataru', 'わたる', '渡过', 2, 'verb'],
      ['terasu', 'てらす', '照亮', 2, 'verb'],
      ['hakobu', 'はこぶ', '搬运', 2, 'verb'],
      ['michishirube', 'みちしるべ', '路标', 2]
    ]),
    register([
      ['minato', 'みなと', '港口', 2],
      ['kippu', 'きっぷ', '车船票', 2],
      ['nimotsu', 'にもつ', '行李', 2],
      ['shina', 'しなもの', '商品', 2],
      ['tegami', 'てがみ', '信件', 2],
      ['hashi_bridge', '橋（はし）', '桥', 2, 'noun', { reading: 'はし' }],
      ['hashi_chopsticks', '箸（はし）', '筷子', 2, 'noun', { reading: 'はし' }],
      ['kana_shu', 'しゅ', 'shu', 2, 'kana'],
      ['kana_kyo', 'キョ', 'kyo', 2, 'kana'],
      ['erabu', 'えらぶ', '挑选', 2, 'verb'],
      ['harau', 'はらう', '支付', 2, 'verb'],
      ['sagasu', 'さがす', '寻找', 2, 'verb'],
      ['todokeru', 'とどける', '送达', 3, 'verb'],
      ['musubu', 'むすぶ', '系结', 3, 'verb'],
      ['senpaku', 'せんぱく', '船舶', 3, 'noun', { meaning: 'fune', answers: boatNames }],
      ['kawagishi', 'かわぎし', '河岸', 3],
      ['nio', 'にをおろす', '卸货', 3, 'phrase'],
      ['ne_fuda', 'ねふだをよむ', '读价签', 3, 'phrase'],
      ['tsuri', 'おつりをもらう', '收下找零', 3, 'phrase'],
      ['rope', 'ロープをほどく', '解开绳索', 4, 'phrase'],
      ['shouhin', 'しょうひんをつつむ', '包好商品', 4, 'phrase']
    ]),
    register([
      ['toudai', 'とうだい', '灯塔', 3],
      ['suimon', 'すいもん', '水闸', 3],
      ['tsuribashi', 'つりばし', '吊桥', 3],
      ['suii', 'すいい', '水位', 3],
      ['funade', 'ふなで', '启航', 3],
      ['kiri', 'きりがはれる', '雾散了', 3, 'phrase'],
      ['kane', 'かねをならす', '敲钟', 3, 'phrase'],
      ['tomosu', 'あかりをともす', '点灯', 3, 'phrase'],
      ['chizu', 'ちずをひらく', '摊开地图', 3, 'phrase'],
      ['mukai', 'むこうぎし', '对岸', 3],
      ['miharasu', 'みはらす', '眺望', 4, 'verb'],
      ['michibiku', 'みちびく', '引导', 4, 'verb'],
      ['shuri', 'しゅうりする', '修理', 4, 'verb'],
      ['kishou', 'てんきをたしかめる', '确认天气', 4, 'phrase'],
      ['tobira', 'とびらをおしあける', '推开大门', 4, 'phrase'],
      ['senro', 'こうろをえらぶ', '选择航线', 4, 'phrase'],
      ['koushin', 'あいずをおくる', '发出信号', 4, 'phrase'],
      ['kanban', 'あんないばんをよむ', '阅读指示牌', 4, 'phrase'],
      ['keikaku', 'けいかくをたてる', '制定计划', 5, 'phrase'],
      ['yoyaku', 'よやくをへんこうする', '更改预约', 5, 'phrase'],
      ['chouten', 'ちょうじょうにたどりつく', '到达山顶', 5, 'phrase'],
      ['shuppan', 'しゅっぱつをしらせる', '通知出发', 5, 'phrase']
    ])
  ];

  R.questCards = register([
    ['akari', 'あかり', '灯光', 2],
    ['funatsuki', 'ふなつきば', '船舶停靠处', 3],
    ['kikou', 'みなとにきこうする', '停靠港口', 5, 'phrase']
  ]);
  R.cards = cards;
  R.wordKinds = { noun: '名词', verb: '动词', phrase: '短语', kana: '假名' };

  R.skills = {
    ward: { name: '护念', cost: 2, target: 'self', description: '挡住下次攻击的 2 点伤害。分裂和蓄势会保留护符。' },
    insight: { name: '看破', cost: 2, target: 'tag', description: '选择一枚弱点，显出答案的第一个假名。' },
    redraw: { name: '重整手牌', cost: 2, target: 'card', description: '选择一张手牌。先抽一张新牌，再弃掉选中的牌。' },
    burst: { name: '舍牌爆发', cost: 3, target: 'card', description: '弃掉一张手牌，下次命中的基础伤害翻倍。' },
    pages: { name: '丰页', cost: 2, target: 'self', description: '接下来的两个回合，每次开局额外抽三张。' },
    foretell: { name: '预习', cost: 2, target: 'self', description: '查看抽牌堆顶的两张牌。只剩一张时查看一张，牌序变动时预告收起。' },
    chain: { name: '连珠之力', cost: 2, target: 'self', description: '连击第二张加 1 点伤害，第三张起加 2 点。出现失误时法术消散。' },
    reveal: { name: '洞悉', cost: 2, target: 'tag', description: '点一个敌人的弱点，为它多亮一枚签。本场每只敌人限一次，需有手牌可对应。' }
  };

  const strike = (name, damage) => ({ type: 'attack', name, damage });
  const effect = (type, name) => ({ type, name });
  const borrow = effect('borrow', '借光');
  const charge = effect('charge', '举灯蓄势');
  const summon = effect('summon', '唤来灯灵');

  R.enemies = {
    slime: { name: '芦叶史莱姆', hp: 12, slots: 2, moves: [strike('扑击', 2), effect('split', '群体分裂')], description: '同群共用一次行动。分裂时平分生命，最多四只。' },
    spirit: { name: '纸灯灵', hp: 9, slots: 1, moves: [borrow, strike('擦碰', 2)], description: '借光让你下一回合多抽三张牌。' },
    guardian: { name: '守灯偶', hp: 16, slots: 2, moves: [charge, strike('横扫', 2)], description: '先举灯蓄势，再横扫。蓄势增加两点攻击。' },
    armor: { name: '铜甲桥卫', hp: 16, slots: 2, armor: 1, moves: [strike('盾击', 2), strike('推撞', 3)], description: '铜甲减去一点伤害，命中至少造成一点。' },
    scribe: { name: '货签书灵', hp: 15, slots: 2, prefers: 'verb', vulnerable: 'verb', moves: [borrow, strike('墨点', 2)], description: '偏好动词，动词命中额外造成一点伤害。' },
    warden: { name: '驳船守卫', hp: 23, slots: 2, shield: true, moves: [strike('撞肩', 2), effect('guard', '架盾')], description: '船盾减去两点伤害。连续命中三次能击破盾面。' },
    caller: { name: '雾笛使', hp: 19, slots: 2, moves: [summon, strike('雾涌', 3)], description: '笛声会唤来一只独立行动的纸灯灵。' },
    mimic: { name: '折影灯羽', hp: 19, slots: 2, moves: [effect('shift', '折光'), strike('振羽', 3)], description: '折光使可见弱点在一枚与三枚之间变化。' },
    beacon: { name: '雾钟守望者', hp: 32, slots: 3, prefers: 'phrase', moves: [charge, strike('鸣钟', 3), summon, strike('回响', 2)], description: '轮流蓄势、鸣钟和召唤。留意钟臂与下一行动。' },
    trial: { name: '试炼灯偶', hp: 40, slots: 3, moves: [borrow, strike('拂袖', 2)], description: '四十点生命。可用丰页练习一手八张的长战。' }
  };

  R.random = function (game) {
    game.rng = (Math.imul(game.rng, 1664525) + 1013904223) >>> 0;
    return game.rng / 4294967296;
  };
  R.shuffle = function (game, values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(R.random(game) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
})();
