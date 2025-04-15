// pages/api/post-twwet.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';

type TwitterPostResponse = {
  data: {
    id: string;
    text: string;
  };
  errors?: any[]; 
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TwitterPostResponse | { error: string }>,
) {
  // Step 1: Ensure that it's a POST request.
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Step 2. Get the session securely on the server side.
  const session = await getServerSession(req, res, authOptions);

  // Step 3. Check if the session is valid and contains the access token.
  if (!session || !session.user?.accessToken) {
    console.error('Session not found or access token missing');
    return res.status(401).json({ error: 'Unauthorized: Not logged in or token missing' });
  }

  // Step 4. Extract the access token from the session.
  const accessToken = session.user.accessToken;

  // Step 5. Extract the tweet text from the request body.
  const { text } = req.body;
  if (!text || text.trim().length === 0 || typeof(text) !== 'string') {
    console.error('Invalid tweet text:', text);
    return res.status(400).json({ error: 'Bad Message: Post needs to contain text' });
  }

  // Step 6. Validate the tweet length. For now we will just check if it is less than 280 characters.
  if (text.length > 280) {
    console.error('Tweet too long:', text.length);
    return res.status(400).json({ error: 'Bad Message: Tweet exceeds 280 characters' });
  }

  // Step 7. Make the API request to post the tweet.
  const twitterApiUrl = 'https://api.twitter.com/2/tweets';
  try {
    const response = await fetch(twitterApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    const data: TwitterPostResponse = await response.json();
    console.log('Twitter API response:', data);

    // Step 8. Handle the response from Twitter.
    if (!response.ok) {
      console.error('Twitter API error:', data);
      const errorMessage = data.errors?.[0]?.message || `Twitter API responded with status ${response.status}`;
      return res.status(response.status).json({ error: errorMessage });
    }

    // 9. Success
    console.log('Tweet posted successfully:', data.data);
    return res.status(201).json({ data: data.data }); // 201 Created is app

  } catch (error) {
    console.error('Error posting tweet:', error);
    // Handle potential network errors or fetch issues
    return res.status(500).json({ error: 'Internal Server Error: Unable to post tweet' });
  }
}

