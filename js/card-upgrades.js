(() => {
  'use strict';
  const R = globalThis.River;
  const maxRank = 3;

  // Hand-picked word families make the earliest upgrades teach genuinely new
  // related vocabulary. All other words fall back to valid contextual phrases.
  // Each entry is [Japanese, Chinese meaning, pronunciation].
  const paths = {
    'みず': [['大海', '大海', 'たいかい'], ['大海原', '辽阔的大海', 'おおうなばら'], ['海洋生態系', '海洋生态系统', 'かいようせいたいけい']],
    'やま': [['山川', '山川', 'さんせん'], ['山岳地帯', '山岳地带', 'さんがくちたい'], ['山岳生態系', '山地生态系统', 'さんがくせいたいけい']],
    '人（ひと）': [['ロボット', '机器人', 'ロボット'], ['人型ロボット', '人形机器人', 'ひとがたロボット'], ['自律型ロボット', '自主机器人', 'じりつがたロボット']],
    'いし': [['鉱石', '矿石', 'こうせき'], ['鉱物資源', '矿产资源', 'こうぶつしげん'], ['地質構造', '地质构造', 'ちしつこうぞう']],
    'かぜ': [['突風', '阵风', 'とっぷう'], ['気象現象', '气象现象', 'きしょうげんしょう'], ['大気循環', '大气环流', 'たいきじゅんかん']],
    'ふね': [['船舶', '船舶', 'せんぱく'], ['貨物船', '货船', 'かもつせん'], ['海上輸送', '海上运输', 'かいじょうゆそう']],
    'つき': [['月面', '月球表面', 'げつめん'], ['月面探査', '月球探测', 'げつめんたんさ'], ['月面基地', '月球基地', 'げつめんきち']],
    'いえ': [['住宅', '住宅', 'じゅうたく'], ['集合住宅', '集合住宅', 'しゅうごうじゅうたく'], ['都市計画', '城市规划', 'としけいかく']],
    'ほし': [['恒星', '恒星', 'こうせい'], ['天体観測', '天体观测', 'てんたいかんそく'], ['宇宙物理学', '天体物理学', 'うちゅうぶつりがく']],
    'かさ': [['日傘', '遮阳伞', 'ひがさ'], ['折りたたみ傘', '折叠伞', 'おりたたみがさ'], ['防水技術', '防水技术', 'ぼうすいぎじゅつ']],
    'いぬ': [['番犬', '看门狗', 'ばんけん'], ['警察犬', '警犬', 'けいさつけん'], ['動物行動学', '动物行为学', 'どうぶつこうどうがく']],
    '海（うみ）': [['大海原', '辽阔的大海', 'おおうなばら'], ['海洋生物', '海洋生物', 'かいようせいぶつ'], ['海洋生態系', '海洋生态系统', 'かいようせいたいけい']],
    '川（かわ）': [['河川', '江河', 'かせん'], ['流域', '流域', 'りゅういき'], ['河川生態系', '河流生态系统', 'かせんせいたいけい']],
    '火（ひ）': [['火炎', '火焰', 'かえん'], ['燃焼反応', '燃烧反应', 'ねんしょうはんのう'], ['熱エネルギー', '热能', 'ねつエネルギー']],
    '雨（あめ）': [['豪雨', '暴雨', 'ごうう'], ['集中豪雨', '局部强降雨', 'しゅうちゅうごうう'], ['降水量', '降水量', 'こうすいりょう']],
    '雪（ゆき）': [['吹雪', '暴风雪', 'ふぶき'], ['積雪', '积雪', 'せきせつ'], ['雪崩対策', '雪崩防范措施', 'なだれたいさく']],
    '木（き）': [['森林', '森林', 'しんりん'], ['森林資源', '森林资源', 'しんりんしげん'], ['森林生態系', '森林生态系统', 'しんりんせいたいけい']],
    '花（はな）': [['花束', '花束', 'はなたば'], ['開花時期', '开花时期', 'かいかじき'], ['植物生態学', '植物生态学', 'しょくぶつせいたいがく']],
    '魚（さかな）': [['海水魚', '海水鱼', 'かいすいぎょ'], ['水産資源', '水产资源', 'すいさんしげん'], ['海洋生物学', '海洋生物学', 'かいようせいぶつがく']],
    '猫（ねこ）': [['野良猫', '流浪猫', 'のらねこ'], ['保護猫', '获救收养的猫', 'ほごねこ'], ['動物福祉', '动物福利', 'どうぶつふくし']],
    '本（ほん）': [['小説', '小说', 'しょうせつ'], ['文学作品', '文学作品', 'ぶんがくさくひん'], ['文学批評', '文学评论', 'ぶんがくひひょう']],
    '学校（がっこう）': [['大学', '大学', 'だいがく'], ['高等教育', '高等教育', 'こうとうきょういく'], ['教育制度', '教育制度', 'きょういくせいど']],
    '車（くるま）': [['自動車', '机动车', 'じどうしゃ'], ['電気自動車', '电动汽车', 'でんきじどうしゃ'], ['自動運転技術', '自动驾驶技术', 'じどううんてんぎじゅつ']],
    '電車（でんしゃ）': [['新幹線', '新干线', 'しんかんせん'], ['高速鉄道', '高速铁路', 'こうそくてつどう'], ['鉄道交通網', '铁路交通网络', 'てつどうこうつうもう']],
    '友達（ともだち）': [['親友', '挚友', 'しんゆう'], ['信頼関係', '信任关系', 'しんらいかんけい'], ['人間関係', '人际关系', 'にんげんかんけい']],
    '先生（せんせい）': [['教師', '教师', 'きょうし'], ['教育者', '教育工作者', 'きょういくしゃ'], ['教育心理学', '教育心理学', 'きょういくしんりがく']],
    '行く（いく）': [['出発する', '出发', 'しゅっぱつする'], ['目的地に向かう', '前往目的地', 'もくてきちにむかう'], ['目的地への経路を確認する', '确认前往目的地的路线', 'もくてきちへのけいろをかくにんする']],
    '食べる（たべる）': [['食事をする', '用餐', 'しょくじをする'], ['栄養を摂取する', '摄取营养', 'えいようをせっしゅする'], ['栄養バランスを考える', '考虑营养均衡', 'えいようバランスをかんがえる']],
    '見る（みる）': [['観察する', '观察', 'かんさつする'], ['詳しく分析する', '详细分析', 'くわしくぶんせきする'], ['客観的に評価する', '客观评价', 'きゃっかんてきにひょうかする']],
    'kana_shu': [['週末', '周末', 'しゅうまつ'], ['週末旅行', '周末旅行', 'しゅうまつりょこう'], ['週末の旅行計画', '周末旅行计划', 'しゅうまつのりょこうけいかく']],
    'kana_kyo': [['今日', '今天', 'きょう'], ['今日の予定', '今天的安排', 'きょうのよてい'], ['今日の行動計画', '今天的行动计划', 'きょうのこうどうけいかく']]
  };

  const bare = jp => jp.replace(/（[^（）]+）$/u, '');
  const patterns = {
    noun: [
      ['の特徴', 'のとくちょう', '的特征'],
      ['の仕組みと役割', 'のしくみとやくわり', '的结构与作用'],
      ['に関する専門的な研究', 'にかんするせんもんてきなけんきゅう', '的专业研究']
    ],
    verb: [
      ['ための工夫', 'ためのくふう', '的方法技巧'],
      ['ための具体的な方法', 'ためのぐたいてきなほうほう', '的具体方法'],
      ['ための実践的な手順', 'ためのじっせんてきなてじゅん', '的实践步骤']
    ],
    adjective: [
      ['と感じる理由', 'とかんじるりゆう', '的感受原因'],
      ['という特徴を持つ', 'というとくちょうをもつ', '这一特点'],
      ['という評価の根拠', 'というひょうかのこんきょ', '这一评价的依据']
    ],
    language: [
      ['の意味と使い方', 'のいみとつかいかた', '的含义及用法'],
      ['を使った表現', 'をつかったひょうげん', '的相关表达'],
      ['の適切な使い分け', 'のてきせつなつかいわけ', '的恰当用法']
    ]
  };

  function fallback(word, rank) {
    const source = bare(word.jp);
    const group = patterns[word.kind] || (word.kind === 'noun' ? patterns.noun : patterns.language);
    const [suffix, sound, meaning] = group[rank - 1];
    const quoted = group === patterns.language;
    const term = quoted ? '「' + source + '」' : source;
    return [term + suffix, '关于「' + word.zh + '」' + meaning, (quoted ? '「' : '') + word.reading + (quoted ? '」' : '') + sound];
  }

  // Upgrade forms are deterministic global definitions; saving just the word ID
  // keeps existing physical-card IDs, decks and combat logic intact on reload.
  const originals = Object.entries(R.cards);
  const meaningByChinese = new Map(originals.flatMap(([, card]) => card.answers.map(answer => [answer, card.meaning])));
  for (const [baseId, base] of originals) {
    const path = paths[baseId] || paths[base.jp] || [];
    for (let rank = 1; rank <= maxRank; rank++) {
      const [jp, zh, reading] = path[rank - 1] || fallback(base, rank);
      const id = 'upgrade_' + rank + '_' + baseId;
      const meaning = meaningByChinese.get(zh) ?? id;
      meaningByChinese.set(zh, meaning);
      R.cards[id] = {
        jp, zh, reading, meaning, answers: [zh], kind: path[rank - 1] ? (base.kind === 'verb' ? 'verb' : 'noun') : 'phrase',
        level: base.level + rank, upgradeBase: baseId, upgradeRank: rank
      };
    }
  }

  R.upgradeInfo = function (game, instanceId) {
    const currentId = game.collection[instanceId], current = R.cards[currentId];
    if (!current) return null;
    const baseId = current.upgradeBase ?? currentId;
    const rank = current.upgradeRank ?? 0;
    const nextId = rank < maxRank ? 'upgrade_' + (rank + 1) + '_' + baseId : null;
    return {
      current, nextId, next: nextId ? R.cards[nextId] : null, rank,
      cost: nextId ? 4 + 2 * (current.level - 1) : null
    };
  };

  R.upgradeCard = function (game, instanceId) {
    if (!R.canGear(game)) return false;
    const info = R.upgradeInfo(game, instanceId);
    if (!info?.next || game.gold < info.cost) return false;
    game.gold -= info.cost;
    game.collection[instanceId] = info.nextId;
    game.profile[info.nextId] ??= {
      correct: 0, wrong: 0, firstRegion: game.region, lastRegion: game.region, lastMiss: null
    };
    return '「' + info.current.jp + '」进阶为「' + info.next.jp + '」！基础伤害 +1，消耗 ' + info.cost + ' 枚铜币。';
  };
})();
