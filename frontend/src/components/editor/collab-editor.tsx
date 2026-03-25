"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useMemo } from "react";
import * as Y from "yjs";
import { AuthUser } from "@/lib/types";
import { colorFromId } from "@/lib/presence-color";

type CollaborativeEditorProps = {
  noteId: string;
  accessToken: string;
  currentUser: AuthUser;
  onCursorChange?: (from: number, to: number) => void;
};

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234";

export const CollaborativeEditor = ({
  noteId,
  accessToken,
  currentUser,
  onCursorChange,
}: CollaborativeEditorProps) => {
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    doc.getMap(noteId);
    return doc;
  }, [noteId]);
  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: COLLAB_URL,
        name: noteId,
        token: accessToken,
        document: ydoc,
      }),
    [accessToken, noteId, ydoc],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: currentUser.name,
          color: colorFromId(currentUser.id),
        },
      }),
    ],
  });

  useEffect(() => {
    if (!editor || !onCursorChange) {
      return;
    }

    const selectionHandler = () => {
      const selection = editor.state.selection;
      onCursorChange(selection.from, selection.to);
    };

    editor.on("selectionUpdate", selectionHandler);

    return () => {
      editor.off("selectionUpdate", selectionHandler);
    };
  }, [editor, onCursorChange]);

  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  if (!editor) {
    return <div className="editor-box">Preparing realtime editor...</div>;
  }

  return (
    <div>
      <div className="editor-toolbar">
        <button className="tool-btn" onClick={() => editor.chain().focus().toggleBold().run()} type="button">
          Bold
        </button>
        <button className="tool-btn" onClick={() => editor.chain().focus().toggleItalic().run()} type="button">
          Italic
        </button>
        <button
          className="tool-btn"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          type="button"
        >
          Bullets
        </button>
        <button
          className="tool-btn"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          type="button"
        >
          Numbered
        </button>
      </div>
      <div className="editor-box">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
