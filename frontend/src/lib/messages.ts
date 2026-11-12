/** Human-readable messages for RPC result codes (shared by server & client). */
export const RESULT_MESSAGES: Record<string, string> = {
  ACCEPTED: "Attendance recorded.",
  INVALID_TOKEN: "Invalid QR code. It was not issued by AttendSure or has been replaced.",
  WRONG_EVENT: "This QR code belongs to a different event.",
  WRONG_ACTION: "Wrong QR type for the selected action (Time In vs Time Out).",
  REVOKED: "This QR code has been revoked. Ask the participant for their latest code.",
  ALREADY_USED: "This QR code has already been used.",
  EXPIRED: "This time-out QR code has expired. The participant must generate a new one.",
  REGISTRATION_CANCELLED: "This registration has been cancelled.",
  NOT_REGISTERED: "No registration found for this participant in the selected event.",
  OUTSIDE_WINDOW: "Scanning is outside the configured window for this action.",
  ALREADY_TIMED_IN: "Participant has already timed in.",
  ALREADY_TIMED_OUT: "Participant has already timed out.",
  NOT_TIMED_IN: "Participant has not timed in yet; time-out is not allowed.",
  EVENT_CANCELLED: "This event has been cancelled.",
  EVENT_NOT_AVAILABLE: "This event is not available.",
  ACTION_DISABLED: "This attendance action is disabled for the event.",
  REASON_REQUIRED: "A reason is required.",
  DUPLICATE_REGISTRATION: "This student ID is already registered for this event.",
  REGISTRATION_CLOSED: "Registration for this event is closed.",
  EVENT_FULL: "This event has reached its maximum capacity.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  INVALID_SEQUENCE: "Time-out cannot be earlier than time-in.",
};

export const message = (code: string) => RESULT_MESSAGES[code] ?? "Request could not be completed.";

export const ACTION_LABEL = { time_in: "Time In", time_out: "Time Out" } as const;
