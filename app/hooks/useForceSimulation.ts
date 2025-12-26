import { useEffect, useRef, useState, useCallback } from "react";

export interface SimulationNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

export interface SimulationEdge {
  source: string;
  target: string;
  strength?: number;
}

export interface ForceSimulationConfig {
  /** 反発力の基準距離（デフォルト: 80-150、ノード数に応じて調整） */
  repulsionDistance?: number;
  /** 中心への引力係数（デフォルト: 0.01-0.04） */
  gravity?: number;
  /** 速度減衰係数（デフォルト: 0.9） */
  damping?: number;
  /** エッジのバネ強度（デフォルト: 0.3） */
  edgeStrength?: number;
  /** シミュレーション収束閾値（デフォルト: 0.005） */
  alphaMin?: number;
  /** alpha減衰率（デフォルト: 0.95） */
  alphaDecay?: number;
}

interface UseForceSimulationOptions<T extends SimulationNode> {
  /** 初期ノードリスト */
  nodes: T[];
  /** エッジリスト */
  edges: SimulationEdge[];
  /** 描画領域の幅 */
  width: number;
  /** 描画領域の高さ */
  height: number;
  /** シミュレーション設定 */
  config?: ForceSimulationConfig;
  /** ノードからSimulationNodeを生成する関数 */
  nodeToSimNode?: (
    node: T,
    index: number,
    total: number,
    width: number,
    height: number
  ) => SimulationNode;
}

interface UseForceSimulationResult<T extends SimulationNode> {
  /** 描画用ノード（React state） */
  renderNodes: T[];
  /** シミュレーションノードへの直接アクセス（ドラッグ等で使用） */
  simNodesRef: React.MutableRefObject<T[]>;
  /** alpha値への参照（シミュレーション再開時に使用） */
  alphaRef: React.MutableRefObject<number>;
  /** ノード位置を更新してReact stateに反映 */
  updateRenderNodes: () => void;
  /** シミュレーションを再開（alpha値をリセット） */
  restartSimulation: (alpha?: number) => void;
}

/**
 * フォースシミュレーション（物理演算）を管理するhook
 *
 * GraphExplorerGraphから抽出した物理シミュレーションロジックを汎用化。
 * ノード間の反発力、中心への引力、エッジのバネ力を計算し、
 * requestAnimationFrameで位置を更新する。
 */
export function useForceSimulation<T extends SimulationNode>({
  nodes,
  edges,
  width,
  height,
  config = {},
  nodeToSimNode,
}: UseForceSimulationOptions<T>): UseForceSimulationResult<T> {
  const { damping = 0.9, alphaMin = 0.005, alphaDecay = 0.95, edgeStrength = 0.3 } = config;

  const animationRef = useRef<number>(0);
  const simNodesRef = useRef<T[]>([]);
  const [renderNodes, setRenderNodes] = useState<T[]>([]);
  const edgesRef = useRef(edges);
  const alphaRef = useRef(1);
  const prevNodeCountRef = useRef(0);
  const sizeRef = useRef({ width, height });
  const prevSizeRef = useRef({ width, height });

  // エッジrefを同期
  edgesRef.current = edges;

  // デフォルトのノード→SimNode変換
  const defaultNodeToSimNode = useCallback(
    (node: T, index: number, total: number, w: number, h: number): SimulationNode => {
      const angle = (2 * Math.PI * index) / Math.max(total, 1);
      const radius = Math.min(w, h) / 3;
      return {
        id: node.id,
        x: w / 2 + radius * Math.cos(angle),
        y: h / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };
    },
    []
  );

  const toSimNode = nodeToSimNode || defaultNodeToSimNode;

  // ノードの初期化/更新
  useEffect(() => {
    const existingById = new Map(simNodesRef.current.map((n) => [n.id, n]));

    const newSimNodes = nodes.map((n, i) => {
      const existing = existingById.get(n.id);
      if (existing) {
        // 既存ノードは位置を保持、他のプロパティは更新
        return {
          ...existing,
          ...n,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          fx: existing.fx,
          fy: existing.fy,
        } as T;
      }
      // 新規ノード
      const simNode = toSimNode(n, i, nodes.length, width, height);
      return { ...n, ...simNode } as T;
    });

    simNodesRef.current = newSimNodes;

    // ノード数が変わった場合はシミュレーション再開
    const nodesChanged =
      nodes.length !== prevNodeCountRef.current || nodes.some((n) => !existingById.has(n.id));
    if (nodesChanged) {
      alphaRef.current = 1;
      prevNodeCountRef.current = nodes.length;
    }

    setRenderNodes(newSimNodes.map((n) => ({ ...n })));
  }, [nodes, width, height, toSimNode]);

  // サイズ変更時にノードを再配置
  useEffect(() => {
    const prevWidth = prevSizeRef.current.width;
    const prevHeight = prevSizeRef.current.height;
    const widthDiff = Math.abs(width - prevWidth);
    const heightDiff = Math.abs(height - prevHeight);

    if (widthDiff > 100 || heightDiff > 100) {
      const offsetX = (width - prevWidth) / 2;
      const offsetY = (height - prevHeight) / 2;

      for (const node of simNodesRef.current) {
        node.x += offsetX;
        node.y += offsetY;
        if (node.fx !== null) node.fx += offsetX;
        if (node.fy !== null) node.fy += offsetY;
      }

      setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
    }

    prevSizeRef.current = { width, height };
    sizeRef.current = { width, height };
  }, [width, height]);

  // 物理シミュレーション
  useEffect(() => {
    let running = true;

    function simulate() {
      if (!running) return;

      const simNodes = simNodesRef.current;
      const currentEdges = edgesRef.current;
      const { width: currentWidth, height: currentHeight } = sizeRef.current;
      const centerX = currentWidth / 2;
      const centerY = currentHeight / 2;

      if (simNodes.length === 0) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }

      const alpha = alphaRef.current;
      if (alpha < alphaMin) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }
      alphaRef.current *= alphaDecay;

      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const nodeCount = simNodes.length;

      // ノード数に応じてパラメータを調整
      const k = Math.max(80, Math.min(150, 300 / Math.sqrt(nodeCount + 1)));
      const gravity = 0.01 + Math.min(0.03, nodeCount * 0.0002);

      // 力の計算
      for (const node of simNodes) {
        if (node.fx !== null && node.fy !== null) continue;
        node.vx *= damping;
        node.vy *= damping;

        // 中心への引力（境界から離れすぎた場合のみ）
        const distFromCenter = Math.sqrt((node.x - centerX) ** 2 + (node.y - centerY) ** 2);
        const maxDist = Math.min(currentWidth, currentHeight) / 2;
        if (distFromCenter > maxDist * 0.6) {
          const gravityForce = gravity * ((distFromCenter - maxDist * 0.6) / maxDist);
          node.vx += (centerX - node.x) * gravityForce * 0.01;
          node.vy += (centerY - node.y) * gravityForce * 0.01;
        }
      }

      // ノード間の反発力
      for (let i = 0; i < simNodes.length; i++) {
        const nodeI = simNodes[i];
        if (!nodeI) continue;
        for (let j = i + 1; j < simNodes.length; j++) {
          const nodeJ = simNodes[j];
          if (!nodeJ) continue;
          const dx = nodeJ.x - nodeI.x;
          const dy = nodeJ.y - nodeI.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = ((k * k) / (dist * dist + 100)) * alpha * 1.5;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (nodeI.fx === null) {
            nodeI.vx -= fx;
            nodeI.vy -= fy;
          }
          if (nodeJ.fx === null) {
            nodeJ.vx += fx;
            nodeJ.vy += fy;
          }
        }
      }

      // エッジのバネ力
      for (const edge of currentEdges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const strength = edgeStrength + (edge.strength ?? 0);
        const force = (dist - k) * 0.05 * strength * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (source.fx === null) {
          source.vx += fx;
          source.vy += fy;
        }
        if (target.fx === null) {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // 位置更新
      for (const node of simNodes) {
        if (node.fx !== null) {
          node.x = node.fx;
        } else {
          node.x += node.vx;
        }
        if (node.fy !== null) {
          node.y = node.fy;
        } else {
          node.y += node.vy;
        }
      }

      setRenderNodes(simNodes.map((n) => ({ ...n })));
      animationRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, [damping, alphaMin, alphaDecay, edgeStrength]);

  const updateRenderNodes = useCallback(() => {
    setRenderNodes(simNodesRef.current.map((n) => ({ ...n })));
  }, []);

  const restartSimulation = useCallback((alpha = 1) => {
    alphaRef.current = alpha;
  }, []);

  return {
    renderNodes,
    simNodesRef,
    alphaRef,
    updateRenderNodes,
    restartSimulation,
  };
}
