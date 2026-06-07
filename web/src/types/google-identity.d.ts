interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityButtonConfiguration {
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large" | "medium" | "small";
  width?: number;
}

interface GoogleIdentityInitializeOptions {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
}

interface GoogleIdentity {
  initialize(options: GoogleIdentityInitializeOptions): void;
  renderButton(
    element: HTMLElement,
    options: GoogleIdentityButtonConfiguration
  ): void;
}

interface Window {
  google?: {
    accounts: {
      id: GoogleIdentity;
    };
  };
}
