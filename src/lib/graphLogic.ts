// ============================================
// Graph Logic — Cycle Detection & Dependency Resolution
// Time Complexity: O(V + E)
// ============================================

export type Dependency = {
  id?: string;
  predecessor_id: string;
  successor_id: string;
  type: 'full' | 'partial';
  threshold: number;
};

export type WorkItem = {
  id: string;
  title?: string;
  progress: number;
  status: 'blocked' | 'in-progress' | 'done';
};

// ────────────────────────────────────────────
// 1. CYCLE DETECTION using DFS (O(V + E))
// ────────────────────────────────────────────
// Uses 3-colour DFS: WHITE(0)=unvisited, GREY(1)=in-stack, BLACK(2)=finished
// A back-edge (hitting a GREY node) means cycle.

export function willCauseCycle(
  existingDependencies: Dependency[],
  newPredecessorId: string,
  newSuccessorId: string
): boolean {
  // Self-loop check
  if (newPredecessorId === newSuccessorId) return true;

  // Build adjacency list: predecessor → [successors]
  const adj: Record<string, string[]> = {};
  const allDeps = [
    ...existingDependencies,
    { predecessor_id: newPredecessorId, successor_id: newSuccessorId },
  ];

  for (const dep of allDeps) {
    if (!adj[dep.predecessor_id]) adj[dep.predecessor_id] = [];
    adj[dep.predecessor_id].push(dep.successor_id);
  }

  const WHITE = 0, GREY = 1, BLACK = 2;
  const color: Record<string, number> = {};

  // Iterative DFS to avoid stack overflow on long chains
  function hasCycleFrom(start: string): boolean {
    const stack: { node: string; childIdx: number }[] = [{ node: start, childIdx: 0 }];
    color[start] = GREY;

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const children = adj[top.node] || [];

      if (top.childIdx < children.length) {
        const child = children[top.childIdx];
        top.childIdx++;

        if (color[child] === GREY) return true;  // back-edge → cycle
        if (color[child] === undefined || color[child] === WHITE) {
          color[child] = GREY;
          stack.push({ node: child, childIdx: 0 });
        }
      } else {
        color[top.node] = BLACK;
        stack.pop();
      }
    }
    return false;
  }

  // Run from every unvisited node
  const nodes = new Set(allDeps.flatMap((d) => [d.predecessor_id, d.successor_id]));
  for (const node of nodes) {
    if (color[node] === undefined || color[node] === WHITE) {
      if (hasCycleFrom(node)) return true;
    }
  }

  return false;
}

// ────────────────────────────────────────────
// 2. DEPENDENCY RESOLUTION (O(V + E))
// ────────────────────────────────────────────
// When a task's progress changes, traverse downstream successors
// and check whether ALL predecessor conditions are met to unblock.

export function resolveDownstreamImpact(
  updatedItemId: string,
  dependencies: Dependency[],
  allItems: Map<string, WorkItem>
): { itemsToUnblock: string[]; itemsToBlock: string[] } {
  const itemsToUnblock: string[] = [];
  const itemsToBlock: string[] = [];

  // BFS from the updated item downstream
  const visited = new Set<string>();
  const queue = [updatedItemId];
  visited.add(updatedItemId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    // Find edges where currentId is the predecessor
    const outEdges = dependencies.filter((d) => d.predecessor_id === currentId);

    for (const edge of outEdges) {
      const successorId = edge.successor_id;
      const successor = allItems.get(successorId);
      if (!successor || successor.status === 'done') continue;

      // Check ALL incoming edges for this successor
      const inEdges = dependencies.filter((d) => d.successor_id === successorId);
      let allSatisfied = true;

      for (const inEdge of inEdges) {
        const pred = allItems.get(inEdge.predecessor_id);
        if (!pred) continue;

        if (inEdge.type === 'full') {
          if (pred.progress < 100) { allSatisfied = false; break; }
        } else {
          // partial
          if (pred.progress < inEdge.threshold) { allSatisfied = false; break; }
        }
      }

      if (allSatisfied && successor.status === 'blocked') {
        itemsToUnblock.push(successorId);
      } else if (!allSatisfied && successor.status !== 'blocked') {
        itemsToBlock.push(successorId);
      }

      // Continue traversal downstream
      if (!visited.has(successorId)) {
        visited.add(successorId);
        queue.push(successorId);
      }
    }
  }

  return { itemsToUnblock, itemsToBlock };
}

// ────────────────────────────────────────────
// 3. EDGE CASE: Threshold = 0 validation
// ────────────────────────────────────────────
export function validateDependency(
  predecessorId: string,
  successorId: string,
  type: 'full' | 'partial',
  threshold: number
): string | null {
  if (predecessorId === successorId) {
    return 'A task cannot depend on itself.';
  }
  if (threshold <= 0) {
    return 'Threshold must be greater than 0. A threshold of 0 would mean the task is never truly dependent.';
  }
  if (threshold > 100) {
    return 'Threshold cannot exceed 100%.';
  }
  if (type === 'full' && threshold !== 100) {
    return 'Full dependencies must have a threshold of 100%.';
  }
  return null; // valid
}
