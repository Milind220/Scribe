// pages/signin.tsx
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Layout from "@/components/Layout"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/router"
import { Logo } from "@/components/ui/logo"

export default function SignIn() {
  const router = useRouter()
  
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        {/* Back button */}
        <div className="absolute top-4 left-4">
          <Button 
            className="flex items-center gap-x-2" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
        <Logo className="mb-8" width={60} height={60} />
        <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-sm">
          <h1 className="text-2xl font-semibold text-center mb-6">Sign In to Scribe</h1>
          <p className="text-muted-foreground text-center mb-8">
            A distraction-free space to write and post your thoughts.
          </p>
          
          <Button 
            className="w-full py-6 flex items-center justify-center gap-2" 
            onClick={() => signIn("twitter", { callbackUrl: "/dashboard" })}
          >
            Continue with 
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              {/* X logo SVG path */}
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Button>
        </div>
      </div>
    </Layout>
  )
}