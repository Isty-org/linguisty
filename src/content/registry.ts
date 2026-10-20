/** @spec spec://modules/page/FEAT-002-page-translation#scan */
import { MAX_PAGE_NODES } from '../shared/constants';
import type { TextCandidate } from './scanner';

export type NodePhase = 'pending' | 'translating' | 'translated' | 'failed';
export interface CacheHitGroup {
  hits: number;
  total: number;
  remaining: number;
}

export interface NodeEntry {
  readonly id: string;
  readonly node: Text;
  readonly order: number;
  original: string;
  expected: string;
  translation?: string;
  preview?: string;
  revision: number;
  batchId?: string;
  phase: NodePhase;
  priority: number;
  group: string;
  groupOrder: number;
  cacheHit: boolean;
  cacheGroup?: CacheHitGroup;
}

function releaseCacheGroup(entry: NodeEntry): void {
  entry.cacheHit = false;
  if (entry.cacheGroup) entry.cacheGroup.remaining -= 1;
  entry.cacheGroup = undefined;
}

/** @spec spec://modules/page/FEAT-002-page-translation#render */
export function syncExternalText(entry: NodeEntry): boolean {
  if (entry.node.data === entry.expected) return false;
  releaseCacheGroup(entry);
  entry.original = entry.node.data;
  entry.expected = entry.node.data;
  entry.translation = undefined;
  entry.preview = undefined;
  entry.revision += 1;
  entry.batchId = undefined;
  entry.phase = 'pending';
  return true;
}

/** @spec spec://modules/page/FEAT-002-page-translation#scan */
export class NodeRegistry {
  private byNode = new WeakMap<Text, NodeEntry>();
  private groups = new WeakMap<Element, number>();
  readonly entries = new Set<NodeEntry>();
  private sequence = 0;
  private groupSequence = 0;
  limited = false;

  get size(): number { return this.entries.size; }
  get(node: Text): NodeEntry | undefined { return this.byNode.get(node); }

  track(candidate: TextCandidate): NodeEntry | undefined {
    let groupOrder = this.groups.get(candidate.container);
    if (groupOrder === undefined) {
      groupOrder = ++this.groupSequence;
      this.groups.set(candidate.container, groupOrder);
    }
    const known = this.byNode.get(candidate.node);
    if (known) {
      syncExternalText(known);
      known.priority = candidate.priority;
      known.groupOrder = groupOrder;
      known.group = `g${groupOrder}`;
      return known;
    }
    if (this.entries.size >= MAX_PAGE_NODES) {
      this.limited = true;
      return;
    }
    const order = ++this.sequence;
    const entry: NodeEntry = {
      id: `n${order}`, node: candidate.node, order,
      original: candidate.node.data, expected: candidate.node.data,
      revision: 0, phase: 'pending', priority: candidate.priority,
      group: `g${groupOrder}`, groupOrder, cacheHit: false,
    };
    this.byNode.set(candidate.node, entry);
    this.entries.add(entry);
    return entry;
  }

  remove(entry: NodeEntry): void {
    releaseCacheGroup(entry);
    this.byNode.delete(entry.node);
    this.entries.delete(entry);
  }

  prune(): NodeEntry[] {
    const removed: NodeEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.node.isConnected) {
        this.remove(entry);
        removed.push(entry);
      }
    }
    return removed;
  }

  clear(): void {
    this.entries.clear();
    this.byNode = new WeakMap();
    this.groups = new WeakMap();
    this.groupSequence = 0;
    this.limited = false;
    // IDs are not reused during the life of a controller, including SPA resets.
  }
}
