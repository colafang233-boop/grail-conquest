import type { DomainEvent } from "./events";
import { unitId } from "./ids";
import { STRATEGY_FACTION_ID, areFactionsHostile, getEncounterDefinition, getStrategicFaction } from "./strategy";
import type { EncounterId, GameState, IdentityCandidate, IntelClue, ScenarioOutcome, ScenarioReport } from "./state";

const ARCHER_UNIT_ID = unitId("archer");
const LANCER_UNIT_ID = unitId("lancer");
const RIN_UNIT_ID = unitId("rin");
const SABER_UNIT_ID = unitId("saber");
const CASTER_UNIT_ID = unitId("caster");

const CLUE_LIBRARY: Readonly<Record<string, Omit<IntelClue, "discoveredAtSequence">>> = {
  lancer_class: { id: "lancer_class", category: "class", label: "敌方从者职阶确认为 Lancer", confidence: 100, source: "遭遇确认" },
  saber_class: { id: "saber_class", category: "class", label: "确认出现 Saber 职阶从者", confidence: 100, source: "多方接触" },
  caster_class: { id: "caster_class", category: "class", label: "柳洞寺阵营从者职阶为 Caster", confidence: 100, source: "结界分析" },
  high_speed: { id: "high_speed", category: "combat_style", label: "具备异常高速的近距离机动能力", confidence: 55, source: "战场移动" },
  red_spear: { id: "red_spear", category: "weapon", label: "武装为带有诅咒气息的红色长枪", confidence: 80, source: "攻击观察" },
  causality_reversal: { id: "causality_reversal", category: "noble_phantasm", label: "宝具准备征兆疑似涉及因果逆转", confidence: 90, source: "魔力波形分析" },
  celtic_origin: { id: "celtic_origin", category: "origin", label: "魔力纹样与凯尔特传说体系高度吻合", confidence: 70, source: "远坂术式比对" },
  true_name_release: { id: "true_name_release", category: "noble_phantasm", label: "真名解放语与 Gáe Bolg 的传说记录高度一致", confidence: 100, source: "宝具释放记录" },
  invisible_sword: { id: "invisible_sword", category: "weapon", label: "Saber 的剑身被风之结界隐藏", confidence: 75, source: "风王结界观测" },
  dragon_core: { id: "dragon_core", category: "origin", label: "Saber 的魔力放出具有龙种炉心特征", confidence: 70, source: "魔力放出观测" },
  greek_caster: { id: "greek_caster", category: "origin", label: "Caster 的术式与古希腊神代魔术吻合", confidence: 72, source: "高速神言分析" },
  rule_breaker: { id: "rule_breaker", category: "noble_phantasm", label: "Caster 持有干涉契约的破戒宝具", confidence: 92, source: "宝具观测" },
};

export function createInitialScenarioState(): GameState["scenario"] {
  return { id: "school-night", phase: "investigation", objective: "调查当前区域的异常魔力与从者活动。", warningRound: 3, clues: [] };
}

export function evaluateIdentityCandidates(clues: readonly IntelClue[]): readonly IdentityCandidate[] {
  const ids = new Set(clues.map(clue => clue.id));
  const score = (base: number, weights: Readonly<Record<string, number>>) => Math.min(99, base + Object.entries(weights).reduce((total, [id, weight]) => total + (ids.has(id) ? weight : 0), 0));
  return [
    { id: "cu_chulainn", name: "库·丘林", confidence: score(8, { lancer_class: 8, high_speed: 10, red_spear: 18, causality_reversal: 26, celtic_origin: 18, true_name_release: 45 }) },
    { id: "artoria", name: "阿尔托莉雅", confidence: score(4, { saber_class: 12, invisible_sword: 30, dragon_core: 30 }) },
    { id: "medea", name: "美狄亚", confidence: score(4, { caster_class: 12, greek_caster: 30, rule_breaker: 40 }) },
    { id: "diarmuid", name: "迪尔姆德·奥迪那", confidence: score(6, { lancer_class: 8, high_speed: 12, red_spear: 10, celtic_origin: 12 }) },
    { id: "scathach", name: "斯卡哈", confidence: score(3, { lancer_class: 8, high_speed: 8, red_spear: 10, celtic_origin: 15 }) },
  ].sort((left, right) => right.confidence - left.confidence);
}

export function buildScenarioReport(outcome: ScenarioOutcome, clues: readonly IntelClue[], encounterId: EncounterId = "school-night"): ScenarioReport {
  const candidates = evaluateIdentityCandidates(clues);
  const top = candidates[0];
  const encounter = getEncounterDefinition(encounterId);
  const summaryByOutcome: Readonly<Record<ScenarioOutcome, string>> = {
    retreated_with_intel: `远坂阵营成功脱离${encounter.title}，并保存了本次多方接触情报。最高候选：${top?.name ?? "未知"}。`,
    enemy_defeated: `${encounter.title}中的敌对阵营已失去有效战力。最高身份候选：${top?.name ?? "未知"}。`,
    master_defeated: `Master 在${encounter.title}中失去战斗能力，本次行动失败。`,
    servant_defeated: `Servant 在${encounter.title}撤离前失去战斗能力，本次行动失败。`,
  };
  const ids = new Set(clues.map(clue => clue.id));
  const unlockedTactics: string[] = [];
  if (ids.has("causality_reversal")) unlockedTactics.push("下一次遭遇将提前显示因果类宝具预警。");
  if (ids.has("true_name_release")) unlockedTactics.push("已确认 Gáe Bolg 特征，解锁绝对防御与替身方案。");
  if (ids.has("invisible_sword")) unlockedTactics.push("已记录风王结界，可预测隐藏剑身的攻击距离。");
  if (ids.has("rule_breaker")) unlockedTactics.push("已确认契约破坏风险，Master 应远离 Caster 近战范围。");
  if (unlockedTactics.length === 0) unlockedTactics.push("尚未获得可转化为战术优势的关键线索。");
  return {
    title: outcome === "retreated_with_intel" ? `${encounter.title} · 战术撤退` : `${encounter.title}结算`,
    summary: summaryByOutcome[outcome], candidates, unlockedTactics,
  };
}

export function evaluateScenarioTriggers(before: GameState, after: GameState, commandEvents: readonly DomainEvent[]): readonly DomainEvent[] {
  if (after.scenario.phase === "investigation" || after.scenario.phase === "completed") return [];
  let sequence = after.sequence;
  const events: DomainEvent[] = [];
  const known = new Set(after.scenario.clues.map(clue => clue.id));
  const pendingClues: IntelClue[] = [];
  const addClue = (id: keyof typeof CLUE_LIBRARY) => {
    if (known.has(id)) return;
    const definition = CLUE_LIBRARY[id];
    if (!definition) return;
    known.add(id);
    const clue: IntelClue = { ...definition, discoveredAtSequence: ++sequence };
    pendingClues.push(clue);
    events.push({ type: "scenario.clue_discovered", sequence, scenarioId: after.scenario.id, clue });
  };

  if (before.scenario.phase === "investigation" && after.scenario.phase === "encounter") {
    if (after.battle.units[LANCER_UNIT_ID]?.deployed) addClue("lancer_class");
    if (after.battle.units[SABER_UNIT_ID]?.deployed) addClue("saber_class");
    if (after.battle.units[CASTER_UNIT_ID]?.deployed) addClue("caster_class");
  }

  let preparingEnemyId = LANCER_UNIT_ID;
  let hostilePrepared = false;
  for (const event of commandEvents) {
    if (event.type === "battle.unit_moved" && event.unitId === LANCER_UNIT_ID) addClue("high_speed");
    if (event.type === "ability.used" && event.actorId === LANCER_UNIT_ID && event.abilityId === "lancer_high_speed_thrust") { addClue("high_speed"); addClue("red_spear"); }
    if (event.type === "ability.used" && event.actorId === SABER_UNIT_ID && event.abilityId === "saber_invisible_air") addClue("invisible_sword");
    if (event.type === "ability.used" && event.actorId === SABER_UNIT_ID && event.abilityId === "saber_mana_burst") addClue("dragon_core");
    if (event.type === "ability.used" && event.actorId === CASTER_UNIT_ID) addClue("greek_caster");
    if (event.type === "battle.attack_started" && event.attackerId === LANCER_UNIT_ID && (event.kind === "normal" || event.kind === "ability")) addClue("red_spear");
    if (event.type === "noble_phantasm.preparation_started") {
      const servant = after.battle.units[event.servantId];
      if (servant && areFactionsHostile(after, servant.factionId, STRATEGY_FACTION_ID)) {
        hostilePrepared = true;
        preparingEnemyId = event.servantId;
      }
      if (event.servantId === LANCER_UNIT_ID) { addClue("causality_reversal"); addClue("celtic_origin"); }
    }
    if (event.type === "noble_phantasm.released" && event.servantId === LANCER_UNIT_ID) { addClue("true_name_release"); addClue("red_spear"); }
    if (event.type === "noble_phantasm.released" && event.servantId === CASTER_UNIT_ID) addClue("rule_breaker");
  }

  const allClues = [...after.scenario.clues, ...pendingClues];
  const rin = after.battle.units[RIN_UNIT_ID];
  const archer = after.battle.units[ARCHER_UNIT_ID];
  const complete = (outcome: ScenarioOutcome) => events.push({
    type: "scenario.completed", sequence: ++sequence, scenarioId: after.scenario.id, outcome,
    report: buildScenarioReport(outcome, allClues, after.strategy.activeEncounterId ?? "school-night"),
  });

  if (rin?.defeated) { complete("master_defeated"); return events; }
  if (archer?.defeated) { complete("servant_defeated"); return events; }

  const hostileParticipants = after.strategy.activeParticipantFactionIds.filter(factionId =>
    factionId !== STRATEGY_FACTION_ID && areFactionsHostile(after, factionId, STRATEGY_FACTION_ID),
  );
  const allHostilesDefeated = hostileParticipants.length > 0 && hostileParticipants.every(factionId => {
    const faction = getStrategicFaction(after, factionId);
    if (!faction) return true;
    const relevantIds = [faction.masterUnitId, ...faction.servantUnitIds];
    return relevantIds.every(unitId => {
      const unit = after.battle.units[unitId];
      return !unit?.deployed || unit.defeated;
    });
  });
  const legacyLancerDefeated = hostileParticipants.length === 0 && after.battle.units[LANCER_UNIT_ID]?.defeated;
  if (allHostilesDefeated || legacyLancerDefeated) { complete("enemy_defeated"); return events; }

  if (after.scenario.phase === "encounter" && hostilePrepared) {
    events.push({
      type: "scenario.noble_phantasm_warning", sequence: ++sequence, scenarioId: after.scenario.id,
      enemyId: preparingEnemyId, message: "检测到敌对阵营宝具准备：必须在其下次行动前打断或撤离。",
    });
  }
  return events;
}
