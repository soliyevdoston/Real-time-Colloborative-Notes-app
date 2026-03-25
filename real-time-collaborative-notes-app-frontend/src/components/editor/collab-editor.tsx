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
import { CSSProperties } from "react";

export type EditorCommandApi = {
  undo: () => void;
  redo: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  setParagraph: () => void;
  setHeading1: () => void;
  selectAll: () => void;
  insertHorizontalRule: () => void;
};

type CollaborativeEditorProps = {
  noteId: string;
  accessToken: string;
  currentUser: AuthUser;
  editable?: boolean;
  zoom?: number;
  fontFamily?: string;
  fontSize?: number;
  onCursorChange?: (from: number, to: number) => void;
  onEditorReady?: (api: EditorCommandApi | null) => void;
};

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234";

export const CollaborativeEditor = ({
  noteId,
  accessToken,
  currentUser,
  editable = true,
  zoom = 100,
  fontFamily = "Arial, sans-serif",
  fontSize = 11,
  onCursorChange,
  onEditorReady,
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
    editable,
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
    editor?.setEditable(editable);
  }, [editable, editor]);

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
    if (!onEditorReady) {
      return;
    }

    if (!editor) {
      onEditorReady(null);
      return;
    }

    const runEditable = (runner: () => void) => {
      if (!editable) {
        return;
      }

      runner();
    };

    onEditorReady({
      undo: () => runEditable(() => editor.chain().focus().undo().run()),
      redo: () => runEditable(() => editor.chain().focus().redo().run()),
      toggleBold: () => runEditable(() => editor.chain().focus().toggleBold().run()),
      toggleItalic: () => runEditable(() => editor.chain().focus().toggleItalic().run()),
      toggleBulletList: () => runEditable(() => editor.chain().focus().toggleBulletList().run()),
      toggleOrderedList: () => runEditable(() => editor.chain().focus().toggleOrderedList().run()),
      setParagraph: () => runEditable(() => editor.chain().focus().setParagraph().run()),
      setHeading1: () => runEditable(() => editor.chain().focus().toggleHeading({ level: 1 }).run()),
      selectAll: () => editor.chain().focus().selectAll().run(),
      insertHorizontalRule: () => runEditable(() => editor.chain().focus().setHorizontalRule().run()),
    });

    return () => {
      onEditorReady(null);
    };
  }, [editable, editor, onEditorReady]);

  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  if (!editor) {
    return <div className="editor-box">Real-time muharrir tayyorlanmoqda...</div>;
  }

  const editorStyle: CSSProperties = {
    fontFamily,
    fontSize: `${(fontSize * zoom) / 100}px`,
  };

  return (
    <div>
      <div className="editor-toolbar">
        <button
          className="tool-btn"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBold().run()}
          type="button"
        >
          B
        </button>
        <button
          className="tool-btn"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          type="button"
        >
          I
        </button>
        <button
          className="tool-btn"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          type="button"
        >
          • List
        </button>
        <button
          className="tool-btn"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          type="button"
        >
          1. List
        </button>
      </div>
      <div className="editor-box" style={editorStyle}>
        <EditorContent editor={editor} />
      </div>
      {!editable ? <p className="panel-empty">Faqat o&apos;qish rejimi yoqilgan.</p> : null}
    </div>
  );
};
