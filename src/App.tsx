import { useTransition, useState, useEffect, useCallback } from "react";
import {
  CreateMLCEngine,
  MLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from "@mlc-ai/web-llm";

const initProgressCallback = (progress: InitProgressReport) => {
  console.log("Model loading progress:", progress);
};

const modelId = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export default function App() {
  const [isPending, startTransition] = useTransition();
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [iaReply, setIaReply] = useState<string | null>("");
  const [inputText, setInputText] = useState<string>("");

  useEffect(() => {
    startTransition(async () => {
      const engine = await CreateMLCEngine(modelId, { initProgressCallback });
      setEngine(engine);
    });
  }, []);

  const classifyText = useCallback(
    (text: string) => {
      startTransition(async () => {
        if (!text.trim()) return;

        const messages: Array<ChatCompletionMessageParam> = [
          {
            role: "system",
            content: `Eres un clasificador de texto. Debes responder con un JSON válido que pertenezca a alguna de estas categorias:

            CATEGORÍAS:
            - "insulto_personal"
            - "insulto_racial"  
            - "insulto_sexista"
            - "lenguaje_ofensivo"
            - "amenaza"
            - "texto_neutral"

            FORMATO OBLIGATORIO - RESPONDE CON UN ARREGLO DE JSONS:
            [{
              "categoria": string,
              "confianza": number,
              "explicacion": string
            }]

            EJEMPLOS DE RESPUESTAS VÁLIDAS:
            {"categoria": "insulto_personal", "confianza": 0.80, "explicacion": "Contiene insultos directos a la persona"}
            {"categoria": "amenaza", "confianza": 0.95, "explicacion": "El mensaje contiene amenazas veladas"}

            REGLAS ESTRICTAS:
            1. NUNCA agregues texto antes o después del JSON
            2. La confianza debe ser un número decimal entre 0.0 y 1.0
            3. Los 3 campos son OBLIGATORIOS (categoria, confianza, explicacion)
            4. Usa solo las categorías listadas arriba
            5. Si tienes dudas, usa "texto_neutral"`,
          },
          {
            role: "user",
            content: `Clasifica este texto: "${text}"`,
          },
        ];

        const reply = await engine?.chat.completions.create({
          messages,
          stream: false,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 150,
        });

        const content = reply?.choices[0].message.content;
        console.log("Respuesta completa:", reply?.choices[0].message.content);

        if (content) {
          const jsonResponse = JSON.parse(content);
          setIaReply(JSON.stringify(jsonResponse, null, 4));
        } else
          setIaReply("No se pudo obtener una respuesta válida del modelo.");
      });
    },
    [engine]
  );

  return (
    <main className="flex flex-col justify-center items-center bg-slate-950 p-8 w-screen h-screen">
      <div className="space-y-6 w-full max-w-2xl">
        <h1 className="mb-8 font-bold text-slate-50 text-4xl text-center">
          Clasificador de insultos
        </h1>

        <div className="space-y-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.currentTarget.value)}
            placeholder="Escribe el texto que quieres clasificar..."
            className="bg-slate-800 p-4 border border-slate-600 rounded-lg w-full text-slate-50"
            rows={3}
          />

          <button
            onClick={() => classifyText(inputText)}
            disabled={isPending || !inputText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 p-3 rounded-lg w-full font-semibold text-white hover:cursor-pointer"
          >
            {isPending ? "Clasificando..." : "Clasificar Texto"}
          </button>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="mb-3 font-semibold text-slate-300 text-lg">
            Resultado:
          </h2>
          {isPending && <p className="text-slate-400">Analizando texto...</p>}
          {!isPending && iaReply && (
            <pre className="bg-slate-900 p-4 rounded overflow-auto text-slate-50 text-sm">
              {iaReply}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
