// pages/api/stripe/create-portal-session.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from './auth/[...nextauth]'; // Adjust path if needed

// --- Environment Variables ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL || 'http://localhost:3000';

// --- Environment Variable Checks ---
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('CRITICAL: Supabase environment variables are not set');
  // Don't throw here in production for API routes, return error instead
  // throw new Error('Server configuration error.');
}
if (!stripeSecretKey) {
  console.error('CRITICAL: STRIPE_SECRET_KEY environment variable is not set');
  // throw new Error('Server configuration error.');
}
if (!appUrl) {
    console.warn('WARN: APP_URL environment variable is not set. Using default.');
}

// --- Client Initializations ---
// Check if keys exist before creating clients to prevent runtime errors if checks above are commented out
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-03-31.basil', // Use your desired API version
      timeout: 30000,
    })
  : null;

// --- Helper for Timestamped Logging ---
const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// --- API Route Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ url: string } | { error: { message: string } }>
) {
  const handlerStartTime = Date.now();
  log("--- create-portal-session handler START ---");

  // Check if clients initialized correctly
  if (!supabaseAdmin || !stripe) {
      log('CRITICAL: Server configuration error (Supabase or Stripe client failed to initialize).');
      return res.status(500).json({ error: { message: 'Server configuration error.' } });
  }

  // 1. Check HTTP Method
  if (req.method !== 'POST') { // Typically POST to create a session
    res.setHeader('Allow', 'POST');
    log(`Method Not Allowed: ${req.method}`);
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  try {
    // 2. Check Authentication
    log("Checking user session...");
    console.time("getServerSessionPortal");
    const session = await getServerSession(req, res, authOptions);
    console.timeEnd("getServerSessionPortal");
    const userId = session?.user?.id;

    if (!userId) {
      log("Unauthorized: User not logged in.");
      return res.status(401).json({ error: { message: 'Unauthorized: Not logged in' } });
    }
    log(`Authenticated user ID: ${userId}`);

    // 3. Get Stripe Customer ID from your Database
    log("Fetching profile from Supabase...");
    console.time("supabaseProfileFetchPortal");
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles') // Use your actual table name
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();
    console.timeEnd("supabaseProfileFetchPortal");

    if (profileError && profileError.code !== 'PGRST116') { // Allow 'PGRST116' (not found)
      log(`Supabase profile fetch error: ${profileError.message} (Code: ${profileError.code})`);
      throw new Error('Could not retrieve user profile.');
    }

    const stripeCustomerId = profileData?.stripe_customer_id;

    if (!stripeCustomerId) {
      log(`No Stripe customer ID found for user ID: ${userId}. Cannot create portal session.`);
      // This user might exist but never completed a checkout or had an issue saving the ID.
      // They can't manage a subscription they don't seem to have linked in your DB.
      return res.status(400).json({ error: { message: 'No active subscription found for this account.' } });
    }
    log(`Found Stripe customer ID: ${stripeCustomerId}`);


    // 4. Create Stripe Billing Portal Session
    const returnUrl = `${appUrl}/dashboard`; // URL user returns to after managing subscription

    log(`Creating Stripe Billing Portal session for customer: ${stripeCustomerId}...`);
    console.time("stripePortalSessionCreate");
    let portalSession: Stripe.BillingPortal.Session;
    try {
         portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
         });
        console.timeEnd("stripePortalSessionCreate");
        log(`Stripe Billing Portal session created: ${portalSession.id}`);

    } catch (error: any) {
        console.timeEnd("stripePortalSessionCreate"); // End timer even on error
        log(`Error creating Stripe Billing Portal session: ${error.message}`);
        // Provide more context if it's a Stripe specific error
        if (error.type === 'StripeInvalidRequestError') {
             log(`Stripe Error Details: ${JSON.stringify(error.raw)}`);
        }
        throw new Error('Could not create Stripe management session.'); // Re-throw
    }


    // 5. Return Portal Session URL
    const handlerEndTime = Date.now();
    log(`--- create-portal-session handler END (Total Time: ${handlerEndTime - handlerStartTime}ms) ---`);
    return res.status(200).json({ url: portalSession.url }); // Send the URL back to the client

  } catch (error: any) {
    // Ensure potential timers are ended
    console.timeEnd("getServerSessionPortal");
    console.timeEnd("supabaseProfileFetchPortal");
    console.timeEnd("stripePortalSessionCreate");

    const handlerEndTime = Date.now();
    log(`!!! ERROR in handler: ${error.message} (Total Time: ${handlerEndTime - handlerStartTime}ms)`);
    console.error("Full error object:", error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error creating portal session' } });
  }
}