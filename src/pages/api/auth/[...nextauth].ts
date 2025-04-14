import NextAuth from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";

export default NextAuth({
  providers: [
    TwitterProvider(
      {
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
  callbacks: {
    async jwt({ token, account }) {

      console.log("JWT Callback - Account:", account); // See if account details (tokens) are present
      console.log("JWT Callback - Initial Token:", token);
      if (account?.provider === "twitter") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at;
      }
      console.log("JWT Callback - Returning Token:", token);
      return token;
    },
    async session({ session, token }) {
      console.log(">>> SESSION CALLBACK START - Initial Session:", session); // Log entry
      console.log(">>> SESSION CALLBACK START - Token:", token);          // Log token received
      try {
        // Your existing logic to modify the session
        if (session.user && token.accessToken) {
          session.user.accessToken = token.accessToken as string;
        } else {
          // Log if expected data is missing even before erroring
          if (!session.user) console.warn("SESSION CALLBACK - session.user is missing");
          if (!token.accessToken) console.warn("SESSION CALLBACK - token.accessToken is missing");
        }
        // Add any other assignments you need here

        console.log(">>> SESSION CALLBACK SUCCESS - Returning Session:", session); // Log success *before* returning
        return session;

      } catch (error) {
        console.error("!!! SESSION CALLBACK ERROR:", error); // Log the exact error
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
