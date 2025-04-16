import NextAuth, { AuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { SupabaseAdapter } from "@auth/supabase-adapter"

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
      // console.log("JWT Callback - Account:", account);      // See if account details (tokens) are present
      // console.log("JWT Callback - Initial Token:", token);
      
      // Initial user login
      if (account && user) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined; // Convert to milliseconds for consistency.
        token.id = user.id;
      }
      // console.log("JWT Callback - Returning Token:", token);
      return token;
    },
    async session({ session, user, token }) {
      // console.log(">>> SESSION CALLBACK START - Initial Session:", session);    // Log entry
      // console.log(">>> SESSION CALLBACK START - Token:", token);                // Log token received
      try {
        if (session.user && token.accessToken) {
          session.user.accessToken = token.accessToken as string;
        } else {
          // Log if expected data is missing even before erroring
          if (!session.user) console.warn("SESSION CALLBACK - session.user is missing");
          if (!token.accessToken) console.warn("SESSION CALLBACK - token.accessToken is missing");
        }
        if (user?.id) {
          session.user.id = user.id;
        } else if (token?.id) {
          session.user.id = token.id as string;
        }
        // NOTE: If you start storing posts, add JWT to session for RLS enforcement

        // console.log(">>> SESSION CALLBACK SUCCESS - Returning Session:", session);  // Log success *before* returning
        return session;

      } catch (error) {
        // console.error("!!! SESSION CALLBACK ERROR:", error); // Log the exact error
        // Decide what to return on error. Maybe the original session?
        // Or re-throw the error if you want NextAuth's default handling?
        // Returning the original session might mask the error client-side, but logs it.
        return session;
        // throw error; // Alternatively, re-throwing might provide more NextAuth debug info if debug mode is on.
      }
    }
  }, 
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
})

export default NextAuth(authOptions);
