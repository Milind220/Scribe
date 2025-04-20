// This is the type of the response from the backend API route
export type StripeCheckoutSessionResponse = {
  sessionId: string;
} | { 
  error: {
    message: string;
  }
};
