import React, { useState } from "react";
import { motion } from "motion/react";
import { Layers, Trash2, Copy, X } from "lucide-react";
import {
  ROOM_TYPES,
  PARTITION_TYPES,
  FURNITURE_STYLES,
} from "../../utils/constants";

interface BulkEditBarProps {
  count: number;
  onApply: (patch: {
    roomType?: string;
    partitionType?: string;
    furnitureStyle?: string;
  }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkEditBar: React.FC<BulkEditBarProps> = ({
  count,
  onApply,
  onDuplicate,
  onDelete,
  onClear,
}) => {
  const [roomType, setRoomType] = useState<string>("");
  const [partitionType, setPartitionType] = useState<string>("");
  const [furnitureStyle, setFurnitureStyle] = useState<string>("");

  const apply = () => {
    const patch: Record<string, string> = {};
    if (roomType) patch.roomType = roomType;
    if (partitionType) patch.partitionType = partitionType;
    if (furnitureStyle) patch.furnitureStyle = furnitureStyle;
    if (Object.keys(patch).length === 0) return;
    onApply(patch);
    setRoomType("");
    setPartitionType("");
    setFurnitureStyle("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-3 mb-3 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
          <Layers className="w-3.5 h-3.5" />
          تعديل جماعي ({count} منطقة)
        </div>
        <button
          onClick={onClear}
          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md"
          title="إلغاء التحديد"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <select
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500"
        >
          <option value="">— تغيير نوع المساحة —</option>
          {ROOM_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
        <select
          value={partitionType}
          onChange={(e) => setPartitionType(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500"
        >
          <option value="">— تغيير القواطع —</option>
          {PARTITION_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>
        <select
          value={furnitureStyle}
          onChange={(e) => setFurnitureStyle(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded-lg px-2.5 py-2 outline-none focus:border-emerald-500"
        >
          <option value="">— تغيير نمط الأثاث —</option>
          {FURNITURE_STYLES.map((fs) => (
            <option key={fs} value={fs}>
              {fs}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={apply}
          disabled={!roomType && !partitionType && !furnitureStyle}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 disabled:cursor-not-allowed font-black text-[11px] py-2 rounded-lg transition-all"
        >
          تطبيق على المحدد
        </button>
        <button
          onClick={onDuplicate}
          className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all"
          title="تكرار"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="px-3 bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40 rounded-lg transition-all"
          title="حذف الكل"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
