import NextAuth, { Account, AuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { SupabaseAdapter } from "@auth/supabase-adapter"
import { createClient } from '@supabase/supabase-js';
import { AdapterAccount } from "next-auth/adapters";

const baseAdapter = SupabaseAdapter({
  url: process.env.SUPABASE_URL as string,
  secret: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
});


const customLinkAccount = async (account: AdapterAccount) => {
  console.log("--- CUSTOM LINK ACCOUNT TRIGGERED ---");
  console.log("CUSTOM LINK ACCOUNT: Received account:", account);

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL as string, 
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      db: { schema: "next_auth" },
    }
  );

  try {
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .upsert(account);
        
    if (error) {
      console.error("!!! CUSTOM LINK ACCOUNT ERROR: Failed to upsert account", error);
      throw error;
    } else {
      console.log("!!! CUSTOM LINK ACCOUNT SUCCESS: Upserted attempted for providerAccountId", account.providerAccountId);
    }
  } catch (error) {
    console.error("!!! CUSTOM LINK ACCOUNT CATASTROPHIC ERROR: Failed to link account", error);
    throw error;
  }
}

const adapter = {
  ...baseAdapter,
  linkAccount: customLinkAccount,
}

export const authOptions: AuthOptions = ({
  debug: true,
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
  adapter: adapter,
  session: {
    strategy: "database",
  },
  callbacks: {
    /*
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
    */
    async signIn({ user, account, profile }) { // Ensure 'account' is destructured
      console.log("--- SIGNIN CALLBACK TRIGGERED ---");
      // Check if the account object exists and is from the Twitter provider
      if (account?.provider === "twitter") {
        console.log("SIGNIN Callback: Received account from provider:", account);
        console.log("SIGNIN Callback: *** NEW Access Token from Provider ***:", account.access_token);
        console.log("SIGNIN Callback: *** NEW Refresh Token from Provider ***:", account.refresh_token);
        console.log("SIGNIN Callback: *** NEW Expires At from Provider (timestamp) ***:", account.expires_at);
        console.log("SIGNIN Callback: *** Profile from Provider ***:", profile); // Log profile too if useful
      // --- Attempt manual update of account tokens here ---
        // Check if essential fields for update are present
        if (account.access_token && account.providerAccountId && account.provider) {
          try {
            console.log(`SIGNIN Callback: Attempting to UPDATE tokens in DB for providerAccountId: ${account.providerAccountId}`);
            const supabase = createClient( // Initialize Supabase client
                process.env.SUPABASE_URL as string,
                process.env.SUPABASE_SERVICE_ROLE_KEY as string,
                { db: { schema: "next_auth" } }
            );

            // Prepare the data payload for the update, including all relevant token fields
            const updateData: any = { // Use 'any' or define a specific type
              access_token: account.access_token,
            };
            // Conditionally add other fields ONLY if they exist in the account object
            if (account.refresh_token) updateData.refresh_token = account.refresh_token;
            if (account.expires_at) updateData.expires_at = account.expires_at;
            if (account.token_type) updateData.token_type = account.token_type;
            if (account.scope) updateData.scope = account.scope;
            if (account.id_token) updateData.id_token = account.id_token;
            // Add any other fields from the 'accounts' table schema that might be in 'account'

            // Perform the update operation
            const { error } = await supabase
                .from('accounts')
                .update(updateData) // Update with the new token data
                .match({ // Use match to specify WHERE clause
                    provider: account.provider,
                    providerAccountId: account.providerAccountId
                 });

            if (error) {
              // Log the error but don't block sign-in because of it
              console.error("SIGNIN Callback: Error updating account tokens in DB:", error);
            } else {
              console.log("SIGNIN Callback: Successfully updated account tokens in DB via manual update.");
            }
          } catch (e) {
            console.error("SIGNIN Callback: Exception during manual token update:", e);
          }
        } else {
             console.log("SIGNIN Callback: Missing essential account info (token/ID/provider), skipping manual token update.");
        }
        // --- End manual update ---
      }
      // Always return true to allow sign-in to proceed
      return true;
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
