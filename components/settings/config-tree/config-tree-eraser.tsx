'use client';

/**
 * Eraser mode inspired by https://reactflow.dev/examples/whiteboard/eraser
 * Overlay is limited to `.react-flow__pane` so toolbar Panels stay clickable.
 */

import { useEffect, useRef } from 'react';
import {
  useReactFlow,
  useStore,
  type ReactFlowState,
} from '@xyflow/react';

type Point = { x: number; y: number };

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRect(
  p: Point,
  rect: { x: number; y: number; width: number; height: number },
  pad = 12
) {
  return (
    p.x >= rect.x - pad &&
    p.x <= rect.x + rect.width + pad &&
    p.y >= rect.y - pad &&
    p.y <= rect.y + rect.height + pad
  );
}

const domSelector = (s: ReactFlowState) => s.domNode;

export function ConfigTreeEraser({
  onEraseNodes,
  onEraseEdges,
}: {
  onEraseNodes: (ids: string[]) => void;
  onEraseEdges: (ids: string[]) => void;
}) {
  const rf = useReactFlow();
  const rfRef = useRef(rf);
  rfRef.current = rf;

  const domNode = useStore(domSelector);

  const drawing = useRef(false);
  const trail = useRef<Point[]>([]);
  const markedNodes = useRef(new Set<string>());
  const markedEdges = useRef(new Set<string>());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorLocal = useRef<Point | null>(null);

  const onEraseNodesRef = useRef(onEraseNodes);
  const onEraseEdgesRef = useRef(onEraseEdges);
  onEraseNodesRef.current = onEraseNodes;
  onEraseEdgesRef.current = onEraseEdges;

  useEffect(() => {
    if (!domNode) return;

    const pane =
      (domNode.querySelector('.react-flow__pane') as HTMLElement | null) ??
      domNode;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-config-tree-eraser', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;z-index:4;pointer-events:auto;cursor:none;touch-action:none;';
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    const redrawTrail = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      if (cursorLocal.current) {
        const c = cursorLocal.current;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const points = trail.current;
      if (points.length < 2) return;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    };

    const syncHighlight = () => {
      const api = rfRef.current;
      api.setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            toBeDeleted: markedNodes.current.has(n.id),
          },
        }))
      );
      api.setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          data: {
            ...e.data,
            toBeDeleted: markedEdges.current.has(e.id),
          },
        }))
      );
    };

    const markIntersections = (flowPoint: Point) => {
      const api = rfRef.current;
      for (const node of api.getNodes()) {
        const internal = api.getInternalNode(node.id);
        const w =
          internal?.measured.width ??
          (typeof node.style?.width === 'number' ? node.style.width : 280);
        const h =
          internal?.measured.height ??
          (typeof node.style?.height === 'number' ? node.style.height : 110);
        const x = internal?.internals.positionAbsolute.x ?? node.position.x;
        const y = internal?.internals.positionAbsolute.y ?? node.position.y;
        if (pointInRect(flowPoint, { x, y, width: w, height: h })) {
          markedNodes.current.add(node.id);
        }
      }

      const nodeMap = new Map(api.getNodes().map((n) => [n.id, n]));
      for (const edge of api.getEdges()) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const si = api.getInternalNode(s.id);
        const ti = api.getInternalNode(t.id);
        const sw = si?.measured.width ?? 280;
        const sh = si?.measured.height ?? 110;
        const tw = ti?.measured.width ?? 280;
        const th = ti?.measured.height ?? 110;
        const sx = si?.internals.positionAbsolute.x ?? s.position.x;
        const sy = si?.internals.positionAbsolute.y ?? s.position.y;
        const tx = ti?.internals.positionAbsolute.x ?? t.position.x;
        const ty = ti?.internals.positionAbsolute.y ?? t.position.y;
        const a = { x: sx + sw / 2, y: sy + sh / 2 };
        const b = { x: tx + tw / 2, y: ty + th / 2 };
        for (let i = 0; i <= 16; i++) {
          const p = {
            x: a.x + ((b.x - a.x) * i) / 16,
            y: a.y + ((b.y - a.y) * i) / 16,
          };
          if (dist(p, flowPoint) < 40) {
            markedEdges.current.add(edge.id);
            break;
          }
        }
      }

      syncHighlight();
    };

    const resize = () => {
      const { width, height } = pane.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redrawTrail();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(pane);

    const localFromEvent = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      drawing.current = true;
      trail.current = [];
      markedNodes.current.clear();
      markedEdges.current.clear();
      const local = localFromEvent(event);
      cursorLocal.current = local;
      trail.current.push(local);
      markIntersections(
        rfRef.current.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      );
      redrawTrail();
      canvas.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      const local = localFromEvent(event);
      cursorLocal.current = local;
      if (drawing.current) {
        const last = trail.current[trail.current.length - 1];
        if (!last || dist(last, local) > 2) {
          trail.current.push(local);
          markIntersections(
            rfRef.current.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            })
          );
        }
      }
      redrawTrail();
    };

    const onUp = (event: PointerEvent) => {
      if (!drawing.current) return;
      drawing.current = false;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      markIntersections(
        rfRef.current.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      );
      const nodeIds = [...markedNodes.current];
      const edgeIds = [...markedEdges.current];
      trail.current = [];
      cursorLocal.current = localFromEvent(event);
      redrawTrail();
      markedNodes.current.clear();
      markedEdges.current.clear();
      rfRef.current.setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, toBeDeleted: false },
        }))
      );
      rfRef.current.setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          data: { ...e.data, toBeDeleted: false },
        }))
      );
      if (nodeIds.length) onEraseNodesRef.current(nodeIds);
      else if (edgeIds.length) onEraseEdgesRef.current(edgeIds);
    };

    const onLeave = () => {
      if (drawing.current) return;
      cursorLocal.current = null;
      redrawTrail();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.remove();
      canvasRef.current = null;
      markedNodes.current.clear();
      markedEdges.current.clear();
    };
    // Mount once per flow DOM node — do not depend on rf/callbacks.
  }, [domNode]);

  return null;
}
