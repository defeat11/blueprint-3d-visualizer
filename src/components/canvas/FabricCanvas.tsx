import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  UploadCloud,
  Crosshair,
  Pencil,
  MousePointer2,
  Eye,
} from "lucide-react";

export interface DrawnRect {
  x: number; // center, %
  y: number; // center, %
  width: number; // m
  length: number; // m
}

interface Room {
  id: string;
  x: number | null;
  y: number | null;
  width: number;
  length: number;
  direction: number;
  roomType: string;
  name: string;
}

interface FabricCanvasProps {
  image: string | null;
  imageOpacity: number;
  onImageOpacityChange: (value: number) => void;
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  onRemoveRoom?: (id: string) => void;
  onClearAll?: () => void;
  onDrawComplete?: (rect: DrawnRect) => void;
  onDuplicateRooms?: (ids: string[]) => void;
  onUploadClick: () => void;
  layoutShape: string;
  workspaceWidth: number;
  workspaceLength: number;
}

const MIN_DRAW_PX = 12;
const PADDING_RATIO = 0.88; // boundary uses 88% of available canvas

const clamp = (value: number, min: number, max: number) => {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.min(Math.max(value, low), high);
};

export const FabricCanvas: React.FC<FabricCanvasProps> = ({
  image,
  imageOpacity,
  onImageOpacityChange,
  rooms,
  activeRoomId,
  onSelectRoom,
  onSelectionChange,
  updateRoom,
  onRemoveRoom,
  onClearAll,
  onDrawComplete,
  onDuplicateRooms,
  onUploadClick,
  layoutShape,
  workspaceWidth,
  workspaceLength,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const rectsByRoomId = useRef<Map<string, fabric.Group>>(new Map());

  const onRemoveRoomRef = useRef(onRemoveRoom);
  const onSelectRoomRef = useRef(onSelectRoom);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const updateRoomRef = useRef(updateRoom);
  const onDrawCompleteRef = useRef(onDrawComplete);
  const onDuplicateRoomsRef = useRef(onDuplicateRooms);
  const layoutShapeRef = useRef(layoutShape);
  const workspaceWidthRef = useRef(workspaceWidth);
  const workspaceLengthRef = useRef(workspaceLength);
  const modeRef = useRef(mode);

  const drawStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    rect: fabric.Rect | null;
  }>({ active: false, startX: 0, startY: 0, rect: null });

  // Dynamic pixels-per-meter — recalculated whenever canvas size or workspace changes.
  const getPxPerMeter = (canvas: fabric.Canvas): number => {
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    const ww = Math.max(workspaceWidthRef.current, 1);
    const wl = Math.max(workspaceLengthRef.current, 1);
    return Math.max(2, Math.min((w * PADDING_RATIO) / ww, (h * PADDING_RATIO) / wl));
  };

  const getGridSizePx = (canvas: fabric.Canvas) => getPxPerMeter(canvas); // 1m grid

  const getBoundaryMetrics = (canvas: fabric.Canvas) => {
    const canvasWidth = canvas.width || 1;
    const canvasHeight = canvas.height || 1;
    const ppm = getPxPerMeter(canvas);
    const boundaryWidth = workspaceWidthRef.current * ppm;
    const boundaryHeight = workspaceLengthRef.current * ppm;
    const left = canvasWidth / 2 - boundaryWidth / 2;
    const top = canvasHeight / 2 - boundaryHeight / 2;
    return {
      left,
      top,
      right: left + boundaryWidth,
      bottom: top + boundaryHeight,
      width: boundaryWidth,
      height: boundaryHeight,
      centerX: canvasWidth / 2,
      centerY: canvasHeight / 2,
      pxPerMeter: ppm,
    };
  };

  const canvasPointToPercent = (canvas: fabric.Canvas, x: number, y: number) => {
    const m = getBoundaryMetrics(canvas);
    return {
      x: clamp(((x - m.left) / m.width) * 100, 0, 100),
      y: clamp(((y - m.top) / m.height) * 100, 0, 100),
    };
  };

  const percentToCanvasPoint = (canvas: fabric.Canvas, xPercent: number, yPercent: number) => {
    const m = getBoundaryMetrics(canvas);
    return {
      x: m.left + (clamp(xPercent, 0, 100) / 100) * m.width,
      y: m.top + (clamp(yPercent, 0, 100) / 100) * m.height,
    };
  };

  const drawGridLayer = (canvas: fabric.Canvas) => {
    canvas
      .getObjects()
      .filter((o) => o.get("isGridLine"))
      .forEach((o) => canvas.remove(o));

    const m = getBoundaryMetrics(canvas);
    const ppm = m.pxPerMeter;

    // Vertical grid lines (every meter inside boundary)
    for (let x = 0; x <= workspaceWidthRef.current; x++) {
      const isMajor = x % 5 === 0;
      const line = new fabric.Line([m.left + x * ppm, m.top, m.left + x * ppm, m.bottom], {
        stroke: isMajor ? "#cbd5e1" : "#e2e8f0",
        strokeWidth: isMajor ? 1.2 : 0.8,
        selectable: false,
        evented: false,
      });
      line.set("isGridLine", true);
      canvas.add(line);
      canvas.sendObjectToBack(line);
    }
    for (let y = 0; y <= workspaceLengthRef.current; y++) {
      const isMajor = y % 5 === 0;
      const line = new fabric.Line([m.left, m.top + y * ppm, m.right, m.top + y * ppm], {
        stroke: isMajor ? "#cbd5e1" : "#e2e8f0",
        strokeWidth: isMajor ? 1.2 : 0.8,
        selectable: false,
        evented: false,
      });
      line.set("isGridLine", true);
      canvas.add(line);
      canvas.sendObjectToBack(line);
    }
  };

  useEffect(() => {
    onRemoveRoomRef.current = onRemoveRoom;
    onSelectRoomRef.current = onSelectRoom;
    onSelectionChangeRef.current = onSelectionChange;
    updateRoomRef.current = updateRoom;
    onDrawCompleteRef.current = onDrawComplete;
    onDuplicateRoomsRef.current = onDuplicateRooms;
    layoutShapeRef.current = layoutShape;
    workspaceWidthRef.current = Math.max(workspaceWidth, 1);
    workspaceLengthRef.current = Math.max(workspaceLength, 1);
    modeRef.current = mode;
  }, [
    onRemoveRoom,
    onSelectRoom,
    onSelectionChange,
    updateRoom,
    onDrawComplete,
    onDuplicateRooms,
    layoutShape,
    workspaceWidth,
    workspaceLength,
    mode,
  ]);

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      selection: true,
      backgroundColor: "#f8fafc",
      preserveObjectStacking: true,
    });

    drawGridLayer(canvas);

    const m = getBoundaryMetrics(canvas);
    const boundaryRect = new fabric.Rect({
      id: "boundaryRect",
      width: m.width,
      height: m.height,
      left: m.centerX,
      top: m.centerY,
      originX: "center",
      originY: "center",
      fill: "rgba(255, 255, 255, 0.4)",
      stroke: "#94a3b8",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
    });
    canvas.add(boundaryRect);

    const boundaryTextW = new fabric.Text(`${workspaceWidth}m`, {
      id: "boundaryTextW",
      fontSize: 13,
      fill: "#475569",
      fontWeight: "bold",
      left: m.centerX,
      top: m.top - 18,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    const boundaryTextH = new fabric.Text(`${workspaceLength}m`, {
      id: "boundaryTextH",
      fontSize: 13,
      fill: "#475569",
      fontWeight: "bold",
      left: m.left - 18,
      top: m.centerY,
      originX: "center",
      originY: "center",
      angle: -90,
      selectable: false,
      evented: false,
    });
    canvas.add(boundaryTextW, boundaryTextH);

    canvas.on("object:moving", (options) => {
      const obj = options.target;
      if (!obj) return;
      const grid = getGridSizePx(canvas) / 2; // half-meter snap
      const left = Math.round(obj.left! / grid) * grid;
      const top = Math.round(obj.top! / grid) * grid;
      const metrics = getBoundaryMetrics(canvas);
      const halfWidth = ((obj.width || 0) * (obj.scaleX || 1)) / 2;
      const halfHeight = ((obj.height || 0) * (obj.scaleY || 1)) / 2;
      obj.set({
        left: clamp(left, metrics.left + halfWidth, metrics.right - halfWidth),
        top: clamp(top, metrics.top + halfHeight, metrics.bottom - halfHeight),
      });
    });

    canvas.on("object:modified", (options) => {
      const target = options.target;
      if (!target) return;
      const ppm = getPxPerMeter(canvas);

      const collect = (obj: fabric.Object) => {
        if (!obj || !obj.get("roomId")) return;
        const roomId = obj.get("roomId") as string;

        // Use absolute center (works for grouped + standalone)
        const center = obj.getCenterPoint();
        const point = canvasPointToPercent(canvas, center.x, center.y);
        const scaleX = obj.scaleX || 1;
        const scaleY = obj.scaleY || 1;
        const newWidth = Math.round((((obj.width || 0) * scaleX) / ppm) * 2) / 2;
        const newLength = Math.round((((obj.height || 0) * scaleY) / ppm) * 2) / 2;
        const newDirection = Math.round((obj.angle || 0) / 15) * 15;

        updateRoomRef.current(roomId, {
          x: point.x,
          y: point.y,
          width: Math.max(newWidth, 0.1),
          length: Math.max(newLength, 0.1),
          direction: newDirection,
        });
      };

      if (target.type === "activeselection" || target.type === "activeSelection") {
        (target as unknown as fabric.ActiveSelection).getObjects().forEach(collect);
      } else {
        collect(target);
      }
    });

    const emitSelection = () => {
      const ids = canvas
        .getActiveObjects()
        .map((o) => o.get("roomId") as string | undefined)
        .filter((v): v is string => Boolean(v));
      onSelectionChangeRef.current?.(ids);
      if (ids.length === 1) onSelectRoomRef.current(ids[0]);
      else if (ids.length === 0) onSelectRoomRef.current(null);
    };

    canvas.on("selection:created", emitSelection);
    canvas.on("selection:updated", emitSelection);
    canvas.on("selection:cleared", () => {
      onSelectionChangeRef.current?.([]);
      onSelectRoomRef.current(null);
    });

    setFabricCanvas(canvas);

    // Cache last seen size so we don't re-layout on no-op resize callbacks.
    let lastResizeW = canvas.width || 0;
    let lastResizeH = canvas.height || 0;
    let resizePending = false;

    const performResize = () => {
      resizePending = false;
      if (!containerRef.current) return;
      const w = Math.round(containerRef.current.clientWidth);
      const h = Math.round(containerRef.current.clientHeight);
      if (w === lastResizeW && h === lastResizeH) return;
      if (w <= 0 || h <= 0) return;
      lastResizeW = w;
      lastResizeH = h;

      canvas.setDimensions({ width: w, height: h });
      drawGridLayer(canvas);
      const metrics = getBoundaryMetrics(canvas);
      const boundary = canvas.getObjects().find((o) => o.get("id") === "boundaryRect");
      const textW = canvas.getObjects().find((o) => o.get("id") === "boundaryTextW") as fabric.Text;
      const textH = canvas.getObjects().find((o) => o.get("id") === "boundaryTextH") as fabric.Text;

      boundary?.set({
        width: metrics.width,
        height: metrics.height,
        left: metrics.centerX,
        top: metrics.centerY,
      });
      textW?.set({ left: metrics.centerX, top: metrics.top - 18 });
      textH?.set({ left: metrics.left - 18, top: metrics.centerY });
      canvas.requestRenderAll();
    };

    // Defer to next animation frame so the ResizeObserver callback returns
    // before we mutate layout — prevents the
    // "ResizeObserver loop completed with undelivered notifications" warning.
    const handleResize = () => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(performResize);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const ids = (canvas.getActiveObjects() || [])
        .map((o) => o.get("roomId") as string | undefined)
        .filter((v): v is string => Boolean(v));

      if ((e.key === "Delete" || e.key === "Backspace") && ids.length > 0) {
        e.preventDefault();
        ids.forEach((id) => onRemoveRoomRef.current?.(id));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        if (ids.length > 0 && onDuplicateRoomsRef.current) {
          e.preventDefault();
          onDuplicateRoomsRef.current(ids);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        if (ids.length > 0) (canvas as any).__clipboardRoomIds = ids;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        const stored = (canvas as any).__clipboardRoomIds as string[] | undefined;
        if (stored && stored.length > 0 && onDuplicateRoomsRef.current) {
          e.preventDefault();
          onDuplicateRoomsRef.current(stored);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const all = canvas.getObjects().filter((o) => o.get("roomId"));
        if (all.length === 0) return;
        canvas.discardActiveObject();
        const sel = new fabric.ActiveSelection(all, { canvas });
        canvas.setActiveObject(sel);
        canvas.requestRenderAll();
        const allIds = all
          .map((o) => o.get("roomId") as string | undefined)
          .filter((v): v is string => Boolean(v));
        onSelectionChangeRef.current?.(allIds);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
    };
  }, []);

  // Background image (with live opacity)
  useEffect(() => {
    if (!fabricCanvas) return;
    const stale = fabricCanvas.getObjects().find((o) => o.get("isBgImage"));

    if (!image) {
      if (stale) {
        fabricCanvas.remove(stale);
        fabricCanvas.requestRenderAll();
      }
      return;
    }

    fabric.Image.fromURL(image).then((img) => {
      if (!img) return;
      const m = getBoundaryMetrics(fabricCanvas);
      const scaleX = m.width / img.width!;
      const scaleY = m.height / img.height!;
      const scale = Math.min(scaleX, scaleY);

      img.set({
        originX: "center",
        originY: "center",
        left: m.centerX,
        top: m.centerY,
        scaleX: scale,
        scaleY: scale,
        opacity: imageOpacity,
        selectable: false,
        evented: false,
      });

      const old = fabricCanvas.getObjects().find((o) => o.get("isBgImage"));
      if (old) fabricCanvas.remove(old);

      img.set("isBgImage", true);
      fabricCanvas.insertAt(0, img);
      fabricCanvas.requestRenderAll();
    });
  }, [fabricCanvas, image]);

  useEffect(() => {
    if (!fabricCanvas) return;
    const bg = fabricCanvas.getObjects().find((o) => o.get("isBgImage"));
    if (bg) {
      bg.set("opacity", imageOpacity);
      fabricCanvas.requestRenderAll();
    }
  }, [fabricCanvas, imageOpacity]);

  // Boundary updates when workspace dims change
  useEffect(() => {
    if (!fabricCanvas) return;
    drawGridLayer(fabricCanvas);
    const m = getBoundaryMetrics(fabricCanvas);
    const boundary = fabricCanvas.getObjects().find((o) => o.get("id") === "boundaryRect");
    const textW = fabricCanvas.getObjects().find((o) => o.get("id") === "boundaryTextW") as fabric.Text;
    const textH = fabricCanvas.getObjects().find((o) => o.get("id") === "boundaryTextH") as fabric.Text;

    boundary?.set({ width: m.width, height: m.height, left: m.centerX, top: m.centerY });
    textW?.set({ text: `${workspaceWidth}m`, left: m.centerX, top: m.top - 18 });
    textH?.set({ text: `${workspaceLength}m`, left: m.left - 18, top: m.centerY });

    // Re-fit background image to new boundary
    const bg = fabricCanvas.getObjects().find((o) => o.get("isBgImage")) as fabric.Image | undefined;
    if (bg && bg.width && bg.height) {
      const sx = m.width / bg.width;
      const sy = m.height / bg.height;
      const s = Math.min(sx, sy);
      bg.set({ left: m.centerX, top: m.centerY, scaleX: s, scaleY: s });
    }

    fabricCanvas.requestRenderAll();
  }, [workspaceWidth, workspaceLength, fabricCanvas]);

  // Sync rooms → fabric groups
  useEffect(() => {
    if (!fabricCanvas) return;
    const m = getBoundaryMetrics(fabricCanvas);
    const ppm = m.pxPerMeter;

    const currentRoomIds = new Set(rooms.map((r) => r.id));
    const removed: fabric.Object[] = [];
    rectsByRoomId.current.forEach((obj, id) => {
      if (!currentRoomIds.has(id)) {
        removed.push(obj);
        rectsByRoomId.current.delete(id);
      }
    });
    removed.forEach((obj) => fabricCanvas.remove(obj));

    rooms.forEach((room, index) => {
      const widthPx = Math.max((room.width || 4) * ppm, 4);
      const heightPx = Math.max((room.length || 4) * ppm, 4);

      const point =
        room.x !== null && room.y !== null
          ? percentToCanvasPoint(fabricCanvas, room.x, room.y)
          : { x: m.centerX, y: m.centerY };

      const gridPx = getGridSizePx(fabricCanvas) / 2;
      let leftPx = Math.round(point.x / gridPx) * gridPx;
      let topPx = Math.round(point.y / gridPx) * gridPx;

      leftPx = clamp(leftPx, m.left + widthPx / 2, m.right - widthPx / 2);
      topPx = clamp(topPx, m.top + heightPx / 2, m.bottom - heightPx / 2);

      const isActive = activeRoomId === room.id;
      const strokeColor = isActive ? "#10b981" : "#475569";
      let fillColor = isActive ? "rgba(16, 185, 129, 0.22)" : "rgba(30, 41, 59, 0.65)";
      if (room.roomType.includes("Glass")) fillColor = "rgba(56, 189, 248, 0.32)";
      else if (room.roomType.includes("Solid")) fillColor = "#1e293b";

      const existingObj = rectsByRoomId.current.get(room.id);
      if (existingObj) fabricCanvas.remove(existingObj);

      const rect = new fabric.Rect({
        width: widthPx,
        height: heightPx,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: 2,
        rx: 4,
        ry: 4,
        originX: "center",
        originY: "center",
      });

      const indexLabel = new fabric.Text(String(index + 1), {
        fontSize: Math.max(12, Math.min(20, ppm * 0.45)),
        fill: isActive ? "#064e3b" : "#cbd5e1",
        fontWeight: "bold",
        originX: "center",
        originY: "center",
      });

      const dimText = new fabric.Text(`${room.width}m × ${room.length}m`, {
        fontSize: Math.max(8, Math.min(12, ppm * 0.28)),
        fill: isActive ? "#064e3b" : "#94a3b8",
        originX: "center",
        originY: "center",
        top: Math.min(heightPx / 2 - 8, 18),
      });

      let roomTypeText = "ZONE";
      if (room.roomType.includes("Meeting")) roomTypeText = "MEETING";
      else if (room.roomType.includes("Private")) roomTypeText = "OFFICE";
      else if (room.roomType.includes("Reception")) roomTypeText = "RECEPTION";
      else if (room.roomType.includes("Glass")) roomTypeText = "GLASS WALL";
      else if (room.roomType.includes("Solid")) roomTypeText = "SOLID WALL";
      else if (room.roomType.includes("Open")) roomTypeText = "OPEN WS";
      else if (room.roomType.includes("Coffee")) roomTypeText = "COFFEE";
      else if (room.roomType.includes("Storage")) roomTypeText = "STORAGE";
      else if (room.roomType.includes("Waiting")) roomTypeText = "WAITING";

      const typeLabel = new fabric.Text(roomTypeText, {
        fontSize: Math.max(7, Math.min(10, ppm * 0.22)),
        fill: strokeColor,
        fontWeight: "bold",
        originX: "center",
        originY: "center",
        top: -Math.min(heightPx / 2 - 8, 16),
      });

      const group = new fabric.Group([rect, indexLabel, dimText, typeLabel], {
        left: leftPx,
        top: topPx,
        originX: "center",
        originY: "center",
        hasControls: true,
        hasBorders: true,
        borderColor: "#10b981",
        cornerColor: "#10b981",
        cornerSize: 9,
        transparentCorners: false,
        angle: room.direction || 0,
        objectCaching: false,
      });
      group.set("roomId", room.id);

      fabricCanvas.add(group);
      rectsByRoomId.current.set(room.id, group);
    });

    // Restore active room as active object (only when single)
    if (activeRoomId) {
      const node = rectsByRoomId.current.get(activeRoomId);
      if (node && fabricCanvas.getActiveObjects().length <= 1) {
        fabricCanvas.setActiveObject(node);
      }
    }
    fabricCanvas.requestRenderAll();
  }, [rooms, activeRoomId, fabricCanvas]);

  // Mode-aware mouse handlers
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.off("mouse:down");
    fabricCanvas.off("mouse:move");
    fabricCanvas.off("mouse:up");
    fabricCanvas.off("mouse:dblclick");

    fabricCanvas.on("mouse:down", (options) => {
      if (modeRef.current !== "draw") return;
      if (options.target) return;

      const pointer = fabricCanvas.getViewportPoint(options.e);
      const m = getBoundaryMetrics(fabricCanvas);
      const sx = clamp(pointer.x, m.left, m.right);
      const sy = clamp(pointer.y, m.top, m.bottom);

      drawStateRef.current = { active: true, startX: sx, startY: sy, rect: null };
      fabricCanvas.selection = false;
      fabricCanvas.discardActiveObject();
    });

    fabricCanvas.on("mouse:move", (options) => {
      const ds = drawStateRef.current;
      if (!ds.active || modeRef.current !== "draw") return;

      const pointer = fabricCanvas.getViewportPoint(options.e);
      const m = getBoundaryMetrics(fabricCanvas);
      const cx = clamp(pointer.x, m.left, m.right);
      const cy = clamp(pointer.y, m.top, m.bottom);
      const left = Math.min(ds.startX, cx);
      const top = Math.min(ds.startY, cy);
      const width = Math.max(2, Math.abs(cx - ds.startX));
      const height = Math.max(2, Math.abs(cy - ds.startY));

      if (!ds.rect) {
        ds.rect = new fabric.Rect({
          left,
          top,
          width,
          height,
          fill: "rgba(16,185,129,0.18)",
          stroke: "#10b981",
          strokeWidth: 2,
          strokeDashArray: [6, 4],
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        ds.rect.set("isDraftRect", true);
        fabricCanvas.add(ds.rect);
      } else {
        ds.rect.set({ left, top, width, height });
      }
      fabricCanvas.requestRenderAll();
    });

    fabricCanvas.on("mouse:up", () => {
      const ds = drawStateRef.current;
      if (!ds.active) return;
      ds.active = false;
      fabricCanvas.selection = true;

      if (!ds.rect) return;
      const widthPx = ds.rect.width! * (ds.rect.scaleX || 1);
      const heightPx = ds.rect.height! * (ds.rect.scaleY || 1);
      const leftPx = ds.rect.left!;
      const topPx = ds.rect.top!;

      fabricCanvas.remove(ds.rect);
      ds.rect = null;
      fabricCanvas.requestRenderAll();

      if (widthPx < MIN_DRAW_PX || heightPx < MIN_DRAW_PX) return;

      const ppm = getPxPerMeter(fabricCanvas);
      const widthM = Math.max(0.5, Math.round((widthPx / ppm) * 2) / 2);
      const lengthM = Math.max(0.5, Math.round((heightPx / ppm) * 2) / 2);
      const cx = leftPx + widthPx / 2;
      const cy = topPx + heightPx / 2;
      const point = canvasPointToPercent(fabricCanvas, cx, cy);

      onDrawCompleteRef.current?.({ x: point.x, y: point.y, width: widthM, length: lengthM });
      setMode("select");
    });

    fabricCanvas.on("mouse:dblclick", (options) => {
      if (modeRef.current === "draw") return;
      if (options.target) return;
      const pointer = fabricCanvas.getViewportPoint(options.e);
      const point = canvasPointToPercent(fabricCanvas, pointer.x, pointer.y);
      onDrawCompleteRef.current?.({ x: point.x, y: point.y, width: 4, length: 4 });
    });
  }, [fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.defaultCursor = mode === "draw" ? "crosshair" : "default";
    fabricCanvas.hoverCursor = mode === "draw" ? "crosshair" : "move";
    fabricCanvas.selection = mode !== "draw";
    fabricCanvas.requestRenderAll();
  }, [mode, fabricCanvas]);

  return (
    <div
      className="flex-1 flex flex-col h-full relative group overflow-hidden bg-white border-2 border-slate-700/50 rounded-2xl shadow-inner pb-12 pt-4 px-4 min-h-[520px]"
      ref={containerRef}
    >
      <div className="absolute top-4 left-4 z-40 flex flex-col gap-2">
        <span className="px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-emerald-500/30 text-[10px] text-emerald-400 uppercase font-bold tracking-widest rounded-lg flex items-center gap-2 shadow-xl">
          <Crosshair className="w-3.5 h-3.5" /> FABRIC.JS EDITOR
        </span>
        <div className="flex gap-1 bg-slate-900/90 border border-slate-700 rounded-xl p-1 backdrop-blur shadow-xl">
          <button
            onClick={() => setMode("select")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              mode === "select" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800"
            }`}
            title="وضع التحديد"
          >
            <MousePointer2 className="w-3.5 h-3.5" /> تحديد
          </button>
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              mode === "draw" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800"
            }`}
            title="وضع الرسم — اسحب لإنشاء منطقة"
          >
            <Pencil className="w-3.5 h-3.5" /> رسم
          </button>
        </div>
        <span className="px-3 py-1 bg-white/85 border border-slate-200 text-[10px] text-slate-600 font-bold rounded-lg shadow-sm">
          {mode === "draw"
            ? "اسحب لرسم منطقة جديدة"
            : "Shift+Click لتحديد متعدد · Ctrl+C/V/D · Del للحذف"}
        </span>
        {image && (
          <div className="px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl shadow-xl backdrop-blur flex items-center gap-2 w-56">
            <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-bold shrink-0">شفافية</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(imageOpacity * 100)}
              onChange={(e) => onImageOpacityChange(Number(e.target.value) / 100)}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-[10px] text-emerald-400 font-mono w-8 text-right shrink-0">
              {Math.round(imageOpacity * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={onUploadClick}
          className="px-4 py-2 bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-300 rounded-xl flex items-center gap-2 shadow-xl hover:bg-slate-800 text-xs font-bold"
        >
          <UploadCloud className="w-4 h-4" />
          {image ? "تغيير المخطط" : "إرفاق مخطط صورة"}
        </button>
        <button
          onClick={() => {
            if (window.confirm("هل أنت متأكد من حذف مساحة العمل وكل العناصر؟")) {
              onClearAll?.();
            }
          }}
          className="px-4 py-2 bg-red-600/90 backdrop-blur border border-red-500 text-white rounded-xl flex items-center gap-2 shadow-xl hover:bg-red-500 text-xs font-bold"
        >
          حذف مساحة العمل
        </button>
        <button
          onClick={() => {
            if (!fabricCanvas) return;
            const exportOptions: any = { format: "png", quality: 1, multiplier: 2 };
            const originalVpt = fabricCanvas.viewportTransform
              ? ([...fabricCanvas.viewportTransform] as [number, number, number, number, number, number])
              : null;
            fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;
            fabricCanvas.getObjects().forEach((obj) => {
              if (
                obj.get("id") === "boundaryRect" ||
                obj.get("id") === "boundaryTextW" ||
                obj.get("id") === "boundaryTextH" ||
                obj.get("roomId")
              ) {
                const br = obj.getBoundingRect();
                minX = Math.min(minX, br.left);
                minY = Math.min(minY, br.top);
                maxX = Math.max(maxX, br.left + br.width);
                maxY = Math.max(maxY, br.top + br.height);
              }
            });
            if (minX !== Infinity) {
              const padding = 60;
              exportOptions.left = minX - padding;
              exportOptions.top = minY - padding;
              exportOptions.width = maxX - minX + padding * 2;
              exportOptions.height = maxY - minY + padding * 2;
            }
            const dataUrl = fabricCanvas.toDataURL(exportOptions);
            if (originalVpt) fabricCanvas.setViewportTransform(originalVpt);
            const link = document.createElement("a");
            link.download = "floor-plan.png";
            link.href = dataUrl;
            link.click();
          }}
          className="px-4 py-2 bg-emerald-600/90 backdrop-blur border border-emerald-500 text-white rounded-xl flex items-center gap-2 shadow-xl hover:bg-emerald-500 text-xs font-bold"
        >
          تصدير المخطط الفني
        </button>
      </div>

      <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-200">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
