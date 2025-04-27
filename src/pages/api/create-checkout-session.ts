import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { StripeCheckoutSessionResponse } from '@/types/stripe'; // Assuming this type definition exists
import { createClient } from '@supabase/supabase-js';
import { authOptions } from './auth/[...nextauth]'; // Ensure this path is correct

// --- Environment Variables ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const priceId = 'price_1RFW272U8Bk8KQCEzbgQK5bh'; // Make sure this Price ID is correct and active

// --- Environment Variable Checks ---
if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Log error server-side, don't expose keys in response
  console.error('CRITICAL: Supabase environment variables are not set');
  throw new Error('Server configuration error.'); // Throw to prevent startup if critical vars missing
}

if (!stripeSecretKey) {
  console.error('CRITICAL: STRIPE_SECRET_KEY environment variable is not set');
  throw new Error('Server configuration error.');
}

// --- Client Initializations ---
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-03-31.basil', // Always specify a fixed API version
  timeout: 30000, // Increased timeout slightly, Vercel limit still applies
});

// --- Helper for Timestamped Logging ---
const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// --- API Route Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StripeCheckoutSessionResponse | { error: { message: string } }>
) {
  const handlerStartTime = Date.now();
  log("--- create-checkout-session handler START ---");

  // 1. Check HTTP Method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    log(`Method Not Allowed: ${req.method}`);
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  try {
    // 2. Check Authentication
    log("Checking user session...");
    console.time("getServerSession");
    const session = await getServerSession(req, res, authOptions);
    console.timeEnd("getServerSession");
    const userId = session?.user?.id;

    if (!userId) {
      log("Unauthorized: User not logged in.");
      return res.status(401).json({ error: { message: 'Unauthorized: Not logged in' } });
    }
    log(`Authenticated user ID: ${userId}`);

    // 3. Get or Create Stripe Customer ID
    let stripeCustomerId: string | null = null;

    log("Fetching profile from Supabase...");
    console.time("supabaseProfileFetch");
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    console.timeEnd("supabaseProfileFetch");

    if (profileError && profileError.code !== 'PGRST116') { // 'PGRST116' means no row found, which is okay here
      log(`Supabase profile fetch error: ${profileError.message} (Code: ${profileError.code})`);
      throw new Error('Could not retrieve user profile.');
    }

    if (profileData?.stripe_customer_id) {
      stripeCustomerId = profileData.stripe_customer_id;
      log(`Stripe customer ID found in DB: ${stripeCustomerId}`);
    } else {
      log('No Stripe customer ID found in DB. Creating new Stripe customer...');
      console.time("stripeCustomerCreate");
      try {
        const stripeCustomer = await stripe.customers.create({
          // Use email if available in session, otherwise name is fallback
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined, // Provide name if email isn't available
          metadata: {
            user_id: userId,
          },
        });
        stripeCustomerId = stripeCustomer.id;
        console.timeEnd("stripeCustomerCreate");
        log(`Stripe customer created: ${stripeCustomerId}`);

        // Update DB with new customer ID (fire and forget is risky, better to await)
        log("Updating Supabase profile with new Stripe customer ID...");
        console.time("supabaseProfileUpdate");
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', userId);
        console.timeEnd("supabaseProfileUpdate");

        if (updateError) {
          // Log the error but potentially continue? Or fail the request?
          // Failing is safer to ensure data consistency.
          log(`Supabase profile update error: ${updateError.message}`);
          throw new Error('Could not update user profile with Stripe customer ID.');
        }
        log("Supabase profile updated successfully.");

      } catch (error: any) {
        console.timeEnd("stripeCustomerCreate"); // End timer even on error
        log(`Error creating Stripe customer: ${error.message}`);
        throw new Error('Could not create Stripe customer.'); // Re-throw to be caught by outer catch
      }
    }

    // Double-check if we have a customer ID before proceeding
    if (!stripeCustomerId) {
      log('CRITICAL: Stripe customer ID is null after check/create logic.');
      throw new Error('Failed to retrieve or create Stripe customer ID.');
    }

    // 4. Create Stripe Checkout Session
    const successUrl = `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`; // Recommended pattern
    const cancelUrl = `${appUrl}/dashboard`; // Or a specific pricing/cancel page

    log(`Creating Stripe checkout session for customer: ${stripeCustomerId}...`);
    console.time("stripeCheckoutSessionCreate");
    let checkoutSession: Stripe.Checkout.Session;
    try {
       checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        // Consider adding metadata for linking back if needed
        // metadata: { user_id: userId }
        // Consider pre-filling email if desired
        // customer_email: session.user.email ?? undefined
      });
      console.timeEnd("stripeCheckoutSessionCreate");
      log(`Stripe checkout session created: ${checkoutSession.id}`);

    } catch (error: any) {
      console.timeEnd("stripeCheckoutSessionCreate"); // End timer even on error
      log(`Error creating Stripe checkout session: ${error.message}`);
      throw new Error('Could not create Stripe checkout session.'); // Re-throw
    }

    // 5. Return Session ID
    const handlerEndTime = Date.now();
    log(`--- create-checkout-session handler END (Total Time: ${handlerEndTime - handlerStartTime}ms) ---`);
    return res.status(200).json({ sessionId: checkoutSession.id });

  } catch (error: any) {
    // Ensure timers that might have been started are ended
    // (Note: timeEnd won't complain if the timer doesn't exist)
    console.timeEnd("getServerSession");
    console.timeEnd("supabaseProfileFetch");
    console.timeEnd("stripeCustomerCreate");
    console.timeEnd("supabaseProfileUpdate");
    console.timeEnd("stripeCheckoutSessionCreate");

    const handlerEndTime = Date.now();
    log(`!!! ERROR in handler: ${error.message} (Total Time: ${handlerEndTime - handlerStartTime}ms)`);
    console.error("Full error object:", error); // Log the full error for more details server-side
    return res.status(500).json({ error: { message: error.message || 'Internal server error creating checkout session' } });
  }
}

// Optional: Add config for max duration if on Pro/Enterprise
// export const config = {
//   maxDuration: 30, // seconds
// };
