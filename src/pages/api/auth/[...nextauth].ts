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
      console.log("Session Callback - Token:", token); // Check if token from JWT is received
      if (session.user) {
        session.user.accessToken = token.accessToken as string;
      } else {

      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
})