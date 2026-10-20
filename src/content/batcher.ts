/** @spec spec://modules/page/FEAT-002-page-translation#queue */
import type { Settings } from '../shared/contracts';
import type { NodeEntry } from './registry';
import { MAX_LONG_NODE_CHARS, TARGET_BATCH_COST, TARGET_BATCH_NODES, textCost } from '../translation/segments';

export function takeBatch(queue: Map<string, NodeEntry>, settings: Settings): { entries: NodeEntry[]; oversized: NodeEntry[] } {
  const ordered = [...queue.values()].sort((a, b) => a.priority - b.priority || a.groupOrder - b.groupOrder || a.order - b.order);
  const entries: NodeEntry[] = [];
  const oversized: NodeEntry[] = [];
  let chars = 0;
  let cost = 0;
  for (const entry of ordered) {
    const length = entry.original.trim().length;
    if (length > MAX_LONG_NODE_CHARS) {
      queue.delete(entry.id);
      oversized.push(entry);
      continue;
    }
    if (entries.length >= Math.min(settings.maxNodesPerBatch, TARGET_BATCH_NODES)) break;
    const weight = textCost(entry.original.trim());
    if (entries.length && (chars + length > settings.maxCharsPerBatch || cost + weight > TARGET_BATCH_COST)) break;
    queue.delete(entry.id);
    entries.push(entry);
    chars += length;
    cost += weight;
    // A long node occupies one scheduler slot and is sent as bounded parts.
    if (length > settings.maxCharsPerBatch || weight > TARGET_BATCH_COST) break;
  }
  // Keep each DOM ID in the message. The shared engine deduplicates text and
  // remaps IDs/cache hits; the page never creates a separate request per node.
  return { entries, oversized };
}
