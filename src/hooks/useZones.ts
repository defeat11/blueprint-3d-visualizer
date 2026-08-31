import { create } from 'zustand';

interface RoomItem {
  id: string;
  name: string;
  direction: number;
}

export type WallAttachment = 'free' | 'attached';
export type TableShape = 'rectangular' | 'round' | 'oval' | 'u-shape' | 'l-shape';

interface Room {
  id: string;
  name: string;
  description: string;
  x: number | null;
  y: number | null;
  width: number;
  length: number;
  roomType: string;
  partitionType: string;
  furnitureStyle: string;
  features: string[];
  direction: number;
  items?: RoomItem[];

  // Furniture-placement constraints used by the prompt builder.
  // wallAttachment: 'attached' = the primary furniture (desk / counter)
  //   is pushed against the wall in the direction the room faces;
  //   'free' = the primary furniture is centered freely in the zone.
  wallAttachment?: WallAttachment;
  // Optional shape override for meeting tables. When omitted the prompt
  // builder picks a sensible default per room type.
  tableShape?: TableShape;
}

interface ProjectState {
  rooms: Room[];
  history: Room[][];
  undo: () => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
}

const HISTORY_LIMIT = 30;

const pushHistory = (history: Room[][], snapshot: Room[]): Room[][] => {
  return [...history, snapshot].slice(-HISTORY_LIMIT);
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  rooms: [],
  history: [],

  setRooms: (rooms) => {
    set((state) => ({
      history: pushHistory(state.history, state.rooms),
      rooms,
    }));
  },

  addRoom: (room) => {
    set((state) => ({
      history: pushHistory(state.history, state.rooms),
      rooms: [...state.rooms, room],
    }));
  },

  removeRoom: (id) => {
    set((state) => ({
      history: pushHistory(state.history, state.rooms),
      rooms: state.rooms.filter((r) => r.id !== id),
    }));
  },

  // Per-field updates (especially text inputs) fire on every keystroke. We only
  // checkpoint history when the touched fields actually changed AND skip noisy
  // pure-text edits to avoid blowing the undo stack on description typing.
  updateRoom: (id, updates) => {
    set((state) => {
      const target = state.rooms.find((r) => r.id === id);
      if (!target) return state;

      const fields = Object.keys(updates) as (keyof Room)[];
      const hasChange = fields.some((f) => target[f] !== (updates as any)[f]);
      if (!hasChange) return state;

      const onlyTextEdit =
        fields.length > 0 &&
        fields.every((f) => f === 'description' || f === 'name');

      return {
        history: onlyTextEdit ? state.history : pushHistory(state.history, state.rooms),
        rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      };
    });
  },

  undo: () => {
    const { history } = get();
    if (history.length === 0) return;
    const previousRooms = history[history.length - 1];
    set({
      rooms: previousRooms,
      history: history.slice(0, -1),
    });
  },
}));
