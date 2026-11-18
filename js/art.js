(function riverArt() {
  "use strict";
  const R = globalThis.River ||= {};
  const icons = {
    lantern: '<path d="M9 3h6m-5 0V1m4 2V1M6 7l3-3h6l3 3M6 8h12l-1.4 10H7.4zM9 20h6m-3-10v6m-2-3h4"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back: '<path d="m11 5-7 7 7 7M5 12h15"/>',
    book: '<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1zM12 6v14"/>',
    grimoire: '<path d="m12 4 1.3 3.6L17 9l-3.7 1.4L12 14l-1.4-3.6L7 9l3.6-1.4zM8 5Q5 4 2 5v13q5-1 10 2 5-3 10-2V5q-3-1-6 0M12 16v4"/>',
    volume: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8q4 4 0 8m3-11q7 7 0 14"/>',
    mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
    fullscreen: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
    pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
    close: '<path d="m5 5 14 14m0-14L5 19"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 7-2 7-7 3 3-7z"/>',
    sail: '<path d="M12 2v15M10 4 3 15h7zm4 2 6 9h-6zM2 17h20l-4 4H6z"/>',
    house: '<path d="m2 10 10-7 10 7M5 9v11h14V9m-9 11v-6h4v6"/>',
    shrine: '<path d="m8 11 4-8 4 8M9 10v10h6V10M3 21h18M4 20v-7l5-3m6 0 5 3v7m-9 1v-5a1 1 0 0 1 2 0v5M12 1v3"/>',
    trail: '<path d="M2 18q5-10 10-4t10-8M2 21q5-9 10-4t10-8"/>',
    sword: '<path d="m5 18 11-13 5-2-1 5L8 20M3 16l6 6m-4-3-3 3"/>',
    claws: '<path d="m5 18 6-13m-1 14 6-14m-1 14 6-13"/>',
    leaf: '<path d="M4 19C2 9 8 4 21 3c-1 11-6 16-14 15m-4 4L17 8"/>',
    heart: '<path d="M12 20S2 14 2 8c0-5 7-7 10-1 3-6 10-4 10 1 0 6-10 12-10 12z"/>',
    mana: '<path d="m12 2 8 11-8 9-8-9zM12 5v13"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="m12 8 4 4-4 4-4-4z"/>',
    bag: '<path d="M7 8 5 4l4 1 3-2 3 2 4-1-2 4M7 9h10m-10 1C-2 21 6 22 12 22s14-1 5-12"/>',
    cards: '<path d="m3 6 11-3 4 14-11 3zM10 6l10 1-1 14-11-1"/>',
    shield: '<path d="m12 3 8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6zM12 7v10"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    redraw: '<path d="M4 10a8 8 0 0 1 14-4l2 3M20 4v5h-5m5 5a8 8 0 0 1-14 4l-2-3m0 5v-5h5"/>',
    burst: '<path d="m14 2-2 7 8-3-4 6 6 2-8 2 1 6-5-5-6 4 3-7-6-1 7-4-1-5 4 4z"/>',
    pages: '<path d="m3 7 8 2v12l-8-3zm10 2 8-3v12l-8 3zm-5-6 6 2 5-2"/>',
    pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0z"/><circle cx="12" cy="9" r="2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
    star: '<path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/>',
    quill: '<path d="M3 21 16 8M7 16C5 6 15 5 22 2c-1 7-4 16-15 14z"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    hand: '<path d="M8 12V6a2 2 0 0 1 4 0v4-6a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v7q0 5-4 7H9l-7-8a2 2 0 0 1 3-2l3 3z"/>',
    settings: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 3v6m9 0v6m-9 0v6" stroke-width="3"/>',
    plus: '<path d="M5 12h14m-7-7v14"/>',
    minus: '<path d="M5 12h14"/>'
  };
  function icon(name, size = 22) {
    return `<svg aria-hidden="true" class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.star}</svg>`;
  }
  const fields = ["shore", "ridge", "highshore"];
  const schools = ["chapel", "atelier", "academy"];
  const keepers = ["lucas", "mira", "orn"];
  const mentors = ["irene", "noah", "sylvi"];

  function picture(folder, name, className = "") {
    return `<img class="${className}" src="art/${folder}/${name}.webp" alt="" draggable="false">`;
  }

  function riverLights(lights) {
    const reaches = [
      "M -2 89 C 8 87 5 76 13 72 S 18 70 22 67",
      "M 22 67 C 30 62 33 69 43 64 S 44 55 51 53 S 60 52 62 48",
      "M 62 48 C 67 45 63 42 69 39 S 80 41 86 33 S 87 24 95 17"
    ];
    const litRoutes = reaches.map((path, i) => lights[i] ? `<path d="${path}"/>` : "").join("");
    return litRoutes ? `<svg class="river-lights" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">${litRoutes}</svg>` : "";
  }

  function scene(type, region = 0, lit = false, room = "", lights = []) {
    let plate = fields[region], actor = "";
    if (type === "title") plate = "cover";
    else if (type === "world") plate = "atlas";
    else if (type === "town") plate = "town" + region;
    else if (type === "ending") plate = "highshore";
    else if (type === "room") {
      if (room === "lodge") {
        plate = lit ? "guild-lit" : "guild";
        actor = keepers[region];
      } else if (room === "lamp") {
        plate = lit ? "lamp-lit" : "lamp";
      } else {
        plate = room === "witch" ? "witchery" : schools[region];
        actor = room === "witch" ? "vera" : mentors[region];
      }
    }
    const atlas = type === "world" || type === "town";
    let layers = atlas ? picture("scenes", plate, "map-wash") : "";
    layers += picture("scenes", plate, "scene-paint paint-" + type + " plate-" + plate);
    if (actor) layers += picture("actors", actor, "room-character at-" + plate);
    if (type === "world") layers += riverLights(lights);
    if (type === "room" && room === "lamp" && lit) layers += '<i class="wick-light" aria-hidden="true"></i>';
    return layers;
  }

  const hero = () => picture("actors", "hero");
  const enemy = kind => picture("enemies", kind === "trial" ? "guardian" : kind, kind === "trial" ? "academy-guardian" : "");
  const portrait = () => picture("actors", "portrait");
  R.art = { scene, icon, enemy, hero, portrait };
})();
