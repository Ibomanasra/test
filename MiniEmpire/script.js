/* =========================================================
   Mini Empire — Game Logic
   Vanilla JS, no dependencies. State lives in `state` and is
   persisted to localStorage after every meaningful change.

   Sections:
   1. Config / constants
   2. State (default + current)
   3. Utilities
   4. Resources
   5. Buildings
   6. Population
   7. Workers
   8. Upgrades
   9. Village level / win condition
   10. Random events
   11. Day cycle
   12. Save / load
   13. UI rendering
   14. Event binding & init
   ========================================================= */

/* ---------------------------------------------------------
   1. Config / constants
   --------------------------------------------------------- */

const SAVE_KEY = "miniEmpireSave";
const EVENT_CHANCE = 0.35;

const RESOURCE_ICONS = { gold: "💰", wood: "🪵", food: "🌾", stone: "🪨" };
const RESOURCE_LABELS = { gold: "Gold", wood: "Holz", food: "Nahrung", stone: "Stein" };

// Building definitions. `category` drives how the card is rendered, so new
// building types (e.g. barracks, market) can be added here later without
// touching the render logic itself.
const BUILDING_INFO = {
  house: {
    name: "Haus", icon: "🏠", cost: { wood: 30, gold: 20 },
    category: "population", popBonus: 5,
  },
  lumberjack: {
    name: "Holzfäller", icon: "🪵", cost: { wood: 50, gold: 30 },
    category: "production", resource: "wood", resourceIcon: "🪵",
    perWorker: 10, upgradeId: "tools",
  },
  farm: {
    name: "Bauernhof", icon: "🌾", cost: { wood: 50, gold: 20 },
    category: "production", resource: "food", resourceIcon: "🌾",
    perWorker: 10, upgradeId: "farming",
  },
  quarry: {
    name: "Steinbruch", icon: "⛏️", cost: { wood: 70, gold: 30 },
    category: "production", resource: "stone", resourceIcon: "🪨",
    perWorker: 8, upgradeId: "stoneworking",
  },
  workshop: {
    name: "Werkstatt", icon: "🏭", cost: { wood: 100, stone: 50, gold: 50 },
    category: "utility", unique: true, desc: "Schaltet Upgrades frei.",
  },
  townhall: {
    name: "Rathaus", icon: "🏰", category: "townhall",
    desc: "Bestimmt das Level deines Dorfes.",
  },
};
const BUILD_ORDER = ["house", "lumberjack", "farm", "quarry", "workshop", "townhall"];
const PRODUCTION_TYPES = ["lumberjack", "farm", "quarry"];

const UPGRADES_CONFIG = {
  tools: { name: "Verbesserte Werkzeuge", cost: { gold: 100, wood: 50 }, desc: "+20% Holzproduktion" },
  farming: { name: "Bessere Landwirtschaft", cost: { gold: 120, wood: 80 }, desc: "+20% Nahrungsproduktion" },
  stoneworking: { name: "Steinverarbeitung", cost: { gold: 150, stone: 100 }, desc: "+20% Steinproduktion" },
};

const MAX_TOWNHALL_LEVEL = 5;
const TOWNHALL_UPGRADES = {
  2: { wood: 150, stone: 100, gold: 150 },
  3: { wood: 250, stone: 200, gold: 250 },
  4: { wood: 400, stone: 350, gold: 400 },
  5: { wood: 600, stone: 500, gold: 600 },
};

// Index 0 = Level 1 (starting level, no requirement).
const VILLAGE_LEVEL_INFO = [
  { level: 1, name: "Kleines Dorf", req: null },
  { level: 2, name: "Dorf", req: { population: 10, buildings: 3, totalResources: 200 } },
  { level: 3, name: "Großes Dorf", req: { population: 20, buildings: 6, townhallLevel: 2 } },
  { level: 4, name: "Stadt", req: { population: 35, buildings: 10, townhallLevel: 3 } },
  { level: 5, name: "Kleines Königreich", req: { population: 50, buildings: 14, townhallLevel: 4 } },
];

const EVENTS = [
  {
    id: "trader", weight: 20, type: "choice", icon: "🐫",
    title: "Ein Händler besucht dein Dorf.",
    description: "Er bietet dir Nahrung im Tausch gegen Gold an.",
    options: [
      {
        label: "20 Gold bezahlen → 40 Nahrung erhalten",
        action() {
          if (canAfford({ gold: 20 })) {
            payCost({ gold: 20 });
            addResource("food", 40);
            showToast("+40 Nahrung, -20 Gold", "success");
          } else {
            showToast("Nicht genügend Gold.", "warning");
          }
        },
      },
      { label: "Ablehnen", action() { showToast("Der Händler zieht weiter.", "info"); } },
    ],
  },
  {
    id: "goodHarvest", weight: 20, type: "auto", icon: "🌾",
    title: "Gute Ernte!",
    description: "Eine besonders gute Ernte bringt zusätzliche Nahrung.",
    action() { addResource("food", 30); adjustMorale(3); showToast("🌾 Gute Ernte: +30 Nahrung", "success"); },
  },
  {
    id: "storm", weight: 15, type: "auto", icon: "⛈️",
    title: "Sturm!",
    description: "Ein Sturm beschädigt Gebäude und Vorräte.",
    action() { removeResource("wood", 20); adjustMorale(-3); showToast("⛈️ Sturm: -20 Holz", "danger"); },
  },
  {
    id: "travelers", weight: 15, type: "auto", icon: "🚶",
    title: "Reisende",
    description: "Eine Familie möchte sich deinem Dorf anschließen.",
    action() {
      const added = addPopulationDirect(2);
      if (added > 0) { adjustMorale(2); showToast(`🚶 Reisende: +${added} Bevölkerung`, "success"); }
      else { showToast("Reisende ziehen weiter — kein Platz im Dorf.", "info"); }
    },
  },
  {
    id: "bandits", weight: 15, type: "choice", icon: "⚔️",
    title: "Räuber",
    description: "Räuber verlangen Gold von deinem Dorf.",
    options: [
      {
        label: "Bezahlen (30 Gold)",
        action() {
          if (canAfford({ gold: 30 })) {
            payCost({ gold: 30 });
            showToast("Die Räuber ziehen zufrieden ab. -30 Gold", "warning");
          } else {
            removeResource("wood", 20);
            adjustMorale(-10);
            showToast("Du kannst nicht zahlen — die Räuber plündern Holz!", "danger");
          }
        },
      },
      {
        label: "Risiko eingehen",
        action() {
          if (Math.random() < 0.5) {
            adjustMorale(2);
            showToast("Die Räuber ziehen ohne Erfolg ab!", "success");
          } else {
            removeResource("gold", 50);
            adjustMorale(-10);
            showToast("Die Räuber plündern 50 Gold!", "danger");
          }
        },
      },
    ],
  },
];

/* ---------------------------------------------------------
   2. State
   --------------------------------------------------------- */

function createDefaultState() {
  return {
    day: 1,
    resources: { gold: 100, wood: 100, food: 50, stone: 0 },
    population: { current: 5, max: 10 },
    workers: { total: 3, assigned: { lumberjack: 0, farm: 0, quarry: 0 } },
    morale: 70,
    villageLevel: 1,
    townhallLevel: 1,
    buildings: { house: 0, lumberjack: 0, farm: 0, quarry: 0, workshop: 0 },
    upgrades: { tools: false, farming: false, stoneworking: false },
    foodShortageDays: 0,
    gameWon: false,
  };
}

let state = createDefaultState();
let modalOpen = false;

/* ---------------------------------------------------------
   3. Utilities
   --------------------------------------------------------- */

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function formatNum(n) { return Math.floor(n).toLocaleString("de-DE"); }
function isPlainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function canAfford(cost) {
  return Object.entries(cost).every(([key, val]) => (state.resources[key] || 0) >= val);
}

function payCost(cost) {
  Object.entries(cost).forEach(([key, val]) => removeResource(key, val));
}

function sumAssigned() {
  return Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
}

function getFreeWorkers() {
  return state.workers.total - sumAssigned();
}

function totalBuildings() {
  return Object.values(state.buildings).reduce((a, b) => a + b, 0) + 1; // +1 for the town hall
}

function totalResources() {
  const r = state.resources;
  return r.gold + r.wood + r.food + r.stone;
}

function moraleMultiplier() {
  const m = state.morale;
  if (m < 20) return 0.7;
  if (m < 40) return 0.85;
  if (m < 60) return 0.95;
  return 1.0;
}

function adjustMorale(delta) {
  state.morale = clamp(state.morale + delta, 0, 100);
}

/* ---------------------------------------------------------
   4. Resources
   --------------------------------------------------------- */

function addResource(key, amount) {
  if (!amount) return;
  state.resources[key] = clamp(state.resources[key] + amount, 0, Infinity);
  updateStatDisplay(key);
  flashResource(key, amount > 0);
}

function removeResource(key, amount) {
  addResource(key, -Math.abs(amount));
}

function produceResources(mult) {
  const results = [];
  PRODUCTION_TYPES.forEach((type) => {
    const info = BUILDING_INFO[type];
    const capacity = state.buildings[type];
    const workers = Math.min(state.workers.assigned[type] || 0, capacity);
    if (workers <= 0) return;
    const upgradeBonus = state.upgrades[info.upgradeId] ? 0.2 : 0;
    const amount = Math.floor(workers * info.perWorker * (1 + upgradeBonus) * mult);
    if (amount > 0) {
      addResource(info.resource, amount);
      results.push({ resource: info.resource, amount });
    }
  });
  return results;
}

function consumeFood() {
  const needed = state.population.current;
  if (needed <= 0) return;
  if (state.resources.food >= needed) {
    removeResource("food", needed);
    state.foodShortageDays = 0;
    adjustMorale(1);
  } else {
    removeResource("food", state.resources.food);
    state.foodShortageDays++;
    adjustMorale(-8);
    showToast("⚠️ Nicht genügend Nahrung! Die Bevölkerung hungert.", "danger");
    if (state.foodShortageDays >= 2 && state.population.current > 0 && Math.random() < 0.4) {
      removeVillager();
      showToast("😢 Ein Bewohner hat das Dorf aus Hunger verlassen.", "danger");
    }
  }
}

/* ---------------------------------------------------------
   5. Buildings
   --------------------------------------------------------- */

function buildBuilding(type) {
  const info = BUILDING_INFO[type];
  if (!info || !info.cost) return;
  if (info.unique && state.buildings[type] >= 1) {
    showToast(`${info.name} wurde bereits gebaut.`, "warning");
    return;
  }
  if (!canAfford(info.cost)) {
    showToast("Nicht genügend Ressourcen.", "warning");
    return;
  }
  payCost(info.cost);
  state.buildings[type] = (state.buildings[type] || 0) + 1;
  if (type === "house") state.population.max += info.popBonus;
  showToast(`${info.icon} ${info.name} gebaut!`, "success");
  if (type === "workshop") showToast("Neues Gebäude freigeschaltet: Upgrades!", "success");
  checkVillageLevelUp();
  renderAll();
  saveGame();
}

function upgradeTownhall() {
  if (state.townhallLevel >= MAX_TOWNHALL_LEVEL) {
    showToast("Rathaus hat bereits das maximale Level.", "warning");
    return;
  }
  const next = state.townhallLevel + 1;
  const cost = TOWNHALL_UPGRADES[next];
  if (!canAfford(cost)) {
    showToast("Nicht genügend Ressourcen für den Rathausausbau.", "warning");
    return;
  }
  payCost(cost);
  state.townhallLevel = next;
  showToast(`🏰 Rathaus auf Level ${next} ausgebaut!`, "success");
  checkVillageLevelUp();
  checkWinCondition();
  renderAll();
  saveGame();
}

/* ---------------------------------------------------------
   6. Population
   --------------------------------------------------------- */

function growPopulation() {
  if (state.population.current >= state.population.max) return;
  if (state.foodShortageDays > 0) return; // no growth while starving
  const chance = 0.15 + (state.morale / 100) * 0.25;
  if (Math.random() < chance) {
    addPopulationDirect(1);
    showToast("👶 Ein neuer Bewohner ist eingetroffen!", "success");
  }
}

function addPopulationDirect(n) {
  const space = state.population.max - state.population.current;
  const added = Math.max(0, Math.min(n, space));
  if (added > 0) {
    state.population.current += added;
    const targetWorkers = Math.round(state.population.current * 0.6);
    if (targetWorkers > state.workers.total) {
      state.workers.total = Math.min(targetWorkers, state.population.current);
    }
  }
  return added;
}

function removeVillager() {
  if (state.population.current <= 0) return;
  state.population.current--;
  const assigned = sumAssigned();
  if (state.workers.total > assigned) {
    state.workers.total--;
  } else if (assigned > 0) {
    const type = Object.keys(state.workers.assigned).reduce((a, b) =>
      (state.workers.assigned[a] || 0) >= (state.workers.assigned[b] || 0) ? a : b
    );
    if (state.workers.assigned[type] > 0) {
      state.workers.assigned[type]--;
      state.workers.total = Math.max(0, state.workers.total - 1);
    }
  } else if (state.workers.total > 0) {
    state.workers.total--;
  }
}

/* ---------------------------------------------------------
   7. Workers
   --------------------------------------------------------- */

function assignWorker(type, delta) {
  const capacity = state.buildings[type] || 0;
  const cur = state.workers.assigned[type] || 0;
  if (delta > 0) {
    if (getFreeWorkers() <= 0) { showToast("Keine freien Arbeiter verfügbar.", "warning"); return; }
    if (cur >= capacity) { showToast("Maximale Arbeiterzahl für dieses Gebäude erreicht.", "warning"); return; }
    state.workers.assigned[type] = cur + 1;
  } else {
    if (cur <= 0) return;
    state.workers.assigned[type] = cur - 1;
  }
  renderAll();
  saveGame();
}

/* ---------------------------------------------------------
   8. Upgrades
   --------------------------------------------------------- */

function buyUpgrade(id) {
  const cfg = UPGRADES_CONFIG[id];
  if (!cfg || state.upgrades[id]) return;
  if (state.buildings.workshop < 1) { showToast("Du benötigst eine Werkstatt.", "warning"); return; }
  if (!canAfford(cfg.cost)) { showToast("Nicht genügend Ressourcen.", "warning"); return; }
  payCost(cfg.cost);
  state.upgrades[id] = true;
  showToast(`${cfg.name} erforscht! ${cfg.desc}`, "success");
  renderAll();
  saveGame();
}

/* ---------------------------------------------------------
   9. Village level / win condition
   --------------------------------------------------------- */

function checkVillageLevelUp() {
  while (state.villageLevel < VILLAGE_LEVEL_INFO.length) {
    const info = VILLAGE_LEVEL_INFO[state.villageLevel]; // next level's requirements
    const req = info.req;
    const ok =
      state.population.current >= req.population &&
      totalBuildings() >= req.buildings &&
      (req.totalResources ? totalResources() >= req.totalResources : true) &&
      (req.townhallLevel ? state.townhallLevel >= req.townhallLevel : true);
    if (!ok) break;
    state.villageLevel++;
    showToast(`🎉 Levelaufstieg! Dein Dorf ist jetzt "${info.name}" (Level ${state.villageLevel})`, "success");
    pulseLevelBadge();
  }
}

function checkWinCondition() {
  if (state.gameWon) return;
  if (state.villageLevel >= 5 && state.population.current >= 50 && state.townhallLevel >= MAX_TOWNHALL_LEVEL) {
    state.gameWon = true;
    showVictoryModal();
  }
}

/* ---------------------------------------------------------
   10. Random events
   --------------------------------------------------------- */

function pickWeightedEvent() {
  const total = EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ev of EVENTS) {
    if (r < ev.weight) return ev;
    r -= ev.weight;
  }
  return EVENTS[EVENTS.length - 1];
}

function maybeTriggerEvent() {
  if (Math.random() >= EVENT_CHANCE) return null;
  const event = pickWeightedEvent();
  if (event.type === "auto") {
    event.action();
    renderAll();
  }
  return event;
}

/* ---------------------------------------------------------
   11. Day cycle
   --------------------------------------------------------- */

function nextDay() {
  if (state.gameWon || modalOpen) return;

  const mult = moraleMultiplier();
  const produced = produceResources(mult);
  if (produced.length) {
    const summary = produced.map((p) => `+${p.amount} ${RESOURCE_LABELS[p.resource]}`).join(", ");
    showToast(summary, "info");
  }

  consumeFood();
  state.day++;
  growPopulation();
  checkVillageLevelUp();
  renderAll();

  const event = maybeTriggerEvent();
  if (event && event.type === "choice") {
    showEventModal(event);
  } else {
    checkWinCondition();
    saveGame();
  }
}

/* ---------------------------------------------------------
   12. Save / load
   --------------------------------------------------------- */

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Speichern fehlgeschlagen", e);
    showToast("Speichern fehlgeschlagen (Speicher voll?).", "danger");
  }
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state = mergeDeep(createDefaultState(), saved);
  } catch (e) {
    console.error("Speicherstand konnte nicht geladen werden", e);
    state = createDefaultState();
  }
  modalOpen = false;
  el.startScreen.hidden = true;
  el.gameScreen.hidden = false;
  renderAll();
  if (state.gameWon) showVictoryModal();
  showToast("Spielstand geladen.", "info");
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  startNewGame();
}

function startNewGame() {
  state = createDefaultState();
  modalOpen = false;
  el.startScreen.hidden = true;
  el.gameScreen.hidden = false;
  el.victoryOverlay.hidden = true;
  renderAll();
  saveGame();
  showToast("Willkommen in deinem neuen Dorf!", "success");
}

/* ---------------------------------------------------------
   13. UI rendering
   --------------------------------------------------------- */

const el = {
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  btnNewGame: document.getElementById("btn-new-game"),
  btnLoadGame: document.getElementById("btn-load-game"),
  btnNextDay: document.getElementById("btn-next-day"),
  btnReset: document.getElementById("btn-reset"),

  statGold: document.getElementById("stat-gold"),
  statWood: document.getElementById("stat-wood"),
  statFood: document.getElementById("stat-food"),
  statStone: document.getElementById("stat-stone"),
  statPopulation: document.getElementById("stat-population"),
  statWorkers: document.getElementById("stat-workers"),
  statDay: document.getElementById("stat-day"),

  villageLevelBadge: document.getElementById("village-level-badge"),
  villageLevelName: document.getElementById("village-level-name"),
  moraleDisplay: document.getElementById("morale-display"),

  buildingsGrid: document.getElementById("buildings-grid"),
  upgradesPanel: document.getElementById("upgrades-panel"),
  upgradesGrid: document.getElementById("upgrades-grid"),

  toastContainer: document.getElementById("toast-container"),

  eventOverlay: document.getElementById("event-modal-overlay"),
  eventIcon: document.getElementById("event-icon"),
  eventTitle: document.getElementById("event-title"),
  eventDescription: document.getElementById("event-description"),
  eventActions: document.getElementById("event-actions"),

  confirmOverlay: document.getElementById("confirm-modal-overlay"),
  confirmMessage: document.getElementById("confirm-message"),
  btnConfirmYes: document.getElementById("btn-confirm-yes"),
  btnConfirmNo: document.getElementById("btn-confirm-no"),

  victoryOverlay: document.getElementById("victory-modal-overlay"),
  victoryStats: document.getElementById("victory-stats"),
  btnNewGameAfterWin: document.getElementById("btn-new-game-after-win"),
};

function renderAll() {
  renderStatusbar();
  renderVillageBanner();
  renderBuildings();
  renderUpgrades();
  renderNextDayButton();
}

function renderStatusbar() {
  el.statGold.textContent = formatNum(state.resources.gold);
  el.statWood.textContent = formatNum(state.resources.wood);
  el.statFood.textContent = formatNum(state.resources.food);
  el.statStone.textContent = formatNum(state.resources.stone);
  el.statPopulation.textContent = `${state.population.current}/${state.population.max}`;
  el.statWorkers.textContent = `${sumAssigned()}/${state.workers.total}`;
  el.statDay.textContent = state.day;
}

function updateStatDisplay(key) {
  const map = { gold: el.statGold, wood: el.statWood, food: el.statFood, stone: el.statStone };
  if (map[key]) map[key].textContent = formatNum(state.resources[key]);
}

function flashResource(key, positive) {
  const wrap = document.getElementById(`statitem-${key}`);
  if (!wrap) return;
  wrap.classList.remove("flash-pos", "flash-neg");
  void wrap.offsetWidth; // restart animation
  wrap.classList.add(positive ? "flash-pos" : "flash-neg");
}

function renderVillageBanner() {
  const info = VILLAGE_LEVEL_INFO[state.villageLevel - 1];
  el.villageLevelBadge.textContent = `Level ${state.villageLevel}`;
  el.villageLevelName.textContent = info.name;
  const m = state.morale;
  const emoji = m >= 80 ? "😄" : m >= 60 ? "🙂" : m >= 40 ? "😐" : m >= 20 ? "😟" : "😢";
  el.moraleDisplay.textContent = `${emoji} Moral: ${m}%`;
}

function pulseLevelBadge() {
  el.villageLevelBadge.classList.remove("level-pulse");
  void el.villageLevelBadge.offsetWidth;
  el.villageLevelBadge.classList.add("level-pulse");
}

function formatCostHTML(cost) {
  return Object.entries(cost)
    .map(([key, val]) => {
      const enough = (state.resources[key] || 0) >= val;
      return `<span class="cost-item ${enough ? "" : "insufficient"}">${RESOURCE_ICONS[key]} ${val}</span>`;
    })
    .join("");
}

function renderBuildings() {
  el.buildingsGrid.innerHTML = BUILD_ORDER.map(buildingCardHTML).join("");
}

function buildingCardHTML(type) {
  const info = BUILDING_INFO[type];
  let body = "";

  if (type === "townhall") {
    const next = state.townhallLevel + 1;
    const maxed = state.townhallLevel >= MAX_TOWNHALL_LEVEL;
    const cost = maxed ? null : TOWNHALL_UPGRADES[next];
    body = `
      <p class="building-desc">Level: <strong>${state.townhallLevel}</strong> / ${MAX_TOWNHALL_LEVEL}</p>
      ${maxed
        ? `<button class="btn btn-disabled" disabled>Maximales Level erreicht</button>`
        : `<div class="cost-row">${formatCostHTML(cost)}</div>
           <button class="btn btn-primary" data-action="upgrade-townhall" ${canAfford(cost) ? "" : "disabled"}>Ausbauen</button>`}
    `;
  } else if (info.category === "population") {
    body = `
      <p class="building-desc">Gebaut: <strong>${state.buildings[type]}</strong> &middot; +${info.popBonus} max. Bevölkerung je Haus</p>
      <div class="cost-row">${formatCostHTML(info.cost)}</div>
      <button class="btn btn-primary" data-action="build" data-type="${type}" ${canAfford(info.cost) ? "" : "disabled"}>Bauen</button>
    `;
  } else if (info.category === "production") {
    const capacity = state.buildings[type];
    const assigned = state.workers.assigned[type] || 0;
    const upgradeBonus = state.upgrades[info.upgradeId] ? 0.2 : 0;
    const mult = moraleMultiplier();
    const production = Math.floor(Math.min(assigned, capacity) * info.perWorker * (1 + upgradeBonus) * mult);
    body = `
      <p class="building-desc">Gebaut: <strong>${capacity}</strong></p>
      ${capacity > 0
        ? `<div class="worker-row">
             <span>👷 ${assigned}/${capacity} Arbeiter</span>
             <div class="worker-controls">
               <button class="btn btn-small" data-action="worker-dec" data-type="${type}" ${assigned <= 0 ? "disabled" : ""}>−</button>
               <button class="btn btn-small" data-action="worker-inc" data-type="${type}" ${(assigned >= capacity || getFreeWorkers() <= 0) ? "disabled" : ""}>+</button>
             </div>
           </div>
           <p class="production-preview">Produktion: +${production} ${info.resourceIcon}/Tag</p>`
        : `<p class="production-preview">Noch nicht gebaut</p>`}
      <div class="cost-row">${formatCostHTML(info.cost)}</div>
      <button class="btn btn-primary" data-action="build" data-type="${type}" ${canAfford(info.cost) ? "" : "disabled"}>Bauen</button>
    `;
  } else if (info.category === "utility") {
    const built = state.buildings[type] >= 1;
    body = `
      <p class="building-desc">${info.desc}</p>
      ${built
        ? `<button class="btn btn-disabled" disabled>Bereits gebaut ✅</button>`
        : `<div class="cost-row">${formatCostHTML(info.cost)}</div>
           <button class="btn btn-primary" data-action="build" data-type="${type}" ${canAfford(info.cost) ? "" : "disabled"}>Bauen</button>`}
    `;
  }

  return `
    <div class="building-card" data-type="${type}">
      <div class="building-header">
        <span class="building-icon">${info.icon}</span>
        <span class="building-name">${info.name}</span>
      </div>
      ${body}
    </div>
  `;
}

function renderUpgrades() {
  const unlocked = state.buildings.workshop >= 1;
  el.upgradesPanel.hidden = !unlocked;
  if (!unlocked) return;
  el.upgradesGrid.innerHTML = Object.entries(UPGRADES_CONFIG)
    .map(([id, cfg]) => {
      const bought = state.upgrades[id];
      return `
        <div class="upgrade-card">
          <div class="upgrade-name">${cfg.name}</div>
          <p class="upgrade-desc">${cfg.desc}</p>
          ${bought
            ? `<button class="btn btn-disabled" disabled>Gekauft ✅</button>`
            : `<div class="cost-row">${formatCostHTML(cfg.cost)}</div>
               <button class="btn btn-primary" data-action="buy-upgrade" data-id="${id}" ${canAfford(cfg.cost) ? "" : "disabled"}>Kaufen</button>`}
        </div>
      `;
    })
    .join("");
}

function renderNextDayButton() {
  el.btnNextDay.disabled = state.gameWon || modalOpen;
}

let toastCounter = 0;
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${++toastCounter}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function showEventModal(event) {
  modalOpen = true;
  el.eventIcon.textContent = event.icon;
  el.eventTitle.textContent = event.title;
  el.eventDescription.textContent = event.description;
  el.eventActions.innerHTML = "";
  event.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      opt.action();
      el.eventOverlay.hidden = true;
      modalOpen = false;
      checkVillageLevelUp();
      checkWinCondition();
      renderAll();
      saveGame();
    });
    el.eventActions.appendChild(btn);
  });
  el.eventOverlay.hidden = false;
  renderNextDayButton();
}

function showConfirmModal(message, onConfirm) {
  el.confirmMessage.textContent = message;
  el.confirmOverlay.hidden = false;

  function cleanup() {
    el.confirmOverlay.hidden = true;
    el.btnConfirmYes.removeEventListener("click", yesHandler);
    el.btnConfirmNo.removeEventListener("click", noHandler);
  }
  function yesHandler() { onConfirm(); cleanup(); }
  function noHandler() { cleanup(); }

  el.btnConfirmYes.addEventListener("click", yesHandler);
  el.btnConfirmNo.addEventListener("click", noHandler);
}

function showVictoryModal() {
  el.victoryStats.innerHTML = `
    <div class="victory-stat"><span>📅 Erreichter Tag</span><strong>${state.day}</strong></div>
    <div class="victory-stat"><span>👥 Bevölkerung</span><strong>${state.population.current}</strong></div>
    <div class="victory-stat"><span>🏛️ Gebäude</span><strong>${totalBuildings()}</strong></div>
    <div class="victory-stat"><span>💰 Gold</span><strong>${formatNum(state.resources.gold)}</strong></div>
    <div class="victory-stat"><span>🪵 Holz</span><strong>${formatNum(state.resources.wood)}</strong></div>
    <div class="victory-stat"><span>🌾 Nahrung</span><strong>${formatNum(state.resources.food)}</strong></div>
    <div class="victory-stat"><span>🪨 Stein</span><strong>${formatNum(state.resources.stone)}</strong></div>
  `;
  el.victoryOverlay.hidden = false;
  renderNextDayButton();
}

/* ---------------------------------------------------------
   14. Event binding & init
   --------------------------------------------------------- */

function bindEvents() {
  el.btnNewGame.addEventListener("click", () => {
    if (localStorage.getItem(SAVE_KEY)) {
      showConfirmModal("Ein neues Spiel überschreibt deinen aktuellen Spielstand. Fortfahren?", startNewGame);
    } else {
      startNewGame();
    }
  });

  el.btnLoadGame.addEventListener("click", loadGame);
  el.btnNextDay.addEventListener("click", nextDay);

  el.btnReset.addEventListener("click", () => {
    showConfirmModal(
      "Möchtest du wirklich deinen Spielstand löschen? Dies kann nicht rückgängig gemacht werden.",
      resetGame
    );
  });

  el.btnNewGameAfterWin.addEventListener("click", () => {
    el.victoryOverlay.hidden = true;
    startNewGame();
  });

  el.buildingsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, type } = btn.dataset;
    if (action === "build") buildBuilding(type);
    else if (action === "worker-inc") assignWorker(type, 1);
    else if (action === "worker-dec") assignWorker(type, -1);
    else if (action === "upgrade-townhall") upgradeTownhall();
  });

  el.upgradesGrid.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="buy-upgrade"]');
    if (!btn) return;
    buyUpgrade(btn.dataset.id);
  });
}

function init() {
  el.btnLoadGame.hidden = !localStorage.getItem(SAVE_KEY);
  bindEvents();
}

init();
