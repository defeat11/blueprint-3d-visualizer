import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus, Wand2, Copy, Check, Undo2,
  Settings, Download, Save, Code, Zap, Palette, Layout, Layers, Monitor
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import toast, { Toaster } from 'react-hot-toast';
import { useProjectStore } from './hooks/useZones';
import { FabricCanvas, type DrawnRect } from './components/canvas/FabricCanvas';
import { ZoneCard } from './components/zones/ZoneCard';
import { ZoneSetupModal, type ZonePreset } from './components/zones/ZoneSetupModal';
import { BulkEditBar } from './components/zones/BulkEditBar';
import { generate3DPrompt, compilePromptInstruction } from './services/geminiService';
import { encodeProject, decodeProject } from './utils/projectCodec';
import { buildNanoBananaScript } from './utils/pythonTemplate';
import {
  ROOM_TYPES, PARTITION_TYPES, FURNITURE_STYLES,
  ENGINES, GLOBAL_STYLES, LIGHTING_MODES, CAMERA_ANGLES,
  LAYOUT_SHAPES, RESOLUTIONS, getResolutionClause,
  type ResolutionId,
} from './utils/constants';

const extractFirstCodeBlock = (text: string) => {
  const match = text.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
  return match && match[1] ? match[1].trim() : text.trim();
};

const getPythonCode = (result: string) => {
  const promptText = extractFirstCodeBlock(result) || 'Prompt parsing failed, please paste here.';
  return buildNanoBananaScript(promptText);
};

const newRoomId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_PRESET: ZonePreset = {
  roomType: ROOM_TYPES[5],            // Open Workspace
  partitionType: PARTITION_TYPES[3],  // Open Space
  furnitureStyle: FURNITURE_STYLES[0],
};

interface DraftRect extends DrawnRect {}

export default function App() {
  const { rooms, addRoom, removeRoom, updateRoom, undo, setRooms } = useProjectStore();

  const [globalStyle, setGlobalStyle] = useState(GLOBAL_STYLES[0]);
  const [lighting, setLighting] = useState(LIGHTING_MODES[0]);
  const [camera, setCamera] = useState(CAMERA_ANGLES[0]);
  const [layoutShape, setLayoutShape] = useState(LAYOUT_SHAPES[0]);
  const [workspaceWidth, setWorkspaceWidth] = useState(20);
  const [workspaceLength, setWorkspaceLength] = useState(15);
  const [engine, setEngine] = useState(ENGINES[0].id);
  const [resolution, setResolution] = useState<ResolutionId>('4k');

  const [image, setImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.35);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');

  const [lastPreset, setLastPreset] = useState<ZonePreset>(DEFAULT_PRESET);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const resolutionClause = useMemo(() => getResolutionClause(resolution), [resolution]);

  // Initialize with one room if empty
  useEffect(() => {
    if (rooms.length === 0 && !initialized.current) {
      initialized.current = true;
      const initId = newRoomId();
      addRoom({
        id: initId,
        name: 'مساحة العمل',
        description: '',
        x: null,
        y: null,
        width: 4,
        length: 4,
        roomType: ROOM_TYPES[3],
        partitionType: PARTITION_TYPES[3],
        furnitureStyle: FURNITURE_STYLES[0],
        features: [],
        direction: 0,
      });
      setActiveRoomId(initId);
    }
  }, [rooms.length, addRoom]);

  const handleAddRoom = () => {
    const id = newRoomId();
    addRoom({
      id,
      name: `منطقة ${rooms.length + 1}`,
      description: '',
      x: null,
      y: null,
      width: 4,
      length: 4,
      roomType: lastPreset.roomType,
      partitionType: lastPreset.partitionType,
      furnitureStyle: lastPreset.furnitureStyle,
      features: [],
      direction: 0,
    });
    setActiveRoomId(id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrawComplete = (rect: DrawnRect) => {
    setDraftRect(rect);
  };

  const confirmZoneFromDraft = (cfg: ZonePreset & { name: string }) => {
    if (!draftRect) return;
    const id = newRoomId();
    addRoom({
      id,
      name: cfg.name || `منطقة ${rooms.length + 1}`,
      description: '',
      x: draftRect.x,
      y: draftRect.y,
      width: draftRect.width,
      length: draftRect.length,
      roomType: cfg.roomType,
      partitionType: cfg.partitionType,
      furnitureStyle: cfg.furnitureStyle,
      features: [],
      direction: 0,
      wallAttachment: cfg.wallAttachment ?? 'free',
      tableShape: cfg.tableShape,
    });
    setActiveRoomId(id);
    setLastPreset({
      roomType: cfg.roomType,
      partitionType: cfg.partitionType,
      furnitureStyle: cfg.furnitureStyle,
      wallAttachment: cfg.wallAttachment ?? 'free',
      tableShape: cfg.tableShape,
    });
    setDraftRect(null);
    toast.success('تمت إضافة المنطقة');
  };

  const handleDuplicateRooms = (ids: string[]) => {
    if (ids.length === 0) return;
    let lastId = activeRoomId;
    rooms
      .filter((r) => ids.includes(r.id))
      .forEach((src) => {
        const id = newRoomId();
        const newX = src.x !== null ? Math.min(95, src.x + 6) : 50;
        const newY = src.y !== null ? Math.min(95, src.y + 6) : 50;
        addRoom({
          ...src,
          id,
          name: `${src.name} ↺`,
          x: newX,
          y: newY,
        });
        lastId = id;
      });
    setActiveRoomId(lastId);
    toast.success(`تم تكرار ${ids.length} منطقة`);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    try {
      const prompt = await generate3DPrompt(
        globalStyle,
        lighting,
        camera,
        layoutShape,
        workspaceWidth,
        workspaceLength,
        engine,
        rooms,
        undefined,
        resolutionClause,
      );
      setResult(prompt);
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء توليد البرومبت.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(extractFirstCodeBlock(result));
      setIsCopied(true);
      toast.success('تم نسخ البرومبت');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('تعذّر النسخ. تحقق من صلاحيات الحافظة.');
    }
  };

  const projectPayload = useMemo(
    () => ({
      version: 2,
      rooms,
      globalStyle,
      lighting,
      camera,
      engine,
      resolution,
      layoutShape,
      workspaceWidth,
      workspaceLength,
      imageOpacity,
    }),
    [rooms, globalStyle, lighting, camera, engine, resolution, layoutShape, workspaceWidth, workspaceLength, imageOpacity],
  );

  const handleExport = async () => {
    const code = encodeProject(projectPayload);
    try {
      await navigator.clipboard.writeText(code);
      toast.success('تم نسخ كود المشروع كاملاً! ألصقه لاحقاً في خانة الاسترجاع.');
    } catch {
      toast.error('تعذّر النسخ. تحقق من صلاحيات الحافظة.');
    }
  };

  const handleImport = () => {
    const data = decodeProject(importCode);
    if (!data) {
      toast.error('كود المشروع غير صالح.');
      return;
    }
    if (Array.isArray(data.rooms)) setRooms(data.rooms);
    if (typeof data.globalStyle === 'string') setGlobalStyle(data.globalStyle);
    if (typeof data.lighting === 'string') setLighting(data.lighting);
    if (typeof data.camera === 'string') setCamera(data.camera);
    if (typeof data.engine === 'string') setEngine(data.engine);
    if (typeof data.resolution === 'string') setResolution(data.resolution);
    if (typeof data.layoutShape === 'string') setLayoutShape(data.layoutShape);
    if (typeof data.workspaceWidth === 'number' && data.workspaceWidth > 0) {
      setWorkspaceWidth(data.workspaceWidth);
    }
    if (typeof data.workspaceLength === 'number' && data.workspaceLength > 0) {
      setWorkspaceLength(data.workspaceLength);
    }
    if (typeof data.imageOpacity === 'number') {
      setImageOpacity(Math.max(0, Math.min(1, data.imageOpacity)));
    }
    setShowImport(false);
    setImportCode('');
    toast.success('تم استرجاع المشروع كاملاً');
  };

  // Bulk operations
  const applyBulkPatch = (patch: Partial<{ roomType: string; partitionType: string; furnitureStyle: string }>) => {
    const ids = selectedIds.length > 0 ? selectedIds : (activeRoomId ? [activeRoomId] : []);
    if (ids.length === 0 || Object.keys(patch).length === 0) return;
    ids.forEach((id) => updateRoom(id, patch));
    toast.success(`تم تحديث ${ids.length} منطقة`);
  };

  const bulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`حذف ${selectedIds.length} منطقة محددة؟`)) return;
    selectedIds.forEach((id) => removeRoom(id));
    setSelectedIds([]);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#050508] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col p-4 md:p-6 lg:p-8 gap-6">

      {/* Header / Top Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 p-4 rounded-[2rem] shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <Zap className="w-6 h-6 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Arch3D Genie <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">PRO v2.0</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Deterministic Precision Prompt Builder</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all shadow-sm" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-800 mx-1"></div>
          <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all text-xs font-bold shadow-sm">
            <Code className="w-4 h-4 text-blue-400" /> استرجاع مشروع
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all text-xs font-bold shadow-sm">
            <Save className="w-4 h-4 text-emerald-400" /> حفظ الكود
          </button>
        </div>
      </header>

      {/* Import Modal */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-lg shadow-3xl">
              <h2 className="text-xl font-bold mb-4">استرجاع المشروع</h2>
              <textarea value={importCode} onChange={(e) => setImportCode(e.target.value)} placeholder="لصق الكود هنا..." className="w-full h-40 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono mb-4 outline-none focus:border-emerald-500" />
              <div className="flex gap-3">
                <button onClick={handleImport} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-2xl transition-all">تأكيد الاسترجاع</button>
                <button onClick={() => setShowImport(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl transition-all">إلغاء</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone Setup Modal — opens when user finishes drawing a rectangle */}
      <ZoneSetupModal
        open={!!draftRect}
        preset={lastPreset}
        defaultName={`منطقة ${rooms.length + 1}`}
        widthM={draftRect?.width ?? 0}
        lengthM={draftRect?.length ?? 0}
        onConfirm={confirmZoneFromDraft}
        onCancel={() => setDraftRect(null)}
      />

      {/* Main Bento Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[640px]">

        {/* Left: Zone Management */}
        <section className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-6 flex flex-col gap-4 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Layout className="w-4 h-4" /> المناطق والمساحات
              </h2>
              <button onClick={handleAddRoom} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all" title="إضافة منطقة (آخر إعدادات)">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {selectedIds.length > 1 && (
              <BulkEditBar
                count={selectedIds.length}
                onApply={applyBulkPatch}
                onDuplicate={() => handleDuplicateRooms(selectedIds)}
                onDelete={bulkDelete}
                onClear={() => setSelectedIds([])}
              />
            )}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {rooms.map((room, index) => (
                <div key={room.id} className="animate-in fade-in slide-in-from-left-4 duration-300">
                  <ZoneCard
                    room={room}
                    index={index}
                    isActive={activeRoomId === room.id || selectedIds.includes(room.id)}
                    onSelect={() => setActiveRoomId(room.id)}
                    onRemove={() => removeRoom(room.id)}
                    onChange={(id, field, value) => updateRoom(id, { [field]: value })}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Center: Canvas */}
        <section className="lg:col-span-6 flex flex-col gap-4 min-h-0">
          <FabricCanvas
            image={image}
            imageOpacity={imageOpacity}
            onImageOpacityChange={setImageOpacity}
            rooms={rooms}
            activeRoomId={activeRoomId}
            updateRoom={(id, updates) => updateRoom(id, updates)}
            onRemoveRoom={(id) => removeRoom(id)}
            onClearAll={() => {
              setRooms([]);
              setImage(null);
              setSelectedIds([]);
            }}
            onSelectRoom={setActiveRoomId}
            onSelectionChange={setSelectedIds}
            onDrawComplete={handleDrawComplete}
            onDuplicateRooms={handleDuplicateRooms}
            layoutShape={layoutShape}
            workspaceWidth={workspaceWidth}
            workspaceLength={workspaceLength}
            onUploadClick={() => fileInputRef.current?.click()}
          />
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} accept="image/*" />
        </section>

        {/* Right: Engine + Settings */}
        <section className="lg:col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-1">

          {/* Engine */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-6 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> محرك التصوير (Engine)
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {ENGINES.map((eng) => (
                <button key={eng.id} onClick={() => setEngine(eng.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${engine === eng.id ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900'}`}>
                  <span className="text-xs font-bold">{eng.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-6 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Monitor className="w-4 h-4" /> دقة الإخراج (Resolution)
            </h2>
            <div className="grid grid-cols-4 gap-1.5">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                    resolution === r.id
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                  title={r.detail}
                >
                  <span>{r.label}</span>
                  <span className="text-[8px] text-slate-500 font-mono">{r.detail}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style + Lighting + Camera + Workspace */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-6 shadow-xl flex-1 space-y-6">
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest flex items-center gap-2">
                <Palette className="w-3 h-3" /> الطراز المعماري
              </label>
              <select value={globalStyle} onChange={(e) => setGlobalStyle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all">
                {GLOBAL_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3" /> نظام الإضاءة
              </label>
              <select value={lighting} onChange={(e) => setLighting(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all">
                {LIGHTING_MODES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest flex items-center gap-2">
                <Settings className="w-3 h-3" /> زاوية الكاميرا
              </label>
              <select value={camera} onChange={(e) => setCamera(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all mb-4">
                {CAMERA_ANGLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest flex items-center gap-2">
                <Layout className="w-3 h-3" /> شكل بيئة العمل
              </label>
              <select value={layoutShape} onChange={(e) => setLayoutShape(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all">
                {LAYOUT_SHAPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">عرض المساحة (م)</label>
                <input
                  type="number"
                  min={3}
                  max={500}
                  step={0.5}
                  value={workspaceWidth}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v) && v >= 3) setWorkspaceWidth(Math.round(v * 10) / 10);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">طول المساحة (م)</label>
                <input
                  type="number"
                  min={3}
                  max={500}
                  step={0.5}
                  value={workspaceLength}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v) && v >= 3) setWorkspaceLength(Math.round(v * 10) / 10);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-3 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 -mt-2 px-1">
              <span>المساحة الإجمالية: <span className="text-emerald-400 font-mono">{(workspaceWidth * workspaceLength).toFixed(1)}م²</span></span>
              <span className="font-mono text-slate-600">دقة: 0.5م</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={isGenerating || rooms.length === 0}
              className={`w-full py-5 rounded-[2rem] font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-2xl transition-all ${isGenerating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_10px_40px_rgba(16,185,129,0.3)]'}`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-4 border-slate-500 border-t-emerald-500 rounded-full animate-spin"></div>
                  جاري التحليل الهندسي...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 fill-slate-950" />
                  توليد الـ PROMPT الاحترافي
                </>
              )}
            </motion.button>
          </div>
        </section>
      </main>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.section id="results-section" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-slate-900/60 backdrop-blur-2xl border border-emerald-500/20 rounded-[3rem] p-8 md:p-12 shadow-3xl">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">النتيجة النهائية (Masterpiece Output)</h2>
                <p className="text-slate-400 text-sm">تم بناء البرومبت النهائي مباشرة من الإحداثيات والأبعاد بدون إعادة صياغة من Gemini.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={copyToClipboard} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${isCopied ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                  {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {isCopied ? 'تم النسخ!' : 'نسخ الـ Prompt'}
                </button>
                <button className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 inline-block">Professional Prompt</label>
                <div className="bg-slate-950/80 border border-slate-800 rounded-[2rem] p-6 md:p-8 font-mono text-sm leading-relaxed text-slate-300 shadow-inner group relative">
                  <div className="prose prose-invert max-w-none prose-sm">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900/40 p-6 md:p-8 rounded-[2rem] border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                  <Zap className="w-5 h-5 text-emerald-400" /> تدقيق البرومبت الهندسي
                </h3>
                <p className="text-sm text-slate-400 leading-loose">
                  يعتمد هذا الـ Prompt على مركز كل منطقة بالمتر داخل حدود مساحة العمل. زر النسخ ينسخ قسم MASTER PROMPT فقط، أما التحليل وملف JSON فهما للمراجعة الهندسية قبل استخدامه في AI Studio.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800/50 space-y-8">
              <div>
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-400" /> كود توليد Nano Banana (Python)
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(getPythonCode(result));
                        toast.success('تم نسخ الكود البرمجي');
                      } catch {
                        toast.error('تعذّر النسخ. تحقق من صلاحيات الحافظة.');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-all"
                  >
                    <Copy className="w-4 h-4" /> نسخ الكود
                  </button>
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-x-auto">
                  <pre className="text-[10px] sm:text-xs font-mono text-emerald-400/90 whitespace-pre-wrap text-left" dir="ltr">
                    {getPythonCode(result)}
                  </pre>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Live preview & project code */}
      <div className="mt-8 pt-8 space-y-8 max-w-full">
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 mb-8 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" /> المعاينة المباشرة للبرومبت النهائي
            </div>
          </h3>
          <p className="text-xs text-slate-500 mb-4">يتحدث لحظياً من الرسم والإعدادات بدون استدعاء Gemini.</p>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-x-auto max-w-full max-h-[400px] overflow-y-auto">
            <pre className="text-[10px] sm:text-[11px] font-mono text-emerald-400/90 whitespace-pre-wrap text-left break-words" dir="ltr">
              {compilePromptInstruction(globalStyle, lighting, camera, layoutShape, workspaceWidth, workspaceLength, engine, rooms as any, image || undefined, resolutionClause)}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" /> كود استرجاع المشروع المباشر (JSON Data)
            </div>
            <button
              onClick={async () => {
                const code = encodeProject(projectPayload);
                try {
                  await navigator.clipboard.writeText(code);
                  toast.success('تم نسخ كود المشروع');
                } catch {
                  toast.error('تعذّر النسخ. تحقق من صلاحيات الحافظة.');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-all"
            >
              <Copy className="w-4 h-4" /> نسخ الكود
            </button>
          </h3>
          <p className="text-xs text-slate-500 mb-4">هذا الكود يتحدث تلقائياً مع كل تغيير في التصميم. يمكنك نسخه في أي وقت.</p>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-x-auto max-w-full">
            <pre className="text-[10px] sm:text-xs font-mono text-blue-400/90 whitespace-pre-wrap text-left break-all" dir="ltr">
              {encodeProject(projectPayload)}
            </pre>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-[10px] text-slate-600 uppercase font-black tracking-widest pb-8">
        Arch3D Genie — Professional Spatial Rendering Engine © 2026
      </footer>
      <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' } }} />
    </div>
  );
}
