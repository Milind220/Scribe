import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { StripePortalSessionResponse } from '@/types/stripe';
import { authOptions } from './auth/[...nextauth]';


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL || 'http://localhost:3000';


console.log("supabaseUrl", supabaseUrl);
console.log("supabaseServiceRoleKey", supabaseServiceRoleKey);
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not set');
}


if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}


const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey 
);


const stripe = new Stripe(stripeSecretKey as string);


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StripePortalSessionResponse>
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: { message: 'Unauthorized: Not logged in' } });
  }

  const userId = session.user.id;

  try {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error('Could not retrieve user profile.');
    }

    if (!profileData?.stripe_customer_id) {
      throw new Error('Stripe customer ID not found in DB.');
    }

    const stripeCustomerId = profileData.stripe_customer_id;

    const stripePortalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
    });

    return res.status(200).json({ url: stripePortalSession.url });
  } catch (error: any) {
    console.error('Error in stripe-portal-session handler:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error creating Stripe portal session' } });
  }
}
