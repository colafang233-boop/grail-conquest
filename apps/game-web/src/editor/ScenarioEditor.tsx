import {
  createScenarioPreviewState,
  validateExternalContentPack,
  type BrowserContentPack,
  type ExternalEncounterContent,
  type ExternalRegionContent,
  type GameState,
} from "@grail/core";
import { useMemo, useRef, useState } from "react";
import { gameEngine } from "../game-engine";
import {
  exportActiveContentPack,
  getActiveContentPack,
  installContentOverride,
} from "../content/browser-content";
import "./editor.css";

export interface ScenarioEditorProps {
  readonly onClose: () => void;
  readonly onLaunchPreview: (state: GameState) => void;
}

export function ScenarioEditor(props: ScenarioEditorProps) {
  const [pack, setPack] = useState<BrowserContentPack>(() => clonePack(getActiveContentPack()));
  const [regionId, setRegionId] = useState(pack.regions[0]?.id ?? "school");
  const [encounterId, setEncounterId] = useState(pack.encounters[0]?.id ?? "school-night");
  const [feedback, setFeedback] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const region = useMemo(() => pack.regions.find(item => item.id === regionId) ?? pack.regions[0], [pack, regionId]);
  const encounter = useMemo(() => pack.encounters.find(item => item.id === encounterId) ?? pack.encounters[0], [pack, encounterId]);
  const validation = useMemo(() => validateExternalContentPack(pack, "scenario-editor"), [pack]);

  const updateRegion = (patch: Partial<ExternalRegionContent>) => {
    if (!region) return;
    setPack(current => ({
      ...current,
      regions: current.regions.map(item => item.id === region.id ? { ...item, ...patch } : item),
    }));
  };

  const updateEncounter = (patch: Partial<ExternalEncounterContent>) => {
    if (!encounter) return;
    setPack(current => ({
      ...current,
      encounters: current.encounters.map(item => item.id === encounter.id ? { ...item, ...patch } : item),
    }));
  };

  const applyPack = () => {
    if (!validation.valid) {
      setFeedback("内容包仍包含错误，不能应用。");
      return;
    }
    const override: BrowserContentPack = {
      ...pack,
      id: "browser-editor-overrides",
      version: `${pack.version}+editor`,
      priority: 100,
    };
    const result = installContentOverride(override, "scenario-editor.json");
    setFeedback(result.status === "ready" ? "内容覆盖包已保存到浏览器。" : result.error);
  };

  const launchPreview = () => {
    if (!validation.valid || !encounter) {
      setFeedback("请先修复内容诊断。");
      return;
    }
    const result = createScenarioPreviewState(gameEngine.getSnapshot().state, pack, encounter.id);
    if (!result.state) {
      setFeedback(result.error ?? "无法创建测试场景");
      return;
    }
    props.onLaunchPreview(result.state);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${pack.id}-${pack.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
    setFeedback("场景JSON已复制到剪贴板。");
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const result = validateExternalContentPack(value, file.name);
      if (!result.pack) {
        setFeedback(result.diagnostics.map(item => item.message).join("；"));
        return;
      }
      setPack(clonePack(result.pack));
      setRegionId(result.pack.regions[0]?.id ?? "school");
      setEncounterId(result.pack.encounters[0]?.id ?? "school-night");
      setFeedback(result.valid ? "内容包已导入。" : "内容包已导入，但仍包含错误。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "JSON导入失败");
    }
  };

  return (
    <main className="tool-shell editor-shell" aria-labelledby="scenario-editor-title">
      <section className="tool-panel editor-panel">
        <header>
          <div>
            <p className="eyebrow">BROWSER SCENARIO EDITOR</p>
            <h1 id="scenario-editor-title">场景编辑器</h1>
            <p>内容包 {pack.id} · {pack.version}</p>
          </div>
          <button onClick={props.onClose} aria-label="关闭场景编辑器">关闭</button>
        </header>

        <div className="editor-toolbar">
          <button onClick={() => inputRef.current?.click()}>导入JSON</button>
          <button onClick={exportJson}>下载JSON</button>
          <button onClick={copyJson}>复制JSON</button>
          <button onClick={applyPack} disabled={!validation.valid}>保存为浏览器覆盖包</button>
          <button className="editor-launch" onClick={launchPreview} disabled={!validation.valid}>一键隔离试玩</button>
          <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={event => void importFile(event.target.files?.[0])} />
        </div>

        <section className="editor-grid">
          <article className="editor-card">
            <div className="editor-section-heading"><h2>战略区域</h2><select value={region?.id} onChange={event => setRegionId(event.target.value)}>{pack.regions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            {region && <>
              <label>名称<input value={region.name} onChange={event => updateRegion({ name: event.target.value })} /></label>
              <div className="editor-field-row">
                <label>X<input type="number" value={region.x} onChange={event => updateRegion({ x: Number(event.target.value) })} /></label>
                <label>Y<input type="number" value={region.y} onChange={event => updateRegion({ y: Number(event.target.value) })} /></label>
                <label>灵脉<input type="number" min="0" value={region.leylineStrength} onChange={event => updateRegion({ leylineStrength: Number(event.target.value) })} /></label>
              </div>
              <label>连接区域<input value={region.connections.join(", ")} onChange={event => updateRegion({ connections: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} /></label>
              <label>遭遇ID<input value={region.encounterId ?? ""} onChange={event => updateRegion(event.target.value ? { encounterId: event.target.value } : {})} /></label>
            </>}
          </article>

          <article className="editor-card">
            <div className="editor-section-heading"><h2>战术遭遇</h2><select value={encounter?.id} onChange={event => setEncounterId(event.target.value)}>{pack.encounters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
            {encounter && <>
              <label>标题<input value={encounter.title} onChange={event => updateEncounter({ title: event.target.value })} /></label>
              <label>副标题<input value={encounter.subtitle} onChange={event => updateEncounter({ subtitle: event.target.value })} /></label>
              <label>目标<textarea value={encounter.objective} onChange={event => updateEncounter({ objective: event.target.value })} /></label>
              <label>区域<select value={encounter.regionId} onChange={event => updateEncounter({ regionId: event.target.value })}>{pack.regions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <div className="editor-spawn-grid">
                <fieldset><legend>我方出生点</legend><label>Q<input type="number" value={encounter.playerStart.q} onChange={event => updateEncounter({ playerStart: { ...encounter.playerStart, q: Number(event.target.value) } })} /></label><label>R<input type="number" value={encounter.playerStart.r} onChange={event => updateEncounter({ playerStart: { ...encounter.playerStart, r: Number(event.target.value) } })} /></label></fieldset>
                <fieldset><legend>敌方出生点</legend><label>Q<input type="number" value={encounter.enemyStart.q} onChange={event => updateEncounter({ enemyStart: { ...encounter.enemyStart, q: Number(event.target.value) } })} /></label><label>R<input type="number" value={encounter.enemyStart.r} onChange={event => updateEncounter({ enemyStart: { ...encounter.enemyStart, r: Number(event.target.value) } })} /></label></fieldset>
              </div>
            </>}
          </article>
        </section>

        <section className={`diagnostic-panel ${validation.valid ? "valid" : "invalid"}`}>
          <div><h2>内容诊断</h2><strong>{validation.valid ? "可试玩" : `${validation.diagnostics.filter(item => item.severity === "error").length} 个错误`}</strong></div>
          {validation.diagnostics.length === 0 ? <p>未发现跨引用或结构错误。</p> : <ol>{validation.diagnostics.map((item, index) => <li key={`${item.code}-${index}`}><code>{item.path}</code><strong>{item.message}</strong><small>{item.suggestedFix}</small></li>)}</ol>}
        </section>
        {feedback && <p className="editor-feedback" role="status">{feedback}</p>}
        <details className="editor-raw"><summary>查看当前完整JSON</summary><pre>{JSON.stringify(pack, null, 2)}</pre></details>
      </section>
    </main>
  );
}

function clonePack(pack: BrowserContentPack): BrowserContentPack {
  return JSON.parse(JSON.stringify(pack)) as BrowserContentPack;
}
