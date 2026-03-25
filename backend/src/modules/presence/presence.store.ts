export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  socketId: string;
  cursor?: {
    from: number;
    to: number;
  };
};

export class PresenceStore {
  private readonly store = new Map<string, Map<string, PresenceUser>>();

  join(noteId: string, presence: PresenceUser): PresenceUser[] {
    const noteMap = this.store.get(noteId) ?? new Map<string, PresenceUser>();
    noteMap.set(presence.socketId, presence);
    this.store.set(noteId, noteMap);
    return Array.from(noteMap.values());
  }

  updateCursor(noteId: string, socketId: string, cursor: { from: number; to: number }): PresenceUser[] {
    const noteMap = this.store.get(noteId);
    if (!noteMap) {
      return [];
    }

    const existing = noteMap.get(socketId);
    if (existing) {
      noteMap.set(socketId, {
        ...existing,
        cursor,
      });
    }

    return Array.from(noteMap.values());
  }

  leave(noteId: string, socketId: string): PresenceUser[] {
    const noteMap = this.store.get(noteId);
    if (!noteMap) {
      return [];
    }

    noteMap.delete(socketId);

    if (noteMap.size === 0) {
      this.store.delete(noteId);
      return [];
    }

    return Array.from(noteMap.values());
  }

  removeSocketEverywhere(socketId: string): string[] {
    const changedNotes: string[] = [];

    for (const [noteId, noteMap] of this.store.entries()) {
      if (noteMap.delete(socketId)) {
        changedNotes.push(noteId);
      }

      if (noteMap.size === 0) {
        this.store.delete(noteId);
      }
    }

    return changedNotes;
  }

  get(noteId: string): PresenceUser[] {
    return Array.from(this.store.get(noteId)?.values() ?? []);
  }
}
