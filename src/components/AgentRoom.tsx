import { For, Show, createMemo } from "solid-js";
import { getAgentActivities } from "../lib/agent-activity";
import { formatMessage, useI18n } from "../lib/i18n";
import { messageStore } from "../stores/message";
import styles from "./AgentRoom.module.css";

interface AgentRoomProps {
  sessionId: string | null;
  sending: boolean;
  waiting: boolean;
  connected: boolean;
  onClose: () => void;
}

export function AgentRoom(props: AgentRoomProps) {
  const { t } = useI18n();
  const agents = createMemo(() => getAgentActivities({
    sessionId: props.sessionId ?? "",
    messages: props.sessionId ? messageStore.message[props.sessionId] ?? [] : [],
    parts: messageStore.part,
    sending: props.sending,
    waiting: props.waiting,
    connected: props.connected,
  }));
  const agentIds = createMemo(() => agents().map((agent) => agent.id));
  const workingCount = createMemo(() => agents().filter((agent) => agent.status === "working").length);

  return (
    <aside id="agent-room" class={styles.room} aria-label={t().agentRoom.title}>
      <header class={styles.header}>
        <div>
          <p class={styles.eyebrow}>{t().agentRoom.eyebrow}</p>
          <h2>{t().agentRoom.title}</h2>
        </div>
        <button type="button" class={styles.close} onClick={() => props.onClose()} aria-label={t().agentRoom.hide}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div class={styles.summary} role="status">
        <span class={styles.dot} data-connected={props.connected} />
        <Show when={props.connected} fallback={t().agentRoom.offline}>
          {formatMessage(t().agentRoom.activeCount, { count: workingCount() })}
        </Show>
      </div>

      <div class={styles.roster}>
        <div class={styles.destinations} aria-hidden="true">
          <span>{t().agentRoom.home}</span>
          <span>{t().agentRoom.mission}</span>
        </div>
        <For each={agentIds()}>
          {(id, index) => {
            const agent = createMemo(() => agents().find((item) => item.id === id)!);
            const name = createMemo(() => index() === 0
              ? t().agentRoom.lead
              : agent().title || formatMessage(t().agentRoom.agentName, { count: index() }));
            return (
              <article
                class={styles.agent}
                data-agent-id={id}
                data-status={agent().status}
                style={{ "--agent-hue": `${(index() * 67 + 265) % 360}` }}
              >
                <div class={styles.track} aria-hidden="true">
                  <div class={styles.desk}><span /></div>
                  <div class={styles.path} />
                  <div class={styles.portal} />
                  <div class={styles.traveler}>
                    <svg class={styles.sprite} width="40" height="48" viewBox="0 0 20 24" shape-rendering="crispEdges">
                      <path class={styles.hair} d="M5 1h10v2h2v9H3V3h2Z" />
                      <path fill="#f6d8c9" d="M5 6h10v7H5Z" />
                      <path fill="#38254e" d="M6 7h2v2H6Zm6 0h2v2h-2ZM9 11h2v1H9Z" />
                      <path class={styles.shirt} d="M5 13h10v7H5ZM3 14h2v5H3Zm12 0h2v5h-2Z" />
                      <path fill="#f6d8c9" d="M3 19h2v2H3Zm12 0h2v2h-2Z" />
                      <path class={styles.legs} fill="#493356" d="M5 20h4v4H4v-2h1Zm6 0h4v2h1v2h-5Z" />
                      <path fill="#fff7dc" d="M9 14h2v2H9Z" />
                    </svg>
                  </div>
                </div>
                <div class={styles.caption}>
                  <h3 title={name()}>{name()}</h3>
                  <span class={styles.badge}>{t().agentRoom[agent().status]}</span>
                </div>
                <Show when={agent().error && agent().status === "error"}>
                  <p class={styles.error}>{agent().error}</p>
                </Show>
              </article>
            );
          }}
        </For>
        <Show when={agents().length === 1}>
          <p class={styles.empty}>
            {props.sessionId ? t().agentRoom.empty : t().agentRoom.noSession}
          </p>
        </Show>
      </div>

      <footer class={styles.footer}>{t().agentRoom.hint}</footer>
    </aside>
  );
}
