import { CharacterMetadata, CompositeDecorator, ContentBlock, ContentState, Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';
import Immutable from 'immutable';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SendIcon } from 'lucide-react';

const timeout = 120000

function FadingSpan(props: any) {
  const [style, setStyle] = useState<any>({
    display: 'inline-block',
    transition: `opacity ${timeout / 1000}s, textSize ${timeout / 1000}s`,
    textSize: 'auto',  // Start at normal height
  });

  useEffect(() => {
    setStyle({
      ...style,
      opacity: 0,
      textSize: 0,
    });
  }, []);

  return <span style={style}>{props.children}</span>;
}


const decorator = new CompositeDecorator([
  {
    strategy: (contentBlock, callback, contentState) => {
      const text = contentBlock.getText();
      // split the text on spaces to find words
      const words = text.split(' ');
      let length = 0
      for (let i = 0; i < words.length; i++) {
        callback(length, length + words[i].length);
        length += words[i].length + 1
      }
    },
    component: FadingSpan,
  },
]);


export default function EditorPage() {
  const [blocks, setBlocks] = useState(new Map());
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty(decorator));

  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date().getTime();
      const newBlocks = new Map(blocks);
      let shouldUpdate = false;

      newBlocks.forEach((value, key) => {
        const [text, timestamp] = value;

        if (currentTime - timestamp >= timeout) {
          newBlocks.set(key, ['', timestamp]);
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        const newContentState = ContentState.createFromBlockArray(
          Array.from(newBlocks, ([key, [text]]) => new ContentBlock({
            key: key,
            type: 'unstyled',
            text: text,
            characterList: Immutable.List(
              Array(text.length).fill(
                CharacterMetadata.create(),
              ),
            ),
          })),
        );
        const newEditorState = EditorState.push(editorState, newContentState, 'change-block-data');
        setEditorState(newEditorState);
        setBlocks(newBlocks);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [blocks, editorState]);

  const handleEditorChange = (newEditorState: EditorState) => {
    const newBlocks = new Map();
    const currentTime = new Date().getTime();

    newEditorState.getCurrentContent().getBlocksAsArray().forEach(block => {
      const oldBlockValue = blocks.get(block.getKey());
      const newText = block.getText();

      if (oldBlockValue) {
        const [oldText] = oldBlockValue;

        if (oldText === newText) {
          newBlocks.set(block.getKey(), oldBlockValue);
        } else {
          newBlocks.set(block.getKey(), [newText, currentTime]);
        }
      } else {
        newBlocks.set(block.getKey(), [newText, currentTime]);
      }
    });

    setBlocks(newBlocks);
    setEditorState(newEditorState);
  };


  return (
    // Outermost container for screen size and padding
    <div className="w-full px-4 py-8 flex justify-center">
      {/* Content container for editor*/}
      <div className="w-full max-w-[700px] relative">
        <div className="bg-card rounded-lg p-6">
          {/* Header */}
          <div className="flex flex-row items-center justify-between w-full">
            <p className='text-foreground/70 mb-2.5 font-semibold'>Scribe</p>
            <p className='text-foreground/70 mb-2.5 font-light text-sm'>60s</p>
          </div>
          {/* Editor */}
          <div className="h-[calc(100vh-200px)] overflow-y-auto ">
            <Editor 
              editorState={editorState} 
              onChange={handleEditorChange} 
              placeholder="Your thoughts don't stick around forever, post before they fade away..."
            />
          </div>
        </div>
        {/* Post button */}
        <div className="mt-4 md:absolute md:bottom-4 md:right-4">
          <Button className="flex items-center gap-x-2">
            <SendIcon className="w-4 h-4" />
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

