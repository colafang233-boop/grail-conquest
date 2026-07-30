import { useBrowserSettings, updateBrowserSettings } from "../browser-settings";
import "./settings.css";

export function BrowserSettingsPanel(props: { readonly onClose: () => void }) {
  const settings = useBrowserSettings();
  return (
    <main className="tool-shell settings-shell" aria-labelledby="browser-settings-title">
      <section className="tool-panel settings-panel">
        <header>
          <div>
            <p className="eyebrow">BROWSER SETTINGS</p>
            <h1 id="browser-settings-title">浏览器设置</h1>
          </div>
          <button onClick={props.onClose} aria-label="关闭浏览器设置">关闭</button>
        </header>

        <label className="setting-row">
          <span><strong>减少动画</strong><small>关闭Phaser位移补间和界面过渡。</small></span>
          <input type="checkbox" checked={settings.reducedMotion} onChange={event => updateBrowserSettings({ reducedMotion: event.target.checked })} />
        </label>
        <label className="setting-row">
          <span><strong>高对比度</strong><small>增强边框、按钮和关键信息对比。</small></span>
          <input type="checkbox" checked={settings.highContrast} onChange={event => updateBrowserSettings({ highContrast: event.target.checked })} />
        </label>
        <label className="setting-row vertical">
          <span><strong>界面字号</strong><small>浏览器刷新后仍会保留。</small></span>
          <select value={settings.fontScale} onChange={event => updateBrowserSettings({ fontScale: Number(event.target.value) as 0.9 | 1 | 1.15 | 1.3 })}>
            <option value={0.9}>90%</option>
            <option value={1}>100%</option>
            <option value={1.15}>115%</option>
            <option value={1.3}>130%</option>
          </select>
        </label>
        <label className="setting-row">
          <span><strong>静音启动</strong><small>音效仅在玩家主动解除静音后启用。</small></span>
          <input type="checkbox" checked={settings.muted} onChange={event => updateBrowserSettings({ muted: event.target.checked })} />
        </label>
        <label className="setting-row vertical">
          <span><strong>主音量</strong><small>{Math.round(settings.masterVolume * 100)}%</small></span>
          <input type="range" min="0" max="1" step="0.05" value={settings.masterVolume} onChange={event => updateBrowserSettings({ masterVolume: Number(event.target.value) })} />
        </label>

        <section className="shortcut-card">
          <h2>键盘快捷键</h2>
          <dl>
            <div><dt>Esc</dt><dd>关闭工具窗口或取消当前选择</dd></div>
            <div><dt>R</dt><dd>打开Replay检查器</dd></div>
            <div><dt>E</dt><dd>打开场景编辑器</dd></div>
            <div><dt>S</dt><dd>打开浏览器设置</dd></div>
            <div><dt>Enter / Space</dt><dd>触发当前聚焦按钮</dd></div>
          </dl>
        </section>
      </section>
    </main>
  );
}
