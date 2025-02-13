import OpenAI from 'openai';

export type ProxyOpenAIOptions = {
  openAIApiKey?: string;
};

export default class Proxy {
  private openAIClient: OpenAI;

  proxyOpenAI(options: ProxyOpenAIOptions, body: any) {
    // Initialize the OpenAI client only once
    if (!this.openAIClient) this.openAIClient = new OpenAI({ apiKey: options.openAIApiKey });

    return this.openAIClient.chat.completions.create(body);
  }
}
