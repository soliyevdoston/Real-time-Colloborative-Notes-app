import { Role } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../../shared/db/prisma";
import { HttpError } from "../../shared/errors/http-error";

const noteBaseInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  _count: {
    select: {
      comments: true,
      versions: true,
    },
  },
};

const membershipInclude = {
  note: {
    include: noteBaseInclude,
  },
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const getMembership = async (noteId: string, userId: string) => {
  return prisma.noteMember.findUnique({
    where: {
      noteId_userId: {
        noteId,
        userId,
      },
    },
    include: membershipInclude,
  });
};

const requireMembership = async (noteId: string, userId: string) => {
  const membership = await getMembership(noteId, userId);
  if (!membership) {
    throw new HttpError(403, "You do not have access to this note");
  }

  return membership;
};

const requireOwner = async (noteId: string, userId: string) => {
  const membership = await requireMembership(noteId, userId);
  if (membership.role !== Role.OWNER) {
    throw new HttpError(403, "Only owner can perform this action");
  }

  return membership;
};

export const notesService = {
  async createNote(userId: string, title: string) {
    const note = await prisma.note.create({
      data: {
        title,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: noteBaseInclude,
    });

    return note;
  },

  async listNotes(userId: string) {
    return prisma.note.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: noteBaseInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });
  },

  async getNote(noteId: string, userId: string) {
    const membership = await requireMembership(noteId, userId);
    return membership.note;
  },

  async updateNote(noteId: string, userId: string, data: { title?: string }) {
    await requireMembership(noteId, userId);

    const note = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(data.title ? { title: data.title } : {}),
      },
      include: noteBaseInclude,
    });

    return note;
  },

  async deleteNote(noteId: string, userId: string) {
    await requireOwner(noteId, userId);

    await prisma.note.delete({
      where: { id: noteId },
    });
  },

  async addCollaborator(noteId: string, ownerId: string, email: string) {
    await requireOwner(noteId, ownerId);

    const normalizedEmail = email.trim().toLowerCase();
    const invitedUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!invitedUser) {
      throw new HttpError(404, "User with this email not found");
    }

    if (invitedUser.id === ownerId) {
      throw new HttpError(400, "Owner already has access to this note");
    }

    const existingMembership = await prisma.noteMember.findUnique({
      where: {
        noteId_userId: {
          noteId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new HttpError(409, "User is already a collaborator");
    }

    await prisma.noteMember.create({
      data: {
        noteId,
        userId: invitedUser.id,
        role: Role.EDITOR,
      },
    });

    const note = await this.getNote(noteId, ownerId);
    return {
      note,
      targetUserId: invitedUser.id,
    };
  },

  async suggestCollaborators(noteId: string, ownerId: string, query: string) {
    await requireOwner(noteId, ownerId);

    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      return [];
    }

    const memberships = await prisma.noteMember.findMany({
      where: { noteId },
      select: { userId: true },
    });

    const excludedUserIds = memberships.map((membership) => membership.userId);

    return prisma.user.findMany({
      where: {
        id: {
          notIn: excludedUserIds,
        },
        OR: [
          {
            email: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: [{ email: "asc" }],
      take: 8,
    });
  },

  async removeCollaborator(noteId: string, ownerId: string, collaboratorId: string) {
    await requireOwner(noteId, ownerId);

    if (ownerId === collaboratorId) {
      throw new HttpError(400, "Owner cannot remove themselves");
    }

    const existingMembership = await prisma.noteMember.findUnique({
      where: {
        noteId_userId: {
          noteId,
          userId: collaboratorId,
        },
      },
    });

    if (!existingMembership) {
      throw new HttpError(404, "Collaborator not found on this note");
    }

    await prisma.noteMember.delete({
      where: {
        noteId_userId: {
          noteId,
          userId: collaboratorId,
        },
      },
    });

    const note = await this.getNote(noteId, ownerId);
    return {
      note,
      targetUserId: collaboratorId,
    };
  },

  async canViewNote(noteId: string, userId: string): Promise<boolean> {
    const membership = await getMembership(noteId, userId);
    return Boolean(membership);
  },

  async canEditNote(noteId: string, userId: string): Promise<boolean> {
    const membership = await getMembership(noteId, userId);
    return Boolean(membership && (membership.role === Role.OWNER || membership.role === Role.EDITOR));
  },

  async saveRealtimeState(params: {
    noteId: string;
    stateBase64: string;
    changedById?: string;
  }) {
    const { noteId, stateBase64, changedById } = params;
    const stateHash = sha256(stateBase64);

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        ydocStateHash: true,
        lastVersionAt: true,
      },
    });

    if (!note) {
      throw new HttpError(404, "Note not found for realtime state save");
    }

    const now = new Date();
    const changed = note.ydocStateHash !== stateHash;
    const canSnapshot =
      changed &&
      (!note.lastVersionAt || now.getTime() - note.lastVersionAt.getTime() >= 30_000);

    await prisma.note.update({
      where: { id: noteId },
      data: {
        ydocState: stateBase64,
        ydocStateHash: stateHash,
        ...(canSnapshot ? { lastVersionAt: now } : {}),
      },
    });

    if (!canSnapshot) {
      return null;
    }

    const version = await prisma.noteVersion.create({
      data: {
        noteId,
        state: stateBase64,
        createdById: changedById,
      },
    });

    const oldVersions = await prisma.noteVersion.findMany({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      skip: 5,
      select: { id: true },
    });

    if (oldVersions.length > 0) {
      await prisma.noteVersion.deleteMany({
        where: {
          id: {
            in: oldVersions.map((item) => item.id),
          },
        },
      });
    }

    return version;
  },

  async listVersions(noteId: string, userId: string) {
    await requireMembership(noteId, userId);

    return prisma.noteVersion.findMany({
      where: { noteId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
  },

  async restoreVersion(noteId: string, versionId: string, userId: string) {
    const canEdit = await this.canEditNote(noteId, userId);
    if (!canEdit) {
      throw new HttpError(403, "You cannot restore this note");
    }

    const version = await prisma.noteVersion.findFirst({
      where: {
        id: versionId,
        noteId,
      },
    });

    if (!version) {
      throw new HttpError(404, "Version not found");
    }

    await prisma.note.update({
      where: { id: noteId },
      data: {
        ydocState: version.state,
        ydocStateHash: sha256(version.state),
        lastVersionAt: new Date(),
      },
    });

    return version;
  },
};
