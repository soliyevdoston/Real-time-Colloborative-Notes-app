export type CollaboratorChangeAction = "added" | "removed";

export type CollaboratorChangedEvent = {
  noteId: string;
  actorId: string;
  targetUserId: string;
  action: CollaboratorChangeAction;
};

export type RealtimeGateway = {
  emitVersionCreated: (noteId: string, version: { id: string; createdAt: Date }) => void;
  emitCollaboratorChanged: (event: CollaboratorChangedEvent) => void;
};

