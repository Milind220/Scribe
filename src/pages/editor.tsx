import { CharacterMetadata, CompositeDecorator, ContentBlock, ContentState, Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';
import Immutable from 'immutable';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SendIcon } from 'lucide-react';
import React from 'react';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/router';

const timeout = 120000
const FadeContext = React.createContext(true);

function FadingSpan(props: any) {
  const fadeEnabled = React.useContext(FadeContext);
  const [style, setStyle] = useState<{
    display: string;
    transition: string;
    textSize: string | number;
    opacity?: number;
  }>({
    display: 'inline-block',
    transition: `opacity ${timeout / 1000}s, textSize ${timeout / 1000}s`,
    textSize: 'auto',  // Start at normal height
  });

  useEffect(() => {
    if (fadeEnabled) {
      setStyle((prevStyle: typeof style) => ({
        ...prevStyle,
        opacity: 0,
        textSize: 0,
      }));
    } else {
      setStyle((prevStyle: typeof style) => ({
        ...prevStyle,
        opacity: 1,
        textSize: 'auto',
      }));
    }
  }, [fadeEnabled]);

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
  const [charCount, setCharCount] = useState(0);
  const [showPop, setShowPop] = useState(false);
  const [popShown, setPopShown] = useState(false);
  const [fadeEnabled, setFadeEnabled] = useState(true);

  const MAX_CHARS = 280;
  const PREMIUM_MAX_CHARS = 25000;
  const isPremium = true;  // For now, we're pretending to be premium

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

    const newCharCount = newEditorState.getCurrentContent().getPlainText().length;
    setCharCount(newCharCount);

    if (isPremium && charCount === MAX_CHARS) {
      setShowPop(true);
      setTimeout(() => setShowPop(false), 1000);
    }

    if (showPop) {
      setPopShown(true);
    }
  };

  const getOpacity = () => {
    return charCount / MAX_CHARS;
    // TODO: Add more logic.
  }

  const handlePost = async () => {
    // Check if the user is authenticated
    const session = await getSession();
    if (!session) {
      // Redirect to the login page
    }

    // if free posts remaining, post

    // if no free posts remaining, check if they are premium

    // if premium, post

    // if not premium, redirect to checkout
  }

  return (
    <FadeContext.Provider value={fadeEnabled}>
      {/*Outermost container for screen size and padding*/} 
      <div className="w-full px-4 py-8 flex justify-center">
        {/* Content container for editor*/}
        <div className="w-full max-w-[700px] flex flex-col">
          <div className="bg-card rounded-lg p-6">
            {/* Header */}
            <div className="flex flex-row items-center justify-between w-full">
              <p className='text-foreground/70 mb-2.5 font-semibold'>Scribe</p>
              <p 
                className={`text-foreground/70 transition-all duration-300 ${
                  showPop ? 'scale-150 font-bold' : ''
                }`}
                style={{ opacity: getOpacity() }}
              >
                {charCount}/{popShown ? PREMIUM_MAX_CHARS : MAX_CHARS}
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-foreground/40 font-light hover:text-foreground/60 rounded"
                      onClick={() => {
                        setFadeEnabled(prev => !prev);
                      }}
                    >
                      {fadeEnabled ? '60s' : 'Words stay, time flies'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>True thoughts don&apos;t need editing. First draft, best draft</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* Editor */}
            <div className="h-[calc(100vh-200px)] overflow-y-auto ">
              <Editor 
                editorState={editorState} 
                onChange={handleEditorChange} 
                placeholder="Your thoughts don't stick around forever, post before they fade..."
              />
            </div>
          </div>
          {/* Post button */}
          <div className="mt-4 md:absolute md:bottom-4 md:right-4">
            <Button className="flex items-center gap-x-2" onClick={handlePost}>
              <SendIcon className="w-4 h-4" />
              Post
            </Button>
          </div>
        </div>
      </div>
    </FadeContext.Provider>
  );
}

