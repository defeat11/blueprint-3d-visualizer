import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Check, X } from "lucide-react";
import {
  ROOM_TYPES,
  PARTITION_TYPES,
  FURNITURE_STYLES,
} from "../../utils/constants";
import type { WallAttachment, TableShape } from "../../hooks/useZones";

export interface ZonePreset {
  roomType: string;
  partitionType: string;
  furnitureStyle: string;
  wallAttachment?: WallAttachment;
  tableShape?: TableShape;
}

const TABLE_SHAPE_OPTIONS: Array<{ id: TableShape; label: string }> = [
  { id: "rectangular", label: "مستطيلة" },
  { id: "round", label: "دائرية" },
  { id: "oval", label: "بيضاوية" },
  { id: "u-shape", label: "U" },
  { id: "l-shape", label: "L" },
];

interface ZoneSetupModalProps {
  open: boolean;
  preset: ZonePreset;
  defaultName: string;
  widthM: number;
  lengthM: number;
  onConfirm: (cfg: ZonePreset & { name: string }) => void;
  onCancel: () => void;
}

const QUICK_TYPES: { label: string; value: string; emoji: string }[] = [
  { label: "استقبال", value: ROOM_TYPES[7], emoji: "🛎" },
  { label: "اجتماعات صغيرة", value: ROOM_TYPES[4], emoji: "👥" },
  { label: "اجتماعات كبيرة", value: ROOM_TYPES[3], emoji: "🪑" },
  { label: "مكتب خاص", value: ROOM_TYPES[2], emoji: "💼" },
  { label: "مساحة مفتوحة", value: ROOM_TYPES[5], emoji: "🏢" },
  { label: "زاوية قهوة", value: ROOM_TYPES[6], emoji: "☕" },
  { label: "انتظار", value: ROOM_TYPES[8], emoji: "🛋" },
  { label: "تخزين", value: ROOM_TYPES[10], emoji: "📦" },
];

export const ZoneSetupModal: React.FC<ZoneSetupModalProps> = ({
  open,
  preset,
  defaultName,
  widthM,
  lengthM,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);
  const [roomType, setRoomType] = useState(preset.roomType);
  const [partitionType, setPartitionType] = useState(preset.partitionType);
  const [furnitureStyle, setFurnitureStyle] = useState(preset.furnitureStyle);
  const [wallAttachment, setWallAttachment] = useState<WallAttachment>(preset.wallAttachment ?? "free");
  const [tableShape, setTableShape] = useState<TableShape | undefined>(preset.tableShape);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setRoomType(preset.roomType);
    setPartitionType(preset.partitionType);
    setFurnitureStyle(preset.furnitureStyle);
    setWallAttachment(preset.wallAttachment ?? "free");
    setTableShape(preset.tableShape);
  }, [open, preset, defaultName]);

  const buildPayload = () => ({ name, roomType, partitionType, furnitureStyle, wallAttachment, tableShape });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        onConfirm(buildPayload());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, name, roomType, partitionType, furnitureStyle, wallAttachment, tableShape, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] w-full max-w-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" /> منطقة جديدة
                </h2>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  {widthM}m × {lengthM}m — اختر النوع وأكمل
                </p>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">
                  اسم المنطقة
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم المنطقة..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">
                  اختيار سريع
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_TYPES.map((q) => (
                    <button
                      key={q.value}
                      onClick={() => setRoomType(q.value)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                        roomType === q.value
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-lg leading-none">{q.emoji}</span>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">
                  نوع المساحة (تفصيلي)
                </label>
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
                >
                  {ROOM_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">
                    القواطع
                  </label>
                  <select
                    value={partitionType}
                    onChange={(e) => setPartitionType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
                  >
                    {PARTITION_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">
                    الأثاث
                  </label>
                  <select
                    value={furnitureStyle}
                    onChange={(e) => setFurnitureStyle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500"
                  >
                    {FURNITURE_STYLES.map((fs) => (
                      <option key={fs} value={fs}>
                        {fs}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">
                  موضع الطاولة بالنسبة للجدار
                </label>
                <div className="flex gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  {([{ val: "free", label: "مركزية" }, { val: "attached", label: "ملاصقة للجدار" }] as Array<{ val: WallAttachment; label: string }>).map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setWallAttachment(opt.val)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                        wallAttachment === opt.val
                          ? "bg-emerald-500 text-slate-950 shadow-lg"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">
                  شكل الطاولة (Optional)
                </label>
                <div className="grid grid-cols-6 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setTableShape(undefined)}
                    className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${!tableShape ? "bg-slate-700 text-slate-200" : "text-slate-500 hover:bg-slate-800"}`}
                  >
                    تلقائي
                  </button>
                  {TABLE_SHAPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setTableShape(opt.id)}
                      className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${tableShape === opt.id ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:bg-slate-800"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => onConfirm(buildPayload())}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Check className="w-4 h-4" /> تأكيد المنطقة
              </button>
              <button
                onClick={onCancel}
                className="px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
              >
                إلغاء
              </button>
            </div>
            <p className="text-[10px] text-slate-600 text-center mt-3 font-mono">
              Ctrl+Enter للتأكيد · Esc للإلغاء
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
