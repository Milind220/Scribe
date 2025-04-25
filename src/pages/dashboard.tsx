// pages/dashboard.tsx
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Layout from "@/components/Layout"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { StripeCheckoutSessionResponse } from "@/types/stripe"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string)

export default function Dashboard() {
  // status would be either "loading", "authenticated", or "unauthenticated"
  const { data: session, status } = useSession();
  const router = useRouter()
  const [subscribed, setSubscribed] = useState(false) // You'll need to get this from your DB
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status != "loading" && !session) {
      router.push("/signup")
    }
  }, [session, status, router])

  // Show loading state while session is being checked
  if (status === "loading") {
    return (
      <Layout>
        <p>Loading...</p>
      </Layout>
    );
  }

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      // Logic to delete account here
      await signOut({ callbackUrl: "/" })
    }
  }

  const handleSubscription = async () => {
    console.log("!!! handleSubscription triggered");
    setLoading(true);
    setError(null);

    // Check if user is logged in  
    if (!session) {
      setLoading(false);
      setError("User not logged in");
      return;
    }

    try {
      // Call backend API route to create a checkout session
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Can add body if extra data required by the backend API
      })

      // Check response status first
      if (!response.ok) {
        // try to parse the error from the response
        let errMessage = response.statusText;
        try {
          const errorData = await response.json() as StripeCheckoutSessionResponse;
          if ('error' in errorData) {
            errMessage = errorData.error.message;
          }
        } catch (parseError) {
          console.error("Error parsing error response", parseError);
        }
        throw new Error(`API Error: ${response.status} ${errMessage}`);
      }

      // If response OK, parse the JSON response
      const checkoutSessionData = await response.json() as StripeCheckoutSessionResponse; 
      if ('error' in checkoutSessionData) {
        throw new Error(checkoutSessionData.error.message);
      }

      // Check if sessionId is present
      if (!checkoutSessionData.sessionId) {
        throw new Error("No session ID found");
      }

      const stripe = await stripePromise
      if (!stripe) {
        throw new Error("Stripe not loaded");
      }

      const { error } = await stripe.redirectToCheckout({ 
        sessionId: checkoutSessionData.sessionId
      });

      if (error) {
        console.error("Error redirecting to checkout", error);
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("Error creating checkout session", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setLoading(false)
    }
  }

  if (session) {
    return (
      <Layout>
        {/* This is the main dashboard layout */}
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
                {subscribed ? "Manage Subscription" : "Subscribe"}
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
  // not loading, not authenticated, the redirect to /signup will happen in the useEffect above
  // return null to avoid rendering anything
  return null;
}
