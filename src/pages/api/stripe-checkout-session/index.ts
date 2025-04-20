import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { authOptions } from './auth/[...nextauth]';
import { StripeCheckoutSessionResponse } from '@/types/checkout';
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL || 'http://localhost:3000';


if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not set');
}


if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}


const supabaseAdmin = createClient(
  supabaseUrl as string,
  supabaseServiceRoleKey as string
);


const stripe = new Stripe(stripeSecretKey as string);
const priceId = 'price_1RFW272U8Bk8KQCEzbgQK5bh';


export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<StripeCheckoutSessionResponse>
) {
  // If not POST, return 405 Method Not Allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  // Check if user is logged in - unauthenticated users can't create checkout sessions
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: { message: 'Unauthorized: Not logged in' } });
  }

  // Check for existing subscriber ID in db 
  try {
    let stripeCustomerId: string | null = null;
    
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
      console.error('Supabase profile fetch error:', profileError);
      throw new Error('Could not retrieve user profile.');
    }

    if (profileData?.stripe_customer_id) {
      stripeCustomerId = profileData.stripe_customer_id;
      console.log('Stripe customer ID found in DB:', stripeCustomerId);
    } else {
      console.log('No Stripe customer ID found in DB. Creating new customer...');
      try {
        const stripeCustomer = await stripe.customers.create({
          name: session.user.name as string,
          metadata: {
            user_id: userId,
          },
        });
        stripeCustomerId = stripeCustomer.id;
        console.log('Stripe customer created:', stripeCustomerId);

        // Update DB with new customer ID
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', userId);

        if (updateError) {
          console.error('Supabase update error:', updateError);
          // TODO: Would be better to log but continue for now. Can always address this later.
          throw new Error('Could not update user profile with Stripe customer ID.');
        }
      } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw new Error('Could not create Stripe customer.');
      }

      if (!stripeCustomerId) {
        throw new Error('CRITICAL: Stripe customer ID not found in DB or created.');
      }

      const successUrl = `${appUrl}/dashboard`;
      const cancelUrl = `${appUrl}/dashboard`;

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        line_items: [{
          price: priceId, 
          quantity: 1
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        // NOTE: maybe add email to the session so that you can use it here as well - potentially for emailing confirmation.
      })

      return res.status(200).json({ sessionId: checkoutSession.id });
    }
  } catch (error: any) {
    console.error('Error in create-checkout-session handler:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error creating checkout session' } });
  }
}