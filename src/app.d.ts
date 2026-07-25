declare global {
  namespace App {
    interface Locals {
      authenticated: boolean;
      identity: string | null;
      sessionToken: string | null;
    }
  }
}

export {};
