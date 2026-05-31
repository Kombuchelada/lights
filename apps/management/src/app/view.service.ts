import { Injectable, computed, effect, signal } from '@angular/core';

/** Identifiers for the collapsible control cards, in display order. */
export type CardId = 'color' | 'light' | 'position' | 'stereo' | 'flicker' | 'ab' | 'sweep';

export const CARD_IDS: readonly CardId[] = [
  'color',
  'light',
  'position',
  'stereo',
  'flicker',
  'ab',
  'sweep',
];

const COMPACT_KEY = 'lumessa.compact';
const COLLAPSED_KEY = 'lumessa.collapsed';

/**
 * Persisted display preferences for the controller's card area: the
 * {@link compact} density toggle and the per-card collapse state. Mirrors
 * {@link ThemeService}'s pattern — load from `localStorage`, expose signals for
 * zoneless change detection, and persist via effects. Independent of the
 * responsive card grid, which is driven purely by CSS width.
 */
@Injectable({ providedIn: 'root' })
export class ViewService {
  readonly compact = signal<boolean>(this.loadCompact());

  /** Set of collapsed card ids. Absence = expanded. */
  private readonly collapsed = signal<ReadonlySet<CardId>>(this.loadCollapsed());

  /** True when every card is collapsed (drives the toolbar's toggle affordance). */
  readonly allCollapsed = computed(() => CARD_IDS.every((id) => this.collapsed().has(id)));

  /** True when at least one card is collapsed. */
  readonly anyCollapsed = computed(() => this.collapsed().size > 0);

  constructor() {
    effect(() => this.persist(COMPACT_KEY, this.compact() ? '1' : '0'));
    effect(() => this.persist(COLLAPSED_KEY, JSON.stringify([...this.collapsed()])));
  }

  toggleCompact(): void {
    this.compact.update((v) => !v);
  }

  isCollapsed(id: CardId): boolean {
    return this.collapsed().has(id);
  }

  toggleCard(id: CardId): void {
    const next = new Set(this.collapsed());
    next.has(id) ? next.delete(id) : next.add(id);
    this.collapsed.set(next);
  }

  expandAll(): void {
    this.collapsed.set(new Set());
  }

  collapseAll(): void {
    this.collapsed.set(new Set(CARD_IDS));
  }

  private loadCompact(): boolean {
    try {
      return localStorage.getItem(COMPACT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private loadCollapsed(): ReadonlySet<CardId> {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) {
        const ids = (JSON.parse(raw) as unknown[]).filter(
          (v): v is CardId => CARD_IDS.includes(v as CardId),
        );
        return new Set(ids);
      }
    } catch {
      /* corrupt or unavailable storage — start with everything expanded */
    }
    return new Set();
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage may be unavailable (private mode); preference still works in-session */
    }
  }
}
