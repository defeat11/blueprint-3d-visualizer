export const ROOM_TYPES = [
  'مكتب تنفيذي (Executive Office)', 
  'مكتب خاص مع شاشة (Private Office with Display)',
  'مكتب خاص بدون شاشة (Private Office)',
  'غرفة اجتماعات كبرى (Large Meeting Room - 8P+)', 
  'غرفة اجتماعات صغيرة (Small Meeting Room)', 
  'مساحة عمل مفتوحة (Open Workspace)', 
  'زاوية قهوة / استراحة (Coffee Break Area)', 
  'استقبال (Reception)',
  'صالة انتظار (Waiting Lounge)',
  'غرفة خوادم (Server Room)',
  'مخرن (Storage)',
  'قاطع زجاجي مستقل (Standalone Glass Partition)',
  'جدار فاصل صلب (Solid Partition Wall)'
];

export const PARTITION_TYPES = [
  'قواطع زجاجية شفافة (Clear Glass Partitions)', 
  'قواطع زجاجية ضبابية (Frosted/Fluted Glass)', 
  'جدران صلبة (Solid Walls)', 
  'مساحة مفتوحة (Open Space)', 
  'قواطع خشبية مضلعة (Wood Slats)',
  'قواطع معدنية (Metal Grid Partitions)'
];

export const FURNITURE_STYLES = [
  'خشب فاتح طبيعي (Natural Light Wood)', 
  'خشب داكن فاخر (Luxury Dark Wood - Walnut)', 
  'أبيض مينيماليت (Minimalist White)', 
  'معدني وصناعي (Industrial Metal)', 
  'أسود عصري (Sleek Modern Black)',
  'أسمنت Brutalist (Raw Cement/Concrete)'
];

export const FEATURES_LIST = [
  'شاشة عرض كبيرة (Large Display Screen)', 
  'نباتات داخلية (Botanical/Plants)', 
  'آلة قهوة (Coffee Machine)', 
  'إضاءة مخفية (Hidden LED Strips)', 
  'أرفف حائطية (Wall Shelves)',
  'كراسي مريحة (Ergonomic Chairs)',
  'سجاد (Area Rug)',
  'سبورة بيضاء (Whiteboard)',
  'طاولة دائرية (Round Table)',
  'طاولة مستطيلة (Rectangular Table)'
];

export const LAYOUT_SHAPES = [
  'تخطيط مستطيل (Rectangular 16:9)',
  'تخطيط مربع (Square 1:1)',
  'تخطيط طولي (Portrait 9:16)'
];

export const ENGINES = [
  { id: 'midjourney', name: 'Midjourney v6', icon: 'zap' },
  { id: 'dalle', name: 'DALL-E 3', icon: 'image' },
  { id: 'unreal', name: 'Unreal Engine 5', icon: 'gamepad' },
  { id: 'octane', name: 'Octane Render', icon: 'layers' },
  { id: 'nanobanana', name: 'Nano Banana (Gemini 2.5 Flash Image)', icon: 'zap' }
];

export const GLOBAL_STYLES = [
  'مكتب عصري حديث (Modern Corporate)',
  'صناعي لوفت (Industrial Loft)',
  'مينيماليت ياباني (Japanese Minimalist)',
  'كلاسيكي فاخر (Luxury Classic)',
  'بيوفيليك (Biophilic Design)',
  'مستقبلي (Futuristic/Tech)'
];

export const LIGHTING_MODES = [
  'إضاءة طبيعية واضحة مع إضاءة دافئة للمكاتب (Natural & Warm)',
  'إضاءة سينمائية (Cinematic High Contrast)',
  'إضاءة استوديو بيضاء (Studio White)',
  'إضاءة وقت الغروب (Golden Hour)',
  'إضاءة ليلية نيون (Cyberpunk Night)'
];

export const CAMERA_ANGLES = [
  'صورة من الأعلى بزاوية (Isometric Top-down view)',
  'زاوية عريضة من الزاوية (Wide-Angle Corner View)',
  'عروق عين الطائر (Bird\'s Eye Flat)',
  'منظور الشخص (Eye-level POV)',
  'لقطة ماكرو (Macro Detail)'
];

export const RESOLUTIONS = [
  { id: 'hd', label: 'HD', detail: '1920×1080', clause: 'high-definition 1920x1080 resolution, sharp detail' },
  { id: '2k', label: '2K', detail: '2560×1440', clause: 'crisp 2K (2560x1440) resolution, fine micro-detail' },
  { id: '4k', label: '4K UHD', detail: '3840×2160', clause: 'ultra-sharp 4K UHD (3840x2160) resolution, photoreal micro-detail, clean PBR materials' },
  { id: '8k', label: '8K Pro', detail: '7680×4320', clause: '8K cinematic resolution (7680x4320), studio-grade micro-detail, archviz reference quality' },
] as const;

export type ResolutionId = (typeof RESOLUTIONS)[number]['id'];

export function getResolutionClause(id: string): string {
  return RESOLUTIONS.find((r) => r.id === id)?.clause || RESOLUTIONS[2].clause;
}
