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
  /** ノードクリック/タップ時のコールバック */
  onNodeClick?: (nodeId: string) => void;
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
  /** ノードのタッチ開始ハンドラ */
  handleNodeTouchStart: (e: React.TouchEvent, nodeId: string) => void;
  /** 背景のタッチ開始ハンドラ */
  handleBackgroundTouchStart: (e: React.TouchEvent) => void;
  /** タッチ移動ハンドラ */
  handleTouchMove: (e: React.TouchEvent) => void;
  /** タッチ終了ハンドラ */
  handleTouchEnd: (e: React.TouchEvent) => void;
  /** ノードのタッチ終了ハンドラ（タップ選択込み） */
  handleNodeTouchEnd: (e: React.TouchEvent, nodeId: string) => void;
  /** ノードのクリックハンドラ */
  handleNodeClick: (e: React.MouseEvent, nodeId: string) => void;
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
  onNodeClick,
}: UseGraphInteractionOptions<T>): UseGraphInteractionResult {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // タッチ操作用の状態
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartRef = useRef({ distance: 0, scale: 1, centerX: 0, centerY: 0 });
  const lastTapRef = useRef<{ time: number; nodeId: string | null }>({ time: 0, nodeId: null });
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

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

  // ピン留め切り替えの共通ロジック
  const togglePin = useCallback(
    (nodeId: string) => {
      const node = simNodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        if (node.fx !== null && node.fy !== null) {
          node.fx = null;
          node.fy = null;
        } else {
          node.fx = node.x;
          node.fy = node.y;
        }
        updateRenderNodes();
        alphaRef.current = Math.max(alphaRef.current, pinRestartAlpha);
      }
    },
    [simNodesRef, updateRenderNodes, alphaRef, pinRestartAlpha]
  );

  // 2点間の距離を計算
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const t1 = touches[0];
    const t2 = touches[1];
    if (!t1 || !t2) return 0;
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 2点の中心を計算
  const getTouchCenter = (
    touches: React.TouchList
  ): { x: number; y: number } => {
    if (touches.length < 2) {
      const t = touches[0];
      return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 };
    }
    const t1 = touches[0];
    const t2 = touches[1];
    if (!t1 || !t2) return { x: 0, y: 0 };
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  // ノードのタッチ開始
  const handleNodeTouchStart = useCallback(
    (e: React.TouchEvent, nodeId: string) => {
      e.stopPropagation();

      // ダブルタップ検出（ピン留め切り替え）
      const now = Date.now();
      if (
        lastTapRef.current.nodeId === nodeId &&
        now - lastTapRef.current.time < 300
      ) {
        togglePin(nodeId);
        lastTapRef.current = { time: 0, nodeId: null };
        return;
      }
      lastTapRef.current = { time: now, nodeId };

      // 1本指の場合はドラッグ開始
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch) {
          touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        }
        setIsDragging(true);
        setDragNodeId(nodeId);
      }
    },
    [togglePin]
  );

  // 背景のタッチ開始
  const handleBackgroundTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging) return;

      // 2本指の場合はピンチズーム開始
      if (e.touches.length >= 2) {
        setIsPinching(true);
        setIsPanning(false);
        const distance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        const svg = svgRef.current;
        const rect = svg?.getBoundingClientRect();
        pinchStartRef.current = {
          distance,
          scale: transform.scale,
          centerX: rect ? center.x - rect.left : center.x,
          centerY: rect ? center.y - rect.top : center.y,
        };
        return;
      }

      // 1本指の場合はパン開始
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch) {
          setIsPanning(true);
          panStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            tx: transform.x,
            ty: transform.y,
          };
        }
      }
    },
    [isDragging, transform, svgRef]
  );

  // タッチ移動
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // ピンチズーム中
      if (isPinching && e.touches.length >= 2) {
        e.preventDefault();
        const distance = getTouchDistance(e.touches);
        const scaleFactor = distance / pinchStartRef.current.distance;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, pinchStartRef.current.scale * scaleFactor)
        );
        const actualFactor = newScale / transform.scale;
        const { centerX, centerY } = pinchStartRef.current;
        const newX = centerX - (centerX - transform.x) * actualFactor;
        const newY = centerY - (centerY - transform.y) * actualFactor;
        setTransform({ x: newX, y: newY, scale: newScale });
        return;
      }

      // ノードドラッグ
      if (isDragging && dragNodeId && svgRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        const x = (touch.clientX - rect.left - transform.x) / transform.scale;
        const y = (touch.clientY - rect.top - transform.y) / transform.scale;

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
      if (isPanning && e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - panStartRef.current.x;
        const dy = touch.clientY - panStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          x: panStartRef.current.tx + dx,
          y: panStartRef.current.ty + dy,
        }));
      }
    },
    [
      isPinching,
      isDragging,
      dragNodeId,
      isPanning,
      transform,
      svgRef,
      simNodesRef,
      updateRenderNodes,
      minScale,
      maxScale,
    ]
  );

  // タッチ終了
  const handleTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      setIsDragging(false);
      setDragNodeId(null);
      setIsPanning(false);
      setIsPinching(false);
      touchStartPosRef.current = null;
    },
    []
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

  // ノードクリック（ドラッグでなければコールバック呼び出し）
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (!isDragging && onNodeClick) {
        onNodeClick(nodeId);
      }
    },
    [isDragging, onNodeClick]
  );

  // ノードのタッチ終了（タップ選択込み）
  const handleNodeTouchEnd = useCallback(
    (e: React.TouchEvent, nodeId: string) => {
      // タップ検出：移動が少なければクリックとして扱う
      if (touchStartPosRef.current && onNodeClick) {
        const touch = e.changedTouches[0];
        if (touch) {
          const dx = touch.clientX - touchStartPosRef.current.x;
          const dy = touch.clientY - touchStartPosRef.current.y;
          const moved = Math.sqrt(dx * dx + dy * dy);
          if (moved < 10) {
            onNodeClick(nodeId);
          }
        }
      }
      // 通常のタッチ終了処理
      setIsDragging(false);
      setDragNodeId(null);
      setIsPanning(false);
      setIsPinching(false);
      touchStartPosRef.current = null;
    },
    [onNodeClick]
  );

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
    handleNodeTouchStart,
    handleBackgroundTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleNodeTouchEnd,
    handleNodeClick,
  };
}
