import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Stripe } from "https://esm.sh/stripe@17.5.0?target=deno";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") as string;
const stripeWebhookSigningSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET") as string;
const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

Deno.serve(async (req: Request) => {
  console.log(">>> Stripe webhook received!");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }
  if (!stripeSecretKey || !stripeWebhookSigningSecret) {
    throw new Error("Missing Stripe secret key or webhook signing secret");
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  
  // Check if the request is a POST request
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check if valid Stripe signature
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  // Verify the event
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      stripeWebhookSigningSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    return new Response(`Webhook error: ${err instanceof Error ? err.message : 'Unknown error'}`, { status: 400 });
  }
  console.log(">>> Stripe event verified!");
  console.log("event", event);

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Get the user ID from the session metadata
      const userId = session.metadata?.user_id;
      if (!userId) {
        throw new Error("Missing user ID in session metadata");
      }
      
      // Retrieve the subscription details from the session 
      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Extract the subscription details
      const subscriptionDetails = {
        id: subscription.id,
        plan: subscription.items.data[0].price.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };

      console.log(">>> Subscription details:", subscriptionDetails);
      console.log(">>> Updating user subscription in Supabase...");

      // Update the user's subscription status in Supabase
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_subscription_id: subscriptionDetails.id,
          stripe_subscription_plan: subscriptionDetails.plan,
          stripe_subscription_current_period_end: subscriptionDetails.currentPeriodEnd,
          stripe_subscription_cancel_at_period_end: subscriptionDetails.cancelAtPeriodEnd,
        })
        .eq("id", userId);

      if (error) {
        console.error(">>> Error updating user subscription:", error);
        return new Response("Error updating user subscription", { status: 500 });
      }
      
      console.log(">>> User subscription updated successfully!");
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      const subscriptionId = invoice.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Update the user's subscription status in Supabase
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error(">>> Error updating user subscription:", error);
        return new Response("Error updating user subscription", { status: 500 });
      }

      console.log(">>> User subscription updated successfully!");
    }

    if (event.type === "invoice.payment_failed") {

      const invoice = event.data.object as Stripe.Invoice;

      const subscriptionId = invoice.subscription as string;

      console.log(">>> Invoice payment failed!", subscriptionId);

      // Update the user's subscription status in Supabase
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_subscription_plan: "free",
        })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error(">>> Failed to cancel subscription", error);
        return new Response("Failed to cancel subscription", { status: 500 });
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
  
        // Find the user in the subscriptions table by subscription ID
        console.log('Handling subscription cancellation:', subscription.id);
  
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            stripe_subscription_cancel_at_period_end: false, 
            stripe_subscription_updated_at: new Date().toISOString(), 
            stripe_subscription_plan: 'free', 
            stripe_subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString() 
          })
          .eq('stripe_subscription_id', subscription.id);
  
        if (error) {
          console.error('Error updating subscription status:', error.message);
          return new Response('Failed to update subscription status', { status: 500 });
        }
  
        console.log('Subscription canceled successfully!');
      }
    }
  } catch (err) {
    console.error(">>> Error processing Stripe webhook:", err);
    return new Response("Error processing Stripe webhook", { status: 500 });
  }

  return new Response("Event not handled", { status: 200 });
});