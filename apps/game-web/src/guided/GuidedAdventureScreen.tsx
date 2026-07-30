import { createScenarioPreviewState } from "@grail/core";
import { useEffect, useMemo, useState } from "react";
import { useBrowserContent } from "../content/browser-content";
import { gameEngine } from "../game-engine";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import "./guided-adventure.css";

const STORAGE_KEY = "grail-conquest:guided-adventure:v1";

type GuidedStage =
  | "welcome"
  | "build-workshop"
  | "recruit"
  | "depart"
  | "collect"
  | "capture"
  | "battle-ready"
  | "battle"
  | "complete";

interface GuidedProgress {
  readonly stage: GuidedStage;
  readonly manaCrystals: number;
  readonly funds: number;
  readonly intelligence: number;
  readonly workshopLevel: number;
  readonly familiars: number;
  readonly location: "tohsaka-residence" | "shopping-street" | "school";
  readonly schoolLeylineControlled: boolean;
}

const DEFAULT_PROGRESS: GuidedProgress = {
  stage: "welcome",
  manaCrystals: 8,
  funds: 120,
  intelligence: 0,
  workshopLevel: 0,
  familiars: 0,
  location: "tohsaka-residence",
  schoolLeylineControlled: false,
};

const STAGE_COPY: Record<GuidedStage, { title: string; description: string; reward: string }> = {
  welcome: {
    title: "守住远坂家的圣杯战争资格",
    description: "你控制远坂凛与Archer。第三夜结束前，占领学校灵脉并查明Lancer的身份。",
    reward: "完成教学后解锁正式三夜战役",
  },
  "build-workshop": {
    title: "第1步 · 建造魔术工房",
    description: "工房会让你每夜恢复更多魔力，也是招募使魔的前置建筑。",
    reward: "魔力收入 +4 / 夜",
  },
  recruit: {
    title: "第2步 · 招募侦察使魔",
    description: "使魔会提前发现敌人，让Archer进入战斗时不被伏击。",
    reward: "获得2队侦察使魔",
  },
  depart: {
    title: "第3步 · 派Archer前往学校",
    description: "先经过商店街，再抵达穗群原学园。地图只显示当前可到达的位置。",
    reward: "发现学校异常魔力",
  },
  collect: {
    title: "第4步 · 收集魔力结晶",
    description: "学校外围残留着无主魔力。先收集资源，再准备占领灵脉。",
    reward: "魔力结晶 +6",
  },
  capture: {
    title: "第5步 · 占领学校灵脉",
    description: "占领后每夜获得魔力，但会暴露位置并吸引其他Servant。",
    reward: "学校灵脉收入 +5 / 夜",
  },
  "battle-ready": {
    title: "敌袭 · Lancer正在接近",
    description: "使魔已发现蓝色枪兵。进入战斗，保护凛并至少获得一条真名线索。",
    reward: "战斗胜利：情报 +20",
  },
  battle: {
    title: "学校夜战进行中",
    description: "先移动Archer，再用投影射击攻击Lancer。凛受到攻击时，Archer会自动护卫。",
    reward: "撤退或击退Lancer即可完成任务",
  },
  complete: {
    title: "教学任务完成",
    description: "你已经完成主城建设、招募、探索、资源采集、灵脉占领和战斗闭环。",
    reward: "正式三夜战役已解锁",
  },
};

export function GuidedAdventureScreen() {
  const snapshot = useGameSnapshot();
  const content = useBrowserContent();
  const [progress, setProgress] = useState<GuidedProgress>(() => loadProgress());
  const [feedback, setFeedback] = useState<string>();

  useEffect(() => {
    if (progress.stage === "battle" && snapshot.state.mode === "strategy") {
      update({
        stage: "complete",
        intelligence: progress.intelligence + 20,
        manaCrystals: progress.manaCrystals + 4,
      });
      setFeedback("Archer带回了战斗记录：获得20情报与4魔力结晶。");
    }
  }, [snapshot.state.mode, progress.stage]);

  const copy = STAGE_COPY[progress.stage];
  const objectiveIndex = stageIndex(progress.stage);
  const armyPower = 42 + progress.familiars * 8 + progress.workshopLevel * 5;

  const update = (changes: Partial<GuidedProgress>) => {
    setProgress(current => {
      const next = { ...current, ...changes };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const startMission = () => {
    if (snapshot.state.campaign.status === "not_started" || snapshot.state.mode === "setup") {
      const result = gameEngine.dispatch({ type: "campaign.start", routeId: "tohsaka-route" });
      if (!result.ok) {
        setFeedback(result.error?.message ?? "战役启动失败");
        return;
      }
    }
    update({ stage: "build-workshop" });
    setFeedback("远坂宅已成为你的主城。先建设魔术工房。");
  };

  const buildWorkshop = () => {
    if (progress.manaCrystals < 5 || progress.funds < 40) return;
    update({
      stage: "recruit",
      workshopLevel: 1,
      manaCrystals: progress.manaCrystals - 5,
      funds: progress.funds - 40,
    });
    setFeedback("魔术工房建造完成：每夜魔力收入提升。");
  };

  const recruit = () => {
    if (progress.manaCrystals < 3 || progress.funds < 30) return;
    update({
      stage: "depart",
      familiars: 2,
      manaCrystals: progress.manaCrystals - 3,
      funds: progress.funds - 30,
    });
    setFeedback("2队侦察使魔加入Archer的军势。");
  };

  const moveTo = (location: GuidedProgress["location"]) => {
    if (progress.stage !== "depart") return;
    if (progress.location === "tohsaka-residence" && location === "shopping-street") {
      update({ location });
      setFeedback("Archer抵达商店街。下一站：穗群原学园。");
      return;
    }
    if (progress.location === "shopping-street" && location === "school") {
      update({ stage: "collect", location });
      setFeedback("抵达学校。发现一处未被回收的魔力结晶。");
    }
  };

  const collectCrystal = () => {
    update({ stage: "capture", manaCrystals: progress.manaCrystals + 6 });
    setFeedback("获得6魔力结晶。现在可以占领学校灵脉。");
  };

  const captureLeyline = () => {
    update({ stage: "battle-ready", schoolLeylineControlled: true });
    setFeedback("学校灵脉已被远坂控制，但高强度魔力活动吸引了Lancer。");
  };

  const launchBattle = () => {
    const pack = content.pack;
    if (!pack) {
      setFeedback("内容包仍在加载，请稍后重试。");
      return;
    }
    const preview = createScenarioPreviewState(snapshot.state, pack, "school-night");
    if (!preview.state) {
      setFeedback(preview.error ?? "战斗场景创建失败");
      return;
    }
    update({ stage: "battle" });
    gameEngine.reset(preview.state);
  };

  const resetTutorial = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setProgress(DEFAULT_PROGRESS);
    gameEngine.reset(gameEngine.getSnapshot().initialState);
    setFeedback("教学进度已重置。");
  };

  const primaryAction = useMemo(() => {
    switch (progress.stage) {
      case "welcome": return { label: "开始远坂教学战役", action: startMission, disabled: false };
      case "build-workshop": return { label: "建造魔术工房 · 5结晶 / 40资金", action: buildWorkshop, disabled: progress.manaCrystals < 5 || progress.funds < 40 };
      case "recruit": return { label: "招募2队侦察使魔 · 3结晶 / 30资金", action: recruit, disabled: progress.manaCrystals < 3 || progress.funds < 30 };
      case "collect": return { label: "收集魔力结晶", action: collectCrystal, disabled: false };
      case "capture": return { label: "占领学校灵脉", action: captureLeyline, disabled: false };
      case "battle-ready": return { label: "进入学校夜战", action: launchBattle, disabled: false };
      case "complete": return { label: "重新体验教学", action: resetTutorial, disabled: false };
      default: return undefined;
    }
  }, [progress, content.pack, snapshot.state]);

  return (
    <main className="guided-shell">
      <header className="guided-topbar">
        <div>
          <p className="eyebrow">FATE × HEROES · GUIDED VERTICAL SLICE</p>
          <h1>Grail Conquest</h1>
        </div>
        <div className="guided-resources" aria-label="当前资源">
          <span><i>◆</i> 魔力结晶 <strong>{progress.manaCrystals}</strong></span>
          <span><i>¥</i> 资金 <strong>{progress.funds}</strong></span>
          <span><i>?</i> 情报 <strong>{progress.intelligence}</strong></span>
        </div>
      </header>

      <section className="guided-layout">
        <aside className="guided-objective-panel">
          <p className="eyebrow">CURRENT OBJECTIVE</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
          <div className="guided-reward"><span>完成奖励</span><strong>{copy.reward}</strong></div>

          <ol className="guided-steps">
            {["建造工房", "招募使魔", "前往学校", "采集资源", "占领灵脉", "击退Lancer"].map((label, index) => (
              <li key={label} className={index < objectiveIndex ? "done" : index === objectiveIndex ? "active" : ""}>
                <span>{index < objectiveIndex ? "✓" : index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>

          {primaryAction && (
            <button className="guided-primary" disabled={primaryAction.disabled} onClick={primaryAction.action}>
              {primaryAction.label}
            </button>
          )}
          {feedback && <p className="guided-feedback" role="status">{feedback}</p>}
        </aside>

        <section className="guided-stage">
          {(progress.stage === "welcome" || progress.stage === "build-workshop" || progress.stage === "recruit" || progress.stage === "complete")
            ? <TownView progress={progress} armyPower={armyPower} />
            : <AdventureMap progress={progress} moveTo={moveTo} armyPower={armyPower} />}
        </section>

        <aside className="guided-army-panel">
          <p className="eyebrow">HERO & ARMY</p>
          <article className="hero-card">
            <div className="hero-portrait">A</div>
            <div><h3>Archer</h3><p>远坂阵营英雄</p></div>
            <strong>战力 {armyPower}</strong>
          </article>
          <article className="army-stack main-stack"><span className="stack-icon">🏹</span><div><strong>Archer</strong><small>远程英雄单位</small></div><b>1</b></article>
          <article className={`army-stack ${progress.familiars > 0 ? "" : "locked"}`}><span className="stack-icon">◆</span><div><strong>侦察使魔</strong><small>发现敌情 · 提供先制</small></div><b>{progress.familiars}</b></article>
          <article className="town-bonus"><span>主城加成</span><strong>{progress.workshopLevel > 0 ? "魔力收入 +4" : "尚未建设"}</strong></article>
          <button className="guided-reset" onClick={resetTutorial}>重置教学</button>
        </aside>
      </section>
    </main>
  );
}

function TownView(props: { readonly progress: GuidedProgress; readonly armyPower: number }) {
  const workshopBuilt = props.progress.workshopLevel > 0;
  return (
    <div className="town-view">
      <div className="town-sky"><span>第1夜 · 黄昏</span></div>
      <div className="town-title"><p className="eyebrow">YOUR TOWN</p><h2>远坂宅</h2><p>管理资源、建设建筑、招募部队，然后让Archer出城探索。</p></div>
      <div className="town-buildings">
        <article className="building-card mansion built"><div className="building-art">🏰</div><h3>远坂宅邸</h3><p>Master据点 · 安全休整</p><span>已建造</span></article>
        <article className={`building-card workshop ${workshopBuilt ? "built" : "available"}`}><div className="building-art">✦</div><h3>魔术工房</h3><p>恢复魔力并解锁使魔招募</p><span>{workshopBuilt ? "等级 1" : "可建造"}</span></article>
        <article className={`building-card familiar-hall ${props.progress.familiars > 0 ? "built" : workshopBuilt ? "available" : "locked"}`}><div className="building-art">◆</div><h3>使魔召唤阵</h3><p>招募侦察部队</p><span>{props.progress.familiars > 0 ? `${props.progress.familiars}队待命` : workshopBuilt ? "可招募" : "需要工房"}</span></article>
      </div>
      <div className="town-footer"><span>驻守英雄：Archer</span><span>当前军势战力：{props.armyPower}</span></div>
    </div>
  );
}

function AdventureMap(props: {
  readonly progress: GuidedProgress;
  readonly armyPower: number;
  readonly moveTo: (location: GuidedProgress["location"]) => void;
}) {
  const { progress } = props;
  return (
    <div className="adventure-view">
      <div className="map-caption"><p className="eyebrow">ADVENTURE MAP</p><h2>冬木市 · 第1夜</h2><p>Archer每天拥有有限移动力。只能前往有道路连接的地点。</p></div>
      <svg className="adventure-map" viewBox="0 0 760 470" role="img" aria-label="远坂宅、商店街和穗群原学园组成的教学冒险地图">
        <defs>
          <linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#172436"/><stop offset="1" stopColor="#0b111b"/></linearGradient>
        </defs>
        <rect width="760" height="470" rx="22" fill="url(#mapBg)" />
        <path d="M145 325 C245 300 260 225 365 235 S505 160 615 125" fill="none" stroke="#68758a" strokeWidth="12" opacity=".34" />
        <path d="M145 325 C245 300 260 225 365 235 S505 160 615 125" fill="none" stroke="#b6a16d" strokeWidth="3" strokeDasharray="10 9" opacity=".8" />
        <MapNode x={145} y={325} label="远坂宅" icon="城" active={progress.location === "tohsaka-residence"} completed />
        <MapNode x={365} y={235} label="商店街" icon="街" active={progress.location === "shopping-street"} completed={progress.location === "school"} available={progress.stage === "depart" && progress.location === "tohsaka-residence"} onSelect={() => props.moveTo("shopping-street")} />
        <MapNode x={615} y={125} label="穗群原学园" icon="校" active={progress.location === "school"} available={progress.stage === "depart" && progress.location === "shopping-street"} controlled={progress.schoolLeylineControlled} onSelect={() => props.moveTo("school")} />
        {progress.location === "school" && progress.stage === "collect" && <g transform="translate(555 225)"><circle r="28" fill="#633f86" stroke="#d2a6ff" strokeWidth="3"/><text textAnchor="middle" y="6" fill="white" fontSize="23">◆</text><text textAnchor="middle" y="50" fill="#dec7f5" fontSize="14">魔力结晶 +6</text></g>}
        {progress.stage === "battle-ready" && <g transform="translate(690 220)"><circle r="31" fill="#263e68" stroke="#7ca8ed" strokeWidth="4"/><text textAnchor="middle" y="7" fill="white" fontWeight="bold" fontSize="22">L</text><text textAnchor="middle" y="54" fill="#b9d3ff" fontSize="14">敌方Lancer</text></g>}
        <g transform={`translate(${progress.location === "tohsaka-residence" ? 145 : progress.location === "shopping-street" ? 365 : 615} ${progress.location === "tohsaka-residence" ? 250 : progress.location === "shopping-street" ? 160 : 50})`}><circle r="25" fill="#913746" stroke="#f1c5cb" strokeWidth="4"/><text textAnchor="middle" y="7" fill="white" fontWeight="bold" fontSize="20">A</text><text textAnchor="middle" y="46" fill="#ffd8dd" fontSize="13">Archer · 战力 {props.armyPower}</text></g>
      </svg>
      <div className="map-legend"><span><i className="hero"/>英雄位置</span><span><i className="available"/>当前可前往</span><span><i className="controlled"/>已控制灵脉</span><span><i className="enemy"/>敌方威胁</span></div>
    </div>
  );
}

function MapNode(props: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly icon: string;
  readonly active?: boolean;
  readonly completed?: boolean;
  readonly available?: boolean;
  readonly controlled?: boolean;
  readonly onSelect?: () => void;
}) {
  const classes = ["map-node", props.active ? "active" : "", props.available ? "available" : "", props.controlled ? "controlled" : "", props.completed ? "completed" : ""].filter(Boolean).join(" ");
  return (
    <g className={classes} transform={`translate(${props.x} ${props.y})`} onClick={props.available ? props.onSelect : undefined} role={props.available ? "button" : undefined}>
      {props.available && <circle r="55" fill="none" stroke="#f2d37e" strokeWidth="3" opacity=".42"><animate attributeName="r" values="44;58;44" dur="1.8s" repeatCount="indefinite"/></circle>}
      <circle r="39" fill={props.controlled ? "#23564e" : props.active ? "#6f303c" : "#26374b"} stroke={props.available ? "#f2d37e" : props.controlled ? "#6ed4c0" : "#8190a4"} strokeWidth={props.available || props.active ? 5 : 3}/>
      <text textAnchor="middle" y="8" fill="white" fontSize="25" fontWeight="bold">{props.icon}</text>
      <text textAnchor="middle" y="65" fill="#f3eee4" fontSize="16" fontWeight="bold">{props.label}</text>
      {props.available && <text textAnchor="middle" y="86" fill="#f3d689" fontSize="13">点击前往</text>}
      {props.controlled && <text textAnchor="middle" y="86" fill="#8ce0d1" fontSize="13">远坂控制</text>}
    </g>
  );
}

function stageIndex(stage: GuidedStage): number {
  if (stage === "welcome" || stage === "build-workshop") return 0;
  if (stage === "recruit") return 1;
  if (stage === "depart") return 2;
  if (stage === "collect") return 3;
  if (stage === "capture") return 4;
  if (stage === "battle-ready" || stage === "battle") return 5;
  return 6;
}

function loadProgress(): GuidedProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<GuidedProgress>;
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return DEFAULT_PROGRESS;
  }
}
