import { writable } from "svelte/store";

export type ViberHeaderTab = "chat" | "terminals" | "dev-server";

export interface ViberSkillInfo {
  id: string;
  name: string;
  description: string;
}

export interface ViberHeaderContext {
  viberId: string;
  viberName: string;
  isConnected: boolean;
  platform: string | null;
  skills: ViberSkillInfo[];
  activeTab: ViberHeaderTab;
  refreshRequested: number;
}

function createHeaderStore() {
  const { subscribe, set, update } = writable<{
    viber: ViberHeaderContext | null;
  }>({ viber: null });

  return {
    subscribe,
    setViberContext(viber: Partial<ViberHeaderContext> | null) {
      if (viber === null) {
        update((s) => ({ ...s, viber: null }));
        return;
      }
      update((s) => ({
        ...s,
        viber: {
          viberId: viber.viberId ?? s.viber?.viberId ?? "",
          viberName: viber.viberName ?? s.viber?.viberName ?? "",
          isConnected: viber.isConnected ?? s.viber?.isConnected ?? false,
          platform: viber.platform ?? s.viber?.platform ?? null,
          skills: viber.skills ?? s.viber?.skills ?? [],
          activeTab: viber.activeTab ?? s.viber?.activeTab ?? "chat",
          refreshRequested: s.viber?.refreshRequested ?? 0,
        },
      }));
    },
    setActiveTab(tab: ViberHeaderTab) {
      update((s) => {
        if (!s.viber) return s;
        return { ...s, viber: { ...s.viber, activeTab: tab } };
      });
    },
    requestRefresh() {
      update((s) => {
        if (!s.viber) return s;
        return {
          ...s,
          viber: { ...s.viber, refreshRequested: Date.now() },
        };
      });
    },
  };
}

export const headerStore = createHeaderStore();
