import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { authOptions } from './auth/[...nextauth]';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const priceId = 'price_1RFW272U8Bk8KQCEzbgQK5bh';
const appUrl = process.env.APP_URL;


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // If not POST, return 405 Method Not Allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check if user is logged in - unauthenticated users can't create checkout sessions
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Not logged in' });
  }
  
  try {
    const successUrl = `${appUrl}/dashboard`;
    const cancelUrl = `${appUrl}/dashboard`;

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price: priceId, 
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // NOTE: maybe add email to the session so that you can use it here as well - potentially for emailing confirmation.
    })

    // Now that the session is created, return the session ID to the client
    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Error creating checkout session' });
  }


  
  
  
}