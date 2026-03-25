export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type NoteAccessRole = "OWNER" | "EDITOR" | "VIEWER";
export type LinkAccessMode = "RESTRICTED" | "ANYONE_WITH_LINK";
export type LinkPermissionMode = "VIEW" | "EDIT";

export type Collaborator = {
  id: string;
  role: "OWNER" | "EDITOR";
  user: AuthUser;
};

export type CollaboratorSuggestion = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export type PendingInvite = {
  id: string;
  invitedEmail: string;
  createdAt: string;
};

export type NoteSummary = {
  id: string;
  title: string;
  linkAccess: LinkAccessMode;
  linkPermission: LinkPermissionMode;
  currentAccessRole: NoteAccessRole;
  createdAt: string;
  updatedAt: string;
  owner: AuthUser;
  members: Collaborator[];
  _count: {
    comments: number;
    versions: number;
  };
};

export type CommentItem = {
  id: string;
  noteId: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  author: AuthUser;
};

export type NoteVersion = {
  id: string;
  noteId: string;
  createdAt: string;
  createdById: string | null;
  createdBy: AuthUser | null;
};

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

export type CollaboratorChangedEvent = {
  noteId: string;
  actorId: string;
  targetUserId: string;
  action: "added" | "removed";
};
