import { useEffect, useRef, useState, useCallback } from "react";
import type { SimulationNode } from "./useForceSimulation.ts";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface UseGraphInteractionOptions<T extends SimulationNode> {
  /** SVG要素への参照 */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** シミュレーションノードへの参照 */
  simNodesRef: React.MutableRefObject<T[]>;
  /** alpha値への参照（シミュレーション再開用） */
  alphaRef: React.MutableRefObject<number>;
  /** ノード位置更新関数 */
  updateRenderNodes: () => void;
  /** ズームの最小値（デフォルト: 0.3） */
  minScale?: number;
  /** ズームの最大値（デフォルト: 3） */
  maxScale?: number;
  /** ピン留め/解除後のシミュレーション再開alpha（デフォルト: 0.3） */
  pinRestartAlpha?: number;
}

interface UseGraphInteractionResult {
  /** 現在のtransform（パン/ズーム） */
  transform: Transform;
  /** ドラッグ中かどうか */
  isDragging: boolean;
  /** パン中かどうか */
  isPanning: boolean;
  /** ドラッグ中のノードID */
  dragNodeId: string | null;
  /** ノードのマウスダウンハンドラ */
  handleNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  /** 背景のマウスダウンハンドラ */
  handleBackgroundMouseDown: (e: React.MouseEvent) => void;
  /** マウス移動ハンドラ */
  handleMouseMove: (e: React.MouseEvent) => void;
  /** マウスアップハンドラ */
  handleMouseUp: () => void;
  /** ダブルクリックハンドラ（ピン留め切り替え） */
  handleDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  /** SVGに設定するカーソルスタイル */
  cursorStyle: string;
}

/**
 * グラフのインタラクション（ドラッグ、パン、ズーム、ピン留め）を管理するhook
 *
 * GraphExplorerGraphから抽出したインタラクションロジックを汎用化。
 */
export function useGraphInteraction<T extends SimulationNode>({
  svgRef,
  simNodesRef,
  alphaRef,
  updateRenderNodes,
  minScale = 0.3,
  maxScale = 3,
  pinRestartAlpha = 0.3,
}: UseGraphInteractionOptions<T>): UseGraphInteractionResult {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // ノードのドラッグ開始
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragNodeId(nodeId);
  }, []);

  // 背景クリックでパン開始
  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [isDragging, transform]
  );

  // マウス移動（ドラッグ/パン）
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // ノードドラッグ
      if (isDragging && dragNodeId && svgRef.current) {
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.x) / transform.scale;
        const y = (e.clientY - rect.top - transform.y) / transform.scale;

        const node = simNodesRef.current.find((n) => n.id === dragNodeId);
        if (node) {
          node.x = x;
          node.y = y;
          node.fx = x;
          node.fy = y;
          updateRenderNodes();
        }
        return;
      }

      // 背景パン
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          x: panStartRef.current.tx + dx,
          y: panStartRef.current.ty + dy,
        }));
      }
    },
    [isDragging, dragNodeId, transform, isPanning, svgRef, simNodesRef, updateRenderNodes]
  );

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragNodeId(null);
    setIsPanning(false);
  }, []);

  // ダブルクリックでピン留め切り替え
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const node = simNodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        if (node.fx !== null && node.fy !== null) {
          // ピン解除
          node.fx = null;
          node.fy = null;
        } else {
          // ピン留め
          node.fx = node.x;
          node.fy = node.y;
        }
        updateRenderNodes();
        // シミュレーションを少し再開
        alphaRef.current = Math.max(alphaRef.current, pinRestartAlpha);
      }
    },
    [simNodesRef, updateRenderNodes, alphaRef, pinRestartAlpha]
  );

  // ホイールズーム
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;

      setTransform((prev) => {
        const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * scaleFactor));
        const actualFactor = newScale / prev.scale;
        // マウス位置を中心にズーム
        const newX = mouseX - (mouseX - prev.x) * actualFactor;
        const newY = mouseY - (mouseY - prev.y) * actualFactor;
        return { x: newX, y: newY, scale: newScale };
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [svgRef, minScale, maxScale]);

  const cursorStyle = isDragging ? "grabbing" : isPanning ? "grabbing" : "grab";

  return {
    transform,
    isDragging,
    isPanning,
    dragNodeId,
    handleNodeMouseDown,
    handleBackgroundMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    cursorStyle,
  };
}
