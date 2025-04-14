// pages/dashboard.tsx
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Layout from "@/components/Layout"
import { useRouter } from "next/router"
import { useState } from "react"

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [subscribed, setSubscribed] = useState(false) // You'll need to get this from your DB
  
  // If no session, redirect to sign in
  if (!session) {
    typeof window !== "undefined" && router.push("/signup")
    return null
  }

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      // Logic to delete account here
      await signOut({ callbackUrl: "/" })
    }
  }

  const handleSubscription = () => {
    if (subscribed) {
      // Handle unsubscribe
      setSubscribed(false)
    } else {
      // Redirect to payment page or open modal
      router.push("/pricing")
    }
  }

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-sm">
          <h1 className="text-2xl font-semibold mb-6">Your Account</h1>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Signed in as <span className="font-medium">{session.user?.name}</span>
            </p>
            
            <Button 
              className="w-full" 
              onClick={() => router.push("/editor")}
            >
              Go to Editor
            </Button>
            
            <Button 
              className="w-full" 
              variant={subscribed ? "destructive" : "default"}
              onClick={handleSubscription}
            >
              {subscribed ? "Unsubscribe" : "Subscribe"}
            </Button>
            
            <div className="pt-4 border-t">
              <Button 
                className="w-full" 
                variant="outline" 
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
              
              <Button 
                className="w-full mt-2" 
                variant="ghost"
                onClick={handleDeleteAccount}
              >
                Delete account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}