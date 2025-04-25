// pages/api/post-twwet.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';


type TwitterPostResponse = {
  data: {
    id: string;
    text: string;
  };
  errors?: any[]; 
  message?: string;
};

type ErrorResponse = {
  error: string;
  reason?: string;
  code?: number;
  type?: string;
};


type ProfileData = {
  id: string;
  plan: string;
  free_posts_used: number;
  free_posts_limit: number;
  monthly_posts_used: number;
  monthly_posts_limit: number;
  last_post_reset: string | null;   // ISO 8601
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TwitterPostResponse | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // --- 1. Get Session (Includes User Id if successful) ---
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  const accessToken = session?.user?.accessToken;

  // --- Check if User is Logged In ---
  if (!session || !userId) {
    console.error('Unauthorized: Not logged in. Session or User Id missing.');
    return res.status(401).json({ error: 'Unauthorized: Not logged in' });
  }

  // --- 2. Get Profile Data and Check Limits ---
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials missing on server');
    return res.status(500).json({ error: 'Internal Server Error: Configuration missing' });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  let currentMonthlyUsed = 0;
  let needsMonthlyReset = false;

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, plan, free_posts_used, monthly_posts_used, monthly_post_limit, last_post_reset')  // Nice to be explicit about the fields we are fetching
    .eq('id', userId)
    .single();  // We know there will only be one profile per user

  if (profileError || !profileData) {
    console.error(`Error fetching profile data for ${userId}:`, profileError);
    return res.status(500).json({ error: 'Internal Server Error: Unable to fetch profile data' });
  }

  // Check for monthly reset
  const now = new Date();
  const lastResetDate = profileData.last_post_reset ? new Date(profileData.last_post_reset) : null; 

  if (!lastResetDate || (lastResetDate.getUTCFullYear() < now.getUTCFullYear()) || (lastResetDate.getUTCMonth() < now.getUTCMonth())) {
    needsMonthlyReset = true;
    currentMonthlyUsed = 0; // Use 0 for checks below if reset is needed
    console.log(`User ${userId} needs monthly counter reset.`);
    // We will perform the actual reset in the DB *after* a successful post, or handle it via a scheduled function later
  } else {
    currentMonthlyUsed = profileData.monthly_posts_used;
  }

  // Apply limits
  let canPost = false;
  let incrementFree = false;
  let incrementMonthly = false;

  if (profileData.free_posts_used < 2) { // Perhaps this should be a config value? and not hardcoded.
    // User has not reached their free limit yet
    canPost = true;
    incrementFree = true;  // Increment the free counter
    incrementMonthly = true;  // Increment the monthly counter
    console.log(`User ${userId} using monthly post (${currentMonthlyUsed + 1} of ${profileData.monthly_post_limit})`);
  } else if (currentMonthlyUsed < profileData.monthly_post_limit) {
    canPost = true;
    incrementFree = false;
    incrementMonthly = true;
    console.log(`User ${userId} using monthly post (${currentMonthlyUsed + 1} of ${profileData.monthly_post_limit})`);
  }

  if (!canPost) {
    console.log(`User ${userId} has reached their limit.`);
    return res.status(429).json({ error: 'Too Many Requests', reason: 'Posting limit reached' });
  }


  // --- 3. Extract the tweet text from the request body. ---
  const { text } = req.body;
  if (!text || text.trim().length === 0 || typeof(text) !== 'string') {
    console.error('Invalid tweet text:', text);
    return res.status(400).json({ error: 'Bad Message: Post needs to contain text' });
  }

  // Validate the tweet length.
  if (text.length > 280) {
    console.error('Tweet too long:', text.length);
    return res.status(400).json({ error: 'Bad Message: Tweet exceeds 280 characters' });
  }

  // --- 4. Make the API request to post the tweet. ---
  const twitterApiUrl = 'https://api.twitter.com/2/tweets';
  let twitterResponseData: TwitterPostResponse | null = null;

  try {
    const response = await fetch(twitterApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    twitterResponseData = await response.json();
    console.log('Twitter API response:', twitterResponseData);

    // Handle the response from Twitter.
    if (!response.ok) {
      console.error('Twitter API error:', twitterResponseData);
      
      // Extract detailed error information
      const twitterError = twitterResponseData?.errors?.[0];
      const errorMessage = twitterError?.message || `Twitter API responded with status ${response.status}`;
      const errorCode = twitterError?.code;
      const errorType = twitterError?.type;

      // Map common Twitter error codes to appropriate HTTP status codes
      let statusCode = response.status;
      if (errorCode === 185) { // Rate limit exceeded
        statusCode = 429;
      } else if (errorCode === 186) { // Tweet too long
        statusCode = 400;
      } else if (errorCode === 187) { // Duplicate tweet
        statusCode = 409;
      }

      return res.status(statusCode).json({ 
        error: errorMessage,
        code: errorCode,
        type: errorType
      });
    }

    if (!twitterResponseData?.data?.id) {
      console.error('Invalid response from Twitter:', twitterResponseData);
      return res.status(500).json({ 
        error: 'Invalid response from Twitter API'
      });
    }

    // --- 5. Update the profile limit in the database ---
    console.log(`Posted tweet successfully for user ${userId}. Updating profile limits...`);
    const updatePayload: {
      monthly_posts_used?: number;
      free_posts_used?: number;
      last_post_reset?: string;
    } = {};

    if (needsMonthlyReset) {
      updatePayload.monthly_posts_used = incrementMonthly ? 1 : 0;
      updatePayload.last_post_reset = now.toISOString();
      console.log(`Resetting monthly count for user ${userId}. New count: ${updatePayload.monthly_posts_used}`);
    } else if (incrementMonthly) {
      updatePayload.monthly_posts_used = currentMonthlyUsed + 1;
      console.log(`Incrementing monthly count for user ${userId}. New count: ${updatePayload.monthly_posts_used}`);
    }

    if (incrementFree) {
      updatePayload.free_posts_used = profileData.free_posts_used + 1;
      console.log(`Incrementing free count for user ${userId}. New count: ${updatePayload.free_posts_used}`);
    }

    // Only update if there are any changes to make
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);
    
      if (updateError) {
        // Log this CRITICAL ERROR but the tweet *did* succeeed.
        // If this happens often consider a scheduled function to check and reset limits, or add a retry queue.
        console.error(`CRITICAL ERROR: Unable to update profile limits for ${userId} after successful tweet:`, updateError);
      } else {
        console.log(`Updated profile limits for ${userId} after successful tweet.`);
      }
    } else {
      console.log(`No updates needed for ${userId} after successful tweet.`);
    }
    
    // --- 6 Success ---
    console.log('Tweet posted successfully:', twitterResponseData.data);
    return res.status(201).json({ 
      data: twitterResponseData.data,
      message: 'Tweet posted successfully'
    });

  } catch (error: any) {
    console.error('Error posting tweet:', error);
    
    // Handle fetch/network errors
    const errorMessage = error instanceof Error ? error.message : 'Unable to post tweet';
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: errorMessage
    });
  }
}