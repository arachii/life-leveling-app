import { FUND_TARGETS, SHOP_REWARDS } from "../domain/catalog.js";
import { activeCoupon, dailyReward, rewardReason, rewardUnlock } from "../domain/rewards.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function RewardsPage({ state, dispatch }) {
  const unlock = rewardUnlock(state);
  const reward = state.today.rewardCard || dailyReward(state);
  const revealed = reward.locked || reward.claimed || unlock.open;

  return (
    <section className="page-stack">
      <SectionTitle title="村長賞賜" sub="每天一張，解封後鎖定，重新整理不換卡。" />
      <Panel className={revealed ? "reward-card" : ""}>
        <div className="row between"><span className="muted">今日封印賞賜</span><span className="badge">{unlock.label}</span></div>
        {revealed ? (
          <>
            <h3>{reward.title}</h3>
            <p>{reward.detail}</p>
            <div className="question">為什麼是這張：{rewardReason(state)}</div>
            <button className="primary wide" disabled={reward.claimed || !unlock.open} onClick={() => dispatch({ type: "reward/claim" })}>
              {reward.claimed ? "今日已領取" : "領取賞賜"}
            </button>
          </>
        ) : (
          <>
            <h3>內容封印中</h3>
            <p>{unlock.detail}</p>
            <div className="gold tiny">目前：{unlock.progress}</div>
          </>
        )}
      </Panel>

      {state.rewards.boosts.length > 0 && (
        <Panel>
          <h3>持有加成</h3>
          {state.rewards.boosts.map((item) => <p key={item.id}>• {item.title}：+{item.amount} 金幣，剩 {item.remaining} 次</p>)}
        </Panel>
      )}
      {state.rewards.coupons.length > 0 && (
        <Panel>
          <h3>持有折扣券</h3>
          {state.rewards.coupons.map((item) => <p key={item.id}>• {item.title}：-{item.amount} 金幣，期限 {item.expiresAt}</p>)}
        </Panel>
      )}

      <SectionTitle title="獎勵商店" sub="休息與娛樂也要有出口，但不要讓食物成為唯一獎勵。" />
      <div className="list">
        {SHOP_REWARDS.map((item) => {
          const coupon = activeCoupon(state, item.id);
          const price = Math.max(0, item.cost - Number(coupon?.amount || 0));
          return (
            <Panel key={item.id}>
              <div className="row between"><h3>{item.title}</h3><span className="badge">{item.tier}</span></div>
              <p>{item.detail}</p>
              <div className="row between">
                <b className="gold">{price} 金幣</b>
                {coupon && <span className="tag">折扣 -{coupon.amount}</span>}
              </div>
              <button className="primary wide" onClick={() => dispatch({ type: "shop/redeem", id: item.id })}>兌換</button>
            </Panel>
          );
        })}
      </div>

      <SectionTitle title="長期目標基金" />
      <div className="list">
        {FUND_TARGETS.map((item) => (
          <Panel key={item.id}>
            <div className="row between"><h3>{item.title}</h3><b>{state.rewards.funds[item.id]} 元</b></div>
            <p>{item.note}</p>
            <button className="secondary wide" onClick={() => dispatch({ type: "fund/redeem", id: item.id })}>
              {item.coinCost} 金幣 → {item.cash} 元
            </button>
          </Panel>
        ))}
      </div>
    </section>
  );
}