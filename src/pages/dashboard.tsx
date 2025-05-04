// pages/dashboard.tsx
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Layout from "@/components/Layout"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { StripeCheckoutSessionResponse } from "@/types/stripe"
import { url } from "inspector"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

export default function Dashboard() {
  // status would be either "loading", "authenticated", or "unauthenticated"
  const { data: session, status } = useSession();
  const router = useRouter()
  const [subscribed, setSubscribed] = useState(false) // You'll need to get this from your DB
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("session_id")) {
      setSubscribed(true);
      router.replace("/dashboard", undefined, { shallow: true }); // This is to avoid redirect loop
    }
    if (status === 'authenticated' && session?.user?.plan === 'price_1RFW272U8Bk8KQCEzbgQK5bh') { // Check your actual plan value
      console.log("Session data confirms user is subscribed.");
      setSubscribed(true);
    }
    if (status != "loading" && !session) {
      router.push("/signup");
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

  const handleManageSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create portal session.');
      }

      // Redirect user to the Stripe Portal URL
      if (data.url) {
        window.location.href = data.url;
      } else {
           throw new Error('Portal URL not received from server.');
      }

    } catch (err: any) {
      console.error('Error managing subscription:', err);
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false); // Stop loading on error
    }
  };

  const handleSubscription = async () => {
    setLoading(true);
    setError(null);

    // Check if user is logged in  
    if (!session) {
      setLoading(false);
      setError("User not logged in");
      return;
    }
    console.log(">>> handleSubscription triggered: Starting process >>>")

    try {
      // Call backend API route to create a checkout session
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Can add body if extra data required by the backend API
      })
      console.log(">>> handleSubscription: response received >>>", response);

      // Check response status first
      if (!response.ok) {
        console.log(">>> handleSubscription: response not ok >>>");
        // try to parse the error from the response
        let errMessage = response.statusText;
        try {
          const errorData = await response.json() as StripeCheckoutSessionResponse;
          if ('error' in errorData) {
            errMessage = errorData.error.message;
          }
          console.log(">>> parsed error message: ", errMessage);
        } catch (parseError) {
          console.error("Error parsing error response", parseError);
        }
        throw new Error(`API Error: ${response.status} ${errMessage}`);
      }
      console.log(">>> handleSubscription: response ok >>>");

      // If response OK, parse the JSON response
      const checkoutSessionData = await response.json() as StripeCheckoutSessionResponse; 
      console.log(">>> handleSubscription: checkoutSessionData received >>>", checkoutSessionData);

      if ('error' in checkoutSessionData) {
        console.log(">>> handleSubscription: error in checkoutSessionData >>>", checkoutSessionData.error);
        throw new Error(checkoutSessionData.error.message);
      }

      // Check if sessionId is present
      if (!checkoutSessionData.sessionId) {
        console.log(">>> handleSubscription: no session ID found >>>");
        throw new Error("No session ID found");
      }

      const stripe = await stripePromise
      if (!stripe) {
        console.log(">>> handleSubscription: Stripe not loaded >>>");
        throw new Error("Stripe not loaded");
      }

      const { error } = await stripe.redirectToCheckout({ 
        sessionId: checkoutSessionData.sessionId
      });

      console.log(">>> handleSubscription: Stripe redirectToCheckout call completed >>>");
      if (error) {
        console.log(">>> handleSubscription: Stripe redirectToCheckout error >>>", error);
        throw new Error(error.message);
      }
      console.log(">>> handleSubscription: Stripe redirectToCheckout call completed successfully >>>");
    } catch (error) {
      console.log(">>> handleSubscription: Error creating checkout session >>>", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      console.log(">>> handleSubscription: Setting loading to false >>>");
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
                onClick={subscribed ? handleManageSubscription : handleSubscription}
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
