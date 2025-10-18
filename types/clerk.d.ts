export {};

declare global {
  interface UserPublicMetadata {
    isAdmin?: boolean;
  }

  interface CustomJwtSessionClaims {
    metadata: {
      isAdmin?: boolean;
    };
  }
}
