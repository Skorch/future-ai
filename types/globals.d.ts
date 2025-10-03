export {};

declare global {
  interface CustomJwtSessionClaims {
    agentDomain?: string;
  }
}
