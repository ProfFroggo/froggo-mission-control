/** Twilio stub — SMS/voice not used in local mode. */
class TwilioClient {
  messages = {
    create: async (_params: any): Promise<any> => ({ sid: 'stub' }),
  }
  calls = {
    create: async (_params: any): Promise<any> => ({ sid: 'stub' }),
  }
}

function twilio(_accountSid?: string, _authToken?: string): TwilioClient {
  return new TwilioClient()
}

export default twilio
