import { useGameSnapshot } from "../hooks/useGameSnapshot";

export function GuidedBattleCoach() {
  const snapshot = useGameSnapshot();
  const activeUnit = snapshot.state.battle.units[snapshot.state.battle.activeUnitId];
  const playerTurn = activeUnit?.factionId === snapshot.state.campaign.selectedPlayerFactionId;

  return (
    <aside className="guided-battle-coach" aria-live="polite">
      <p className="eyebrow">BATTLE COACH</p>
      <h3>{playerTurn ? `轮到 ${activeUnit?.name ?? "我方单位"}` : "敌方行动中"}</h3>
      {playerTurn ? (
        <>
          <p>只看右侧五个动作。当前推荐操作会根据战局变化：</p>
          <ol>
            <li>点击“移动”，选择蓝色六边格靠近敌人。</li>
            <li>进入射程后，使用“投影射击”或普通攻击。</li>
            <li>凛遇险时，Archer会自动消耗反应进行护卫。</li>
            <li>宝具准备完成后释放，或在获得线索后撤退。</li>
          </ol>
        </>
      ) : <p>等待Lancer行动结算。蓝色枪兵会优先追击凛，注意保持Archer在护卫距离内。</p>}
    </aside>
  );
}
