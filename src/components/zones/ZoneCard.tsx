import React from 'react';
import { Trash2, MapPin, ChevronUp, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';
import { ROOM_TYPES, PARTITION_TYPES, FURNITURE_STYLES, FEATURES_LIST } from '../../utils/constants';
import type { WallAttachment, TableShape } from '../../hooks/useZones';

interface RoomItem {
  id: string;
  name: string;
  direction: number;
}

interface Room {
  id: string;
  name: string;
  roomType: string;
  partitionType: string;
  furnitureStyle: string;
  features: string[];
  direction: number;
  description: string;
  x: number | null;
  y: number | null;
  width: number;
  length: number;
  items?: RoomItem[];
  wallAttachment?: WallAttachment;
  tableShape?: TableShape;
}

const TABLE_SHAPE_OPTIONS: Array<{ id: TableShape; label: string }> = [
  { id: 'rectangular', label: 'مستطيلة' },
  { id: 'round', label: 'دائرية' },
  { id: 'oval', label: 'بيضاوية' },
  { id: 'u-shape', label: 'حرف U' },
  { id: 'l-shape', label: 'حرف L' },
];

interface ZoneCardProps {
  room: Room;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: (id: string, field: keyof Room, value: any) => void;
}

export const ZoneCard: React.FC<ZoneCardProps> = ({
  room,
  index,
  isActive,
  onSelect,
  onRemove,
  onChange
}) => {
  const generateDescription = (currentRoom: Room, field?: string, value?: any) => {
    const tempRoom = { ...currentRoom };
    if (field) {
      (tempRoom as any)[field] = value;
    }
    
    const dirMap: Record<number, string> = { 0: 'يتجه نحو الشمال', 90: 'يتجه نحو الشرق', 180: 'يتجه نحو الجنوب', 270: 'يتجه نحو الغرب' };
    
    // Constructing a detailed, explicit description
    let desc = `التصنيف الصارم: ${tempRoom.roomType}. لا تضف أي أثاث آخر لم يذكر هنا.
الجدران/القواطع: ${tempRoom.partitionType}
نمط الأثاث: ${tempRoom.furnitureStyle}
توجيه المنطقة: ${dirMap[tempRoom.direction] || 'غير محدد'}
المميزات التقنية الإضافية: ${(tempRoom.features || []).join('، ') || 'لا يوجد'}
`;

    if (tempRoom.items && tempRoom.items.length > 0) {
      desc += `محتويات الأثاث الإجبارية (لا تضف غيرها):
${tempRoom.items.map(i => `- ${i.name || 'أثاث غير مسمى'} (${dirMap[i.direction] || 'يتجه للشمال'})`).join('\n')}
`;
    }

    return desc;
  };

  const handleFieldChange = (field: keyof Room, value: any) => {
    // Determine if we need to auto-adjust dimensions based on room type
    let shouldUpdateDimensions = false;
    let newWidth = room.width;
    let newLength = room.length;

    if (field === 'roomType') {
      const isWall = value.includes('Glass') || value.includes('Solid');
      const wasWall = room.roomType.includes('Glass') || room.roomType.includes('Solid');
      
      if (isWall && !wasWall) {
        newLength = 0.2; // default thin wall
      } else if (!isWall && wasWall) {
        if (newLength! < 2) newLength = 4;
      }
    }

    // First do the user's intended update
    onChange(room.id, field, value);

    if (field === 'roomType' && newLength !== room.length) {
      setTimeout(() => {
        onChange(room.id, 'length', newLength!);
      }, 0);
    }

    // Generate an automatic description if the user is changing core aspects
    // This helps the user see exactly what text the AI will receive.
    if (field !== 'description' && field !== 'name' && field !== 'x' && field !== 'y') {
       const newDesc = generateDescription(room, field, value);
       onChange(room.id, 'description', newDesc);
    }
  };

  const toggleFeature = (feature: string) => {
    const currentFeatures = room.features || [];
    const features = currentFeatures.includes(feature) 
      ? currentFeatures.filter(f => f !== feature) 
      : [...currentFeatures, feature];
    handleFieldChange('features', features);
  };

  const autoFillDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    const desc = generateDescription(room);
    onChange(room.id, 'description', desc);
  };

  return (
    <div 
      onClick={onSelect}
      className={`flex flex-col gap-3 p-4 border rounded-2xl transition-all cursor-pointer group mb-3
        ${isActive 
          ? 'bg-slate-800/80 border-emerald-500/50 shadow-[0_10px_30px_rgba(16,185,129,0.1)]' 
          : 'bg-slate-800/20 border-slate-700/50 hover:border-slate-600'
        }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center font-mono text-sm shadow-inner transition-colors
            ${isActive ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}
          `}>
            {index + 1}
          </div>
          <input
            value={room.name}
            onChange={(e) => onChange(room.id, 'name', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="اسم المنطقة..."
            className="flex-1 text-sm font-bold bg-transparent border-b border-transparent focus:border-emerald-500 outline-none px-1 py-1 text-slate-100 placeholder:text-slate-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {room.x !== null && room.y !== null && (
             <span className="text-[10px] bg-slate-950 border border-slate-700 text-slate-500 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
               <MapPin className="w-3 h-3 text-emerald-400" />
               {Math.round(room.x)},{Math.round(room.y)}
             </span>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isActive && (
        <div className="space-y-4 pt-2 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">اتجاه الطاولة / المكتب (Main Furniture Direction)</label>
            <div className="flex gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {[
                { icon: <ChevronUp className="w-4 h-4"/>, val: 0, label: 'يواجه الشمال (N)' },
                { icon: <ChevronRight className="w-4 h-4"/>, val: 90, label: 'يواجه الشرق (E)' },
                { icon: <ChevronDown className="w-4 h-4"/>, val: 180, label: 'يواجه الجنوب (S)' },
                { icon: <ChevronLeft className="w-4 h-4"/>, val: 270, label: 'يواجه الغرب (W)' },
              ].map(dir => (
                 <button
                   key={dir.val}
                   onClick={(e) => { e.stopPropagation(); handleFieldChange('direction', dir.val); }}
                   className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${room.direction === dir.val ? 'bg-emerald-500 text-slate-950 shadow-lg scale-105' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                   title={dir.label}
                 >
                   {dir.icon}
                 </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">موضع الطاولة بالنسبة للجدار</label>
            <div className="flex gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {[
                { val: 'free' as WallAttachment, label: 'مركزية' },
                { val: 'attached' as WallAttachment, label: 'ملاصقة للجدار' },
              ].map((opt) => {
                const current = room.wallAttachment ?? 'free';
                const active = current === opt.val;
                return (
                  <button
                    key={opt.val}
                    onClick={(e) => { e.stopPropagation(); handleFieldChange('wallAttachment', opt.val); }}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${active ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-600 mt-1.5 px-1">
              {room.wallAttachment === 'attached'
                ? `سيتم إلصاق الطاولة بالجدار في الجهة التي تواجهها (${{0:'الشمال',90:'الشرق',180:'الجنوب',270:'الغرب'}[room.direction] || ''}).`
                : 'الطاولة سترسم في وسط المنطقة مع ممرات حولها.'}
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">شكل الطاولة (Optional)</label>
            <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={(e) => { e.stopPropagation(); handleFieldChange('tableShape', undefined); }}
                className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${!room.tableShape ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:bg-slate-800'}`}
                title="افتراضي حسب نوع المنطقة"
              >
                تلقائي
              </button>
              {TABLE_SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={(e) => { e.stopPropagation(); handleFieldChange('tableShape', opt.id); }}
                  className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${room.tableShape === opt.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">العرض (متر)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={room.width || 4}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFieldChange('width', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">الطول (متر)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={room.length || 4}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFieldChange('length', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">نوع المساحة</label>
              <select
                value={room.roomType}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFieldChange('roomType', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none"
              >
                {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">الجدران والقواطع</label>
              <select
                value={room.partitionType}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFieldChange('partitionType', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none"
              >
                {PARTITION_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">الأثاث والمظهر</label>
              <select
                value={room.furnitureStyle}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFieldChange('furnitureStyle', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:border-emerald-500 outline-none"
              >
                {FURNITURE_STYLES.map(fs => <option key={fs} value={fs}>{fs}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">تحديد الأثاث (اختياري)</label>
              <div className="flex flex-col gap-2">
                {(room.items || []).map((item, itemIdx) => (
                  <div key={item.id} className="flex gap-2 items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
                     <input 
                       className="flex-1 bg-transparent text-xs text-slate-200 px-2 outline-none border-b border-transparent focus:border-emerald-500"
                       value={item.name}
                       placeholder="مثال: مكتب، كرسي"
                       onChange={(e) => {
                         const newItems = [...(room.items || [])];
                         newItems[itemIdx] = { ...newItems[itemIdx], name: e.target.value };
                         handleFieldChange('items', newItems);
                       }}
                     />
                     <div className="flex gap-1 shrink-0">
                       {[
                         { icon: <ChevronUp className="w-3 h-3"/>, val: 0, label: 'N' },
                         { icon: <ChevronRight className="w-3 h-3"/>, val: 90, label: 'E' },
                         { icon: <ChevronDown className="w-3 h-3"/>, val: 180, label: 'S' },
                         { icon: <ChevronLeft className="w-3 h-3"/>, val: 270, label: 'W' },
                       ].map(dir => (
                         <button 
                           key={dir.val}
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             const newItems = [...(room.items || [])];
                             newItems[itemIdx] = { ...newItems[itemIdx], direction: dir.val };
                             handleFieldChange('items', newItems);
                           }}
                           className={`p-1.5 rounded-lg transition-all ${item.direction === dir.val ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                           title={dir.label}
                         >
                           {dir.icon}
                         </button>
                       ))}
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           const newItems = [...(room.items || [])];
                           newItems.splice(itemIdx, 1);
                           handleFieldChange('items', newItems);
                         }}
                         className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                       >
                         <Trash2 className="w-3 h-3" />
                       </button>
                     </div>
                  </div>
                ))}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newItems = [...(room.items || []), { id: Date.now().toString() + Math.random().toString(36).substring(7), name: '', direction: 0 }];
                    handleFieldChange('items', newItems);
                  }}
                  className="text-xs text-emerald-400 border border-dashed border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl py-2 flex items-center justify-center transition-colors font-bold"
                >
                  + إضافة أثاث معين
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">الميزات التقنية</label>
              <div className="flex flex-wrap gap-1.5">
                {FEATURES_LIST.map(feature => {
                  const hasFeature = room.features.includes(feature);
                  return (
                    <button
                      key={feature}
                      onClick={(e) => { e.stopPropagation(); toggleFeature(feature); }}
                      className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all border ${
                        hasFeature 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      {feature}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase font-black text-slate-500 tracking-widest">توصيف دقيق للنقطة (سيتم إرساله للمحرك)</label>
              <button 
                onClick={autoFillDescription}
                className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-slate-950 px-2 py-1 rounded-md transition-colors"
                title="كتابة الوصف آلياً بناء على الإعدادات التي اخترتها أعلاه"
              >
                توليد الوصف التلقائي من الخيارات
              </button>
            </div>
            <textarea
              value={room.description || ''}
              onChange={(e) => onChange(room.id, 'description', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="ملاحظات احترافية إضافية (مثلاً: ألوان السجاد، نوع الإضاءة)..."
              className="w-full text-xs bg-slate-950/80 border border-slate-800 rounded-xl p-3 min-h-[80px] outline-none focus:border-emerald-500/50 text-slate-300 placeholder:text-slate-700 resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
};
