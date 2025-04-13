import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Home() {
  const router = useRouter()
  const [pageState, setPageState] = useState(0);

  const updateState = () => {
    setPageState(1);
    setTimeout(() => {
      router.push("/editor");
    }, 1500); // Adjust timing to match CSS transition
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* Your logo here */}
          <span className="font-semibold text-lg">Scribe</span>
        </div>
        <Button variant="ghost" className="text-sm" onClick={() => router.push("/signup")}>Sign in</Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-[600px] text-muted-foreground">
          <div className={`${pageState % 2 == 0 ? "fade-in" : "fade-out"}`}>
            <p className="mb-6">
              I built Scribe because going on X can be distracting when all I want is to write my thoughts.
              Sometimes you don&apos;t want to engage with everything - you just want to write.
            </p>
            <p className="mb-6">
              Inspired by Will DePue&apos;s Ephemeral Notes, Scribe is a distraction-free space where text fades away, forcing you to think clearly and post with intention.
              <br />
              <br />
              Will said it best - Writing is thinking. It&apos;s the greatest tool we have.
            </p>
            <button onClick={updateState} className={"underline mt-1 text-medium font-medium text-primary"}>
              Start -&gt;
            </button>
          </div>
        </div>
      </main>

      <footer className="p-4 flex justify-center gap-6 text-xs text-muted-foreground">
        <a href="/privacy" className="hover:underline">Privacy</a>
        <a href="/terms" className="hover:underline">Terms</a>
        <a href="/pricing" className="hover:underline">Pricing</a>
      </footer>
    </div>
  );
};