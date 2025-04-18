import NextAuth, { AuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { SupabaseAdapter } from "@auth/supabase-adapter"
import { createClient } from '@supabase/supabase-js';


export const authOptions: AuthOptions = ({
  providers: [
    TwitterProvider({
        clientId: process.env.TWITTER_CLIENT_ID as string,
        clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
        version: "2.0",
        authorization: {
          params: {
            scope: "tweet.read users.read tweet.write offline.access"
          }
        }
      }
    )
  ],
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL as string,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  }),
  session: {
    strategy: "database",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      console.log("--- JWT CALLBACK TRIGGERED (Sign In event only) ---")
      // Initial user login 
      if (account) {
        console.log("JWT Callback: Received account from provider:", account);
        console.log("JWT Callback: *** NEW Access Token from Provider ***:", account.access_token); // Log the fresh token

        token.id = user?.id;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined; // Convert to milliseconds for consistency.
      } else {
        console.log("JWT Callback: No account found. Not a sign in event.");
      }
      console.log("--- JWT CALLBACK FINISHED: Returning Token: ---", token);
      return token;
    },
    async session({ session, user }) {
      console.log(">>> SESSION CALLBACK START - Initial Session:", session);    // Log entry
      console.log(">>> SESSION CALLBACK START - User:", user);                  // Log user details

      if (user?.id) {
        session.user.id = user.id 
      } else {
        console.warn("SESSION CALLBACK - user.id is missing from adapter response");
      }

      // Fetch the access token from the database
      try {
        const supabaseUrl = process.env.SUPABASE_URL as string;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

        if (!supabaseUrl || !supabaseServiceRoleKey || !user.id) {
          console.error("!!! SESSION CALLBACK ERROR: Missing supabase credentials or user ID");
          // return session without attempting db query 
          return session;
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { db: { schema: "next_auth" }});

        const { data: account, error } = await supabaseAdmin
          .from("accounts")
          .select("access_token")
          .eq("userId", user.id)
          .eq("provider", "twitter")
          .maybeSingle();

        if (error) {
          console.error("!!! SESSION CALLBACK ERROR: Failed to fetch access token from database", error);
          // return session without attempting db query 
          return session;
        } else if (account?.access_token) {
          // Update session with the fetched access token
          console.log(">>> SESSION CALLBACK SUCCESS: Fetched access token from database");
          console.log(">>> SESSION CALLBACK: *** Existing Access Token from DB ***:", account.access_token);
          session.user.accessToken = account.access_token;

          // Check Twitter verification status
          try {
            const response = await fetch('https://api.twitter.com/2/users/me?user.fields=verified', {
              headers: {
                'Authorization': `Bearer ${account.access_token}`
              }
            });

            if (!response.ok) {
              throw new Error(`Twitter API error: ${response.status}`);
            }

            const userData = await response.json();
            session.user.isVerified = userData.data?.verified || false;
            console.log(">>> SESSION CALLBACK: User verification status:", session.user.isVerified);
          } catch (twitterError) {
            console.error("!!! SESSION CALLBACK ERROR: Failed to fetch Twitter verification status", twitterError);
            session.user.isVerified = false; // Default to false if we can't verify
          }
        } else {
          console.warn(">>> SESSION CALLBACK WARNING: No access token found in database for user", user.id);
          session.user.isVerified = false; // Default to false if no access token
        }
      } catch (dbError) {
        console.error("!!! SESSION CALLBACK ERROR: Failed to fetch access token from database", dbError);
        session.user.isVerified = false; // Default to false if database error
      }

      console.log(">>> SESSION CALLBACK FINISHED - Returning Session:", session);  // Log success *before* returning
      return session;
    }
  }, 
})

export default NextAuth(authOptions);
