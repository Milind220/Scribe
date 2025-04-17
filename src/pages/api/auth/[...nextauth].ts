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
      console.log("JWT Callback - Account:", account);      // See if account details (tokens) are present
      console.log("JWT Callback - Initial Token:", token);
      console.log("JWT Callback - User:", user);
      
      // Initial user login 
      if (account && user) {
        token.id = user.id;
        // Session callback no longer relies on the locally stored JWT.
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined; // Convert to milliseconds for consistency.
      }
      console.log("JWT Callback - Returning Token:", token);
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

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

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
          session.user.accessToken = account.access_token;
        } else {
          console.warn(">>> SESSION CALLBACK WARNING: No access token found in database for user", user.id);
        }
      } catch (dbError) {
        console.error("!!! SESSION CALLBACK ERROR: Failed to fetch access token from database", dbError); // Log the exact error
      }
      // NOTE: If you start storing posts, add JWT to session for RLS enforcement

      console.log(">>> SESSION CALLBACK FINISHED - Returning Session:", session);  // Log success *before* returning
      return session;
    }
  }, 
})

export default NextAuth(authOptions);
