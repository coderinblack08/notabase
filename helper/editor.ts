import {
  Editor as SlateEditor,
  Element as SlateElement,
  Transforms,
  Range,
  Point,
} from 'slate';
import { ReactEditor } from 'slate-react';

const LIST_TYPES = ['numbered-list', 'bulleted-list'];

export const isMarkActive = (editor: ReactEditor, format: string) => {
  const [match] = SlateEditor.nodes(editor, {
    match: (n) => n[format] === true,
    mode: 'all',
  });
  return !!match;
};

export const toggleMark = (editor: ReactEditor, format: string) => {
  const isActive = isMarkActive(editor, format);

  if (isActive) {
    SlateEditor.removeMark(editor, format);
  } else {
    SlateEditor.addMark(editor, format, true);
  }
};

export const isBlockActive = (editor: ReactEditor, format: string) => {
  const [match] = SlateEditor.nodes(editor, {
    match: (n) =>
      !SlateEditor.isEditor(n) &&
      SlateElement.isElement(n) &&
      n.type === format,
  });

  return !!match;
};

export const toggleBlock = (editor: ReactEditor, format: string) => {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) => {
      if (SlateEditor.isEditor(n) || !SlateElement.isElement(n)) {
        return false;
      }
      return LIST_TYPES.includes(n.type as string);
    },
    split: true,
  });
  const newProperties: Partial<SlateElement> = {
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  };
  Transforms.setNodes(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block);
  }
};

const SHORTCUTS: Record<string, string | undefined> = {
  '*': 'list-item',
  '-': 'list-item',
  '+': 'list-item',
  '>': 'block-quote',
  '#': 'heading-one',
  '##': 'heading-two',
  '###': 'heading-three',
  '####': 'heading-four',
  '#####': 'heading-five',
  '######': 'heading-six',
};

export const withShortcuts = (editor: ReactEditor) => {
  const { deleteBackward, insertText } = editor;

  editor.insertText = (text) => {
    const { selection } = editor;

    if (text === ' ' && selection && Range.isCollapsed(selection)) {
      const { anchor } = selection;
      const block = SlateEditor.above(editor, {
        match: (n) => SlateEditor.isBlock(editor, n),
      });
      const path = block ? block[1] : [];
      const start = SlateEditor.start(editor, path);
      const range = { anchor, focus: start };
      const beforeText = SlateEditor.string(editor, range);
      const type = SHORTCUTS[beforeText];

      if (type) {
        Transforms.select(editor, range);
        Transforms.delete(editor);
        const newProperties: Partial<SlateElement> = {
          type,
        };
        Transforms.setNodes(editor, newProperties, {
          match: (n) => SlateEditor.isBlock(editor, n),
        });

        if (type === 'list-item') {
          const list = { type: 'bulleted-list', children: [] };
          Transforms.wrapNodes(editor, list, {
            match: (n) =>
              !SlateEditor.isEditor(n) &&
              SlateElement.isElement(n) &&
              n.type === 'list-item',
          });
        }

        return;
      }
    }

    insertText(text);
  };

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      const match = SlateEditor.above(editor, {
        match: (n) => SlateEditor.isBlock(editor, n),
      });

      if (match) {
        const [block, path] = match;
        const start = SlateEditor.start(editor, path);

        if (
          !SlateEditor.isEditor(block) &&
          SlateElement.isElement(block) &&
          block.type !== 'paragraph' &&
          Point.equals(selection.anchor, start)
        ) {
          const newProperties: Partial<SlateElement> = {
            type: 'paragraph',
          };
          Transforms.setNodes(editor, newProperties);

          if (block.type === 'list-item') {
            Transforms.unwrapNodes(editor, {
              match: (n) =>
                !SlateEditor.isEditor(n) &&
                SlateElement.isElement(n) &&
                n.type === 'bulleted-list',
              split: true,
            });
          }

          return;
        }
      }

      deleteBackward(...args);
    }
  };

  return editor;
};