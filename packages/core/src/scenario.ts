import type { DomainEvent } from "./events";
import { unitId } from "./ids";
import type {
  GameState,
  IdentityCandidate,
  IntelClue,
  ScenarioOutcome,
  ScenarioReport,
} from "./state";

const ARCHER_UNIT_ID = unitId("archer");
const LANCER_UNIT_ID = unitId("lancer");
const RIN_UNIT_ID = unitId("rin");

const CLUE_LIBRARY: Readonly<Record<string, Omit<IntelClue, "discoveredAtSequence">>> = {
  lancer_class: {
    id: "lancer_class",
    category: "class",
    label: "敌方从者职阶确认为 Lancer",
    confidence: 100,
    source: "遭遇确认",
  },
  high_speed: {
    id: "high_speed",
    category: "combat_style",
    label: "具备异常高速的近距离机动能力",
    confidence: 55,
    source: "战场移动",
  },
  red_spear: {
    id: "red_spear",
    category: "weapon",
    label: "武装为带有诅咒气息的红色长枪",
    confidence: 80,
    source: "攻击观察",
  },
  causality_reversal: {
    id: "causality_reversal",
    category: "noble_phantasm",
    label: "宝具准备征兆疑似涉及因果逆转",
    confidence: 90,
    source: "魔力波形分析",
  },
  celtic_origin: {
    id: "celtic_origin",
    category: "origin",
    label: "魔力纹样与凯尔特传说体系高度吻合",
    confidence: 70,
    source: "远坂术式比对",
  },
};

export function createInitialScenarioState(): GameState["scenario"] {
  return {
    id: "school-night",
    phase: "investigation",
    objective: "调查学园内异常结界，并确认未知从者的活动痕迹。",
    warningRound: 3,
    clues: [],
  };
}

export function evaluateIdentityCandidates(
  clues: readonly IntelClue[],
): readonly IdentityCandidate[] {
  const ids = new Set(clues.map(clue => clue.id));
  const score = (base: number, weights: Readonly<Record<string, number>>) =>
    Math.min(99, base + Object.entries(weights).reduce(
      (total, [id, weight]) => total + (ids.has(id) ? weight : 0),
      0,
    ));

  return [
    {
      id: "cu_chulainn",
      name: "库·丘林",
      confidence: score(12, {
        lancer_class: 8,
        high_speed: 10,
        red_spear: 18,
        causality_reversal: 32,
        celtic_origin: 20,
      }),
    },
    {
      id: "diarmuid",
      name: "迪尔姆德·奥迪那",
      confidence: score(10, {
        lancer_class: 8,
        high_speed: 12,
        red_spear: 10,
        celtic_origin: 12,
      }),
    },
    {
      id: "scathach",
      name: "斯卡哈",
      confidence: score(6, {
        lancer_class: 8,
        high_speed: 8,
        red_spear: 10,
        celtic_origin: 15,
      }),
    },
  ].sort((left, right) => right.confidence - left.confidence);
}

export function buildScenarioReport(
  outcome: ScenarioOutcome,
  clues: readonly IntelClue[],
): ScenarioReport {
  const candidates = evaluateIdentityCandidates(clues);
  const top = candidates[0];
  const summaryByOutcome: Readonly<Record<ScenarioOutcome, string>> = {
    retreated_with_intel: `远坂阵营成功脱离学园。虽未击败敌人，但已取得足以改变下一次交战计划的情报。最高候选：${top?.name ?? "未知"}。`,
    enemy_defeated: `未知 Lancer 已被击败，战场记录完整保留。最高候选：${top?.name ?? "未知"}。`,
    master_defeated: "Master 在学园夜战中失去战斗能力，本次调查失败。",
    servant_defeated: "Servant 在撤离前失去战斗能力，本次调查失败。",
  };

  const ids = new Set(clues.map(clue => clue.id));
  const unlockedTactics: string[] = [];
  if (ids.has("causality_reversal")) {
    unlockedTactics.push("下一次遭遇将提前显示因果类宝具预警；常规闪避不再被标记为可靠方案。");
  }
  if (ids.has("red_spear")) {
    unlockedTactics.push("红色长枪特征已进入真名筛选器，可缩小候选英灵范围。");
  }
  if (ids.has("celtic_origin")) {
    unlockedTactics.push("解锁凯尔特传说资料比对，提升后续身份推断置信度。");
  }
  if (unlockedTactics.length === 0) {
    unlockedTactics.push("尚未获得可转化为战术优势的关键线索。");
  }

  return {
    title: outcome === "retreated_with_intel" ? "战术撤退 · 情报保全" : "学校夜战结算",
    summary: summaryByOutcome[outcome],
    candidates,
    unlockedTactics,
  };
}

export function evaluateScenarioTriggers(
  before: GameState,
  after: GameState,
  commandEvents: readonly DomainEvent[],
): readonly DomainEvent[] {
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
    events.push({
      type: "scenario.clue_discovered",
      sequence,
      scenarioId: after.scenario.id,
      clue,
    });
  };

  if (before.scenario.phase === "investigation" && after.scenario.phase === "encounter") {
    addClue("lancer_class");
  }

  for (const event of commandEvents) {
    if (event.type === "battle.unit_moved" && event.unitId === LANCER_UNIT_ID) addClue("high_speed");
    if (
      event.type === "battle.attack_started" &&
      event.attackerId === LANCER_UNIT_ID &&
      event.kind === "normal"
    ) addClue("red_spear");
  }

  const allClues = [...after.scenario.clues, ...pendingClues];
  const lancer = after.battle.units[LANCER_UNIT_ID];
  const rin = after.battle.units[RIN_UNIT_ID];
  const archer = after.battle.units[ARCHER_UNIT_ID];

  const complete = (outcome: ScenarioOutcome) => {
    events.push({
      type: "scenario.completed",
      sequence: ++sequence,
      scenarioId: after.scenario.id,
      outcome,
      report: buildScenarioReport(outcome, allClues),
    });
  };

  if (lancer?.defeated) {
    complete("enemy_defeated");
    return events;
  }
  if (rin?.defeated) {
    complete("master_defeated");
    return events;
  }
  if (archer?.defeated) {
    complete("servant_defeated");
    return events;
  }

  if (
    after.scenario.phase === "encounter" &&
    after.battle.round >= after.scenario.warningRound
  ) {
    events.push({
      type: "scenario.noble_phantasm_warning",
      sequence: ++sequence,
      scenarioId: after.scenario.id,
      enemyId: LANCER_UNIT_ID,
      message: "检测到异常魔力收束：敌方正在准备疑似因果干涉型宝具。",
    });
    addClue("causality_reversal");
    addClue("celtic_origin");
  }

  return events;
}
