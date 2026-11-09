// Gemini Multimodal Live API Client (WebSocket Bidirectional Streaming with Jarvis Tool Calling)

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiLiveCallbacks {
  onConnected?: () => void;
  onSetupComplete?: () => void;
  onAudioChunk?: (base64Audio: string) => void;
  onTextChunk?: (text: string) => void;
  onInputTranscript?: (text: string) => void;
  onToolCall?: (toolCall: ToolCall) => Promise<Record<string, unknown>>;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onError?: (err: Error | Event) => void;
  onClose?: (event: CloseEvent) => void;
  onLog?: (msg: string) => void;
}

export interface ConnectOptions {
  token: string;
  wsUrl?: string;
  model?: string;
  callbacks: GeminiLiveCallbacks;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private isSetupDone = false;
  private isIntentionalDisconnect = false;
  private callbacks: GeminiLiveCallbacks | null = null;
  private currentModel = 'models/gemini-3.8-live';

  connect(options: ConnectOptions): void {
    this.callbacks = options.callbacks;
    this.currentModel = options.model || 'models/gemini-3.8-live';
    this.isIntentionalDisconnect = false;
    this.isSetupDone = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    const rawWsUrl = options.wsUrl || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
    const separator = rawWsUrl.includes('?') ? '&' : '?';
    const finalUrl = `${rawWsUrl}${separator}key=${options.token}`;

    this.log(`Conectando a Gemini Live (${this.currentModel})...`);
    this.ws = new WebSocket(finalUrl);

    this.ws.onopen = () => {
      this.log('WebSocket conectado. Enviando configuración inicial...');
      this.callbacks?.onConnected?.();
      this.sendSetup();
    };

    this.ws.onmessage = async (event: MessageEvent) => {
      try {
        let data: unknown;
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
        } else if (event.data instanceof Blob) {
          const text = await event.data.text();
          data = JSON.parse(text);
        } else if (event.data instanceof ArrayBuffer) {
          const decoder = new TextDecoder();
          data = JSON.parse(decoder.decode(event.data));
        }

        if (!data || typeof data !== 'object') return;
        this.handleMessage(data as Record<string, unknown>);
      } catch (err) {
        console.error('[GeminiLive] Error procesando mensaje entrante:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[GeminiLive] Error de WebSocket:', err);
      this.callbacks?.onError?.(err);
    };

    this.ws.onclose = (event) => {
      this.log(`WebSocket cerrado. Código: ${event.code}, Razón: ${event.reason || 'ninguna'}`);
      this.callbacks?.onClose?.(event);
      this.ws = null;
      this.isSetupDone = false;
    };
  }

  private sendSetup(): void {
    const setupPayload = {
      setup: {
        model: this.currentModel,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text: `Eres Tomás, el compañero inteligente, presencia ejecutiva y segundo cerebro de Andrés en Jarvis. Eres directo, cercano, conciso (máximo 1 a 2 oraciones por intervención), cálido y sumamente eficiente. Hablas en español colombiano natural.

TIENES ACCESO DIRECTO AL BFF CLOUD DE JARVIS:
- registrar_gasto: Registra gastos con monto, concepto, categoría y medio de pago (Nequi, Bancolombia, Daviplata, Efectivo).
- registrar_ingreso: Registra ingresos de dinero con monto, fuente y medio de pago.
- consultar_finanzas: Consulta el saldo total, gastos de hoy y balance del mes.
- registrar_habito: Marca o desmarca hábitos de vida diaria.
- consultar_rutina: Consulta el bloque horario actual y qué sigue en el día.
- registrar_odometro: Actualiza los kilómetros de la moto y calcula el próximo cambio de aceite.
- record_learning: Registra preferencias, decisiones y aprendizajes personales en la memoria permanente.

REGLAS DE ORO DE SEGURIDAD (INVIOLABLES):
1. REGLA 1: NUNCA afirmes verbalmente que un gasto, ingreso o hábito fue guardado hasta que la herramienta correspondiente haya retornado respuesta exitosa (COMMITTED). Si la herramienta falla o retorna error, explica el fallo con honestidad y brevedad.
2. REGLA 2: Si consultas finanzas o rutina, di las cifras en pesos colombianos ($ COP) con total claridad y exactitud.
3. Respuestas orales cortas, al grano, sin rodeos ni preámbulos innecesarios.`,
            },
          ],
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'registrar_gasto',
                description: 'Registra un gasto financiero en la base de datos de Jarvis y actualiza el saldo de la cuenta.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    monto: { type: 'NUMBER', description: 'Monto o valor del gasto en pesos COP, ej. 25000' },
                    concepto: { type: 'STRING', description: 'Descripción o concepto del gasto, ej. Almuerzo, Gasolina' },
                    categoria: { type: 'STRING', description: 'Categoría opcional: Comida, Transporte, Gasolina, Entretenimiento, Hogar, Salud' },
                    medio_pago: { type: 'STRING', description: 'Medio de pago: Nequi, Bancolombia, Daviplata, Efectivo' },
                    fecha: { type: 'STRING', description: 'Fecha YYYY-MM-DD opcional (por defecto hoy)' },
                  },
                  required: ['monto', 'concepto'],
                },
              },
              {
                name: 'registrar_ingreso',
                description: 'Registra un ingreso de dinero en Jarvis y actualiza el saldo disponible.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    monto: { type: 'NUMBER', description: 'Monto del ingreso en pesos COP, ej. 50000' },
                    fuente: { type: 'STRING', description: 'Fuente o cliente del ingreso, ej. Didi, Papa, Sueldo' },
                    medio_pago: { type: 'STRING', description: 'Medio de pago: Nequi, Bancolombia, Daviplata, Efectivo' },
                    nota: { type: 'STRING', description: 'Nota adicional opcional' },
                    fecha: { type: 'STRING', description: 'Fecha YYYY-MM-DD opcional' },
                  },
                  required: ['monto', 'fuente'],
                },
              },
              {
                name: 'consultar_finanzas',
                description: 'Consulta el saldo acumulado en cuentas, gastos del día y balance del mes.',
                parameters: {
                  type: 'OBJECT',
                  properties: {},
                },
              },
              {
                name: 'registrar_habito',
                description: 'Marca o actualiza el estado de un hábito personal en Jarvis.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    nombre: { type: 'STRING', description: 'Nombre o coincidencia del hábito (ej. Gimnasio, Lectura, Agua)' },
                    completado: { type: 'BOOLEAN', description: 'True si se completó, False si no' },
                    fecha: { type: 'STRING', description: 'Fecha opcional YYYY-MM-DD' },
                  },
                  required: ['nombre'],
                },
              },
              {
                name: 'consultar_rutina',
                description: 'Consulta el bloque de rutina actual y los próximos bloques programados.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    hora: { type: 'STRING', description: 'Hora opcional en formato HH:MM (por defecto hora actual)' },
                  },
                },
              },
              {
                name: 'registrar_odometro',
                description: 'Registra el kilometraje actual del odómetro de la moto y verifica el próximo mantenimiento.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    kilometros: { type: 'NUMBER', description: 'Kilómetros leídos en el odómetro (ej. 11750)' },
                  },
                  required: ['kilometros'],
                },
              },
              {
                name: 'record_learning',
                description: 'Registra en la memoria permanente un aprendizaje, preferencia o decisión sobre Andrés.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    categoria: { type: 'STRING', description: 'Categoría: preferencia, rutina, finanzas, moto, personal' },
                    aprendizaje: { type: 'STRING', description: 'Hecho o lección aprendida en una frase' },
                    contexto: { type: 'STRING', description: 'Detalle o justificación contextual' },
                  },
                  required: ['categoria', 'aprendizaje'],
                },
              },
            ],
          },
        ],
      },
    };

    this.sendJson(setupPayload);
  }

  private async handleMessage(data: Record<string, unknown>): Promise<void> {
    // 1. Setup complete
    if (data.setupComplete) {
      this.isSetupDone = true;
      this.log('Setup completado por Gemini Live. Sesión lista.');
      this.callbacks?.onSetupComplete?.();
      return;
    }

    const serverContent = data.serverContent as Record<string, unknown> | undefined;

    // 2. Interrupted by user (barge-in)
    if (serverContent?.interrupted) {
      this.log('Interrupción detectada (barge-in). Deteniendo audio.');
      this.callbacks?.onInterrupted?.();
    }

    // 3. Audio & Text content from model
    if (serverContent?.modelTurn) {
      const modelTurn = serverContent.modelTurn as Record<string, unknown>;
      const parts = (modelTurn.parts as Array<Record<string, unknown>>) || [];

      for (const part of parts) {
        // Output audio chunks
        if (part.inlineData) {
          const inlineData = part.inlineData as { mimeType?: string; data?: string };
          if (inlineData.data && this.callbacks?.onAudioChunk) {
            this.callbacks.onAudioChunk(inlineData.data);
          }
        }
        // Output text transcripts
        if (part.text && this.callbacks?.onTextChunk) {
          this.callbacks.onTextChunk(part.text as string);
        }
      }
    }

    // 4. Input audio transcription (what user spoke)
    if (serverContent?.turnComplete) {
      this.callbacks?.onTurnComplete?.();
    }

    // 5. Tool Call dispatch
    const toolCall = data.toolCall as Record<string, unknown> | undefined;
    if (toolCall?.functionCalls) {
      const calls = toolCall.functionCalls as Array<{ id: string; name: string; args?: Record<string, unknown> }>;
      for (const call of calls) {
        this.log(`Tool call recibido: ${call.name} (id: ${call.id})`);
        let result: Record<string, unknown> = {};
        if (this.callbacks?.onToolCall) {
          try {
            result = await this.callbacks.onToolCall({
              id: call.id,
              name: call.name,
              args: call.args || {},
            });
          } catch (err) {
            result = { status: 'REJECTED', error: String(err) };
          }
        }
        this.sendToolResponse(call.id, call.name, result);
      }
    }
  }

  sendAudioChunk(base64Audio: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        ],
      },
    };
    this.sendJson(message);
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };
    this.sendJson(message);
  }

  sendToolResponse(id: string, name: string, output: Record<string, unknown>): void {
    const responsePayload = {
      toolResponse: {
        functionResponses: [
          {
            id,
            name,
            response: { output },
          },
        ],
      },
    };
    this.sendJson(responsePayload);
  }

  flushSilenceEndOfTurn(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // 640 muestras de silencio en PCM 16-bit (40ms) en base64
    const zeroSamples = new Int16Array(640);
    const uint8 = new Uint8Array(zeroSamples.buffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const silenceBase64 = btoa(binary);

    // Inyectar 10 paquetes de silencio (~400ms) para cerrar el turno en el VAD del servidor
    for (let i = 0; i < 10; i++) {
      this.sendAudioChunk(silenceBase64);
    }
  }

  disconnect(): void {
    this.isIntentionalDisconnect = true;
    if (this.ws) {
      try {
        this.ws.close(1000, 'User disconnected');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isSetupDone = false;
  }

  private sendJson(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[GeminiLive] Error enviando payload JSON:', err);
    }
  }

  private log(msg: string): void {
    console.info(`[GeminiLive] ${msg}`);
    this.callbacks?.onLog?.(msg);
  }
}
