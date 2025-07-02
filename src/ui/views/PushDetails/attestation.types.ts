interface Question {
  label: string;
  checked: boolean;
}

interface Reviewer {
  username: string;
  gitAccount: string;
}

export interface AttestationData {
  reviewer: Reviewer;
  timestamp: string | Date;
  questions: Question[];
}

export interface AttestationViewProps {
  attestation: boolean;
  setAttestation: (value: boolean) => void;
  data: AttestationData;
}
